import { NextResponse } from "next/server";

import {
  analyticsReportCsv,
  normalizeAnalyticsReport,
  resolveAnalyticsRange,
} from "@/lib/analytics-report";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { adminReadMessage, readAdminResult } from "@/lib/admin-read-result";
import { isAnalyticsReport } from "@/lib/analytics-load-validation";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "База данных не подключена." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } }
    );
  }
  const url = new URL(request.url);
  const range = resolveAnalyticsRange(url.searchParams.get("period"));
  const [result] = await Promise.allSettled([Promise.resolve().then(() => supabase.rpc("get_admin_analytics_report", {
    p_from: range.from,
    p_to: range.to,
  }))]);
  const read = readAdminResult(result, (data) => isAnalyticsReport(data, range.from, range.to));
  if (read.status === "failed") {
    return NextResponse.json(
      { error: adminReadMessage(read.issue) },
      { status: read.issue === "permission" ? 403 : 503,
        headers: { "Cache-Control": "private, no-store" } }
    );
  }
  const report = normalizeAnalyticsReport(read.data, range.from, range.to);
  return new NextResponse(analyticsReportCsv(report), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="probpera-analytics-${range.period}d.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
