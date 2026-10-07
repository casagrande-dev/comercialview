"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action}>
      <label>
        E-mail
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Senha
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error && <div className="err" role="alert">{state.error}</div>}
      <button className="btn" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
