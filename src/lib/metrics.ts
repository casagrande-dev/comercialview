import "server-only";
import type { Activity, Dataset, Deal } from "./pipedrive/client";
import { ACT, PIPELINE, PREMISSAS, STAGE, STAGES_VENDAS, TIPOS_ATIVIDADE } from "./pipedrive/config";
import { addDays, daysInMonth, diffDays, localDay, monthOf, toUtcMs, weekStart } from "./dates";

export type Meta = { meta_vgv: number; meta_captacoes: number };

export type Ctx = {
  ds: Dataset;
  mes: string; // YYYY-MM
  hoje: string; // YYYY-MM-DD (São Paulo)
  metas: Map<number, Meta>; // metas do mês selecionado, por pipedrive_user_id
};

/* ---------- utilitários de recorte ---------- */

const isVendas = (d: Deal) => d.pipeline === PIPELINE.vendas;
const isCaptacao = (d: Deal) => d.pipeline === PIPELINE.captacao;
const openVendas = (d: Deal) => isVendas(d) && d.status === "open" && !d.archived;
const wonIn = (mes: string) => (d: Deal) => d.status === "won" && monthOf(localDay(d.wonTime) ?? "") === mes;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Fração do mês já corrida: 1 para meses passados, 0 para futuros. */
export function pace(ctx: Pick<Ctx, "mes" | "hoje">) {
  const cur = monthOf(ctx.hoje);
  if (ctx.mes < cur) return 1;
  if (ctx.mes > cur) return 0;
  return Number(ctx.hoje.slice(8, 10)) / daysInMonth(ctx.mes);
}

/** Semanas (segunda-feira) das últimas 8, a última é a corrente. */
export function ultimasSemanas(hoje: string, n = 8) {
  const w = weekStart(hoje);
  return Array.from({ length: n }, (_, i) => addDays(w, -7 * (n - 1 - i)));
}

const doneDay = (a: Activity) => a.dueDate ?? localDay(a.doneTime);

function ticketMedio(ds: Dataset, hoje: string, owner?: number) {
  const desde = addDays(hoje, -365);
  const ganhos = ds.deals.filter(
    (d) => isVendas(d) && d.status === "won" && d.value > 0 && (localDay(d.wonTime) ?? "") >= desde && (owner == null || d.owner === owner),
  );
  return ganhos.length ? sum(ganhos.map((d) => d.value)) / ganhos.length : null;
}

/** Ticket do corretor, ou da equipe se ele ainda não tem histórico. */
function ticketDe(ds: Dataset, hoje: string, owner: number) {
  return ticketMedio(ds, hoje, owner) ?? ticketMedio(ds, hoje) ?? 0;
}

/** Ritmo semanal esperado derivado da meta: meta ÷ ticket ÷ 33% ÷ 4,3 semanas; visitas = propostas × 4 (hipótese). */
export function esperado(meta: number | undefined, ticket: number) {
  if (!meta || !ticket) return null;
  const prop = Math.max(1, Math.round(meta / ticket / PREMISSAS.taxaPropostaGanho / PREMISSAS.semanasPorMes));
  return { prop, vis: prop * PREMISSAS.visitasPorProposta };
}

function forecastDe(deals: Deal[]) {
  const v3 = sum(deals.filter((d) => d.stage === STAGE.V3).map((d) => d.value));
  const v4 = sum(deals.filter((d) => d.stage === STAGE.V4).map((d) => d.value));
  const v12 = sum(deals.filter((d) => d.stage === STAGE.V1 || d.stage === STAGE.V2).map((d) => d.value));
  const fc3 = v3 * PREMISSAS.taxaPropostaGanho;
  const fc4 = v4 * PREMISSAS.taxaContratoGanho;
  return { v3, v4, v12, fc3, fc4, total: fc3 + fc4 };
}

function pendentesPorDeal(ds: Dataset) {
  const s = new Set<number>();
  for (const a of ds.activities) if (!a.done && a.dealId) s.add(a.dealId);
  return s;
}

function ultimaAtividadePorDeal(ds: Dataset) {
  const m = new Map<number, string>();
  for (const a of ds.activities) {
    if (!a.done || !a.dealId) continue;
    const d = doneDay(a);
    if (d && (!m.has(a.dealId) || d > m.get(a.dealId)!)) m.set(a.dealId, d);
  }
  return m;
}

