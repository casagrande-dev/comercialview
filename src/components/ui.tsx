import type { CSSProperties, ReactNode } from "react";

export function Card({ title, freq, q, alert, children, style }: {
  title: ReactNode; freq?: string; q?: ReactNode; alert?: boolean; children?: ReactNode; style?: CSSProperties;
}) {
  return (
    <div className={`card${alert ? " alert" : ""}`} style={style}>
      <h3>{title} {freq && <span className="freq">{freq}</span>}</h3>
      {q && <p className="q">{q}</p>}
      {children}
    </div>
  );
}

export type Status = "good" | "warn" | "crit" | "mute";

/** Status de ritmo: ≥ esperado = bom; ≥ 70% do esperado = atenção; abaixo = crítico. */
export function statusRitmo(frac: number, pace: number): Status {
  if (pace <= 0) return "mute";
  if (frac >= pace) return "good";
  if (frac >= pace * 0.7) return "warn";
  return "crit";
}

export function Pace({ frac, pace, left, right, label = "DEVERIA" }: {
  frac: number; pace: number; left: ReactNode; right: ReactNode; label?: string;
}) {
  const st = statusRitmo(frac, pace);
  return (
    <div className="pace">
      <div className="track">
        <div className={`fill st-${st}`} style={{ width: `${Math.min(100, frac * 100)}%` }} />
        {pace > 0 && pace < 1 && <div className="mark" style={{ left: `${pace * 100}%` }} data-l={label} />}
      </div>
      <div className="ends"><span>{left}</span><span>{right}</span></div>
    </div>
  );
}

export function Delta({ st, children }: { st: Status; children: ReactNode }) {
  return <span className={`delta d-${st}`}>{children}</span>;
}

export function Flag({ st, children }: { st: Status; children: ReactNode }) {
  return <span className={`flag f-${st}`}>{children}</span>;
}

export function MiniBar({ frac, pace, color }: { frac: number; pace?: number; color: string }) {
  return (
    <div className="mb">
      <i style={{ width: `${Math.min(100, Math.max(0, frac) * 100)}%`, background: color }} />
      {pace != null && pace > 0 && <u style={{ left: `${Math.min(100, pace * 100)}%` }} />}
    </div>
  );
}

export function AlertItem({ st, n, children, sub }: { st: Status; n: ReactNode; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className={`ai c-${st}`}>
      <span className="n">{n}</span>
      <span className="tx">{children}{sub && <s>{sub}</s>}</span>
    </div>
  );
}

export function Sec({ children }: { children: ReactNode }) {
  return <h4 className="sec">{children}</h4>;
}
