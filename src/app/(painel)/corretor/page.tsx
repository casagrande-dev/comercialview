import Link from "next/link";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { loadCtx, resolveMes } from "@/lib/data";
import { equipe, painelCorretor } from "@/lib/metrics";
import { daysInMonth, mesesOpcoes, monthOf, nomeMes } from "@/lib/dates";
import { brl, brlCurto, fmtMin, pct } from "@/lib/format";
import { PREMISSAS } from "@/lib/pipedrive/config";
import { AlertItem, Card, Delta, MiniBar, Pace, Sec, statusRitmo } from "@/components/ui";
import { FunnelBars, WeeklyBars } from "@/components/charts";
import { MesSelect } from "@/components/nav";

export const metadata = { title: "Corretor · Painéis Casagrande" };

export default async function CorretorPage(props: PageProps<"/corretor">) {
  const sp = await props.searchParams;
  const mes = resolveMes(sp.mes);
  // em paralelo: o redirect de requireProfile acontece antes de qualquer dado ser renderizado
  const [profile, ctx] = await Promise.all([requireProfile(), loadCtx(mes)]);

  // ——— quem é o dono dos dados desta tela ———
  // Corretor: SEMPRE o próprio vínculo do profile. Qualquer ?u= é ignorado.
  // Gestor: pode escolher qualquer usuário do Pipedrive.
  let owner: number | null = profile.pipedrive_user_id;
  const time = profile.role === "gestor" ? equipe(ctx) : [];
  if (profile.role === "gestor") {
    const pedido = Number(Array.isArray(sp.u) ? sp.u[0] : sp.u);
    if (Number.isInteger(pedido) && ctx.ds.users.some((u) => u.id === pedido)) owner = pedido;
    else if (!owner || !time.some((t) => t.id === owner)) owner = time[0]?.id ?? owner;
  }

  if (!owner) {
    return (
      <div className="view" style={{ "--tone": "var(--op)" } as React.CSSProperties}>
        <div className="viewbar"><div><h2>Meu painel</h2></div></div>
        <p className="empty" style={{ marginTop: 22 }}>Sua conta ainda não está vinculada a um usuário do Pipedrive. Peça para a gestão fazer o vínculo.</p>
      </div>
    );
  }

  const d = painelCorretor(ctx, owner);
  const dia = monthOf(ctx.hoje) === mes ? Number(ctx.hoje.slice(8)) : null;
  const metaVgv = d.vgv.meta;
  const fracVgv = metaVgv ? d.vgv.realizado / metaVgv : 0;
  const deveria = metaVgv ? metaVgv * d.pace : 0;
  const stVgv = metaVgv ? statusRitmo(fracVgv, d.pace) : "mute";
  const falta = metaVgv ? Math.max(0, metaVgv - d.vgv.realizado) : null;
  const gapProj = metaVgv ? metaVgv - d.previsao.projecao : null;
  const propsFaltam = gapProj && gapProj > 0 && d.ticket ? Math.ceil(gapProj / d.ticket / PREMISSAS.taxaPropostaGanho) : 0;
  const primeiro = d.nome.split(" ")[0];
  const proprio = owner === profile.pipedrive_user_id;

  return (
    <div className="view" style={{ "--tone": "var(--op)" } as React.CSSProperties}>
      <div className="viewbar">
        <div>
          <h2>{proprio ? "Meu painel" : `Painel de ${primeiro}`}</h2>
          <p className="sub">
            {d.nome} · {nomeMes(mes)}
            {dia ? ` · dia ${dia} de ${daysInMonth(mes)} (${pct(d.pace)} do mês corrido)` : ""}
          </p>
        </div>
        <Suspense><MesSelect mes={mes} opcoes={mesesOpcoes(ctx.hoje)} /></Suspense>
      </div>

      {profile.role === "gestor" && (
        <div className="selector" role="group" aria-label="Corretor">
          {time.map((t) => (
            <Link key={t.id} className="pill" href={`/corretor?u=${t.id}&mes=${mes}`} aria-current={t.id === owner ? "page" : undefined}>
              {t.nome.split(" ")[0]}
            </Link>
          ))}
        </div>
      )}

      <Sec>Onde eu estou</Sec>
      <div className="grid g4">
        <Card title="VGV do mês" freq="diária" q="Estou adiantado ou atrasado hoje?">
          <div className="stat">
            <div className="val">{brlCurto(d.vgv.realizado)}</div>
            <div className="sub">{metaVgv ? `meta ${brl(metaVgv)}` : "sem meta cadastrada para o mês"} · {d.vgv.ganhos} negócio(s) ganho(s)</div>
          </div>
          {metaVgv ? (
            <>
              <Pace frac={fracVgv} pace={d.pace} label={`DEVERIA: ${pct(d.pace)}`} left={`${pct(fracVgv)} da meta`} right={falta ? `−${brlCurto(falta)}` : "meta batida"} />
              <Delta st={stVgv}>
                {stVgv === "good" ? "▲ no ritmo" : stVgv === "warn" ? "■ um pouco atrás" : `▼ atrás do ritmo · deveria estar em ${brlCurto(deveria)}`}
              </Delta>
            </>
          ) : null}
        </Card>

        <Card title="Meus honorários" freq="semanal" q="Quanto eu vou receber?">
          <div className="stat">
            <div className="val">{brlCurto(d.honorarios.valor)}</div>
            <div className="sub">campo “Comissão” dos negócios ganhos no mês</div>
          </div>
          {d.honorarios.meta ? (
            <Pace frac={d.honorarios.valor / d.honorarios.meta} pace={d.pace} left={`meta ${brlCurto(d.honorarios.meta)}`} right={pct(d.honorarios.valor / d.honorarios.meta)} />
          ) : null}
        </Card>

        <Card title="Meu funil aberto" freq="diária" q="Tenho conta suficiente para o que falta?">
          <div className="stat">
            <div className="val">{d.funil.contas} <small>contas</small></div>
            <div className="sub">{brlCurto(d.funil.valor)} em valor aberto{falta ? ` · falta fechar ${brlCurto(falta)}` : ""}</div>
          </div>
          {falta != null && falta > 0 && (
            d.funil.valor >= falta * 3
              ? <Delta st="good">▲ volume existe — o gargalo é ritmo, não estoque</Delta>
              : <Delta st="warn">■ funil curto para o que falta</Delta>
          )}
        </Card>

        <Card title="Captações no mês" freq="semanal" q="Estou alimentando o estoque?">
          <div className="stat">
            <div className="val">{d.captacoes.feitas} {d.captacoes.meta ? <small>/ {d.captacoes.meta}</small> : null}</div>
            <div className="sub">imóveis ganhos no funil de Captação (C4 — assinatura e publicação)</div>
          </div>
          {d.captacoes.meta ? (
            <Pace frac={d.captacoes.feitas / d.captacoes.meta} pace={d.pace} left={`${d.captacoes.emNegociacao} em negociação de termos`} right={pct(d.captacoes.feitas / d.captacoes.meta)} />
          ) : null}
        </Card>
      </div>

      <Sec>O ritmo desta semana</Sec>
      <div className="grid g21">
        <Card title="Estou no ritmo?" freq="semanal" q="O que eu fiz esta semana × o que precisaria fazer para bater a meta do mês.">
          <div className="rit">
            {[
              { l: "Visitas", s: "nesta semana", feito: d.ritmo.visitas, esp: d.esperado?.vis ?? null },
              { l: "Propostas", s: "nesta semana", feito: d.ritmo.propostas, esp: d.esperado?.prop ?? null },
              { l: "Contas trabalhadas", s: "com atividade concluída", feito: d.ritmo.contas, esp: null },
            ].map((r) => {
              const ok = r.esp != null && r.feito >= r.esp;
              const cor = r.esp == null ? "var(--ink-3)" : ok ? "var(--good)" : "var(--crit)";
              return (
                <div className="rit-row" key={r.l}>
                  <div className="lbl">{r.l}<s>{r.s}</s></div>
                  <div style={{ height: 12 }}><MiniBar frac={r.esp ? r.feito / r.esp : 0} pace={r.esp ? 1 : undefined} color={cor} /></div>
                  <div className="num">
                    <b>{r.feito}</b>
                    {r.esp != null ? <> / {r.esp} {ok ? <span className="pos">✓</span> : <span className="neg">▼{r.esp - r.feito}</span>}</> : <> / <span style={{ color: "var(--warn)" }}>?</span></>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="note">
            {d.esperado && metaVgv ? (
              <>
                <b>De onde vem o “deveria”:</b> meta {brl(metaVgv)} ÷ ticket médio {brl(d.ticket)} ÷ {pct(PREMISSAS.taxaPropostaGanho)} de conversão proposta→ganho ÷ {String(PREMISSAS.semanasPorMes).replace(".", ",")} semanas ≈ <b>{d.esperado.prop} {d.esperado.prop === 1 ? "proposta" : "propostas"} por semana</b>. Com {PREMISSAS.visitasPorProposta} visitas por proposta, são <b>{d.esperado.vis} visitas por semana</b> — <em>essa taxa ainda é hipótese e precisa ser medida.</em>
              </>
            ) : (
              <>Sem meta cadastrada no mês, não há ritmo esperado. A gestão cadastra a meta em “Usuários e metas”.</>
            )}
          </p>
        </Card>
        <Card title="Minhas visitas, semana a semana" freq="semanal" q="Estou melhorando ou piorando em relação a mim mesmo?">
          <WeeklyBars data={d.visitasSemanas} alvo={d.esperado?.vis ?? null} label="Visitas concluídas por semana nas últimas 8 semanas" />
          {d.esperado && <p className="axnote">Linha preta = ritmo esperado ({d.esperado.vis}/semana)</p>}
        </Card>
      </div>

      <Sec>Meu funil e minha previsão</Sec>
      <div className="grid g2">
        <Card title="Contas por etapa" freq="diária" q="Onde meu funil está empoçando?">
          <FunnelBars etapas={d.etapas} />
          <p className="axnote">Funil de Vendas · negócios abertos · valor abaixo de cada etapa</p>
        </Card>
        <Card title="Minha previsão de fechamento" freq="semanal" q="Com o que tenho na mesa, eu bato a meta?">
          <div className="tw">
            <table>
              <thead><tr><th>Etapa</th><th className="r">Valor aberto</th><th className="r">Taxa até ganho</th><th className="r">Forecast</th></tr></thead>
              <tbody>
                <tr><td className="nm">Realizado</td><td className="r">—</td><td className="r">—</td><td className="r">{brlCurto(d.previsao.realizado)}</td></tr>
                <tr><td className="nm">V3 — Proposta</td><td className="r">{brlCurto(d.previsao.v3)}</td><td className="r">{pct(PREMISSAS.taxaPropostaGanho)}</td><td className="r">{brlCurto(d.previsao.fc3)}</td></tr>
                <tr><td className="nm">V4 — Contrato</td><td className="r">{brlCurto(d.previsao.v4)}</td><td className="r"><span className="flag f-warn" title="taxa provisória">{pct(PREMISSAS.taxaContratoGanho)}*</span></td><td className="r">{brlCurto(d.previsao.fc4)}</td></tr>
                <tr><td className="nm">V1–V2</td><td className="r">{brlCurto(d.previsao.v12)}</td><td className="r"><span className="flag f-warn">a apurar</span></td><td className="r">—</td></tr>
                <tr className="tot">
                  <td>Projeção do mês</td><td className="r" /><td className="r">{metaVgv ? `meta ${brlCurto(metaVgv)}` : ""}</td>
                  <td className={`r ${metaVgv ? (d.previsao.projecao >= metaVgv ? "pos" : "neg") : ""}`}>{brlCurto(d.previsao.projecao)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="note">
            {metaVgv ? (
              gapProj! > 0 ? (
                <><b>Leitura:</b> com o que está na mesa, {proprio ? "você fecha" : `${primeiro} fecha`} {nomeMes(mes)} em {brlCurto(d.previsao.projecao)} — <b>faltam {brlCurto(gapProj!)}, ou {propsFaltam} proposta(s) nova(s).</b> V1–V2 não entram porque a taxa ainda não foi apurada.</>
              ) : (
                <><b>Leitura:</b> o funil atual cobre a meta. Agora é converter.</>
              )
            ) : (
              <>Forecast = valor aberto × taxa da etapa. *Taxa V4 provisória.</>
            )}
          </p>
        </Card>
      </div>

      <Sec>O que eu faço hoje</Sec>
      <div className="grid g3">
        <Card title="Contas sem próximo passo" freq="diária" q="Alvo: zero. Card sem atividade agendada é conta largada." alert={d.higiene.semProxima > 0}>
          <div className="alist">
            <AlertItem st={d.higiene.semProxima ? "crit" : "good"} n={d.higiene.semProxima} sub="negócio aberto sem nenhuma atividade pendente">Sem próxima atividade no CRM</AlertItem>
            <AlertItem st={d.higiene.paradosV1V4 ? "warn" : "good"} n={d.higiene.paradosV1V4} sub="Política Comercial 6.4 — podem ser redistribuídas">Paradas há mais de {PREMISSAS.diasParado} dias em V1–V4</AlertItem>
          </div>
        </Card>
        <Card title="SLA de primeiro contato" freq="diária" q={`${PREMISSAS.slaMinutos} minutos no horário comercial (PC 6.3).`} alert={d.leads.semContato > 0}>
          <div className="alist">
            <AlertItem st={d.leads.semContato ? "crit" : "good"} n={d.leads.semContato}
              sub={d.leads.semContatoMaisAntigoMin ? `o mais antigo chegou há ${fmtMin(d.leads.semContatoMaisAntigoMin)}` : "nenhum lead esperando"}>
              Lead sem primeiro contato agora
            </AlertItem>
            <AlertItem st="good" n={d.leads.dentroSla}
              sub={d.leads.tempoMedioMin != null ? `tempo médio até a 1ª atividade: ${fmtMin(d.leads.tempoMedioMin)} (${d.leads.semana} lead(s) na semana)` : `${d.leads.semana} lead(s) na semana`}>
              Leads atendidos dentro do SLA nesta semana
            </AlertItem>
          </div>
        </Card>
        <Card title="Minha agenda de hoje" freq="diária" q="O que já está programado — e o que sobra do dia.">
          <div className="alist">
            <AlertItem st={d.agenda.visitasHoje.length ? "good" : "mute"} n={d.agenda.visitasHoje.length}
              sub={d.agenda.visitasHoje.map((v) => `${v.hora ? v.hora + " " : ""}${v.assunto}`).join(" · ") || `${d.agenda.atividadesHoje} atividade(s) no total hoje`}>
              Visitas agendadas
            </AlertItem>
            <AlertItem st={d.agenda.vencidas ? "warn" : "good"} n={d.agenda.vencidas} sub="atividades com prazo estourado">Follow-ups vencidos</AlertItem>
          </div>
        </Card>
      </div>

      <div className="vfoot">
        <p><b>Dados ao vivo do Pipedrive</b>, atualizados a cada 5 minutos (última leitura {new Date(ctx.ds.fetchedAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}). Para corrigir um número, corrija o card no CRM.</p>
        <p><b>O que deliberadamente não está aqui:</b> comparação com os colegas e ranking. Diagnóstico entra na 1:1 de segunda, conduzida pela gestão.</p>
      </div>
    </div>
  );
}

