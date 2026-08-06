import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StaffRole = "owner" | "admin" | "editor";

export type StaffSession = {
  configured: boolean;
  user: {
    id: string;
    email: string;
  } | null;
  role: StaffRole | null;
  membershipError?: string;
};

export const getStaffSession = cache(async (): Promise<StaffSession> => {
  if (!isSupabaseConfigured) {
    return { configured: false, user: null, role: null };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { configured: false, user: null, role: null };
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Admin auth: user session check failed", userError);
      return { configured: true, user: null, role: null };
    }

    if (!user) {
      return { configured: true, user: null, role: null };
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
        membershipError: membershipError.message,
      };
    }

    return {
      configured: true,
      user: {
        id: user.id,
        email: user.email || "",
      },
      role: (membership?.role as StaffRole | undefined) || null,
    };
  } catch (error) {
    console.error("Admin auth: unexpected session check error", error);
    return {
      configured: true,
      user: null,
      role: null,
      membershipError:
        error instanceof Error ? error.message : "Ошибка инициализации сессии",
    };
  }
});

export async function requireStaff(
  allowedRoles: StaffRole[] = ["owner", "admin", "editor"]
) {
  const session = await getStaffSession();
  if (!session.user || !session.role || !allowedRoles.includes(session.role)) {
    return null;
  }
  return session;
}
