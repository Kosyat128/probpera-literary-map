import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { describe, expect, it } from "vitest";

const appRoot = path.join(process.cwd(), "apps", "admin", "app");
const dashboardRoot = path.join(appRoot, "(dashboard)");

function pageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return pageFiles(entryPath);
    return entry.name === "page.tsx" ? [entryPath] : [];
  });
}

const dashboardPages = pageFiles(dashboardRoot);
const rootErrorSource = readFileSync(path.join(appRoot, "error.tsx"), "utf8");
const globalErrorSource = readFileSync(
  path.join(appRoot, "global-error.tsx"),
  "utf8"
);
const statusStateSource = readFileSync(
  path.join(process.cwd(), "apps", "admin", "components", "AdminStatusState.tsx"),
  "utf8"
);
const layoutStylesSource = readFileSync(
  path.join(appRoot, "styles", "layout.css"),
  "utf8"
);

function isNullableSupabasePage(source: string): boolean {
  const parsed = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const page = parsed.statements.find((statement): statement is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(statement) && Boolean(statement.body) &&
    Boolean(statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)));
  if (!page?.body) return false;
  let createsClient = false, nullableReturn = false;
  const visitsPageBody = (node: ts.Node) => {
    // Helper declarations/callbacks have their own dependency contract.
    if (ts.isFunctionLike(node)) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "createServerSupabaseClient") createsClient = true;
    if (ts.isIfStatement(node) && ts.isPrefixUnaryExpression(node.expression) &&
      node.expression.operator === ts.SyntaxKind.ExclamationToken && ts.isIdentifier(node.expression.operand) && node.expression.operand.text === "supabase" &&
      (ts.isReturnStatement(node.thenStatement) || ts.isBlock(node.thenStatement) && node.thenStatement.statements.some(ts.isReturnStatement))) nullableReturn = true;
    ts.forEachChild(node, visitsPageBody);
  };
  visitsPageBody(page.body);
  return createsClient && nullableReturn;
}

describe("admin resilience boundaries", () => {
  it("replaces every nullable Supabase page with one shared dependency state", () => {
    const nullableSupabasePages = dashboardPages.filter((file) => {
      const source = readFileSync(file, "utf8");
      return isNullableSupabasePage(source);
    });
    const dependencyPages = dashboardPages.filter((file) =>
      readFileSync(file, "utf8").includes("<AdminDependencyState />")
    );

    expect(dependencyPages.sort()).toEqual(nullableSupabasePages.sort());
    expect(nullableSupabasePages.length).toBeGreaterThan(0);
    for (const file of dashboardPages) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("if (!supabase) return null;");
    }
    for (const file of dependencyPages) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain(
        'import { AdminDependencyState } from "@/components/AdminStatusState"'
      );
    }
    expect(isNullableSupabasePage(`export default async function Page() {
      const supabase = await createServerSupabaseClient();
      if (!supabase) return <AdminDependencyState />;
      return <main />;
    }`)).toBe(true);
    expect(isNullableSupabasePage(`async function readHelper() {
      const supabase = await createServerSupabaseClient();
      if (!supabase) return { status: "failed" };
    }
    export default async function Page() {
      const supabase = await createServerSupabaseClient();
      async function nestedHelper() { if (!supabase) return { status: "failed" }; }
      return <main />;
    }`)).toBe(false);
  });

  it("keeps route and root failures recoverable without exposing raw errors", () => {
    expect(rootErrorSource).toContain('"use client"');
    expect(rootErrorSource).toContain("reset: () => void");
    expect(rootErrorSource).toContain("onClick={reset}");
    expect(rootErrorSource).not.toContain("{error.message}");

    expect(globalErrorSource).toContain('"use client"');
    expect(globalErrorSource).toContain('<html lang="ru">');
    expect(globalErrorSource).toContain("<body>");
    expect(globalErrorSource).toContain("onClick={reset}");
    expect(globalErrorSource).not.toContain("{error.message}");
  });

  it("uses the shared accessible state presentation and its existing theme", () => {
    expect(statusStateSource).toContain('role="alert"');
    expect(statusStateSource).toContain('aria-live="assertive"');
    expect(statusStateSource).toContain("Редакционная база временно недоступна");
    expect(layoutStylesSource).toContain(".admin-state-page");
    expect(layoutStylesSource).toContain(".state-card");
    expect(layoutStylesSource).toContain(".state-actions");
    expect(layoutStylesSource).toContain(".primary-button");
  });
});
