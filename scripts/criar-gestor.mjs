// Cria a PRIMEIRA conta de gestor (depois disso, contas são criadas pela tela "Usuários e metas").
// Uso:  node scripts/criar-gestor.mjs "Julio Casagrande" julio@casagrandeslo.com.br 6511906
// Lê NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do .env.local. Imprime a senha temporária uma vez.
import fs from "node:fs";
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const [nome, email, pid] = process.argv.slice(2);
if (!nome || !email) {
  console.error('Uso: node scripts/criar-gestor.mjs "Nome" email@dominio [pipedrive_user_id]');
  process.exit(1);
}

const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
let senha;
do senha = Array.from({ length: 16 }, () => abc[randomInt(abc.length)]).join("");
while (!/\d/.test(senha) || !/[a-zA-Z]/.test(senha));

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.createUser({ email: email.toLowerCase(), password: senha, email_confirm: true });
if (error) {
  console.error("Erro ao criar usuário:", error.message);
  process.exit(1);
}
const { error: pe } = await admin.from("profiles").insert({
  id: data.user.id,
  nome,
  email: email.toLowerCase(),
  role: "gestor",
  pipedrive_user_id: pid ? Number(pid) : null,
  must_change_password: true,
});
if (pe) {
  await admin.auth.admin.deleteUser(data.user.id);
  console.error("Erro ao criar perfil (rodou o supabase/schema.sql?):", pe.message);
  process.exit(1);
}
console.log(`Gestor criado: ${email}\nSenha temporária (troca obrigatória no 1º acesso): ${senha}`);
