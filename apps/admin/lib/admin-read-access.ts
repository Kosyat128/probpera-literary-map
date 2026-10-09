import { getStaffSession } from "@/lib/auth";
import { redirect } from "@/lib/navigation";

// Layouts can be cached or render in parallel with their children. Private reads
// must check the current server session before constructing any entity query.
export async function requireStaffRead() {
  const session = await getStaffSession();
  if (!session.configured) return null;
  if (!session.user) redirect("/login");
  if (session.mfa.checkError) redirect(`/login?error=${encodeURIComponent(session.mfa.checkError)}`);
  if (session.mfa.required) redirect("/mfa");
  if (
    session.authError ||
    session.membershipError ||
    !session.role ||
    !["owner", "admin", "editor"].includes(session.role)
  ) return null;
  return session;
}
