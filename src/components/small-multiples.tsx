"use client";

import { useState } from "react";
import { Spark } from "./charts";

type Linha = { id: number; nome: string; series: number[][]; esperado: { prop: number; vis: number } | null };
type Tipo = { key: string; nome: string; cor: string };

/** O corretor contra ele mesmo, 8 semanas, um painel por tipo de atividade. */
export function SmallMultiples({ linhas, tipos }: { linhas: Linha[]; tipos: readonly Tipo[] }) {
  const [sel, setSel] = useState(linhas[0]?.id);
  const l = linhas.find((x) => x.id === sel);
  if (!l) return <p className="empty">Sem corretores com atividade no período.</p>;
  return (
    <>
      <div className="selector" role="group" aria-label="Corretor para a série histórica">
        {linhas.map((x) => (
          <button key={x.id} type="button" className="pill" aria-pressed={x.id === sel} onClick={() => setSel(x.id)}>
            {x.nome.split(" ")[0]}
          </button>
        ))}
      </div>
      <div className="smgrid">
        {tipos.map((t, j) => {
          const serie = l.series[j];
          // a semana corrente está em andamento: compara a última semana FECHADA com a média das 6 anteriores
          const atual = serie[serie.length - 2];
          const anteriores = serie.slice(0, -2);
          const media = anteriores.reduce((a, b) => a + b, 0) / anteriores.length;
          const varia = media ? Math.round(((atual - media) / media) * 100) : 0;
          const cls = varia >= 8 ? "up" : varia <= -8 ? "dn" : "fl";
          const sinal = varia >= 8 ? "▲" : varia <= -8 ? "▼" : "■";
          const alvo = t.key === "visita1" ? l.esperado?.vis ?? null : t.key === "proposta" ? l.esperado?.prop ?? null : null;
          const cor = `var(${t.cor})`;
          return (
            <div className="sm" key={t.key} title={`${l.nome} · ${t.nome}\n8 semanas: ${serie.join(" · ")}\nsemana passada ${atual} · média anterior ${media.toFixed(1)} · esta semana até agora ${serie[serie.length - 1]}`}>
              <div className="sm-h"><i style={{ background: cor }} /><span>{t.nome}</span></div>
              <div className="sm-v">
                <b style={{ color: cor }}>{atual}</b>
                <em className={cls}>
                  {media < 1 ? `média anterior ${media.toFixed(1)}` : `${sinal} ${varia > 0 ? "+" : ""}${Math.min(varia, 200)}%${varia > 200 ? "+" : ""} vs média`}
                </em>
              </div>
              <Spark serie={serie} cor={cor} alvo={alvo} />
              <div className="sm-f">
                {alvo != null ? (
                  <>esperado <b>{alvo}/sem</b> · {atual >= alvo ? "no ritmo" : `faltam ${alvo - atual}`}</>
                ) : l.esperado ? "sem alvo — leitura de tendência" : "sem meta cadastrada"}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
