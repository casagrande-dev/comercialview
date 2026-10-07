import Link from "next/link";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { Tabs } from "@/components/nav";
import { logout } from "../actions";

export default async function PainelLayout({ children }: LayoutProps<"/">) {
  const p = await requireProfile();
  return (
    <div className="wrap">
      <header className="topbar">
        <Link href="/" className="brand">Painéis Casagrande<small>{p.role === "gestor" ? "gestão" : "corretor"}</small></Link>
        <div className="who">
          <span>Olá, <b>{p.nome.split(" ")[0]}</b></span>
          <form action={logout}><button className="btn-link">Sair</button></form>
        </div>
      </header>
      <Suspense>
        <Tabs gestor={p.role === "gestor"} />
      </Suspense>
      {children}
    </div>
  );
}
