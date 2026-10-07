import "server-only";
import { createClient } from "./supabase/server";
import { getDataset } from "./pipedrive/client";
import { isValidYm, monthOf, today } from "./dates";
import type { Ctx, Meta } from "./metrics";

export function resolveMes(raw: string | string[] | undefined) {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return isValidYm(s) ? s : monthOf(today());
}

/**
 * Monta o contexto de cálculo. As metas são lidas com a sessão do usuário,
 * então o RLS garante que um corretor só recebe a própria meta.
 */
export async function loadCtx(mes: string): Promise<Ctx> {
  const supabase = await createClient();
  const [ds, metasRes] = await Promise.all([
    getDataset(),
    supabase.from("metas").select("pipedrive_user_id, meta_vgv, meta_captacoes").eq("mes", `${mes}-01`),
  ]);
  const metas = new Map<number, Meta>();
  for (const m of metasRes.data ?? [])
    metas.set(Number(m.pipedrive_user_id), { meta_vgv: Number(m.meta_vgv), meta_captacoes: Number(m.meta_captacoes) });
  return { ds, mes, hoje: today(), metas };
}

/** Meta total por mês do ano (só gestor tem RLS para ler todas). */
export async function loadMetasAno(ano: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("metas").select("mes, meta_vgv").gte("mes", `${ano}-01-01`).lte("mes", `${ano}-12-01`);
  const m = new Map<string, number>();
  for (const r of data ?? []) {
    const k = String(r.mes).slice(0, 7);
    m.set(k, (m.get(k) ?? 0) + Number(r.meta_vgv));
  }
  return m;
}
