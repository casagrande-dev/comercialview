"use client";

import { useActionState } from "react";
import { trocarSenha } from "../actions";

export function TrocarSenhaForm() {
  const [state, action, pending] = useActionState(trocarSenha, undefined);
  return (
    <form action={action}>
      <label>
        Nova senha
        <input name="senha" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      <label>
        Repita a senha
        <input name="confirma" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      {state?.error && <div className="err" role="alert">{state.error}</div>}
      <button className="btn" disabled={pending}>{pending ? "Salvando…" : "Salvar e entrar"}</button>
    </form>
  );
}
