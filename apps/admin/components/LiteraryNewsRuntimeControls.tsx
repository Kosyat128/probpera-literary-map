import { updateLiteraryNewsRuntimeAction } from "@/app/(dashboard)/literary-news/actions";

function Identity({ recordKey, version, operation }: { recordKey: string; version: string; operation: string }) {
  return <><input type="hidden" name="key" value={recordKey} /><input type="hidden" name="expected_version" value={version} /><input type="hidden" name="operation" value={operation} /></>;
}
function Reason() {
  return <label className="field"><span>Причина и проверенные сведения</span><textarea name="reason" required minLength={12} maxLength={2000} rows={3} /></label>;
}
export function NewsDestinationControls({ platform, id, paused, version }: { platform: "telegram" | "vk"; id: string; paused: boolean | null; version: string | null }) {
  if (!version) return null;
  return <details><summary>Пауза назначения</summary><p>Изменение паузы сохраняет режим и права назначения. Уже начатый запрос может завершиться; новые запросы проверяют паузу атомарно.</p>
    <form action={updateLiteraryNewsRuntimeAction} className="settings-stack"><Identity recordKey={`destination:${platform}:${id}`} version={version} operation={paused ? "resume" : "pause"} /><Reason />
      <button className="button-secondary" type="submit">{paused ? "Снять паузу" : "Поставить на паузу"}</button>
    </form></details>;
}
export function NewsJobResolutionControls({ recordKey, version, status, platform, destinationId }: { recordKey: string; version: string; status: string; platform: "telegram" | "vk"; destinationId: string }) {
  if (!["ambiguous", "blocked", "pending", "correction_pending"].includes(status)) return null;
  const urlExample = platform === "telegram" ? `https://t.me/c/${destinationId.replace(/^-100/u, "")}/ID` : `https://vk.com/wall${destinationId}_ID`;
  return <details><summary>Зафиксировать решение по записи</summary>
    {status === "ambiguous" && <form action={updateLiteraryNewsRuntimeAction} className="settings-stack"><h5>Найдена публикация в канале</h5><Identity recordKey={recordKey} version={version} operation="bind_remote" />
      <label className="field"><span>Проверенный ID сообщения</span><input name="remote_id" required inputMode="numeric" pattern="[1-9][0-9]{0,14}" maxLength={15} /></label>
      <label className="field"><span>Ссылка именно на это сообщение в назначении</span><input name="proof_url" type="url" required maxLength={2048} placeholder={urlExample} /></label><Reason />
      <label><input type="checkbox" name="verified" required /> Я открыл публикацию, проверил канал и её соответствие этой новости.</label>
      <p>Привязка сохранит найденный ID. Текущий подготовленный текст будет отправлен как исправление; подтверждение его доставки ожидается отдельно.</p><button className="button-secondary" type="submit">Привязать проверенную публикацию</button>
    </form>}
    {["ambiguous", "blocked"].includes(status) && <form action={updateLiteraryNewsRuntimeAction} className="settings-stack"><h5>Подтверждено, что попытка не выполнилась</h5><Identity recordKey={recordKey} version={version} operation="not_sent" /><Reason />
      <label><input type="checkbox" name="verified" required /> Я проверил сведения о попытке и подтверждаю отсутствие её результата; повтор допустим.</label>
      <p>Неопределённость сама по себе не разрешает повтор. Если старый ID уже известен, сохраняется исправление этой публикации.</p><button className="button-secondary" type="submit">Разрешить повтор после проверки</button>
    </form>}
    <form action={updateLiteraryNewsRuntimeAction} className="settings-stack"><h5>Закрыть без дальнейшей отправки</h5><Identity recordKey={recordKey} version={version} operation="explicitly_close" /><Reason /><p>История и известная публикация сохранятся. Запись перестанет автоматически отправляться.</p><button className="button-secondary" type="submit">Зафиксировать закрытие</button></form>
  </details>;
}
