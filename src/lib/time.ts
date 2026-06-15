// Time block helpers. 1 block = 30 minutes. Block 0 = 00:00, block 18 = 09:00, block 38 = 19:00.
export const OPEN_BLOCK = 18; // 09:00
export const CLOSE_BLOCK = 38; // 19:00 (exclusive)

export function blockToTime(b: number): string {
  const h = Math.floor(b / 2);
  const m = b % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}

export function blockRangeLabel(start: number, count: number): string {
  return `${blockToTime(start)} – ${blockToTime(start + count)}`;
}

export function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function blocksToDuration(blocks: number): string {
  const mins = blocks * 30;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}`;
}
