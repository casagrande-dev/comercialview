import Link from "next/link";
import { Suspense } from "react";
import { requireGestor } from "@/lib/auth";
import { loadCtx, resolveMes } from "@/lib/data";
import { painelGerente } from "@/lib/metrics";
import { mesesOpcoes, nomeMes } from "@/lib/dates";
import { brl, fmtMin, pct } from "@/lib/format";
import { PREMISSAS, TIPOS_ATIVIDADE } from "@/lib/pipedrive/config";
import { Card, Flag, MiniBar, Sec, statusRitmo } from "@/components/ui";
import { AreaLine, GroupedBars } from "@/components/charts";
import { MesSelect } from "@/components/nav";
import { SmallMultiples } from "@/components/small-multiples";

export const metadata = { title: "Gerente · Painéis Casagrande" };

const corSt = { good: "var(--good)", warn: "var(--warn)", crit: "var(--crit)", mute: "var(--ink-3)" } as const;
const rotSt = { good: "no ritmo", warn: "atenção", crit: "crítico", mute: "—" } as const;

export default async function GerentePage(props: PageProps<"/gerente">) {
  await requireGestor();
  const sp = await props.searchParams;
  const mes = resolveMes(sp.mes);
  const ctx = await loadCtx(mes);
  const g = painelGerente(ctx);
  const L = g.linhas;
  const curto = (n: string) => n.split(" ")[0];

  const comMeta = L.filter((l) => l.meta);
  const tm = comMeta.reduce((a, l) => a + l.meta!, 0);
  const tr = comMeta.reduce((a, l) => a + l.real, 0);
  const tf = comMeta.reduce((a, l) => a + l.fc, 0);

  return (
    <div className="view" style={{ "--tone": "var(--tat)" } as React.CSSProperties}>
      <div className="viewbar">
        <div>
          <h2>Painel da gerência</h2>
          <p className="sub">Consolidado + quebra por corretor · {nomeMes(mes)} · série de 8 semanas</p>
        </div>
        <Suspense><MesSelect mes={mes} opcoes={mesesOpcoes(ctx.hoje)} /></Suspense>
      </div>

      <Sec>Bloco 1 — Higiene do CRM · olhar antes de tudo</Sec>
      <Card alert style={{ marginTop: 22 }} title="Dá para confiar nos outros indicadores?" freq="diária"
        q="Se estas colunas estiverem sujas, nada do que vem depois é confiável. Conta arquivada em vez de marcada como perdida corrompe toda taxa de conversão.">
        <div className="tw">
          <table>
            <thead><tr>
              <th>Corretor</th><th className="r">Sem próxima atividade</th><th className="r">Parado &gt;{PREMISSAS.diasParado}d em V3/V4</th>
              <th className="r">Perdido/arquivado sem motivo</th><th className="r">% GBANT preenchido (V1+)</th><th className="r">Atividades vencidas</th>
            </tr></thead>
            <tbody>
              {L.map((l) => {
                const h = l.higiene;
                const gb = h.gbant;
                const bad = h.semProxima > 3 || h.paradosV3V4 > 1 || h.semMotivo > 0 || (gb != null && gb < 0.8);
                const c = (v: number, lim: number) => <td className={`r ${v > lim ? "neg" : ""}`}>{v}</td>;
                return (
                  <tr key={l.id} className={bad ? "bad" : undefined}>
                    <td className="nm"><Link href={`/corretor?u=${l.id}&mes=${mes}`}>{curto(l.nome)}</Link></td>
                    {c(h.semProxima, 3)}{c(h.paradosV3V4, 1)}{c(h.semMotivo, 0)}
                    <td className={`r ${gb != null && gb < 0.8 ? "neg" : ""}`}>{gb == null ? "—" : pct(gb)}</td>
                    {c(h.vencidas, 5)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="note"><b>Regra de leitura:</b> qualquer célula vermelha vira item da 1:1 de segunda com aquele corretor, antes de qualquer conversa sobre meta.</p>
      </Card>

      <Sec>Bloco 2 — Resultado por corretor</Sec>
      <Card style={{ marginTop: 22 }} title="VGV realizado × meta individual" freq="semanal" q="Quem está fora do ritmo de resultado? Realizado é negócio ganho no Pipedrive — não é previsão.">
        <div className="tw">
          <table>
            <thead><tr>
              <th>Corretor</th><th className="r">Meta</th><th className="r">Realizado</th>
              <th style={{ minWidth: 150 }}>Ritmo (marca = {pct(g.pace)} do mês)</th><th className="r">%</th><th className="r">Ticket médio 12m</th><th>Status</th>
            </tr></thead>
            <tbody>
              {L.map((l) => {
                if (!l.meta)
                  return (
                    <tr key={l.id}>
                      <td className="nm">{curto(l.nome)}</td><td className="r"><Flag st="warn">sem meta</Flag></td>
                      <td className="r">{brl(l.real)}</td><td /><td className="r">—</td><td className="r">{brl(l.ticket)}</td><td><Flag st="mute">sem base</Flag></td>
                    </tr>
                  );
                const f = l.real / l.meta;
                const st = statusRitmo(f, g.pace);
                return (
                  <tr key={l.id} className={st === "crit" ? "bad" : undefined} title={`deveria estar em ${brl(l.meta * g.pace)}`}>
                    <td className="nm">{curto(l.nome)}</td><td className="r">{brl(l.meta)}</td><td className="r">{brl(l.real)}</td>
                    <td><MiniBar frac={f} pace={g.pace} color={corSt[st]} /></td>
                    <td className="r">{pct(f)}</td><td className="r">{brl(l.ticket)}</td><td><Flag st={st}>{rotSt[st]}</Flag></td>
                  </tr>
                );
              })}
              {tm > 0 && (
                <tr className="tot">
                  <td>Equipe (com meta)</td><td className="r">{brl(tm)}</td><td className="r">{brl(tr)}</td>
                  <td><MiniBar frac={tr / tm} pace={g.pace} color={corSt[statusRitmo(tr / tm, g.pace)]} /></td>
                  <td className="r">{pct(tr / tm)}</td><td className="r">{brl(g.ticketEquipe)}</td><td><Flag st={statusRitmo(tr / tm, g.pace)}>{rotSt[statusRitmo(tr / tm, g.pace)]}</Flag></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {L.some((l) => !l.meta) && (
          <p className="note"><b>Sem meta no mês:</b> {L.filter((l) => !l.meta).map((l) => curto(l.nome)).join(", ")}. Sem meta cadastrada, não há denominador — cadastre em “Usuários e metas”.</p>
        )}
      </Card>

      <Sec>Bloco 3 — Ritmo por corretor</Sec>
      <div className="grid g2">
        <Card title="Atividades por tipo, na semana" freq="semanal" q="Barras separadas, nunca empilhadas: 48 ligações não é a mesma coisa que 48 visitas.">
          <GroupedBars grupos={L.map((l) => ({ nome: curto(l.nome), vals: l.series.map((s) => s[s.length - 1]) }))} tipos={TIPOS_ATIVIDADE} />
          <div className="legend">{TIPOS_ATIVIDADE.map((t) => <span key={t.key}><i style={{ background: `var(${t.cor})` }} />{t.nome}</span>)}</div>
          <p className="axnote">Atividades concluídas na semana corrente (segunda a hoje)</p>
        </Card>
        <Card title="Visitas e propostas × ritmo esperado" freq="semanal" q="O que cada um fez × o que precisaria fazer. É a resposta a “48 é muito ou é pouco?”.">
          <div className="tw">
            <table>
              <thead><tr><th>Corretor</th><th className="r">Visitas</th><th className="r">Esperado</th><th className="r">Propostas</th><th className="r">Esperado</th><th>Gap</th></tr></thead>
              <tbody>
                {L.map((l) => {
                  const vis = l.series[2][7], prop = l.series[4][7], e = l.esperado;
                  if (!e)
                    return (
                      <tr key={l.id}><td className="nm">{curto(l.nome)}</td><td className="r">{vis}</td><td className="r">—</td><td className="r">{prop}</td><td className="r">—</td><td><Flag st="warn">sem meta</Flag></td></tr>
                    );
                  const gap = Math.max(0, e.vis - vis) + Math.max(0, e.prop - prop);
                  return (
                    <tr key={l.id} className={gap > 4 ? "bad" : undefined}
                      title={`meta ${brl(l.meta!)} ÷ ticket ${brl(l.ticket)} ÷ ${pct(PREMISSAS.taxaPropostaGanho)} ÷ ${PREMISSAS.semanasPorMes} sem = ${e.prop} propostas/sem × ${PREMISSAS.visitasPorProposta} = ${e.vis} visitas/sem`}>
                      <td className="nm">{curto(l.nome)}</td>
                      <td className={`r ${vis < e.vis ? "neg" : "pos"}`}>{vis}</td><td className="r" style={{ color: "var(--ink-3)" }}>{e.vis}</td>
                      <td className={`r ${prop < e.prop ? "neg" : "pos"}`}>{prop}</td><td className="r" style={{ color: "var(--ink-3)" }}>{e.prop}</td>
                      <td>{gap === 0 ? <Flag st="good">em dia</Flag> : <Flag st={gap > 4 ? "crit" : "warn"}>−{gap}</Flag>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note"><b>A coluna “esperado” é hipótese</b> ({PREMISSAS.visitasPorProposta} visitas por proposta). Fica real quando a taxa visita→proposta for extraída de 90 dias de CRM limpo. A semana corrente ainda está em andamento.</p>
        </Card>
      </div>

      <Card style={{ marginTop: 16 }} title="O corretor contra ele mesmo, semana a semana" freq="semanal"
        q={<>Um painel por tipo de atividade, 8 semanas. Responde: <em>esse corretor está aumentando ou diminuindo as visitas?</em></>}>
        <SmallMultiples linhas={L.map((l) => ({ id: l.id, nome: l.nome, series: l.series, esperado: l.esperado }))} tipos={TIPOS_ATIVIDADE} />
        <p className="note"><b>A linha tracejada é o ritmo esperado</b>, e só existe em visitas e propostas. O número grande é a <b>semana passada</b> (fechada), comparada com a média das 6 semanas anteriores; o último ponto do gráfico é a semana corrente, ainda em andamento.</p>
      </Card>

      <div className="grid g21">
        <Card title="Contas diferentes trabalhadas por semana" freq="semanal" q="Quantas contas a equipe efetivamente tocou — não “leads criados”.">
          <AreaLine data={g.contasSemana} label="Contas diferentes com atividade concluída por semana, equipe" />
          <p className="axnote">Negócio com pelo menos uma atividade concluída na semana</p>
        </Card>
        <Card title="Leads e tempo de resposta" freq="diária" q={`A distribuição respeita o volume mínimo (PC 6.2)? Respondemos em ${PREMISSAS.slaMinutos} min?`}>
          <div className="tw">
            <table style={{ minWidth: 300 }}>
              <thead><tr><th>Corretor</th><th className="r">Leads na semana</th><th className="r">Tempo médio</th><th className="r">Sem contato</th></tr></thead>
              <tbody>
                {L.map((l) => {
                  const x = l.leads;
                  const lento = x.tempoMedioMin != null && x.tempoMedioMin > PREMISSAS.slaMinutos;
                  return (
                    <tr key={l.id} className={x.semContato > 0 || lento ? "bad" : undefined}>
                      <td className="nm">{curto(l.nome)}</td>
                      <td className="r">{x.semana}</td>
                      <td className={`r ${lento ? "neg" : ""}`}>{x.tempoMedioMin != null ? fmtMin(x.tempoMedioMin) : "—"}</td>
                      <td className={`r ${x.semContato ? "neg" : ""}`}>{x.semContato}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note">Tempo até a primeira atividade registrada no lead (aproximação do primeiro contato). Corretor com zero lead precisa ser decisão consciente.</p>
        </Card>
      </div>

      <Sec>Bloco 4 — Forecast e gap, por corretor</Sec>
      <Card style={{ marginTop: 22 }} title="Cada um vai chegar?" freq="semanal" q="Forecast ponderado pela taxa de conversão de cada etapa — não pela probabilidade que o corretor digita.">
        <div className="tw">
          <table>
            <thead><tr>
              <th>Corretor</th><th className="r">Meta</th><th className="r">Realizado</th><th className="r">Forecast ponderado</th>
              <th className="r">Projeção</th><th className="r">Gap descoberto</th><th className="r">Propostas que faltam</th>
            </tr></thead>
            <tbody>
              {comMeta.map((l) => {
                const proj = l.real + l.fc, gap = Math.max(0, l.meta! - proj);
                const props = gap > 0 && l.ticket ? Math.ceil(gap / l.ticket / PREMISSAS.taxaPropostaGanho) : 0;
                return (
                  <tr key={l.id} className={gap > 0 ? "bad" : undefined}>
                    <td className="nm">{curto(l.nome)}</td><td className="r">{brl(l.meta!)}</td><td className="r">{brl(l.real)}</td>
                    <td className="r">{brl(l.fc)}</td><td className="r">{brl(proj)}</td>
                    <td className={`r ${gap > 0 ? "neg" : "pos"}`}>{gap > 0 ? brl(gap) : "coberto"}</td>
                    <td className="r">{props ? <b>{props}</b> : "—"}</td>
                  </tr>
                );
              })}
              {tm > 0 && (() => {
                const gp = Math.max(0, tm - tr - tf);
                return (
                  <tr className="tot">
                    <td>Equipe</td><td className="r">{brl(tm)}</td><td className="r">{brl(tr)}</td><td className="r">{brl(tf)}</td><td className="r">{brl(tr + tf)}</td>
                    <td className={`r ${gp > 0 ? "neg" : "pos"}`}>{gp > 0 ? brl(gp) : "coberto"}</td>
                    <td className="r"><b>{gp > 0 && g.ticketEquipe ? Math.ceil(gp / g.ticketEquipe / PREMISSAS.taxaPropostaGanho) : "—"}</b></td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
        {comMeta.length === 0 && <p className="empty">Nenhuma meta cadastrada para {nomeMes(mes)}.</p>}
        <p className="note"><b>Como o forecast é calculado:</b> valor aberto em V3 × {pct(PREMISSAS.taxaPropostaGanho)} + valor aberto em V4 × {pct(PREMISSAS.taxaContratoGanho)} (provisória). “Propostas que faltam” = gap ÷ ticket médio do corretor ÷ {pct(PREMISSAS.taxaPropostaGanho)}.</p>
      </Card>

      <Sec>Bloco 5 — Captação</Sec>
      <Card style={{ marginTop: 22 }} title="Quem alimenta o estoque" freq="semanal" q="Funil de Captação no mês. Publicado = negócio ganho em C4 (Assinatura e Publicação).">
        <div className="tw">
          <table>
            <thead><tr><th>Corretor</th><th className="r">Iniciadas</th><th className="r">Publicadas</th><th className="r">Meta</th><th className="r">Com exclusividade</th><th className="r">Dias até publicar</th></tr></thead>
            <tbody>
              {L.map((l) => {
                const c = l.captacao, meta = l.metaCapt;
                return (
                  <tr key={l.id} className={meta && c.publicadas < meta / 2 ? "bad" : undefined}>
                    <td className="nm">{curto(l.nome)}</td><td className="r">{c.iniciadas}</td>
                    <td className={`r ${meta ? (c.publicadas < meta ? "neg" : "pos") : ""}`}>{c.publicadas}</td>
                    <td className="r" style={{ color: "var(--ink-3)" }}>{meta ?? "—"}</td>
                    <td className="r">{c.exclusividade}</td>
                    <td className={`r ${c.diasPublicar != null && c.diasPublicar > 15 ? "neg" : ""}`}>{c.diasPublicar != null ? `${c.diasPublicar} d` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="vfoot">
        <p><b>Fonte única:</b> tudo aqui sai do Pipedrive, atualizado a cada 5 minutos. As metas vêm do cadastro em “Usuários e metas”.</p>
        <p><b>Este painel é montado na sexta.</b> Alimenta as 1:1 de segunda e, consolidado, vai para a reunião de terça com a diretoria.</p>
      </div>
    </div>
  );
}
