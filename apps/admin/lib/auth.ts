import { cache } from "react";

import {
  shouldRequireStaffMfa,
  type AdminAuthenticatorAssuranceLevel,
} from "@/lib/admin-mfa-policy";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authServiceError, logAuthFailure } from "@/lib/auth-service-error";

export type StaffRole = "owner" | "admin" | "editor";

export type StaffMfaState = {
  currentLevel: AdminAuthenticatorAssuranceLevel;
  nextLevel: AdminAuthenticatorAssuranceLevel;
  required: boolean;
  checkError?: string;
};

export type StaffSession = {
  configured: boolean;
  user: {
    id: string;
    email: string;
  } | null;
  role: StaffRole | null;
  mfa: StaffMfaState;
  membershipError?: string;
  authError?: string;
};

const emptyMfaState = (): StaffMfaState => ({
  currentLevel: null,
  nextLevel: null,
  required: false,
});

export const getStaffSession = cache(async (): Promise<StaffSession> => {
  if (!isSupabaseConfigured) {
    return {
      configured: false,
      user: null,
      role: null,
      mfa: emptyMfaState(),
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      configured: false,
      user: null,
      role: null,
      mfa: emptyMfaState(),
    };
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      if (userError.name !== "AuthSessionMissingError") logAuthFailure("session_check", userError);
      return {
        configured: true,
        user: null,
        role: null,
        mfa: emptyMfaState(),
        authError: authServiceError(userError) || undefined,
      };
    }

    if (!user) {
      return {
        configured: true,
        user: null,
        role: null,
        mfa: emptyMfaState(),
      };
    }

    const { data: membership, error: membershipError } = await supabase
      .from("staff_memberships")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      logAuthFailure("membership_check", membershipError);
      return {
        configured: true,
        user: {
          id: user.id,
          email: user.email || "",
        },
        role: null,
        mfa: emptyMfaState(),
        membershipError: authServiceError(membershipError) || "Не удалось проверить редакционную роль. Повторите попытку позже.",
        authError: authServiceError(membershipError) || undefined,
      };
    }

    const role = (membership?.role as StaffRole | undefined) || null;
    let mfa = emptyMfaState();
    try {
      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;

      const currentLevel =
        (assurance?.currentLevel as AdminAuthenticatorAssuranceLevel) || null;
      const nextLevel =
        (assurance?.nextLevel as AdminAuthenticatorAssuranceLevel) || null;
      if (!["aal1", "aal2"].includes(currentLevel || "") || !["aal1", "aal2"].includes(nextLevel || "")) {
        throw new Error("mfa_assurance_unavailable");
      }
      mfa = {
        currentLevel,
        nextLevel,
        required: shouldRequireStaffMfa({
          hasStaffRole: Boolean(role),
          currentLevel,
          nextLevel,
        }),
      };
    } catch (error) {
      const message = authServiceError(error) || "Не удалось проверить защиту учётной записи. Повторите попытку позже.";
      logAuthFailure("mfa_assurance_check", error);
      mfa = {
        ...emptyMfaState(),
        checkError: message,
      };
    }

    return {
      configured: true,
      user: {
        id: user.id,
        email: user.email || "",
      },
      role,
      mfa,
    };
  } catch (error) {
    logAuthFailure("session_check", error);
    return {
      configured: true,
      user: null,
      role: null,
      mfa: emptyMfaState(),
      membershipError:
        "Не удалось проверить редакционную роль. Повторите попытку позже.",
      authError: authServiceError(error) || "Не удалось проверить сессию. Повторите попытку позже.",
    };
  }
});

export async function requireStaff(
  allowedRoles: StaffRole[] = ["owner", "admin", "editor"]
) {
  const session = await getStaffSession();
  if (
    !session.user ||
    !session.role ||
    session.mfa.required ||
    session.mfa.checkError ||
    !allowedRoles.includes(session.role)
  ) {
    return null;
  }
  return session;
}
