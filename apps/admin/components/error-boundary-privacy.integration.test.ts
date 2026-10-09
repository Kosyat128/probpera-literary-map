import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const currentRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = process.env.M02_ERROR_BOUNDARY_BASELINE_DIR
  ? path.resolve(process.env.M02_ERROR_BOUNDARY_BASELINE_DIR, "apps/admin")
  : currentRoot;
type Component = (props: { error: Error & { digest?: string }; reset: () => void }) => ReactElement;
type Effect = { callback: () => void; dependencies?: readonly unknown[] };

// Isolate only the app's useEffect callbacks. React's JSX/markup and the shared
// status component are real; this does not exercise or suppress React logging.
function fixture(relative: string) {
  const pending: Effect[] = [];
  let previousDependencies: readonly unknown[] | undefined;
  const useEffect = (callback: () => void, dependencies?: readonly unknown[]) => {
    const unchanged = dependencies !== undefined && previousDependencies !== undefined
      && dependencies.length === previousDependencies.length
      && dependencies.every((value, index) => Object.is(value, previousDependencies?.[index]));
    if (!unchanged) pending.push({ callback, dependencies });
    previousDependencies = dependencies;
  };
  function load(filename: string): Record<string, unknown> {
    const source = readFileSync(filename, "utf8");
    const compiled = ts.transpileModule(source, { fileName: filename, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const module = { exports: {} as Record<string, unknown> };
    const require = (name: string): unknown => {
      if (name === "react") return { ...nativeRequire("react"), useEffect };
      if (name === "@/components/AdminStatusState") {
        return load(path.join(currentRoot, "components/AdminStatusState.tsx"));
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", compiled)(require, module, module.exports);
    return module.exports;
  }
  const render = load(path.join(sourceRoot, relative)).default as Component;
  return { render, pending, flush: () => {
    for (const effect of pending.splice(0)) effect.callback();
  } };
}

const authorMarker = "SYNTHETIC_PRIVATE_AUTHOR_RU_EN_7f3d";
const tokenMarker = "SYNTHETIC_NOT_A_REAL_AUTH_TOKEN_8b12";
function privateError(suffix = "first") {
  const cause = Object.assign(new Error(`${authorMarker}:cause:${suffix}`), {
    request: { token: tokenMarker, sources: [{ url: `https://example.invalid/${authorMarker}` }] },
  });
  const error = Object.assign(new Error(`${authorMarker}:message:${suffix}`, { cause }), {
    digest: `${authorMarker}:digest:${suffix}`,
    stack: `${authorMarker}:stack:${suffix}`,
    ui: { ru: authorMarker, en: `${authorMarker}:manual-en`, rights: `${authorMarker}:rights` },
    token: tokenMarker,
  });
  Object.freeze(cause.request.sources[0]); Object.freeze(cause.request.sources);
  Object.freeze(cause.request); Object.freeze(cause); Object.freeze(error.ui);
  return Object.freeze(error);
}

function retryButton(element: ReactElement): ReactElement<{ type: string; onClick: () => void }> {
  const visit = (value: unknown): ReactElement<{ type: string; onClick: () => void }> | null => {
    if (Array.isArray(value)) {
      for (const child of value) { const found = visit(child); if (found) return found; }
      return null;
    }
    if (!isValidElement(value)) return null;
    const props = value.props as Record<string, unknown>;
    if (value.type === "button") return value as ReactElement<{ type: string; onClick: () => void }>;
    return visit(props.action) || visit(props.children);
  };
  const button = visit(element);
  if (!button) throw Error("The actual error boundary has no retry button");
  return button;
}

const boundaries = [
  { name: "route", file: "app/error.tsx", log: "Admin route rendering failed", title: "Не удалось открыть этот раздел" },
  { name: "global", file: "app/global-error.tsx", log: "Admin application rendering failed", title: "Кабинет временно недоступен" },
] as const;

describe("M02: app-owned error boundaries keep private diagnostics out of their UI and logs", () => {
  for (const boundary of boundaries) {
    it(`${boundary.name}: real status markup and explicit retry remain usable without exposing the error`, () => {
      const view = fixture(boundary.file), error = privateError(), reset = vi.fn();
      const element = view.render({ error, reset });
      const markup = renderToStaticMarkup(element);
      expect(markup).toContain(boundary.title);
      expect(markup).toContain('role="alert"');
      expect(markup).toContain('aria-live="assertive"');
      expect(markup).toContain("Повторить загрузку");
      expect(markup).not.toContain(authorMarker); expect(markup).not.toContain(tokenMarker);
      expect(markup.includes('<html lang="ru">')).toBe(boundary.name === "global");
      expect(reset).not.toHaveBeenCalled();
      const button = retryButton(element);
      expect(button.props.type).toBe("button");
      button.props.onClick();
      expect(reset).toHaveBeenCalledTimes(1);
    });

    it(`${boundary.name}: scheduled app log contains only its constant diagnostic`, () => {
      const view = fixture(boundary.file), error = privateError(), reset = vi.fn();
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        view.render({ error, reset });
        expect(log).not.toHaveBeenCalled();
        view.flush();
        expect(log).toHaveBeenCalledTimes(1);
        // Error/message/stack/cause/digest/token/author fields must never be
        // passed to an app-owned logger, including as non-enumerable arguments.
        expect(log.mock.calls).toEqual([[boundary.log]]);
        expect(log.mock.calls.flat()).not.toContain(error);
        expect(JSON.stringify(log.mock.calls)).not.toContain(authorMarker);
        expect(JSON.stringify(log.mock.calls)).not.toContain(tokenMarker);
        expect(reset).not.toHaveBeenCalled();
      } finally { log.mockRestore(); }
    });

    it(`${boundary.name}: changing error identity schedules a fresh diagnostic without automatic retry`, () => {
      const view = fixture(boundary.file), first = privateError(), next = privateError("next"), reset = vi.fn();
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        view.render({ error: first, reset });
        expect(view.pending).toHaveLength(1); view.flush();
        view.render({ error: first, reset });
        expect(view.pending).toHaveLength(0); view.flush();
        expect(log).toHaveBeenCalledTimes(1);
        view.render({ error: next, reset });
        expect(view.pending).toHaveLength(1); view.flush();
        expect(log).toHaveBeenCalledTimes(2);
        expect(reset).not.toHaveBeenCalled();
      } finally { log.mockRestore(); }
    });

    it(`${boundary.name}: rendering, logging and retry leave the original private error and cause unchanged`, () => {
      const view = fixture(boundary.file), error = privateError(), reset = vi.fn();
      const originalDescriptors = Object.getOwnPropertyDescriptors(error);
      const originalCauseDescriptors = Object.getOwnPropertyDescriptors(error.cause as object);
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const element = view.render({ error, reset });
        renderToStaticMarkup(element); view.flush(); retryButton(element).props.onClick();
        expect(Object.getOwnPropertyDescriptors(error)).toEqual(originalDescriptors);
        expect(Object.getOwnPropertyDescriptors(error.cause as object)).toEqual(originalCauseDescriptors);
        expect(error.ui.ru).toBe(authorMarker); expect(error.token).toBe(tokenMarker);
        expect(reset).toHaveBeenCalledTimes(1);
      } finally { log.mockRestore(); }
    });
  }
});
