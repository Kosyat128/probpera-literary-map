import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  AUTH_TURNSTILE_RESET_EVENT,
  clearAuthTurnstileToken,
  hasAuthTurnstileToken,
  setAuthTurnstileToken,
} from "./authTurnstileToken";

type TurnstileOptions = {
  sitekey: string;
  action?: string;
  appearance?: "always" | "execute" | "interaction-only";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};

type TurnstileApi = {
  render(container: HTMLElement, options: TurnstileOptions): string;
  reset(widgetId?: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_ID = "probpera-turnstile-script";
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

const gateCopy = {
  ru: {
    label: "Проверка защиты от автоматических запросов",
    required: "Подтвердите, что запрос отправляет человек.",
    loadError: "Не удалось загрузить проверку защиты. Обновите страницу.",
  },
  en: {
    label: "Protection against automated requests",
    required: "Confirm that this request is being sent by a person.",
    loadError: "The protection check could not be loaded. Reload the page.",
  },
} as const;

let turnstileLoader: Promise<TurnstileApi> | null = null;

function currentCopy() {
  const documentLanguage =
    document.documentElement.dataset.routeLanguage ||
    document.documentElement.lang;
  return documentLanguage.toLocaleLowerCase("en").startsWith("en")
    ? gateCopy.en
    : gateCopy.ru;
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileLoader) return turnstileLoader;

  turnstileLoader = new Promise<TurnstileApi>((resolve, reject) => {
    const finish = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile loaded without exposing its API."));
    };
    const fail = () => reject(new Error("Turnstile script failed to load."));
    const existing = document.getElementById(
      TURNSTILE_SCRIPT_ID
    ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.head.append(script);
  }).catch((error) => {
    document.getElementById(TURNSTILE_SCRIPT_ID)?.remove();
    turnstileLoader = null;
    throw error;
  });

  return turnstileLoader;
}

function ensureAuthSlot() {
  const form = document.querySelector<HTMLFormElement>("form.auth-form");
  if (!form) return null;
  const existing = form.querySelector<HTMLElement>("[data-auth-turnstile-slot]");
  if (existing) return existing;

  const slot = document.createElement("div");
  slot.dataset.authTurnstileSlot = "true";
  const submitButton = form.querySelector<HTMLElement>(
    'button[type="submit"].community-primary'
  );
  form.insertBefore(slot, submitButton || null);
  return slot;
}

export default function AuthTurnstileGate() {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || "";
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [message, setMessage] = useState("");
  const widgetHostRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const apiRef = useRef<TurnstileApi | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    const syncSlot = () => {
      const nextSlot = ensureAuthSlot();
      setSlot((current) => (current === nextSlot ? current : nextSlot));
    };
    syncSlot();
    const observer = new MutationObserver(syncSlot);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey) return;
    const protectSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.matches("form.auth-form")) {
        return;
      }
      if (hasAuthTurnstileToken()) {
        setMessage("");
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      setMessage(currentCopy().required);
    };
    document.addEventListener("submit", protectSubmit, true);
    return () => document.removeEventListener("submit", protectSubmit, true);
  }, [siteKey]);

  useEffect(() => {
    const host = widgetHostRef.current;
    if (!siteKey || !host || widgetIdRef.current) return;
    let active = true;

    void loadTurnstile()
      .then((api) => {
        if (!active || !widgetHostRef.current) return;
        apiRef.current = api;
        widgetIdRef.current = api.render(widgetHostRef.current, {
          sitekey: siteKey,
          action: "community_auth",
          appearance: "always",
          callback(token) {
            setAuthTurnstileToken(token);
            setMessage("");
          },
          "expired-callback"() {
            clearAuthTurnstileToken();
            setMessage(currentCopy().required);
          },
          "error-callback"() {
            clearAuthTurnstileToken();
            setMessage(currentCopy().loadError);
          },
        });
      })
      .catch(() => {
        if (active) setMessage(currentCopy().loadError);
      });

    return () => {
      active = false;
      clearAuthTurnstileToken();
      const widgetId = widgetIdRef.current;
      if (widgetId && apiRef.current) apiRef.current.remove(widgetId);
      widgetIdRef.current = null;
    };
  }, [siteKey, slot]);

  useEffect(() => {
    if (!siteKey) return;
    const reset = () => {
      clearAuthTurnstileToken();
      setMessage("");
      const widgetId = widgetIdRef.current;
      if (widgetId && apiRef.current) apiRef.current.reset(widgetId);
    };
    window.addEventListener(AUTH_TURNSTILE_RESET_EVENT, reset);
    return () => window.removeEventListener(AUTH_TURNSTILE_RESET_EVENT, reset);
  }, [siteKey]);

  if (!siteKey || !slot) return null;
  const copy = currentCopy();

  return createPortal(
    <section
      aria-label={copy.label}
      style={{
        display: "grid",
        gap: "0.55rem",
        justifyItems: "start",
        marginBlock: "0.25rem 0.4rem",
      }}
    >
      <div ref={widgetHostRef} />
      {message && (
        <p
          role="status"
          aria-live="polite"
          style={{ margin: 0, maxWidth: "32rem" }}
        >
          {message}
        </p>
      )}
    </section>,
    slot
  );
}
