export function brl(n: number) {
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}

/** R$ 480 mil · R$ 1,80 mi */
export function brlCurto(n: number) {
  const a = Math.abs(n);
  const s = n < 0 ? "−" : "";
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toFixed(2).replace(".", ",")} mi`;
  if (a >= 1e3) return `${s}R$ ${Math.round(a / 1e3).toLocaleString("pt-BR")} mil`;
  return `${s}R$ ${Math.round(a)}`;
}

export function pct(n: number) {
  return Math.round(n * 100) + "%";
}

export function primeiroNome(n: string) {
  return n.split(" ")[0];
}

export function fmtMin(m: number) {
  if (m < 60) return `${Math.round(m)} min`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, "0")}`;
  return `${Math.round(m / 60 / 24)} dia(s)`;
}
