// Gráficos em SVG puro, renderizados no servidor. Hover via <title>.
import { brl, brlCurto } from "@/lib/format";

const v = (name: string) => `var(${name})`;

function Grid({ L, R, T, ih, W, max, ticks, fmt = String }: {
  L: number; R: number; T: number; ih: number; W: number; max: number; ticks: number[]; fmt?: (n: number) => string;
}) {
  return (
    <>
      {ticks.map((t) => {
        const y = T + ih - (t / max) * ih;
        return (
          <g key={t}>
            <line x1={L} y1={y} x2={W - R} y2={y} stroke={v("--grid")} />
            <text x={L - 6} y={y + 3.5} textAnchor="end" fontSize={9} fill={v("--ink-3")}>{fmt(t)}</text>
          </g>
        );
      })}
    </>
  );
}

function niceMax(n: number) {
  if (n <= 0) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(n)));
  const m = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => x * p >= n)!;
  return m * p;
}

/** Barras semanais com linha de ritmo esperado (visitas do corretor). */
export function WeeklyBars({ data, alvo, label }: { data: number[]; alvo: number | null; label: string }) {
  const W = 340, H = 180, L = 28, R = 8, T = 14, B = 30;
  const iw = W - L - R, ih = H - T - B;
  const max = niceMax(Math.max(alvo ?? 0, ...data) * 1.15);
  const pitch = iw / data.length, bw = pitch * 0.62;
  const ay = alvo != null ? T + ih - (alvo / max) * ih : 0;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <Grid L={L} R={R} T={T} ih={ih} W={W} max={max} ticks={[0, max / 2, max]} />
      {data.map((d, i) => {
        const h = (d / max) * ih, x = L + i * pitch + (pitch - bw) / 2, y = T + ih - h;
        const fill = alvo == null ? v("--s3") : d >= alvo ? v("--good") : v("--crit");
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={h} rx={3} fill={fill}>
              <title>{`Semana ${i + 1}: ${d}${alvo != null ? ` · esperado ${alvo}` : ""}${i === data.length - 1 ? " (em andamento)" : ""}`}</title>
            </rect>
            <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize={9.5} fill={v("--ink-2")}>{d}</text>
          </g>
        );
      })}
      {alvo != null && <line x1={L} y1={ay} x2={W - R} y2={ay} stroke={v("--ink")} strokeWidth={2} strokeDasharray="5 3" />}
      <line x1={L} y1={T + ih} x2={W - R} y2={T + ih} stroke={v("--rule")} />
      <text x={L} y={H - 9} fontSize={9} fill={v("--ink-3")}>8 SEMANAS ATRÁS</text>
      <text x={W - R} y={H - 9} textAnchor="end" fontSize={9} fill={v("--ink-3")}>ESTA SEMANA</text>
    </svg>
  );
}

/** Contas por etapa do funil. */
export function FunnelBars({ etapas }: { etapas: { code: string; nome: string; q: number; v: number }[] }) {
  const W = 460, H = 210, L = 30, R = 10, T = 16, B = 42;
  const iw = W - L - R, ih = H - T - B;
  const max = niceMax(Math.max(...etapas.map((e) => e.q)) * 1.1);
  const pitch = iw / etapas.length, bw = pitch * 0.6;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Contas abertas por etapa do funil de vendas">
      <Grid L={L} R={R} T={T} ih={ih} W={W} max={max} ticks={[0, max / 2, max]} />
      {etapas.map((e, i) => {
        const h = (e.q / max) * ih, x = L + i * pitch + (pitch - bw) / 2, y = T + ih - h;
        return (
          <g key={e.code}>
            <rect x={x} y={y} width={bw} height={h} rx={3} fill={v("--s1")}><title>{`${e.code} ${e.nome}: ${e.q} conta(s) · ${brl(e.v)}`}</title></rect>
            <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize={9.5} fill={v("--ink-2")}>{e.q}</text>
            <text x={x + bw / 2} y={T + ih + 14} textAnchor="middle" fontSize={10} fontWeight={600} fill={v("--ink-2")}>{e.code}</text>
            <text x={x + bw / 2} y={T + ih + 27} textAnchor="middle" fontSize={8.5} fill={v("--ink-3")}>{brlCurto(e.v).replace("R$ ", "")}</text>
          </g>
        );
      })}
      <line x1={L} y1={T + ih} x2={W - R} y2={T + ih} stroke={v("--rule")} />
    </svg>
  );
}

