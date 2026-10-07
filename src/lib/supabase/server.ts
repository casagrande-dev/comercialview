import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} não configurado`);
  return v;
}

/** Cliente com a sessão do usuário — respeita RLS. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // chamado de um Server Component: o proxy já renova a sessão
        }
      },
    },
  });
}

/** Cliente com service role — ignora RLS. Só para ações de gestor já autorizadas. */
export function createAdminClient() {
  return createSupabaseClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
