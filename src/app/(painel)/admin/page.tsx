import { Suspense } from "react";
import { requireGestor } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getDataset } from "@/lib/pipedrive/client";
import { resolveMes } from "@/lib/data";
import { mesesOpcoes, nomeMes, today } from "@/lib/dates";
import { Card, Sec } from "@/components/ui";
import { MesSelect } from "@/components/nav";
import { alternarAtivo } from "./actions";
import { CriarUsuarioForm, EditarUsuarioForm, MetasForm, ResetarSenhaForm } from "./forms";

export const metadata = { title: "Usuários e metas · Painéis Casagrande" };

type Row = { id: string; nome: string; email: string; role: "corretor" | "gestor"; pipedrive_user_id: number | null; ativo: boolean; must_change_password: boolean };

export default async function AdminPage(props: PageProps<"/admin">) {
  const eu = await requireGestor();
  const sp = await props.searchParams;
  const mes = resolveMes(sp.mes);
  const supabase = await createClient();
  const [ds, { data: perfis }, { data: metas }] = await Promise.all([
    getDataset(),
    createAdminClient().from("profiles").select("id, nome, email, role, pipedrive_user_id, ativo, must_change_password").order("nome"),
    supabase.from("metas").select("pipedrive_user_id, meta_vgv, meta_captacoes").eq("mes", `${mes}-01`),
  ]);
  const usuariosPd = ds.users.filter((u) => u.active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const opcoesPd = usuariosPd.map((u) => ({ id: u.id, nome: u.name }));
  const metaDe = new Map((metas ?? []).map((m) => [Number(m.pipedrive_user_id), m]));
  const pdNome = new Map(ds.users.map((u) => [u.id, u.name]));

  return (
    <div className="view" style={{ "--tone": "var(--ink-2)" } as React.CSSProperties}>
      <div className="viewbar">
        <div>
          <h2>Usuários e metas</h2>
          <p className="sub">Só gestores veem esta tela. Toda alteração é feita no servidor e conferida de novo.</p>
        </div>
      </div>

      <Sec>Contas de acesso</Sec>
      <div className="grid g21">
        <Card title="Quem tem acesso" q="Corretor vê só o próprio painel, filtrado pelo usuário do Pipedrive vinculado. Gestor vê tudo.">
          <div className="tw">
            <table>
              <thead><tr><th>Nome</th><th>Papel e vínculo Pipedrive</th><th>Status</th><th /></tr></thead>
              <tbody>
                {((perfis ?? []) as Row[]).map((p) => (
                  <tr key={p.id} style={p.ativo ? undefined : { opacity: 0.55 }}>
                    <td className="nm">{p.nome}<div style={{ fontWeight: 400, fontSize: 11.5, color: "var(--ink-3)" }}>{p.email}</div></td>
                    <td>
                      <EditarUsuarioForm id={p.id} role={p.role} pid={p.pipedrive_user_id} opcoes={opcoesPd} />
                      {p.pipedrive_user_id && !pdNome.has(p.pipedrive_user_id) && <span className="flag f-crit">vínculo inválido</span>}
                    </td>
                    <td>
                      {!p.ativo ? <span className="flag f-mute">desativado</span> : p.must_change_password ? <span className="flag f-warn">aguardando 1º acesso</span> : <span className="flag f-good">ativo</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {p.id !== eu.id && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <ResetarSenhaForm id={p.id} />
                          <form action={alternarAtivo}>
                            <input type="hidden" name="id" value={p.id} />
                            <button className="btn-link">{p.ativo ? "Desativar" : "Reativar"}</button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Nova conta" q="Gera uma senha temporária que aparece uma única vez. Entregue pessoalmente ou por WhatsApp; no 1º acesso a pessoa é obrigada a trocar.">
          <CriarUsuarioForm opcoes={opcoesPd} />
        </Card>
      </div>

      <Sec>Metas mensais</Sec>
      <Card style={{ marginTop: 22 }} title={`Metas de ${nomeMes(mes)}`}
        q="VGV em reais e captações (imóveis publicados) por corretor. Deixe o VGV em branco para remover a meta do mês.">
        <div style={{ marginBottom: 12 }}><Suspense><MesSelect mes={mes} opcoes={proximos(today()).concat(mesesOpcoes(today()))} /></Suspense></div>
        <MetasForm
          mes={mes}
          linhas={usuariosPd.map((u) => ({
            id: u.id,
            nome: u.name,
            vgv: metaDe.has(u.id) ? Number(metaDe.get(u.id)!.meta_vgv) : null,
            cap: metaDe.has(u.id) ? Number(metaDe.get(u.id)!.meta_captacoes) : null,
          }))}
        />
      </Card>
    </div>
  );
}

/** Permite cadastrar metas dos próximos 3 meses. */
function proximos(hoje: string) {
  const [y, m] = hoje.split("-").map(Number);
  return [3, 2, 1].map((i) => {
    const ym = new Date(Date.UTC(y, m - 1 + i, 1)).toISOString().slice(0, 7);
    return { value: ym, label: nomeMes(ym) };
  });
}
