"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { AdminAuthenticatorAssuranceLevel } from "@/lib/admin-mfa-policy";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type TotpFactor = {
  id: string;
  status: string;
  friendly_name?: string | null;
};

type EnrollmentState = {
  factorId: string;
  qrCode: string;
  secret: string;
} | null;

type Props = {
  initialCurrentLevel: AdminAuthenticatorAssuranceLevel;
  initialNextLevel: AdminAuthenticatorAssuranceLevel;
  initialCheckError?: string;
};

function assuranceLabel(
  currentLevel: AdminAuthenticatorAssuranceLevel,
  nextLevel: AdminAuthenticatorAssuranceLevel
) {
  if (currentLevel === "aal2") return "AAL2 · второй фактор подтверждён";
  if (nextLevel === "aal2") return "AAL1 · при следующем входе потребуется код";
  return "AAL1 · TOTP пока не подключён";
}

export default function AdminMfaSettings({
  initialCurrentLevel,
  initialNextLevel,
  initialCheckError,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [currentLevel, setCurrentLevel] =
    useState<AdminAuthenticatorAssuranceLevel>(initialCurrentLevel);
  const [nextLevel, setNextLevel] =
    useState<AdminAuthenticatorAssuranceLevel>(initialNextLevel);
  const [enrollment, setEnrollment] = useState<EnrollmentState>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(
    initialCheckError
      ? "Не удалось определить текущий уровень MFA. Обновите страницу перед настройкой."
      : null
  );
  const [success, setSuccess] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    setLoading(true);
    try {
      const [factorResult, assuranceResult] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      if (factorResult.error) throw factorResult.error;
      if (assuranceResult.error) throw assuranceResult.error;

      setFactors(
        ((factorResult.data?.totp || []) as TotpFactor[]).filter(
          (factor) => factor.status === "verified"
        )
      );
      setCurrentLevel(
        (assuranceResult.data?.currentLevel as AdminAuthenticatorAssuranceLevel) ||
          null
      );
      setNextLevel(
        (assuranceResult.data?.nextLevel as AdminAuthenticatorAssuranceLevel) ||
          null
      );
      setMessage(null);
    } catch {
      setMessage(
        "Не удалось прочитать настройки MFA. Обновите страницу и повторите попытку."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  async function startEnrollment() {
    if (enrollment || working) return;
    setWorking(true);
    setMessage(null);
    setSuccess(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });
      if (error) throw error;
      if (!data?.id || !data.totp?.qr_code || !data.totp?.secret) {
        throw new Error("Incomplete TOTP enrollment response");
      }
      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setCode("");
    } catch {
      setMessage(
        "Не удалось начать подключение приложения-аутентификатора. Повторите попытку."
      );
    } finally {
      setWorking(false);
    }
  }

  async function cancelEnrollment() {
    const factorId = enrollment?.factorId;
    if (!factorId || working) return;
    setWorking(true);
    setMessage(null);
    setSuccess(null);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      setEnrollment(null);
      setCode("");
      await refreshState();
    } catch {
      setMessage(
        "Не удалось отменить текущую настройку. Обновите страницу перед новой попыткой."
      );
    } finally {
      setWorking(false);
    }
  }

  async function verifyEnrollment() {
    const factorId = enrollment?.factorId;
    const normalizedCode = code.trim();
    if (!factorId || !/^\d{6}$/u.test(normalizedCode) || working) {
      setMessage("Введите шестизначный код из приложения-аутентификатора.");
      return;
    }

    setWorking(true);
    setMessage(null);
    setSuccess(null);
    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge?.id) {
        throw challengeError || new Error("MFA challenge was not created");
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: normalizedCode,
      });
      if (verifyError) throw verifyError;

      setEnrollment(null);
      setCode("");
      setSuccess(
        "Двухфакторная защита подключена. Следующий вход в редакцию потребует код из приложения."
      );
      await refreshState();
      router.refresh();
    } catch {
      setMessage(
        "Код не принят. Проверьте время на устройстве и введите новый код из приложения."
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="panel settings-stack" aria-labelledby="admin-mfa-title">
      <div>
        <span className="eyebrow">Защита редакции</span>
        <h2 id="admin-mfa-title">Двухфакторный вход</h2>
      </div>
      <p className="editorial-note">
        TOTP работает с Google Authenticator, Microsoft Authenticator, 1Password,
        Bitwarden и другими совместимыми приложениями. Подключение добровольное на
        этом этапе: пока фактор не подтверждён, существующий вход не блокируется.
      </p>

      <div className="status-list">
        <div>
          <span>Текущая сессия</span>
          <strong>{assuranceLabel(currentLevel, nextLevel)}</strong>
        </div>
        <div>
          <span>Подтверждённых TOTP-факторов</span>
          <strong>{loading ? "…" : factors.length}</strong>
        </div>
      </div>

      {message && <p className="form-message" role="alert">{message}</p>}
      {success && <p className="form-message form-success" role="status">{success}</p>}

      {factors.length > 0 && (
        <div className="editorial-note">
          <strong>Подключено:</strong>{" "}
          {factors
            .map(
              (factor, index) =>
                factor.friendly_name || `Приложение-аутентификатор ${index + 1}`
            )
            .join(", ")}
          . Для резервного доступа можно отдельно подключить второй TOTP-фактор.
        </div>
      )}

      {!enrollment ? (
        <button
          className="button-secondary"
          type="button"
          onClick={startEnrollment}
          disabled={working || loading}
        >
          {factors.length > 0
            ? "Добавить резервный аутентификатор"
            : "Подключить приложение-аутентификатор"}
        </button>
      ) : (
        <div className="settings-stack">
          <p>
            Отсканируйте QR-код в приложении. Если камера недоступна, введите
            секрет вручную. Не сохраняйте этот секрет в заметках или переписке.
          </p>
          <img
            src={enrollment.qrCode}
            alt="QR-код для подключения TOTP к редакционной учётной записи"
            width={220}
            height={220}
            style={{ maxWidth: "100%", height: "auto", alignSelf: "flex-start" }}
          />
          <label className="field">
            <span>Секрет для ручного ввода</span>
            <input
              value={enrollment.secret}
              readOnly
              autoComplete="off"
              spellCheck={false}
              aria-label="Секрет TOTP для ручного ввода"
            />
          </label>
          <label className="field">
            <span>Шестизначный код из приложения</span>
            <input
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/gu, "").slice(0, 6))
              }
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
            />
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className="button"
              type="button"
              onClick={verifyEnrollment}
              disabled={working || code.length !== 6}
            >
              Подтвердить TOTP
            </button>
            <button
              className="button-secondary"
              type="button"
              onClick={cancelEnrollment}
              disabled={working}
            >
              Отменить настройку
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
