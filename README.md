# Painéis Casagrande

Painéis comerciais (Corretor · Gerente · Diretoria) lendo o Pipedrive ao vivo.
Next.js 16 + Supabase Auth, hospedado na Vercel.

## Como o acesso funciona

- **Não existe cadastro público.** Contas são criadas por um gestor, com senha temporária e troca obrigatória no 1º acesso.
- **Corretor** vê só o próprio painel. O filtro usa o usuário do Pipedrive vinculado ao perfil dele, no servidor — nada que venha do navegador muda isso.
- **Gestor** (Marcos, Julio) vê Corretor (qualquer um), Gerente, Diretoria e a tela *Usuários e metas*.
- O token do Pipedrive e a service role do Supabase ficam só no servidor (variáveis de ambiente). O navegador recebe apenas o HTML já calculado.
- Desativar uma conta bloqueia na hora (o perfil é checado a cada requisição) e também bane o usuário no Supabase Auth.

## Configuração (uma vez)

### 1. Supabase
1. Crie um projeto em supabase.com (região São Paulo).
2. **SQL Editor** → cole e rode `supabase/schema.sql`.
3. **Authentication → Sign In / Providers**: desligue *Allow new users to sign up*. Deixe só *Email* habilitado.
4. **Authentication → Policies / Passwords**: senha mínima 10.
5. **Project Settings → API**: copie *URL*, *anon/publishable key* e *service_role/secret key* para o `.env.local`.

### 2. Primeiro gestor
```bash
node scripts/criar-gestor.mjs "Julio Casagrande" julio@casagrandeslo.com.br 6511906
```
Ele mostra a senha temporária uma vez. Os demais (Marcos, corretores) são criados pela tela *Usuários e metas*.

### 3. Rodar local
```bash
npm run dev
```

### 4. Vercel
1. Suba o repositório no GitHub e importe na Vercel.
2. Em *Settings → Environment Variables*, cadastre as 5 variáveis do `.env.local`.
3. No Supabase, **Authentication → URL Configuration**: *Site URL* = domínio da Vercel.

## Onde ajustar regras

`src/lib/pipedrive/config.ts` — IDs de funis/etapas, tipos de atividade, campos personalizados e premissas
(33% proposta→ganho, 67% V4 provisória, 4 visitas por proposta, SLA de 15 min, 7 dias para "parado").

Dados do Pipedrive são lidos a cada 5 minutos (cache compartilhado) e o recorte por pessoa é feito depois.
