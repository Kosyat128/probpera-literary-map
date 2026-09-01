"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { loadEditorialCatalog } from "@/lib/editorial-catalog";
import { redirect } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function textField(fields: Record<string, unknown>, key: string) {
  const value = fields[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function synchronizeEditorialReferencesAction() {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/data-studio?error=forbidden");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/data-studio?error=database");

  const catalog = await loadEditorialCatalog();
  const countries = catalog.countries.map((country) => ({
    id: country.id,
    nameRu: country.label,
    nameEn: textField(country.fields, "nameEn"),
    isoCode: textField(country.fields, "code").toUpperCase(),
  }));
  const writers = catalog.countries.flatMap((country) =>
    country.writers.map((writer) => ({
      countryId: country.id,
      id: writer.id,
      nameRu: writer.label,
      nameEn: textField(writer.fields, "fullName"),
    }))
  );
  const { error } = await supabase.rpc("sync_editorial_reference_catalog", {
    p_countries: countries,
    p_writers: writers,
  });
  if (error) redirect("/data-studio?error=sync");

  revalidatePath("/data-studio");
  revalidatePath("/editorial-database");
  revalidatePath("/library");
  redirect("/data-studio?synchronized=1");
}
