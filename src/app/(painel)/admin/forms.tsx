"use client";

import { useActionState } from "react";
import { atualizarUsuario, criarUsuario, resetarSenha, salvarMetas, type AdminState } from "./actions";

type Opcao = { id: number; nome: string };

function Resultado({ state }: { state: AdminState }) {
  if (!state) return null;
  if (state.error) return <div className="err" role="alert">{state.error}</div>;
  return (
    <div className="ok" role="status">
      {state.ok}
      {state.senha && (
        <div style={{ marginTop: 8, color: "var(--ink-2)" }}>
          Login: <b>{state.email}</b><br />
          Senha temporária (aparece só agora):
          <div className="secret">{state.senha}</div>
        </div>
      )}
    </div>
  );
}

export function CriarUsuarioForm({ opcoes }: { opcoes: Opcao[] }) {
  const [state, action, pending] = useActionState(criarUsuario, undefined);
  return (
    <form action={action} className="form">
      <label>Nome<input name="nome" required maxLength={120} /></label>
      <label>E-mail<input name="email" type="email" required /></label>
      <label>
        Papel
        <select name="role" defaultValue="corretor">
          <option value="corretor">Corretor — vê só o próprio painel</option>
          <option value="gestor">Gestor — vê tudo e administra</option>
        </select>
      </label>
      <label>
        Usuário no Pipedrive
        <select name="pipedrive_user_id" defaultValue="">
          <option value="">— nenhum —</option>
          {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </label>
      <Resultado state={state} />
      <button className="btn" disabled={pending}>{pending ? "Criando…" : "Criar conta"}</button>
    </form>
  );
}

export function EditarUsuarioForm({ id, role, pid, opcoes }: { id: string; role: string; pid: number | null; opcoes: Opcao[] }) {
  const [state, action, pending] = useActionState(atualizarUsuario, undefined);
  return (
    <form action={action} className="row-form">
      <input type="hidden" name="id" value={id} />
      <select name="role" defaultValue={role} aria-label="Papel">
        <option value="corretor">corretor</option>
        <option value="gestor">gestor</option>
      </select>
      <select name="pipedrive_user_id" defaultValue={pid ?? ""} aria-label="Usuário do Pipedrive">
        <option value="">— sem vínculo —</option>
        {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
      </select>
      <button className="btn-link" disabled={pending}>Salvar</button>
      {state?.error && <span className="flag f-crit">{state.error}</span>}
      {state?.ok && <span className="flag f-good">{state.ok}</span>}
    </form>
  );
}

export function ResetarSenhaForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(resetarSenha, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Gerar uma nova senha temporária? A senha atual deixa de funcionar.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn-link" disabled={pending}>Resetar senha</button>
      {state && (
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", right: 0, top: 6, width: 260, zIndex: 5 }}><Resultado state={state} /></div>
        </div>
      )}
    </form>
  );
}

export function MetasForm({ mes, linhas }: { mes: string; linhas: { id: number; nome: string; vgv: number | null; cap: number | null }[] }) {
  const [state, action, pending] = useActionState(salvarMetas, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="mes" value={mes} />
      <div className="tw">
        <table>
          <thead><tr><th>Usuário do Pipedrive</th><th className="r">Meta VGV (R$)</th><th className="r">Meta captações</th></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={`${mes}-${l.id}`}>
                <td className="nm">{l.nome}</td>
                <td className="r"><input name={`vgv_${l.id}`} defaultValue={l.vgv ?? ""} inputMode="numeric" placeholder="ex.: 1000000" style={{ width: 150, textAlign: "right" }} /></td>
                <td className="r"><input name={`cap_${l.id}`} defaultValue={l.cap ?? ""} inputMode="numeric" placeholder="4" style={{ width: 70, textAlign: "right" }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        <button className="btn sm" disabled={pending}>{pending ? "Salvando…" : "Salvar metas"}</button>
        {state?.error && <div className="err">{state.error}</div>}
        {state?.ok && <div className="ok">{state.ok}</div>}
      </div>
    </form>
  );
}
