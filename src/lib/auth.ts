import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Profile = {
  id: string;
  nome: string;
  email: string;
  role: "corretor" | "gestor";
  pipedrive_user_id: number | null;
  ativo: boolean;
  must_change_password: boolean;
};

/**
 * Sessão verificada no servidor: getClaims valida a assinatura do JWT (não confia só no cookie).
 * O perfil é relido a cada requisição, então desativar uma conta corta o acesso na hora.
 * Memoizada por requisição.
 */
export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nome, email, role, pipedrive_user_id, ativo, must_change_password")
    .eq("id", userId)
    .single<Profile>();
  if (!profile || !profile.ativo) return null;
  return profile;
});

/** Qualquer usuário logado e ativo. Sem profile = sem acesso (mesmo que a conta exista no Auth). */
export async function requireProfile(opts: { allowPasswordChange?: boolean } = {}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.must_change_password && !opts.allowPasswordChange) redirect("/trocar-senha");
  return profile;
}

export async function requireGestor() {
  const profile = await requireProfile();
  if (profile.role !== "gestor") redirect("/corretor");
  return profile;
}
