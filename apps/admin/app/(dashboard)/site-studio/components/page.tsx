import { getStaffSession } from "@/lib/auth";

import ComponentStudio from "./ComponentStudio";

export const metadata = { title: "Компоненты · Site Studio" };

export default async function SiteStudioComponentsPage() {
  const session = await getStaffSession();
  return <ComponentStudio role={session.role || "editor"} />;
}
