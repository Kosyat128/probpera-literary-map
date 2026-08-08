"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const redirectSchema = z.object({
  sourcePath: z.string().trim().startsWith("/").max(500),
  destinationPath: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => value.startsWith("/") || value.startsWith("https://"),
      "Новый адрес должен начинаться с / или https://"
    ),
  statusCode: z.coerce.number().refine((value) => [301, 302, 307, 308].includes(value)),
});

export async function createRedirectAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const parsed = redirectSchema.safeParse({
    sourcePath: formData.get("source_path"),
    destinationPath: formData.get("destination_path"),
    statusCode: formData.get("status_code") || 301,
  });
  if (!parsed.success || parsed.data.sourcePath === parsed.data.destinationPath) {
    redirect(
      `/seo?error=${encodeURIComponent(
        parsed.success
          ? "Старый и новый адреса не должны совпадать"
          : parsed.error.issues[0]?.message || "Проверьте адреса"
      )}`
    );
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/seo?error=База данных не подключена");
  const { data, error } = await supabase
    .from("redirects")
    .insert({
      source_path: parsed.data.sourcePath.replace(/\/+$/u, "") || "/",
      destination_path: parsed.data.destinationPath,
      status_code: parsed.data.statusCode,
      is_active: true,
      created_by: session.user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    redirect(
      `/seo?error=${encodeURIComponent(error?.message || "Переадресация не создана")}`
    );
  }
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "redirect.created",
    entity_type: "redirect",
    entity_id: data.id,
    metadata: {
      sourcePath: parsed.data.sourcePath,
      destinationPath: parsed.data.destinationPath,
    },
  });
  await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "redirect",
    entityId: data.id,
    reason: "redirect.created",
  });
  revalidatePath("/seo");
  redirect("/seo?saved=1");
}

export async function deleteRedirectAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/seo?error=Некорректная переадресация");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/seo?error=База данных не подключена");
  const { error } = await supabase.from("redirects").delete().eq("id", id.data);
  if (error) redirect(`/seo?error=${encodeURIComponent(error.message)}`);
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "redirect.deleted",
    entity_type: "redirect",
    entity_id: id.data,
  });
  await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "redirect",
    entityId: id.data,
    reason: "redirect.deleted",
  });
  revalidatePath("/seo");
  redirect("/seo?deleted=1");
}
