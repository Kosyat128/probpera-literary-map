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
};

export const getStaffSession = cache(async (): Promise<StaffSession> => {
  if (!isSupabaseConfigured) {
    return { configured: false, user: null, role: null };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { configured: false, user: null, role: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { configured: true, user: null, role: null };
  }

  const { data: membership } = await supabase
    .from("staff_memberships")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    configured: true,
    user: {
      id: user.id,
      email: user.email || "",
    },
    role: (membership?.role as StaffRole | undefined) || null,
  };
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
