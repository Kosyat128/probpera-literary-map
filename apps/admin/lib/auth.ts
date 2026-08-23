import { cache } from "react";

import {
  shouldRequireStaffMfa,
  type AdminAuthenticatorAssuranceLevel,
} from "@/lib/admin-mfa-policy";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
      console.error("Admin auth: user session check failed", userError);
      return {
        configured: true,
        user: null,
        role: null,
        mfa: emptyMfaState(),
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
      console.error("Admin auth: role check failed", membershipError);
      return {
        configured: true,
        user: {
          id: user.id,
          email: user.email || "",
        },
        role: null,
        mfa: emptyMfaState(),
        membershipError: membershipError.message,
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
      const message =
        error instanceof Error ? error.message : "Не удалось проверить MFA";
      console.error("Admin auth: MFA assurance check failed", error);
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
    console.error("Admin auth: unexpected session check error", error);
    return {
      configured: true,
      user: null,
      role: null,
      mfa: emptyMfaState(),
      membershipError:
        error instanceof Error ? error.message : "Ошибка инициализации сессии",
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
    !allowedRoles.includes(session.role)
  ) {
    return null;
  }
  return session;
}
