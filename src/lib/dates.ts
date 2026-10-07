import { TIMEZONE } from "./pipedrive/config";

const fmtDay = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** Data local (São Paulo) no formato YYYY-MM-DD. Aceita ISO ("...Z") ou "YYYY-MM-DD HH:MM:SS" (UTC, v1). */
export function localDay(ts: string | Date | null | undefined): string | null {
  if (!ts) return null;
  if (typeof ts === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts;
    ts = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : ts.replace(" ", "T") + "Z");
  }
  return fmtDay.format(ts);
}

export function today(): string {
  return localDay(new Date())!;
}

export function monthOf(day: string) {
  return day.slice(0, 7);
}

export function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(day: string, n: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Segunda-feira da semana do dia. */
export function weekStart(day: string) {
  const d = new Date(day + "T12:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(day, -dow);
}

export function diffDays(a: string, b: string) {
  return Math.round((new Date(a + "T12:00:00Z").getTime() - new Date(b + "T12:00:00Z").getTime()) / 864e5);
}

export function toUtcMs(ts: string) {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : ts.replace(" ", "T") + "Z").getTime();
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export function nomeMes(ym: string, curto = false) {
  const [y, m] = ym.split("-").map(Number);
  const n = MESES[m - 1];
  return curto ? `${n.slice(0, 3)}/${String(y).slice(2)}` : `${n}/${String(y).slice(2)}`;
}

/** Mês corrente e os 11 anteriores, para o seletor. */
export function mesesOpcoes(hoje: string) {
  const [y, m] = hoje.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const ym = d.toISOString().slice(0, 7);
    return { value: ym, label: nomeMes(ym) };
  });
}

export function isValidYm(s: string | undefined | null): s is string {
  return !!s && /^20\d\d-(0[1-9]|1[0-2])$/.test(s);
}
