import "server-only";
import { unstable_cache } from "next/cache";
import { FIELD, PIPELINE } from "./config";

const BASE = "https://api.pipedrive.com";

function token() {
  const t = process.env.PIPEDRIVE_API_TOKEN;
  if (!t) throw new Error("PIPEDRIVE_API_TOKEN não configurado");
  return t;
}

async function pd<T>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { "x-api-token": token() }, cache: "no-store" });
  if (!res.ok) throw new Error(`Pipedrive ${path} respondeu ${res.status}`);
  const json = await res.json();
  if (json.success === false) throw new Error(`Pipedrive ${path}: ${json.error ?? "erro"}`);
  return json as T;
}

type Page<T> = { data: T[] | null; additional_data?: { next_cursor?: string | null; pagination?: { more_items_in_collection?: boolean; next_start?: number } } };

async function allV2<T>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 100; i++) {
    const r = await pd<Page<T>>(path, { ...params, limit: 500, ...(cursor ? { cursor } : {}) });
    out.push(...(r.data ?? []));
    cursor = r.additional_data?.next_cursor ?? undefined;
    if (!cursor) break;
  }
  return out;
}

async function allV1<T>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T[]> {
  const out: T[] = [];
  let start = 0;
  for (let i = 0; i < 100; i++) {
    const r = await pd<Page<T>>(path, { ...params, limit: 500, start });
    out.push(...(r.data ?? []));
    const p = r.additional_data?.pagination;
    if (!p?.more_items_in_collection) break;
    start = p.next_start ?? start + 500;
  }
  return out;
}

/* ---------- formas enxutas (só o que os painéis usam) ---------- */

export type Deal = {
  id: number;
  title: string;
  pipeline: number;
  stage: number;
  owner: number;
  value: number;
  status: "open" | "won" | "lost" | "deleted";
  addTime: string;
  wonTime: string | null;
  lostTime: string | null;
  stageChangeTime: string | null;
  lostReason: string | null;
  archived: boolean;
  comissao: number;
  exclusividade: boolean;
  gbant: number; // 0..5 campos preenchidos
};

export type Activity = {
  id: number;
  type: string;
  owner: number;
  done: boolean;
  dueDate: string | null;
  dueTime: string | null;
  addTime: string;
  doneTime: string | null;
  dealId: number | null;
  leadId: string | null;
  subject: string;
};

export type Lead = { id: string; owner: number; addTime: string; archived: boolean };
export type PdUser = { id: number; name: string; email: string; active: boolean };

export type Dataset = {
  fetchedAt: string;
  users: PdUser[];
  deals: Deal[];
  activities: Activity[];
  leads: Lead[];
};

type RawDeal = {
  id: number; title: string; pipeline_id: number; stage_id: number; owner_id: number; value: number | null;
  status: Deal["status"]; add_time: string; won_time: string | null; lost_time: string | null;
  stage_change_time: string | null; lost_reason: string | null; is_archived?: boolean;
  custom_fields?: Record<string, unknown>;
};

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v && "value" in v) return Number((v as { value: unknown }).value) || 0;
  return Number(v) || 0;
}

function filled(v: unknown) {
  if (v == null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function slimDeal(d: RawDeal): Deal {
  const cf = d.custom_fields ?? {};
  return {
    id: d.id,
    title: d.title,
    pipeline: d.pipeline_id,
    stage: d.stage_id,
    owner: d.owner_id,
    value: d.value ?? 0,
    status: d.status,
    addTime: d.add_time,
    wonTime: d.won_time,
    lostTime: d.lost_time,
    stageChangeTime: d.stage_change_time,
    lostReason: d.lost_reason || null,
    archived: !!d.is_archived,
    comissao: num(cf[FIELD.comissao]),
    exclusividade: num(cf[FIELD.exclusividade]) === 261,
    gbant: [FIELD.goals, FIELD.budget, FIELD.authority, FIELD.needs, FIELD.timing].filter((k) => filled(cf[k])).length,
  };
}

export async function fetchDataset(): Promise<Dataset> {
  // 10 semanas de atividades bastam para a série de 8 semanas + a semana corrente
  const since = new Date(Date.now() - 70 * 864e5).toISOString().slice(0, 19) + "Z";

  const [users, dealsArrays, archived, recentActs, openActs, leads] = await Promise.all([
    allV1<{ id: number; name: string; email: string; active_flag: boolean }>("/v1/users"),
    Promise.all(
      [PIPELINE.vendas, PIPELINE.captacao].flatMap((pipeline_id) =>
        (["open", "won", "lost"] as const).map((status) => allV2<RawDeal>("/api/v2/deals", { pipeline_id, status })),
      ),
    ),
    // negócios arquivados não vêm na listagem padrão
    allV2<RawDeal>("/api/v2/deals/archived", { pipeline_id: PIPELINE.vendas }).catch(() => [] as RawDeal[]),
    allV2<RawActivity>("/api/v2/activities", { updated_since: since }),
    allV2<RawActivity>("/api/v2/activities", { done: false }),
    allV1<{ id: string; owner_id: number; add_time: string; is_archived: boolean }>("/v1/leads", { archived_status: "all" }),
  ]);

  const deals = new Map<number, Deal>();
  for (const d of [...dealsArrays.flat(), ...archived.map((d) => ({ ...d, is_archived: true }))]) deals.set(d.id, slimDeal(d));

  const acts = new Map<number, Activity>();
  for (const a of [...recentActs, ...openActs]) if (!a.is_deleted) acts.set(a.id, slimActivity(a));

  return {
    fetchedAt: new Date().toISOString(),
    users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, active: u.active_flag })),
    deals: [...deals.values()],
    activities: [...acts.values()],
    leads: leads.map((l) => ({ id: l.id, owner: l.owner_id, addTime: l.add_time, archived: l.is_archived })),
  };
}

type RawActivity = {
  id: number; type: string; owner_id: number; done: boolean; due_date: string | null; due_time: string | null;
  add_time: string; marked_as_done_time: string | null; deal_id: number | null; lead_id: string | null;
  subject: string; is_deleted: boolean;
};

function slimActivity(a: RawActivity): Activity {
  return {
    id: a.id,
    type: a.type,
    owner: a.owner_id,
    done: a.done,
    dueDate: a.due_date,
    dueTime: a.due_time,
    addTime: a.add_time,
    doneTime: a.marked_as_done_time,
    dealId: a.deal_id,
    leadId: a.lead_id,
    subject: a.subject,
  };
}

/** Uma busca a cada 5 minutos para todo mundo; o recorte por corretor é feito depois, no servidor. */
export const getDataset = unstable_cache(fetchDataset, ["pipedrive-dataset-v1"], {
  revalidate: 300,
  tags: ["pipedrive"],
});
