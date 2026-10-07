import { LoginForm } from "./form";

export const metadata = { title: "Entrar · Painéis Casagrande" };

export default function LoginPage() {
  return (
    <main className="auth">
      <p className="eyebrow">Casagrande Negócios Imobiliários</p>
      <h1>Painéis Casagrande</h1>
      <p className="standfirst">Acesso restrito à equipe. Contas são criadas pela gestão.</p>
      <LoginForm />
    </main>
  );
}
