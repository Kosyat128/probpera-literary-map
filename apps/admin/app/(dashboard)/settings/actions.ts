"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const memberSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(["owner", "admin", "editor"]),
});

const staffErrorMessages: Record<string, string> = {
  STAFF_LAST_OWNER: "Нельзя удалить или понизить последнего владельца",
  STAFF_MEMBER_NOT_FOUND: "Участник команды не найден",
  STAFF_OWNER_REQUIRED: "Требуются права владельца",
  STAFF_SELF_REMOVE_FORBIDDEN:
    "Для удаления собственного доступа используйте другую учётную запись владельца",
  STAFF_USER_NOT_REGISTERED:
    "Пользователь должен сначала зарегистрироваться на сайте",
};

function staffErrorMessage(message?: string) {
  if (!message) return "Не удалось изменить состав команды";
  return staffErrorMessages[message] ?? "Не удалось изменить состав команды";
}

export async function saveStaffMemberAction(formData: FormData) {
  const session = await requireStaff(["owner"]);
  if (!session?.user) redirect("/login");
  const parsed = memberSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/settings?error=Проверьте email и роль");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/settings?error=База данных не подключена");
  const { data: userId, error } = await supabase.rpc(
    "owner_set_staff_member",
    {
      p_email: parsed.data.email,
      p_role: parsed.data.role,
    }
  );
  if (error || !userId) {
    redirect(`/settings?error=${encodeURIComponent(staffErrorMessage(error?.message))}`);
  }
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function removeStaffMemberAction(formData: FormData) {
  const session = await requireStaff(["owner"]);
  if (!session?.user) redirect("/login");
  const userId = z.string().uuid().safeParse(formData.get("user_id"));
  if (!userId.success) redirect("/settings?error=Некорректный пользователь");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/settings?error=База данных не подключена");
  const { error } = await supabase.rpc("owner_remove_staff_member", {
    p_user_id: userId.data,
  });
  if (error) {
    redirect(`/settings?error=${encodeURIComponent(staffErrorMessage(error.message))}`);
  }
  revalidatePath("/settings");
  redirect("/settings?deleted=1");
}
