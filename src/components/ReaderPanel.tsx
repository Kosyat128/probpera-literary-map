import { useEffect, useState } from "react";

type ReaderProfile = {
  name: string;
  interest: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onProfileChange: (profile: ReaderProfile | null) => void;
  profile: ReaderProfile | null;
};

const STORAGE_KEY = "probpera-reader-profile";

export function loadReaderProfile(): ReaderProfile | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ReaderProfile) : null;
  } catch {
    return null;
  }
}

export default function ReaderPanel({ open, onClose, onProfileChange, profile }: Props) {
  const [name, setName] = useState(profile?.name || "");
  const [interest, setInterest] = useState(profile?.interest || "Мировая классика");

  useEffect(() => {
    if (!open) return;
    setName(profile?.name || "");
    setInterest(profile?.interest || "Мировая классика");
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  const saveProfile = () => {
    const nextProfile = { name: name.trim() || "Читатель", interest };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProfile));
    onProfileChange(nextProfile);
    onClose();
  };

  return (
    <div className="reader-overlay" role="presentation" onMouseDown={onClose}>
      <aside
        className="reader-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reader-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="reader-close" type="button" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <img src={`${import.meta.env.BASE_URL}brand/probpera-logo.png`} alt="" />
        <span className="section-kicker">Клуб читателей</span>
        <h2 id="reader-title">Соберите свою литературную траекторию</h2>
        <p>
          Профиль запоминает интересы на этом устройстве. Защищённую синхронизацию аккаунта между
          устройствами подключим отдельным серверным этапом.
        </p>

        <label>
          Как к вам обращаться
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ваше имя" />
        </label>

        <label>
          Что читать чаще
          <select value={interest} onChange={(event) => setInterest(event.target.value)}>
            <option>Мировая классика</option>
            <option>Мнение о книге</option>
            <option>Биографии писателей</option>
            <option>Экранизации</option>
            <option>Литературные премии</option>
          </select>
        </label>

        <button className="reader-submit" type="button" onClick={saveProfile}>
          {profile ? "Сохранить профиль" : "Создать профиль читателя"}
        </button>
        <small>Без паролей и передачи личных данных на сторонний сервер.</small>
      </aside>
    </div>
  );
}