/** Barras agrupadas: atividades por tipo por corretor (semana corrente). */
export function GroupedBars({ grupos, tipos }: { grupos: { nome: string; vals: number[] }[]; tipos: readonly { nome: string; cor: string }[] }) {
  const W = 560, H = 250, L = 28, R = 8, T = 14, B = 44;
  const iw = W - L - R, ih = H - T - B;
  const max = niceMax(Math.max(1, ...grupos.flatMap((g) => g.vals)) * 1.1);
  const pitch = iw / Math.max(1, grupos.length), gw = pitch * 0.8, bw = gw / tipos.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Atividades realizadas na semana por corretor, por tipo">
      <Grid L={L} R={R} T={T} ih={ih} W={W} max={max} ticks={[0, max / 2, max]} />
      {grupos.map((g, i) => {
        const gx = L + i * pitch + (pitch - gw) / 2;
        return (
          <g key={g.nome}>
            {g.vals.map((val, j) => {
              const h = (val / max) * ih, x = gx + j * bw, y = T + ih - h;
              return (
                <g key={j}>
                  <rect x={x + 1} y={y} width={Math.max(0, bw - 2)} height={h} rx={2} fill={v(tipos[j].cor)}><title>{`${g.nome} · ${tipos[j].nome}: ${val}`}</title></rect>
                  {val > 0 && val >= max * 0.35 && <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize={7.5} fill={v("--ink-3")}>{val}</text>}
                </g>
              );
            })}
            <text x={gx + gw / 2} y={T + ih + 15} textAnchor="middle" fontSize={9.5} fill={v("--ink-2")}>{g.nome}</text>
          </g>
        );
      })}
      <line x1={L} y1={T + ih} x2={W - R} y2={T + ih} stroke={v("--rule")} />
    </svg>
  );
}

