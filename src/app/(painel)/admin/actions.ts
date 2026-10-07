"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireGestor } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getDataset } from "@/lib/pipedrive/client";
import { isValidYm } from "@/lib/dates";

export type AdminState = { error?: string; ok?: string; senha?: string; email?: string } | undefined;

function senhaTemporaria() {
  // 16 caracteres sem ambiguidade (sem 0/O/l/1), garantindo letra e número
  const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (;;) {
    const s = Array.from({ length: 16 }, () => abc[randomInt(abc.length)]).join("");
    if (/\d/.test(s) && /[a-zA-Z]/.test(s)) return s;
  }
}

async function pipedriveIdValido(raw: FormDataEntryValue | null) {
  if (raw == null || raw === "") return null;
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new Error("Usuário do Pipedrive inválido.");
  const ds = await getDataset();
  if (!ds.users.some((u) => u.id === id)) throw new Error("Usuário do Pipedrive não encontrado.");
  return id;
}

export async function criarUsuario(_: AdminState, form: FormData): Promise<AdminState> {
  await requireGestor();
  const nome = String(form.get("nome") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = String(form.get("role") ?? "corretor");
  if (!nome || nome.length > 120) return { error: "Informe o nome." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "E-mail inválido." };
  if (role !== "corretor" && role !== "gestor") return { error: "Papel inválido." };

  let pid: number | null;
  try {
    pid = await pipedriveIdValido(form.get("pipedrive_user_id"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (role === "corretor" && !pid) return { error: "Corretor precisa estar vinculado a um usuário do Pipedrive." };

  const admin = createAdminClient();
  if (pid) {
    const { data: ja } = await admin.from("profiles").select("email").eq("pipedrive_user_id", pid).maybeSingle();
    if (ja) return { error: `Esse usuário do Pipedrive já está vinculado a ${ja.email}.` };
  }

  const senha = senhaTemporaria();
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error || !data.user) return { error: error?.message.includes("already") ? "Já existe uma conta com esse e-mail." : "Não foi possível criar a conta." };

  const { error: pe } = await admin.from("profiles").insert({
    id: data.user.id, nome, email, role, pipedrive_user_id: pid, ativo: true, must_change_password: true,
  });
  if (pe) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: "Não foi possível criar o perfil." };
  }
  revalidatePath("/admin");
  return { ok: `Conta criada para ${nome}.`, senha, email };
}

export async function resetarSenha(_: AdminState, form: FormData): Promise<AdminState> {
  const eu = await requireGestor();
  const id = String(form.get("id") ?? "");
  if (id === eu.id) return { error: "Para trocar a sua senha, saia e use outro gestor, ou o painel do Supabase." };
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("email, nome").eq("id", id).single();
  if (!p) return { error: "Usuário não encontrado." };
  const senha = senhaTemporaria();
  const { error } = await admin.auth.admin.updateUserById(id, { password: senha });
  if (error) return { error: "Não foi possível resetar a senha." };
  await admin.from("profiles").update({ must_change_password: true }).eq("id", id);
  return { ok: `Senha de ${p.nome} resetada.`, senha, email: p.email };
}

export async function alternarAtivo(form: FormData) {
  const eu = await requireGestor();
  const id = String(form.get("id") ?? "");
  if (!id || id === eu.id) return;
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("ativo").eq("id", id).single();
  if (!p) return;
  const ativo = !p.ativo;
  await admin.from("profiles").update({ ativo }).eq("id", id);
  // bloqueia também no Auth: impede renovar sessão / logar de novo
  await admin.auth.admin.updateUserById(id, { ban_duration: ativo ? "none" : "876000h" });
  revalidatePath("/admin");
}

export async function atualizarUsuario(_: AdminState, form: FormData): Promise<AdminState> {
  const eu = await requireGestor();
  const id = String(form.get("id") ?? "");
  const role = String(form.get("role") ?? "");
  if (role !== "corretor" && role !== "gestor") return { error: "Papel inválido." };
  if (id === eu.id && role !== "gestor") return { error: "Você não pode remover o seu próprio acesso de gestor." };
  let pid: number | null;
  try {
    pid = await pipedriveIdValido(form.get("pipedrive_user_id"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (role === "corretor" && !pid) return { error: "Corretor precisa estar vinculado a um usuário do Pipedrive." };
  const admin = createAdminClient();
  if (pid) {
    const { data: ja } = await admin.from("profiles").select("id, email").eq("pipedrive_user_id", pid).neq("id", id).maybeSingle();
    if (ja) return { error: `Esse usuário do Pipedrive já está vinculado a ${ja.email}.` };
  }
  const { error } = await admin.from("profiles").update({ role, pipedrive_user_id: pid }).eq("id", id);
  if (error) return { error: "Não foi possível salvar." };
  revalidatePath("/admin");
  return { ok: "Salvo." };
}

export async function salvarMetas(_: AdminState, form: FormData): Promise<AdminState> {
  const eu = await requireGestor();
  const mes = String(form.get("mes") ?? "");
  if (!isValidYm(mes)) return { error: "Mês inválido." };
  const ds = await getDataset();
  const validos = new Set(ds.users.map((u) => u.id));

  const upserts: { pipedrive_user_id: number; mes: string; meta_vgv: number; meta_captacoes: number; updated_by: string; updated_at: string }[] = [];
  const remover: number[] = [];
  for (const [k, val] of form.entries()) {
    const m = /^vgv_(\d+)$/.exec(k);
    if (!m) continue;
    const pid = Number(m[1]);
    if (!validos.has(pid)) continue;
    const vgvRaw = String(val).replace(/\./g, "").replace(",", ".").trim();
    const capRaw = String(form.get(`cap_${pid}`) ?? "").trim();
    if (vgvRaw === "") {
      remover.push(pid);
      continue;
    }
    const vgv = Number(vgvRaw);
    const cap = capRaw === "" ? 4 : Number(capRaw);
    if (!Number.isFinite(vgv) || vgv < 0 || vgv > 1e9) return { error: `Meta de VGV inválida (${vgvRaw}).` };
    if (!Number.isInteger(cap) || cap < 0 || cap > 100) return { error: `Meta de captações inválida (${capRaw}).` };
    upserts.push({ pipedrive_user_id: pid, mes: `${mes}-01`, meta_vgv: vgv, meta_captacoes: cap, updated_by: eu.id, updated_at: new Date().toISOString() });
  }

  // gravado com a sessão do gestor — passa pela policy de RLS "metas: gestor escreve"
  const supabase = await createClient();
  if (upserts.length) {
    const { error } = await supabase.from("metas").upsert(upserts);
    if (error) return { error: "Não foi possível salvar as metas." };
  }
  if (remover.length) {
    await supabase.from("metas").delete().eq("mes", `${mes}-01`).in("pipedrive_user_id", remover);
  }
  revalidatePath("/", "layout");
  return { ok: `Metas de ${mes} salvas.` };
}
