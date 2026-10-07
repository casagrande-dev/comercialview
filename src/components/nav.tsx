"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function Tabs({ gestor }: { gestor: boolean }) {
  const path = usePathname();
  const sp = useSearchParams();
  const mes = sp.get("mes");
  const q = mes ? `?mes=${mes}` : "";
  const tabs = [
    { href: "/corretor", cls: "t-cor", lv: "Operacional", nome: gestor ? "Corretor" : "Meu painel" },
    ...(gestor
      ? [
          { href: "/gerente", cls: "t-ger", lv: "Tático", nome: "Gerente" },
          { href: "/diretoria", cls: "t-dir", lv: "Estratégico", nome: "Diretoria" },
          { href: "/admin", cls: "t-adm", lv: "Config", nome: "Usuários e metas" },
        ]
      : []),
  ];
  return (
    <nav className="tabs" aria-label="Visões do painel">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href + (t.href === "/admin" ? "" : q)} className={`tab ${t.cls}`} aria-current={path.startsWith(t.href) ? "page" : undefined}>
          <span className="lv">{t.lv}</span> {t.nome}
        </Link>
      ))}
    </nav>
  );
}

/** Troca o mês mantendo os outros parâmetros (ex.: ?u= do gestor). */
export function MesSelect({ mes, opcoes }: { mes: string; opcoes: { value: string; label: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (
    <div className="controls">
      <label htmlFor="mes">Mês</label>
      <select
        id="mes"
        value={mes}
        onChange={(e) => {
          const p = new URLSearchParams(sp.toString());
          p.set("mes", e.target.value);
          router.push(`${path}?${p.toString()}`);
        }}
      >
        {opcoes.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