/** Linha com área — contas trabalhadas por semana. */
export function AreaLine({ data, label }: { data: number[]; label: string }) {
  const W = 520, H = 190, L = 28, R = 8, T = 16, B = 30;
  const iw = W - L - R, ih = H - T - B;
  const max = niceMax(Math.max(1, ...data) * 1.15);
  const pts = data.map((d, i) => [L + i * (iw / (data.length - 1)), T + ih - (d / max) * ih] as const);
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `M${pts.map((p) => p.join(",")).join(" L ")} L ${pts[pts.length - 1][0]},${T + ih} L ${pts[0][0]},${T + ih} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <Grid L={L} R={R} T={T} ih={ih} W={W} max={max} ticks={[0, max / 2, max]} />
      <path d={area} fill={v("--s1")} fillOpacity={0.12} />
      <polyline points={line} fill="none" stroke={v("--s1")} strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 5 : 4} fill={v("--s1")} stroke={v("--card")} strokeWidth={2}>
          <title>{`Semana ${i + 1}: ${data[i]} contas diferentes${i === pts.length - 1 ? " (em andamento)" : ""}`}</title>
        </circle>
      ))}
      <text x={last[0]} y={last[1] - 11} textAnchor="end" fontSize={11} fontWeight={700} fill={v("--ink")}>{data[data.length - 1]}</text>
      <line x1={L} y1={T + ih} x2={W - R} y2={T + ih} stroke={v("--rule")} />
      <text x={L} y={H - 8} fontSize={9} fill={v("--ink-3")}>8 SEMANAS ATRÁS</text>
      <text x={W - R} y={H - 8} textAnchor="end" fontSize={9} fill={v("--ink-3")}>ESTA SEMANA</text>
    </svg>
  );
}

/** Composição da meta: realizado + forecast + gap. */
export function Composicao({ meta, realizado, forecast, pace }: { meta: number; realizado: number; forecast: number; pace: number }) {
  const W = 560, H = 150, L = 14, R = 14, T = 44, BH = 44, iw = W - L - R;
  const total = Math.max(meta, realizado + forecast, 1);
  const gap = Math.max(0, meta - realizado - forecast);
  const seg = [
    { n: "Realizado", val: realizado, c: "--s1" },
    { n: "Forecast ponderado", val: forecast, c: "--s4" },
    { n: "Gap descoberto", val: gap, c: "--crit" },
  ];
  const starts = seg.map((_, i) => L + (seg.slice(0, i).reduce((a, s) => a + s.val, 0) / total) * iw);
  const mx = L + iw * (meta / total);
  const px = L + iw * (meta / total) * pace;
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label="Composição da meta do mês">
        {seg.map((s, i) => {
          const w = (s.val / total) * iw;
          const x = starts[i];
          const isGap = s.c === "--crit";
          return (
            <g key={s.n}>
              <rect x={x} y={T} width={Math.max(0, w - 2)} height={BH} rx={3} fill={v(s.c)} fillOpacity={isGap ? 0.28 : 1}
                stroke={isGap ? v("--crit") : undefined} strokeWidth={isGap ? 1.5 : undefined} strokeDasharray={isGap ? "5 3" : undefined}>
                <title>{`${s.n}: ${brl(s.val)}${meta ? ` · ${Math.round((s.val / meta) * 100)}% da meta` : ""}`}</title>
              </rect>
              {w > 48 && (
                <text x={x + w / 2} y={T + BH / 2 + 4} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={isGap ? v("--crit") : "#fff"}>
                  {(s.val / 1e6).toFixed(2).replace(".", ",")}
                </text>
              )}
            </g>
          );
        })}
        {meta > 0 && (
          <>
            <line x1={mx} y1={T - 12} x2={mx} y2={T + BH + 12} stroke={v("--ink")} strokeWidth={2} />
            <text x={mx} y={T - 18} textAnchor="end" fontSize={10} fontWeight={600} fill={v("--ink")}>{`META ${brlCurto(meta).toUpperCase()}`}</text>
          </>
        )}
        {meta > 0 && pace > 0 && pace < 1 && (
          <>
            <line x1={px} y1={T - 6} x2={px} y2={T + BH + 20} stroke={v("--ink-3")} strokeWidth={1.5} strokeDasharray="4 3" />
            <text x={px - 7} y={T + BH + 31} textAnchor="end" fontSize={9.5} fill={v("--ink-3")}>DEVERIA ESTAR AQUI HOJE</text>
          </>
        )}
      </svg>
      <div className="legend">
        <span><i style={{ background: v("--s1") }} />Realizado — negócio ganho</span>
        <span><i style={{ background: v("--s4") }} />Forecast — funil × taxa de conversão</span>
        <span><i style={{ background: v("--crit"), opacity: 0.45 }} />Gap descoberto — sem lastro</span>
      </div>
    </>
  );
}

/** VGV acumulado no ano × meta acumulada. */
export function Acumulado({ pontos }: { pontos: { mes: string; real: number; meta: number }[] }) {
  const W = 340, H = 170, L = 34, R = 10, T = 14, B = 28;
  const iw = W - L - R, ih = H - T - B;
  const max = niceMax(Math.max(1, ...pontos.map((p) => Math.max(p.real, p.meta))) * 1.05);
  const n = pontos.length;
  const X = (i: number) => (n === 1 ? L + iw / 2 : L + i * (iw / (n - 1)));
  const Y = (val: number) => T + ih - (val / max) * ih;
  const temMeta = pontos.some((p) => p.meta > 0);
  const ini = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const ult = pontos[n - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="VGV acumulado do ano contra a meta acumulada">
      <Grid L={L} R={R} T={T} ih={ih} W={W} max={max} ticks={[0, max / 2, max]} fmt={(t) => (t / 1e6).toFixed(0) + "mi"} />
      {temMeta && <polyline points={pontos.map((p, i) => `${X(i)},${Y(p.meta)}`).join(" ")} fill="none" stroke={v("--ink-3")} strokeWidth={2} strokeDasharray="5 4" />}
      <polyline points={pontos.map((p, i) => `${X(i)},${Y(p.real)}`).join(" ")} fill="none" stroke={v("--s1")} strokeWidth={2} strokeLinejoin="round" />
      {pontos.map((p, i) => (
        <g key={p.mes}>
          <circle cx={X(i)} cy={Y(p.real)} r={3.5} fill={v("--s1")} stroke={v("--card")} strokeWidth={1.5}>
            <title>{`${p.mes}: acumulado ${brlCurto(p.real)}${p.meta ? ` · meta ${brlCurto(p.meta)}` : ""}`}</title>
          </circle>
          <text x={X(i)} y={T + ih + 14} textAnchor="middle" fontSize={8.5} fill={v("--ink-3")}>{ini[Number(p.mes.slice(5)) - 1]}</text>
        </g>
      ))}
      <line x1={L} y1={T + ih} x2={W - R} y2={T + ih} stroke={v("--rule")} />
      {temMeta && <text x={L + iw} y={Y(ult.meta) + (ult.meta >= ult.real ? -7 : 14)} textAnchor="end" fontSize={9} fill={v("--ink-3")}>META</text>}
      <text x={L + iw} y={Y(ult.real) + (temMeta && ult.real < ult.meta ? 14 : -7)} textAnchor="end" fontSize={9} fontWeight={700} fill={v("--s1")}>REALIZADO</text>
    </svg>
  );
}

export function Spark({ serie, cor, alvo }: { serie: number[]; cor: string; alvo: number | null }) {
  const W = 190, H = 64, L = 2, R = 2, T = 10, B = 6, iw = W - L - R, ih = H - T - B;
  const max = Math.max(alvo ?? 0, ...serie, 1) * 1.12;
  const pts = serie.map((val, i) => [L + i * (iw / (serie.length - 1)), T + ih - (val / max) * ih] as const);
  const d = "M" + pts.map((p) => p.join(",")).join(" L ");
  const last = pts[pts.length - 1];
  const ay = alvo != null ? T + ih - (alvo / max) * ih : 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path d={`${d} L ${last[0]},${T + ih} L ${pts[0][0]},${T + ih} Z`} fill={cor} fillOpacity={0.13} />
      {alvo != null && <line x1={L} y1={ay} x2={W - R} y2={ay} stroke={v("--ink")} strokeWidth={1.5} strokeDasharray="4 3" strokeOpacity={0.65} />}
      <path d={d} fill="none" stroke={cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <line x1={L} y1={T + ih} x2={W - R} y2={T + ih} stroke={v("--rule")} />
      <circle cx={last[0]} cy={last[1]} r={4.5} fill={cor} stroke={v("--card")} strokeWidth={2} />
    </svg>
  );
}
