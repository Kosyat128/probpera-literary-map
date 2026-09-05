import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import { build } from "esbuild";
import { chromium, expect, test } from "@playwright/test";

// Actual React, canonical Supabase SDK/client + AuthProvider, global RU/EN
// control, AuthTurnstileGate and CommunityHub. All HTTP is intercepted; test
// keys sign fixture JWTs only. A fake Turnstile host exercises the real gate,
// never claims real CAPTCHA verification or a delivered recovery email.
const SITE = "https://recovery-ui.test";
const PROJECT = "https://recovery-fixture.supabase.co";
const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const SESSION = "33333333-3333-4333-8333-333333333333";
const PASSWORD = "fixture-new-password";
const localeCopy = {
  ru: { open: "Забыли пароль?", email: "Электронная почта аккаунта", send: "Отправить ссылку", password: "Новый пароль", confirm: "Повторите новый пароль", save: "Сохранить новый пароль", sent: "Если для этого адреса доступно восстановление", gate: "Подтвердите, что запрос отправляет человек.", invalid: "Сессия восстановления не подтверждена", changed: "Сессия аккаунта изменилась.", updated: "Пароль изменён. Войдите", partial: "Пароль изменён, но завершение выхода", signIn: "Войти с новым паролем" },
  en: { open: "Forgot your password?", email: "Account email address", send: "Send recovery link", password: "New password", confirm: "Confirm new password", save: "Save new password", sent: "If password recovery is available for this address", gate: "Confirm that this request is being sent by a person.", invalid: "Your recovery session could not be verified", changed: "Your account session changed.", updated: "Your password has been changed. Sign in", partial: "Your password has changed, but sign-out", signIn: "Sign in with new password" },
};
let browser, bundle, css, privateKey, publicJwk;
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
async function jwt(method = "recovery", subject = SUBJECT) {
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({ alg: "ES256", kid: "ephemeral-recovery-browser", typ: "JWT" }) + "." + encode({
    iss: PROJECT + "/auth/v1", sub: subject, aud: "authenticated", role: "authenticated", iat: now - 5, exp: now + 3600,
    session_id: SESSION, aal: "aal1", amr: [{ method, timestamp: now - 5 }], is_anonymous: false,
  });
  return payload + "." + Buffer.from(await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, new TextEncoder().encode(payload))).toString("base64url");
}
test.beforeAll(async () => {
  const keys = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  privateKey = keys.privateKey; publicJwk = { ...await webcrypto.subtle.exportKey("jwk", keys.publicKey), kid: "ephemeral-recovery-browser", alg: "ES256", use: "sig" };
  const result = await build({
    stdin: { resolveDir: fileURLToPath(new URL("../../", import.meta.url)), loader: "jsx", contents: `
      import React,{useState} from 'react';import{createRoot}from'react-dom/client';
      import{AuthProvider}from'./src/community/AuthContext';
      import{InterfaceLanguageProvider}from'./src/i18n/InterfaceLanguage';
      import InterfaceLanguageControl from'./src/components/InterfaceLanguageControl';
      import AuthTurnstileGate from'./src/community/AuthTurnstileGate';
      import CommunityHub from'./src/community/CommunityHub';
      import{PlanetPasswordRecovery}from'./src/pwa/PlanetPasswordRecovery';
      import{supabase}from'./src/lib/supabase';
      const widgets=new Map();let sequence=0,openDialog;
      window.turnstile={render(host,options){const id='fixture-'+(++sequence);widgets.set(id,options);host.dataset.fixtureTurnstile=id;return id},reset(){},remove(id){widgets.delete(id)}};
      window.__recoveryBrowser={
        completeCaptcha(){const options=[...widgets.values()].at(-1);if(!options)throw Error('No real gate widget');options.callback('one-use-fixture-captcha')},
        widgets(){return widgets.size},
        async switchSession(access_token){await supabase.auth.setSession({access_token,refresh_token:'fixture-refresh-never-used'})},
        async sessionSubject(){return(await supabase.auth.getSession()).data.session?.user.id??null},
        openDialog(){openDialog(true)},closeDialog(){openDialog(false)}
      };
      function View(){const[modal,setModal]=useState(false);openDialog=setModal;
        async function signInAgain(){await supabase.auth.signOut({scope:'local'});setModal(true)}
        return <main className="planet-account pwa-access"><InterfaceLanguageControl/><button id="fixture-open-account" onClick={()=>setModal(true)}>Open canonical account dialog</button>
          <section className="planet-account__panel">{!modal&&<PlanetPasswordRecovery onSignIn={()=>void signInAgain()}/>}</section>
          {modal&&<CommunityHub open initialView="account" onClose={()=>setModal(false)}/>}<AuthTurnstileGate/>
        </main>
      }
      async function start(){if(window.__recoveryInitialToken){const response=await supabase.auth.setSession({access_token:window.__recoveryInitialToken,refresh_token:'fixture-refresh-never-used'});if(response.error)throw response.error}
        createRoot(document.getElementById('root')).render(<React.StrictMode><InterfaceLanguageProvider><AuthProvider><View/></AuthProvider></InterfaceLanguageProvider></React.StrictMode>)}
      start().catch(error=>{window.__recoveryFixtureError=error.message});
    ` },
    bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", jsx: "automatic", loader: { ".css": "empty" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"development"', "import.meta.env": JSON.stringify({ BASE_URL: "/", DEV: false, VITE_SUPABASE_URL: PROJECT, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_only", VITE_TURNSTILE_SITE_KEY: "fixture-turnstile-public-key" }), __LITERARY_PLANET_EDITION__: '"site"', __LITERARY_PLANET_LOCAL_QA__: "false" },
  });
  bundle = result.outputFiles[0].text;
  css = (await Promise.all(["src/index.css", "src/pwa/pwa.css", "src/pwa/account.css", "src/community/community-accessibility.css"].map(name => readFile(new URL("../../" + name, import.meta.url), "utf8")))).join("\n");
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
test.afterAll(async () => { await browser?.close(); });

