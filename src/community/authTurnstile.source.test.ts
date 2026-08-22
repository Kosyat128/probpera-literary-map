import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const gate = readFileSync(
  path.join(root, "src", "community", "AuthTurnstileGate.tsx"),
  "utf8"
);
const token = readFileSync(
  path.join(root, "src", "community", "authTurnstileToken.ts"),
  "utf8"
);
const entrypoint = readFileSync(path.join(root, "src", "main.tsx"), "utf8");
const edgeSecurity = readFileSync(
  path.join(root, "scripts", "cloudflare", "configure-edge-security.mjs"),
  "utf8"
);
const deployment = readFileSync(
  path.join(root, ".github", "workflows", "deploy-pages.yml"),
  "utf8"
);

describe("public authentication Turnstile contract", () => {
  it("loads only the official explicit widget and mounts it in the auth form", () => {
    expect(gate).toContain(
      '"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"'
    );
    expect(gate).toContain('document.querySelector<HTMLFormElement>("form.auth-form")');
    expect(gate).toContain("api.render(widgetHostRef.current");
    expect(gate).toContain('action: "community_auth"');
    expect(gate).toContain('appearance: "always"');
  });

  it("recovers from a failed third-party script load", () => {
    expect(gate).toContain("turnstileLoader = null");
    expect(gate).toContain(
      "document.getElementById(TURNSTILE_SCRIPT_ID)?.remove()"
    );
    expect(gate).toContain('script.addEventListener("error", fail, { once: true })');
  });

  it("blocks submission before verification and resets every used token", () => {
    expect(gate).toContain('document.addEventListener("submit", protectSubmit, true)');
    expect(gate).toContain("event.stopImmediatePropagation()");
    expect(gate).toContain("hasAuthTurnstileToken()");
    expect(gate).toContain("setAuthTurnstileToken(token)");
    expect(gate).toContain('"expired-callback"');
    expect(gate).toContain('"error-callback"');
    expect(gate).toContain("apiRef.current.reset(widgetId)");
    expect(gate).toContain('aria-live="polite"');
    expect(token).toContain("currentToken = \"\"");
    expect(token).toContain("AUTH_TURNSTILE_RESET_EVENT");
  });

  it("stays outside CMS preview and is allowed by the public CSP", () => {
    expect(entrypoint).toContain(
      "{!cmsEditMode && <AuthTurnstileGate />}"
    );
    expect(edgeSecurity).toContain(
      "script-src 'self' https://challenges.cloudflare.com"
    );
    expect(edgeSecurity).toContain(
      "connect-src 'self' https://challenges.cloudflare.com"
    );
    expect(edgeSecurity).toContain(
      "frame-src https://challenges.cloudflare.com"
    );
  });

  it("passes only the public site key into the production build", () => {
    expect(deployment).toContain(
      "VITE_TURNSTILE_SITE_KEY: ${{ vars.VITE_TURNSTILE_SITE_KEY }}"
    );
    expect(deployment).not.toContain("TURNSTILE_SECRET_KEY");
  });
});
