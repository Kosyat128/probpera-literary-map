import { NextResponse } from "next/server";

import {
  analyticsReportCsv,
  normalizeAnalyticsReport,
  resolveAnalyticsRange,
} from "@/lib/analytics-report";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "База данных не подключена." },
      { status: 503 }
    );
  }
  const url = new URL(request.url);
  const range = resolveAnalyticsRange(url.searchParams.get("period"));
  const { data, error } = await supabase.rpc("get_admin_analytics_report", {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) {
    return NextResponse.json(
      { error: "Отчёт временно недоступен." },
      { status: error.code === "42501" ? 403 : 503 }
    );
  }
  const report = normalizeAnalyticsReport(data, range.from, range.to);
  return new NextResponse(analyticsReportCsv(report), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="probpera-analytics-${range.period}d.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