function higieneDe(ctx: Ctx, owner: number) {
  const { ds, hoje } = ctx;
  const abertos = ds.deals.filter((d) => openVendas(d) && d.owner === owner);
  const pend = pendentesPorDeal(ds);
  const ultima = ultimaAtividadePorDeal(ds);
  const limite = addDays(hoje, -PREMISSAS.diasParado);
  const parado = (d: Deal) => {
    const mud = localDay(d.stageChangeTime ?? d.addTime) ?? hoje;
    const ult = ultima.get(d.id);
    return mud < limite && (!ult || ult < limite);
  };
  const avancados = abertos.filter((d) => [STAGE.V1, STAGE.V2, STAGE.V3, STAGE.V4].includes(d.stage as 33));
  const desde90 = addDays(hoje, -90);
  return {
    semProxima: abertos.filter((d) => !pend.has(d.id)).length,
    paradosV1V4: avancados.filter(parado).length,
    paradosV3V4: abertos.filter((d) => (d.stage === STAGE.V3 || d.stage === STAGE.V4) && parado(d)).length,
    semMotivo:
      ds.deals.filter((d) => isVendas(d) && d.owner === owner && d.status === "lost" && !d.lostReason && (localDay(d.lostTime) ?? "") >= desde90).length +
      ds.deals.filter((d) => isVendas(d) && d.owner === owner && d.archived && d.status === "open").length,
    gbant: avancados.length ? avancados.filter((d) => d.gbant === 5).length / avancados.length : null,
    vencidas: ds.activities.filter((a) => !a.done && a.owner === owner && a.dueDate && a.dueDate < hoje).length,
  };
}

function leadsDe(ctx: Ctx, owner: number) {
  const { ds, hoje } = ctx;
  const semana = weekStart(hoje);
  const primeiro = new Map<string, number>();
  for (const a of ds.activities) {
    if (!a.leadId) continue;
    const t = toUtcMs(a.addTime);
    if (!primeiro.has(a.leadId) || t < primeiro.get(a.leadId)!) primeiro.set(a.leadId, t);
  }
  const meus = ds.leads.filter((l) => l.owner === owner);
  const daSemana = meus.filter((l) => (localDay(l.addTime) ?? "") >= semana);
  const tempos = daSemana
    .filter((l) => primeiro.has(l.id))
    .map((l) => Math.max(0, (primeiro.get(l.id)! - toUtcMs(l.addTime)) / 60000));
  const agora = Date.now();
  const semContato = meus.filter(
    (l) => !l.archived && !primeiro.has(l.id) && agora - toUtcMs(l.addTime) > PREMISSAS.slaMinutos * 60000,
  );
  return {
    semana: daSemana.length,
    tempoMedioMin: tempos.length ? sum(tempos) / tempos.length : null,
    dentroSla: tempos.filter((t) => t <= PREMISSAS.slaMinutos).length,
    semContato: semContato.length,
    semContatoMaisAntigoMin: semContato.length ? Math.max(...semContato.map((l) => (agora - toUtcMs(l.addTime)) / 60000)) : null,
  };
}

function seriesDe(ds: Dataset, owner: number | null, semanas: string[]) {
  const idx = new Map(semanas.map((w, i) => [w, i]));
  const series = TIPOS_ATIVIDADE.map(() => semanas.map(() => 0));
  const contas = semanas.map(() => new Set<number>());
  for (const a of ds.activities) {
    if (!a.done || (owner != null && a.owner !== owner)) continue;
    const d = doneDay(a);
    if (!d) continue;
    const i = idx.get(weekStart(d));
    if (i == null) continue;
    const t = TIPOS_ATIVIDADE.findIndex((x) => x.key === a.type);
    if (t >= 0) series[t][i]++;
    if (a.dealId) contas[i].add(a.dealId);
  }
  return { series, contas: contas.map((s) => s.size) };
}

/* ---------- equipe ---------- */

/** Quem aparece nos painéis de equipe: usuários ativos com meta no mês ou com movimento recente no Pipedrive. */
export function equipe(ctx: Ctx) {
  const { ds, mes, hoje } = ctx;
  const desde = addDays(hoje, -63);
  const ativos = new Set<number>(ctx.metas.keys());
  for (const d of ds.deals) if (isVendas(d) && (d.status === "open" || wonIn(mes)(d))) ativos.add(d.owner);
  for (const a of ds.activities) if (a.done && (doneDay(a) ?? "") >= desde) ativos.add(a.owner);
  return ds.users
    .filter((u) => u.active && ativos.has(u.id))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((u) => ({ id: u.id, nome: u.name }));
}

/* ---------- painel do corretor ---------- */

