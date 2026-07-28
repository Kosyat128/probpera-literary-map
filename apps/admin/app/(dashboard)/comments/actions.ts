"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function moderateCommentAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const id = String(formData.get("id") || "");
  const status = formData.get("status") === "published" ? "published" : "hidden";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase!
    .from("article_comments")
    .update({ status })
    .eq("id", id);
  if (!error) {
    await supabase!.from("admin_audit_log").insert({
      actor_id: session.user.id,
      action: `comment.${status}`,
      entity_type: "comment",
      entity_id: id,
    });
  }
  revalidatePath("/comments");
}
