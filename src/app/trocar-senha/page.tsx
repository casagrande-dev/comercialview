import { requireProfile } from "@/lib/auth";
import { TrocarSenhaForm } from "./form";

export const metadata = { title: "Definir senha · Painéis Casagrande" };

export default async function TrocarSenhaPage() {
  const p = await requireProfile({ allowPasswordChange: true });
  return (
    <main className="auth">
      <p className="eyebrow">Primeiro acesso</p>
      <h1>Olá, {p.nome.split(" ")[0]}</h1>
      <p className="standfirst">Defina uma senha só sua. Mínimo de 10 caracteres, com letras e números.</p>
      <TrocarSenhaForm />
    </main>
  );
}
