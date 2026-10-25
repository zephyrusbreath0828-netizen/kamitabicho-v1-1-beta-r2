/** 表示用フォーマッタ（日付・数値） */

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO → 2026年10月24日 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** ISO → 2026/10/24 16:35 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** YYYY-MM-DD（ローカル時刻） */
export function toDateInputValue(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** ISO → YYYY-MM-DD（ローカル時刻） */
export function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return toDateInputValue();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 「3日前」「今日」など相対表記 */
export function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < 60 * 60 * 1000) return "さきほど";
  if (diff < day) return `${Math.floor(diff / (60 * 60 * 1000))}時間前`;
  const days = Math.floor(diff / day);
  if (days === 0) return "今日";
  if (days === 1) return "昨日";
  if (days < 30) return `${days}日前`;
  if (days < 365) return `${Math.floor(days / 30)}か月前`;
  return `${Math.floor(days / 365)}年前`;
}

export function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}
