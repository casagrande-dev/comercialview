// Mapa da conta Pipedrive da Casagrande (lido da API em 07/10/2026).
// Se alguém renomear etapa ou criar campo novo no Pipedrive, é aqui que ajusta.

export const PIPELINE = { vendas: 7, captacao: 4, investidores: 5 } as const;

/** Etapas do funil de Vendas, na ordem. */
export const STAGES_VENDAS = [
  { id: 47, code: "Q1", nome: "Triagem Inicial" },
  { id: 48, code: "Q2", nome: "Investigação" },
  { id: 49, code: "Q3", nome: "Pré Aprovação Financeira" },
  { id: 33, code: "V1", nome: "Seleção de Imóveis" },
  { id: 34, code: "V2", nome: "Visitas" },
  { id: 35, code: "V3", nome: "Proposta" },
  { id: 36, code: "V4", nome: "Contrato" },
] as const;

export const STAGES_CAPTACAO = [
  { id: 18, code: "C1", nome: "Descoberta" },
  { id: 19, code: "C2", nome: "Avaliação do Imóvel" },
  { id: 20, code: "C3", nome: "Negociação de Termos" },
  { id: 21, code: "C4", nome: "Assinatura e Publicação" },
] as const;

export const STAGE = { V1: 33, V2: 34, V3: 35, V4: 36, C3: 20 } as const;

/** key_string dos tipos de atividade. "visita" (sem 1) é Pós Venda — não conta como visita. */
export const ACT = {
  ligacao: "call",
  whatsapp: "whatsapp",
  visita: "visita1",
  reuniao: "meeting",
  proposta: "proposta",
} as const;

export const TIPOS_ATIVIDADE = [
  { key: ACT.ligacao, nome: "Ligação", cor: "--s1" },
  { key: ACT.whatsapp, nome: "WhatsApp", cor: "--s2" },
  { key: ACT.visita, nome: "Visita", cor: "--s3" },
  { key: ACT.reuniao, nome: "Reunião", cor: "--s4" },
  { key: ACT.proposta, nome: "Proposta", cor: "--s5" },
] as const;

/** Campos personalizados de negócio (hash da API). */
export const FIELD = {
  comissao: "e5812afa6180a6c6f9ba9848e0bfac6073e16bba",
  exclusividade: "25c0a22217b4e9a311dd9df4ee98f9567ef0b84a",
  // GBANT — Goals, Budget, Authority, Needs, Timing
  goals: "353bffb7e06d7129ac3c965c0bd699594429e434",
  budget: "ba727f1d367dbecb1b7b7f352ce3d64f51c63e39",
  authority: "56ba64ef3bea88633212b76f90efe73c5ff4aea7",
  needs: "5f5c474b29d5b33f54cb8d5270e56a06b8aba0f3",
  timing: "6ae3ca34677938ae1a7172182c185edf2533f58a",
} as const;

export const EXCLUSIVIDADE_SIM = 261;

/** Premissas comerciais — as mesmas do layout de referência. */
export const PREMISSAS = {
  /** conversão proposta → ganho (Política Comercial) */
  taxaPropostaGanho: 0.33,
  /** taxa V4 → ganho: PROVISÓRIA até ser apurada */
  taxaContratoGanho: 0.67,
  /** visitas por proposta: HIPÓTESE da reunião de 28/08, ainda não medida */
  visitasPorProposta: 4,
  semanasPorMes: 4.3,
  /** honorário esperado sobre VGV, para a meta de honorários */
  honorarioSobreVgv: 0.05,
  /** dias sem mudança para considerar conta parada (PC 6.4) */
  diasParado: 7,
  /** SLA de primeiro contato em minutos (PC 6.3) */
  slaMinutos: 15,
} as const;

export const TIMEZONE = "America/Sao_Paulo";
