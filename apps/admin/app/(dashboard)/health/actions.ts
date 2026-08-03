"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";

import { requireStaff } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function setDiagnosticStatusAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const fingerprint = String(formData.get("fingerprint") || "").slice(0, 120);
  const status = ["open", "resolved", "ignored"].includes(String(formData.get("status")))
    ? String(formData.get("status"))
    : "resolved";
  if (!fingerprint) return;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase!
    .from("client_errors")
    .update({
      status,
      resolved_at: status === "open" ? null : new Date().toISOString(),
      resolved_by: status === "open" ? null : session.user.id,
    })
    .eq("fingerprint", fingerprint);
  if (!error) {
    await supabase!.from("admin_audit_log").insert({
      actor_id: session.user.id,
      action: `diagnostic.${status}`,
      entity_type: "client_error",
      metadata: { fingerprint },
    });
  }
  revalidatePath("/health");
}