async function open({ language = "en", mode = "none", recovery = false, logoutFailure = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(8000);
  const errors = [], calls = []; const tokens = new Map();
  const initialToken = mode === "none" ? null : await jwt(mode);
  if (initialToken) tokens.set(initialToken, SUBJECT);
  const otherToken = await jwt("password", OTHER); tokens.set(otherToken, OTHER);
  const state = { holdUser: false, pendingUser: null };
  const cors = { "access-control-allow-origin": SITE, "access-control-allow-headers": "authorization,apikey,content-type,x-client-info,x-supabase-api-version", "access-control-allow-methods": "GET,POST,PUT,OPTIONS" };
  const user = subject => ({ id: subject, aud: "authenticated", role: "authenticated", email: subject === SUBJECT ? "reader@example.test" : "other@example.test", created_at: "2026-01-01T00:00:00Z", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, is_anonymous: false });
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin === SITE && url.pathname === `/${language}/planet-account/`) return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="${language}" data-route-language="${language}"><head><title>Recovery component fixture</title></head><body><div id="root"></div></body></html>` });
    if (url.origin !== PROJECT) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const token = request.headers().authorization?.replace(/^Bearer /u, "");
    calls.push({ pathname: url.pathname, method: request.method(), scope: url.searchParams.get("scope"), redirect: url.searchParams.get("redirect_to"), token, body: request.postData() ? request.postDataJSON() : null });
    if (url.pathname.endsWith("/.well-known/jwks.json")) return route.fulfill({ headers: cors, json: { keys: [publicJwk] } });
    if (url.pathname === "/auth/v1/user" && request.method() === "GET") {
      if (state.holdUser && token === initialToken) await new Promise(resolve => { state.pendingUser = resolve; });
      return route.fulfill({ status: tokens.has(token) ? 200 : 401, headers: cors, json: tokens.has(token) ? user(tokens.get(token)) : { error: "fixture-invalid-token" } }).catch(() => {});
    }
    if (url.pathname === "/auth/v1/user" && request.method() === "PUT") return route.fulfill({ status: token === initialToken ? 200 : 401, headers: cors, json: user(SUBJECT) });
    if (url.pathname === "/auth/v1/logout") return route.fulfill({ status: logoutFailure && url.searchParams.get("scope") === "global" ? 503 : 204, headers: cors, body: logoutFailure && url.searchParams.get("scope") === "global" ? "DO_NOT_REFLECT_SECRET" : "" });
    if (url.pathname === "/auth/v1/recover") return route.fulfill({ headers: cors, json: {} });
    if (url.pathname.startsWith("/rest/v1/")) return route.fulfill({ headers: cors, json: [] });
    return route.abort();
  });
  await page.goto(`${SITE}/${language}/planet-account/${recovery ? "?recovery=1" : ""}`);
  await page.evaluate(token => { window.__recoveryInitialToken = token; }, initialToken);
  await page.addStyleTag({ content: css }); await page.addScriptTag({ content: bundle });
  await expect(page.locator("[data-password-recovery]")).toBeVisible();
  if (recovery) await expect(page.getByRole("button", { name: localeCopy[language].save, exact: true })).toBeEnabled();
  return { page, calls, errors, state, initialToken, otherToken };
}
async function fillPassword(page, language = "en") {
  const copy = localeCopy[language];
  await page.getByLabel(copy.password, { exact: true }).fill(PASSWORD);
  await page.getByLabel(copy.confirm, { exact: true }).fill(PASSWORD);
}
const mutations = calls => calls.filter(call => call.pathname === "/auth/v1/user" && call.method === "PUT");

for (const language of ["ru", "en"]) test(`canonical ${language} email form uses keyboard and one-use Turnstile without account enumeration`, async () => {
  const { page, calls, errors } = await open({ language }); const copy = localeCopy[language];
  try {
    await expect(page.locator("form.auth-form")).toHaveCount(0);
    const expand = page.getByRole("button", { name: copy.open, exact: true }); await expand.focus(); await page.keyboard.press("Enter");
    await expect(page.locator("[data-password-recovery] > button")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("form.auth-form")).toHaveCount(1);
    await page.getByLabel(copy.email, { exact: true }).fill("reader@example.test");
    await page.keyboard.press("Enter");
    await expect(page.getByText(copy.gate, { exact: true })).toBeVisible();
    expect(calls.some(call => call.pathname === "/auth/v1/recover")).toBe(false);
    await page.waitForFunction(() => window.__recoveryBrowser.widgets() === 1);
    await page.evaluate(() => window.__recoveryBrowser.completeCaptcha());
    await page.getByLabel(copy.email, { exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(page.locator("[data-password-recovery] [role=status]")).toContainText(copy.sent);
    const emails = calls.filter(call => call.pathname === "/auth/v1/recover"); expect(emails).toHaveLength(1);
    expect(emails[0].redirect).toBe(`https://probpera.ru/${language}/planet-account/?recovery=1`);
    expect(emails[0].body).toMatchObject({ email: "reader@example.test", gotrue_meta_security: { captcha_token: "one-use-fixture-captcha" } });
    await page.getByLabel(copy.email, { exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByText(copy.gate, { exact: true })).toBeVisible();
    expect(calls.filter(call => call.pathname === "/auth/v1/recover")).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const box = await page.getByRole("button", { name: copy.send, exact: true }).boundingBox(); expect(box.height).toBeGreaterThanOrEqual(44);
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("global language switching keeps the same input; CommunityHub takes the single auth form", async () => {
  const { page, errors } = await open();
  try {
    await page.getByRole("button", { name: localeCopy.en.open, exact: true }).click();
    const email = page.getByLabel(localeCopy.en.email, { exact: true }); await email.fill("retained@example.test"); const handle = await email.elementHandle();
    await page.locator(".interface-language-control button").filter({ hasText: "RU" }).click();
    const russian = page.getByLabel(localeCopy.ru.email, { exact: true });
    expect(await russian.evaluate((node, original) => node === original, handle)).toBe(true); await expect(russian).toHaveValue("retained@example.test");
    await expect(page.locator(".interface-language-control")).toHaveCount(1);
    await page.locator("#fixture-open-account").click();
    await expect(page.locator("[data-password-recovery]")).toHaveCount(0); await expect(page.locator("form.auth-form")).toHaveCount(1);
    await page.waitForFunction(() => window.__recoveryBrowser.widgets() === 1);
    await page.evaluate(() => window.__recoveryBrowser.closeDialog());
    await expect(page.locator("[data-password-recovery]")).toBeVisible(); await expect(page.locator("form.auth-form")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

for (const language of ["ru", "en"]) test(`${language} recovery query alone cannot authorize a password-authenticated session`, async () => {
  const { page, calls, errors } = await open({ language, recovery: true, mode: "password" });
  try {
    await fillPassword(page, language); await page.getByLabel(localeCopy[language].confirm, { exact: true }).press("Enter");
    await expect(page.locator("[data-password-recovery] [role=alert]")).toContainText(localeCopy[language].invalid);
    expect(mutations(calls)).toHaveLength(0); expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("verified recovery changes only its bound account, signs out and shows success", async () => {
  const { page, calls, errors, initialToken } = await open({ recovery: true, mode: "recovery" });
  try {
    await fillPassword(page); await page.getByLabel(localeCopy.en.confirm, { exact: true }).press("Enter");
    await expect(page.locator("[data-password-recovery] [role=status]")).toContainText(localeCopy.en.updated);
    expect(mutations(calls)).toHaveLength(1); expect(mutations(calls)[0]).toMatchObject({ token: initialToken, body: { password: PASSWORD } });
    expect(calls.filter(call => call.pathname === "/auth/v1/logout").map(call => call.scope)).toEqual(["global", "local"]);
    expect(await page.evaluate(() => window.__recoveryBrowser.sessionSubject())).toBeNull();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await page.getByRole("button", { name: localeCopy.en.signIn, exact: true }).click();
    await expect(page.locator("form.auth-form")).toHaveCount(1); await expect(page.locator("[data-password-recovery]")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("confirmed update with failed global signout has honest bilingual error text", async () => {
  const { page, calls, errors } = await open({ recovery: true, mode: "recovery", logoutFailure: true });
  try {
    await fillPassword(page); await page.getByRole("button", { name: localeCopy.en.save, exact: true }).click();
    await expect(page.locator("[data-password-recovery] [role=alert]")).toContainText(localeCopy.en.partial);
    expect(mutations(calls)).toHaveLength(1); expect(await page.evaluate(() => window.__recoveryBrowser.sessionSubject())).toBe(SUBJECT);
    await page.locator(".interface-language-control button").filter({ hasText: "RU" }).click();
    await expect(page.locator("[data-password-recovery] [role=alert]")).toContainText(localeCopy.ru.partial);
    await expect(page.locator("body")).not.toContainText("DO_NOT_REFLECT_SECRET"); await expect(page.locator('input[type="password"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("a canonical subject switch during pending server verification cannot update either password", async () => {
  const { page, calls, errors, state, otherToken } = await open({ recovery: true, mode: "recovery" });
  try {
    state.holdUser = true;
    await fillPassword(page); await page.getByRole("button", { name: localeCopy.en.save, exact: true }).click();
    await expect.poll(() => !!state.pendingUser).toBe(true);
    await page.evaluate(token => window.__recoveryBrowser.switchSession(token), otherToken);
    await expect(page.locator("[data-password-recovery] [role=alert]")).toContainText(localeCopy.en.changed);
    state.pendingUser(); state.holdUser = false;
    expect(await page.evaluate(() => window.__recoveryBrowser.sessionSubject())).toBe(OTHER);
    expect(mutations(calls)).toHaveLength(0); expect(errors).toEqual([]);
  } finally { state.pendingUser?.(); await page.close(); }
});
