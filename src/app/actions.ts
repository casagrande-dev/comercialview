"use server";

import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export type FormState = { error?: string; ok?: string } | undefined;

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // mensagem genérica: não revela se o e-mail existe
  if (error) return { error: "E-mail ou senha inválidos." };
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function trocarSenha(_: FormState, form: FormData): Promise<FormState> {
  const profile = await requireProfile({ allowPasswordChange: true });
  const senha = String(form.get("senha") ?? "");
  const confirma = String(form.get("confirma") ?? "");
  if (senha.length < 10) return { error: "A senha precisa ter pelo menos 10 caracteres." };
  if (!/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) return { error: "Use letras e números." };
  if (senha !== confirma) return { error: "As senhas não conferem." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { error: error.message.includes("different") ? "A nova senha precisa ser diferente da atual." : "Não foi possível trocar a senha." };

  await createAdminClient().from("profiles").update({ must_change_password: false }).eq("id", profile.id);
  redirect("/");
}
