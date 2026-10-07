import { Suspense } from "react";
import { requireGestor } from "@/lib/auth";
import { loadCtx, loadMetasAno, resolveMes } from "@/lib/data";
import { painelDiretoria } from "@/lib/metrics";
import { daysInMonth, mesesOpcoes, monthOf, nomeMes } from "@/lib/dates";
import { brl, brlCurto, pct } from "@/lib/format";
import { PREMISSAS } from "@/lib/pipedrive/config";
import { AlertItem, Card, Delta, Pace, Sec, statusRitmo, type Status } from "@/components/ui";
import { Acumulado, Composicao } from "@/components/charts";
import { MesSelect } from "@/components/nav";

export const metadata = { title: "Diretoria · Painéis Casagrande" };

export default async function DiretoriaPage(props: PageProps<"/diretoria">) {
  const sp = await props.searchParams;
  const mes = resolveMes(sp.mes);
  const [, ctx, metasAno] = await Promise.all([requireGestor(), loadCtx(mes), loadMetasAno(mes.slice(0, 4))]);
  const d = painelDiretoria(ctx, metasAno);
  const corrente = monthOf(ctx.hoje) === mes;
  const dia = corrente ? Number(ctx.hoje.slice(8)) : null;
  const meta = d.metaTotal;
  const frac = meta ? d.realizado / meta : 0;
  const st = meta ? statusRitmo(frac, d.pace) : "mute";

  // semáforo de suficiência
  const sem: { st: Status; n: string; t: string; s: string }[] = [];
  if (meta) {
    const cob = d.cobertura ?? 0;
    sem.push(
      cob >= 1
        ? { st: "good", n: "✓", t: "Realizado + funil cobrem a meta", s: `projeção ${brlCurto(d.realizado + d.forecast.total)} contra ${brlCurto(meta)} — agora é converter` }
        : cob >= 0.8
          ? { st: "warn", n: "!", t: `Realizado + funil cobrem ${pct(cob)} da meta`, s: `faltam ${brlCurto(d.gap)} sem lastro` }
          : { st: "crit", n: "✕", t: `${nomeMes(mes)} não fecha na meta com o funil atual`, s: `cobertura de ${pct(cob)} · seriam ${d.propostas} propostas novas${corrente ? ` em ${d.diasRestantes} dias` : ""}` },
    );
    if (d.gap > 0)
      sem.push({
        st: d.forecast.v12 >= d.gap * 3 ? "warn" : "crit",
        n: "!",
        t: `V1–V2 somam ${brlCurto(d.forecast.v12)} em aberto`,
        s: `${pct(d.forecast.v12 / d.gap)} do gap descoberto — é daí que viriam as propostas novas`,
      });
    sem.push(
      corrente && d.diasRestantes <= 7 && d.gap > 0
        ? { st: "good", n: "→", t: "A conversa é sobre o próximo mês", s: "o ritmo de visitas e propostas do próximo mês começa na segunda" }
        : { st: d.gap > 0 ? "warn" : "good", n: d.gap > 0 ? "!" : "✓", t: d.gap > 0 ? "O mês ainda é recuperável" : "Mês coberto", s: d.gap > 0 ? `${d.propostas} propostas ≈ ${d.visitas} visitas no período restante` : "manter o ritmo de visitas" },
    );
  }

  return (
    <div className="view" style={{ "--tone": "var(--est)" } as React.CSSProperties}>
      <div className="viewbar">
        <div>
          <h2>Painel da diretoria</h2>
          <p className="sub">Uma tela · consolidado · {nomeMes(mes)}{dia ? `, dia ${dia} de ${daysInMonth(mes)}` : ""}</p>
        </div>
        <Suspense><MesSelect mes={mes} opcoes={mesesOpcoes(ctx.hoje)} /></Suspense>
      </div>

      {!meta && (
        <Card alert style={{ marginTop: 22 }} title={`Qual é a meta de ${nomeMes(mes)}?`}>
          <p className="q" style={{ margin: 0 }}>Nenhuma meta cadastrada para o mês. Sem meta, o painel mostra só o realizado — cadastre em “Usuários e metas”.</p>
        </Card>
      )}

      <Sec>Vamos bater a meta?</Sec>
      <div className="grid g4">
        <Card title="VGV realizado" freq="semanal" q="Onde estamos × onde deveríamos estar hoje.">
          <div className="stat">
            <div className="val">{brlCurto(d.realizado)}</div>
            <div className="sub">{meta ? `meta ${brlCurto(meta)} · deveria estar em ${brlCurto(meta * d.pace)}` : "sem meta cadastrada"}</div>
          </div>
          {meta ? (
            <>
              <Pace frac={frac} pace={d.pace} label={`DEVERIA: ${pct(d.pace)}`} left={`${pct(frac)} da meta`} right={`faltam ${brlCurto(Math.max(0, meta - d.realizado))}`} />
              <Delta st={st}>{st === "good" ? "▲ no ritmo" : st === "warn" ? "■ atrás do ritmo" : "▼ muito atrás do ritmo"}</Delta>
            </>
          ) : null}
        </Card>
        <Card title="Forecast ponderado" freq="semanal" q="Com o que está na mesa, quanto ainda entra?">
          <div className="stat">
            <div className="val">{brlCurto(d.forecast.total)}</div>
            <div className="sub">V3 {brlCurto(d.forecast.v3)} × {pct(PREMISSAS.taxaPropostaGanho)} + V4 {brlCurto(d.forecast.v4)} × {pct(PREMISSAS.taxaContratoGanho)}</div>
          </div>
          <Delta st="warn">■ taxas ainda provisórias</Delta>
        </Card>
        <Card title="Gap descoberto" freq="semanal" q="Quanto do resultado ainda não tem lastro nenhum.">
          <div className="stat">
            <div className="val" style={{ color: d.gap > 0 ? "var(--crit)" : "var(--good)" }}>{meta ? brlCurto(d.gap) : "—"}</div>
            <div className="sub">meta − realizado − forecast</div>
          </div>
          {meta ? <Delta st={d.gap > 0 ? "crit" : "good"}>{d.gap > 0 ? `▼ ${pct(d.gap / meta)} da meta sem cobertura` : "▲ meta coberta"}</Delta> : null}
        </Card>
        <Card title="Propostas necessárias" freq="semanal" q="O que precisa acontecer nos próximos dias.">
          <div className="stat">
            <div className="val">{d.propostas} <small>propostas</small></div>
            <div className="sub">gap ÷ ticket médio {brl(d.ticket)} ÷ {pct(PREMISSAS.taxaPropostaGanho)} · com ~{PREMISSAS.visitasPorProposta} visitas por proposta, ~{d.visitas} visitas</div>
          </div>
          {d.propostas > 0 && corrente && <Delta st="crit">▼ {d.diasRestantes} dia(s) restantes no mês</Delta>}
        </Card>
      </div>

      <div className="grid g21">
        <Card title="Como a meta se compõe hoje" freq="semanal" q="Realizado, o que o funil sustenta, e o que ainda não tem lastro.">
          <Composicao meta={meta} realizado={d.realizado} forecast={d.forecast.total} pace={d.pace} />
        </Card>
        <Card title="Semáforo de suficiência" freq="semanal" q="O funil aberto comporta a meta, ou o mês já está matematicamente decidido?">
          <div className="alist">
            {sem.length ? sem.map((x, i) => <AlertItem key={i} st={x.st} n={x.n} sub={x.s}>{x.t}</AlertItem>) : <p className="empty">Cadastre a meta do mês para ativar o semáforo.</p>}
          </div>
          <p className="note">A pergunta não é “quem falhou”. É <b>“a conversa desta terça é sobre salvar o mês ou sobre montar o próximo?”</b></p>
        </Card>
      </div>

      <Sec>O time e o ano</Sec>
      <div className="grid g3">
        <Card title="Taxa de atingimento" freq="mensal" q="O resultado vem do time ou de uma pessoa?">
          <div className="alist">
            <AlertItem st={d.atingimento.noRitmo === d.atingimento.comMeta && d.atingimento.comMeta ? "good" : d.atingimento.noRitmo ? "warn" : "crit"} n={d.atingimento.noRitmo}
              sub={`com ${pct(d.pace)} do mês corrido`}>de {d.atingimento.comMeta} corretores com meta estão no ritmo</AlertItem>
            <AlertItem st={d.atingimento.semMeta.length ? "warn" : "good"} n={d.atingimento.semMeta.length} sub={d.atingimento.semMeta.join(", ") || "todos com meta"}>corretores ativos sem meta no mês</AlertItem>
            <AlertItem st={d.atingimento.muitoAtras ? "crit" : "good"} n={d.atingimento.muitoAtras} sub="vira exceção sinalizada, com nome">abaixo de metade do ritmo</AlertItem>
          </div>
        </Card>
        <Card title="Captações no mês" freq="mensal" q="O motor de estoque está rodando?" alert={d.captacoes.meta > 0 && d.captacoes.feitas < d.captacoes.meta * d.pace * 0.7}>
          <div className="stat">
            <div className="val" style={{ color: d.captacoes.meta && d.captacoes.feitas < d.captacoes.meta * d.pace * 0.7 ? "var(--crit)" : undefined }}>
              {d.captacoes.feitas} {d.captacoes.meta ? <small>/ {d.captacoes.meta}</small> : null}
            </div>
            <div className="sub">imóveis publicados (ganhos no funil de Captação) no mês</div>
          </div>
          {d.captacoes.meta ? <Pace frac={d.captacoes.feitas / d.captacoes.meta} pace={d.pace} left={pct(d.captacoes.feitas / d.captacoes.meta)} right={`meta ${d.captacoes.meta}`} /> : null}
        </Card>
        <Card title="VGV acumulado do ano" freq="mensal" q="O ano está sendo salvo ou perdido?">
          <Acumulado pontos={d.acumulado} />
          <p className="axnote">
            Realizado {mes.slice(0, 4)}: {brlCurto(d.acumulado.at(-1)?.real ?? 0)}
            {d.acumulado.at(-1)?.meta ? ` · meta acumulada ${brlCurto(d.acumulado.at(-1)!.meta)}` : " · metas do ano não cadastradas"}
          </p>
        </Card>
      </div>

      <Sec>Exceções — a única linha que desce ao indivíduo</Sec>
      <Card style={{ marginTop: 22 }} title="Preciso decidir alguma coisa?" freq="semanal"
        q="Gerado automaticamente: contas ≥ R$ 1 mi paradas 14+ dias em V3/V4, corretores abaixo de metade do ritmo, captação zerada.">
        <div className="alist">
          {d.excecoes.length ? d.excecoes.map((e, i) => <AlertItem key={i} st={e.nivel} n={e.nivel === "crit" ? "!" : "?"} sub={e.detalhe}>{e.titulo}</AlertItem>) : <p className="empty">Nenhuma exceção no momento.</p>}
        </div>
      </Card>

      <div className="vfoot">
        <p><b>Uma tela, sete minutos.</b> Se for preciso abrir outro relatório para responder “estamos no caminho ou não”, o painel não passou.</p>
        <p><b>O que não está aqui, de propósito:</b> contagem de atividades, conversão de lead, tarefas por corretor. É trabalho da gerência — sobe para cá apenas quando vira exceção.</p>
      </div>
    </div>
  );
}