export function painelCorretor(ctx: Ctx, owner: number) {
  const { ds, mes, hoje } = ctx;
  const p = pace(ctx);
  const meta = ctx.metas.get(owner);
  const ganhos = ds.deals.filter((d) => isVendas(d) && d.owner === owner && wonIn(mes)(d));
  const realizado = sum(ganhos.map((d) => d.value));
  const honorarios = sum(ganhos.map((d) => d.comissao));
  const abertos = ds.deals.filter((d) => openVendas(d) && d.owner === owner);
  const ticket = ticketDe(ds, hoje, owner);
  const esp = esperado(meta?.meta_vgv, ticket);

  const semanas = ultimasSemanas(hoje);
  const { series, contas } = seriesDe(ds, owner, semanas);
  const iVis = TIPOS_ATIVIDADE.findIndex((t) => t.key === ACT.visita);
  const iProp = TIPOS_ATIVIDADE.findIndex((t) => t.key === ACT.proposta);

  const capt = ds.deals.filter((d) => isCaptacao(d) && d.owner === owner);
  const fc = forecastDe(abertos);

  const minhasPendentes = ds.activities.filter((a) => !a.done && a.owner === owner);
  const deHoje = minhasPendentes
    .filter((a) => a.dueDate === hoje)
    .sort((a, b) => (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99"));

  return {
    owner,
    nome: ds.users.find((u) => u.id === owner)?.name ?? `Usuário ${owner}`,
    pace: p,
    vgv: { realizado, meta: meta?.meta_vgv ?? null, ganhos: ganhos.length },
    honorarios: { valor: honorarios, meta: meta ? meta.meta_vgv * PREMISSAS.honorarioSobreVgv : null },
    funil: { contas: abertos.length, valor: sum(abertos.map((d) => d.value)) },
    captacoes: {
      feitas: capt.filter(wonIn(mes)).length,
      meta: meta?.meta_captacoes ?? null,
      emNegociacao: capt.filter((d) => d.status === "open" && d.stage === STAGE.C3).length,
    },
    ticket,
    esperado: esp,
    ritmo: {
      visitas: series[iVis][7],
      propostas: series[iProp][7],
      contas: contas[7],
    },
    visitasSemanas: series[iVis],
    etapas: STAGES_VENDAS.map((s) => {
      const ds_ = abertos.filter((d) => d.stage === s.id);
      return { code: s.code, nome: s.nome, q: ds_.length, v: sum(ds_.map((d) => d.value)) };
    }),
    previsao: { realizado, ...fc, projecao: realizado + fc.total },
    higiene: higieneDe(ctx, owner),
    leads: leadsDe(ctx, owner),
    agenda: {
      visitasHoje: deHoje.filter((a) => a.type === ACT.visita).map((a) => ({ hora: a.dueTime?.slice(0, 5) ?? null, assunto: a.subject })),
      atividadesHoje: deHoje.length,
      vencidas: minhasPendentes.filter((a) => a.dueDate && a.dueDate < hoje).length,
    },
  };
}

export type PainelCorretor = ReturnType<typeof painelCorretor>;

/* ---------- painel da gerência ---------- */

export function painelGerente(ctx: Ctx) {
  const { ds, mes, hoje } = ctx;
  const p = pace(ctx);
  const time = equipe(ctx);
  const semanas = ultimasSemanas(hoje);

  const linhas = time.map((u) => {
    const meta = ctx.metas.get(u.id);
    const ganhos = ds.deals.filter((d) => isVendas(d) && d.owner === u.id && wonIn(mes)(d));
    const real = sum(ganhos.map((d) => d.value));
    const ticket = ticketDe(ds, hoje, u.id);
    const abertos = ds.deals.filter((d) => openVendas(d) && d.owner === u.id);
    const fc = forecastDe(abertos).total;
    const { series } = seriesDe(ds, u.id, semanas);
    const capt = ds.deals.filter((d) => isCaptacao(d) && d.owner === u.id);
    const publicadas = capt.filter(wonIn(mes));
    const dias = publicadas.map((d) => diffDays(localDay(d.wonTime)!, localDay(d.addTime)!));
    return {
      ...u,
      meta: meta?.meta_vgv ?? null,
      metaCapt: meta?.meta_captacoes ?? null,
      real,
      ticket,
      fc,
      esperado: esperado(meta?.meta_vgv, ticket),
      series,
      higiene: higieneDe(ctx, u.id),
      leads: leadsDe(ctx, u.id),
      captacao: {
        iniciadas: capt.filter((d) => monthOf(localDay(d.addTime) ?? "") === mes).length,
        publicadas: publicadas.length,
        exclusividade: publicadas.filter((d) => d.exclusividade).length,
        diasPublicar: dias.length ? Math.round(sum(dias) / dias.length) : null,
      },
    };
  });

  const { contas } = seriesDe(ds, null, semanas);
  return { pace: p, semanas, linhas, contasSemana: contas, ticketEquipe: ticketMedio(ds, hoje) ?? 0 };
}

export type PainelGerente = ReturnType<typeof painelGerente>;

/* ---------- painel da diretoria ---------- */

export function painelDiretoria(ctx: Ctx, metasAno: Map<string, number>) {
  const { ds, mes, hoje } = ctx;
  const p = pace(ctx);
  const ger = painelGerente(ctx);
  const metaTotal = sum([...ctx.metas.values()].map((m) => m.meta_vgv));
  const realizado = sum(ds.deals.filter((d) => isVendas(d) && wonIn(mes)(d)).map((d) => d.value));
  const abertos = ds.deals.filter(openVendas);
  const fc = forecastDe(abertos);
  const gap = Math.max(0, metaTotal - realizado - fc.total);
  const ticket = ger.ticketEquipe;
  const propostas = gap > 0 && ticket ? Math.ceil(gap / ticket / PREMISSAS.taxaPropostaGanho) : 0;
  const diasRestantes = monthOf(hoje) === mes ? daysInMonth(mes) - Number(hoje.slice(8, 10)) : 0;

  const comMeta = ger.linhas.filter((l) => l.meta);
  const noRitmo = comMeta.filter((l) => l.real / l.meta! >= p);
  const muitoAtras = comMeta.filter((l) => l.real / l.meta! < p * 0.5);

  const captFeitas = sum(ger.linhas.map((l) => l.captacao.publicadas));
  const captMeta = sum([...ctx.metas.values()].map((m) => m.meta_captacoes));

  // acumulado do ano até o mês selecionado
  const ano = mes.slice(0, 4);
  const meses = Array.from({ length: Number(mes.slice(5)) }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
  let ra = 0, ma = 0;
  const acumulado = meses.map((m) => {
    ra += sum(ds.deals.filter((d) => isVendas(d) && wonIn(m)(d)).map((d) => d.value));
    ma += metasAno.get(m) ?? 0;
    return { mes: m, real: ra, meta: ma };
  });

  // exceções automáticas — o que pede decisão, não fiscalização
  const ultima = ultimaAtividadePorDeal(ds);
  const nomeDe = (id: number) => ds.users.find((u) => u.id === id)?.name.split(" ")[0] ?? "?";
  const excecoes: { nivel: "crit" | "warn"; titulo: string; detalhe: string }[] = [];
  for (const d of abertos) {
    if (d.stage !== STAGE.V3 && d.stage !== STAGE.V4) continue;
    const desde = localDay(d.stageChangeTime ?? d.addTime) ?? hoje;
    const dias = diffDays(hoje, desde);
    const ult = ultima.get(d.id);
    if (d.value >= 1_000_000 && dias >= 14)
      excecoes.push({
        nivel: "crit",
        titulo: `Conta de ${(d.value / 1e6).toFixed(2).replace(".", ",")} mi há ${dias} dias em ${d.stage === STAGE.V3 ? "V3" : "V4"} — ${nomeDe(d.owner)}`,
        detalhe: `${d.title}${ult ? ` · última atividade em ${ult.split("-").reverse().join("/")}` : " · sem atividade registrada"}`,
      });
  }
  for (const l of muitoAtras)
    excecoes.push({
      nivel: "crit",
      titulo: `${l.nome.split(" ")[0]} abaixo de metade do ritmo`,
      detalhe: `${Math.round((l.real / l.meta!) * 100)}% da meta com ${Math.round(p * 100)}% do mês corrido`,
    });
  if (captMeta > 0 && captFeitas === 0)
    excecoes.push({ nivel: "warn", titulo: "Nenhuma captação publicada no mês", detalhe: "falha de registro ou de execução?" });

  const cobertura = metaTotal ? (realizado + fc.total) / metaTotal : null;

  return {
    pace: p,
    metaTotal,
    realizado,
    forecast: fc,
    gap,
    propostas,
    visitas: propostas * PREMISSAS.visitasPorProposta,
    ticket,
    diasRestantes,
    cobertura,
    atingimento: {
      comMeta: comMeta.length,
      noRitmo: noRitmo.length,
      semMeta: ger.linhas.filter((l) => !l.meta).map((l) => l.nome.split(" ")[0]),
      muitoAtras: muitoAtras.length,
    },
    captacoes: { feitas: captFeitas, meta: captMeta },
    acumulado,
    excecoes,
  };
}

export type PainelDiretoria = ReturnType<typeof painelDiretoria>;
