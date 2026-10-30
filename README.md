# NYX Market

Inteligência de mercado do Albion Online (servidor West) para a guild **NYX**.
Planejamento completo em `OneDrive\Documentos\albion_estrategia`.

## Stack

| Camada | Escolha |
|---|---|
| Site | Next.js 16 (App Router, Cache Components) + TypeScript |
| Estilo | Tailwind CSS 4 · glassmorphism · Motion |
| Gráficos | Recharts com tooltip de vidro (`components/charts`) |
| Login e banco | Supabase (Auth + Postgres + **RLS**) |
| Hospedagem | Vercel (`output: "standalone"` para migrar a contêiner se preciso) |

## Segurança

- O app usa **só a chave publishable**. Não existe service role no código.
- Toda proteção de dados é do **RLS** no Supabase (`supabase/migrations`).
- O `proxy.ts` só renova a sessão e redireciona; não é barreira de segurança.
- Sessão validada no servidor com `getClaims()` (proxy) e `getUser()` (DAL em `lib/auth.ts`).

## Rodar localmente

```bash
cp .env.example .env.local   # preencher URL e chave publishable
npm install
npm run dev
```

## Configurar o Supabase (uma vez)

1. **SQL Editor** → colar e rodar `supabase/migrations/0001_profiles.sql`.
2. **Authentication → URL Configuration**
   - *Site URL*: a URL de produção (ex.: `https://nyx-market.vercel.app`).
   - *Redirect URLs*: `http://localhost:3000/**` e `https://SEU-DOMINIO/**`.
3. **Authentication → Sign In / Providers → Email**: confirmação de e-mail ligada (recomendado).
4. (Opcional) Fechar cadastros públicos e só convidar: desligar *Allow new users to sign up*.

## Coletor de preços

Edge Function `supabase/functions/collect-prices` (Deno), chamada pelo `pg_cron`.
Cada execução processa um pedaço da lista vigiada (`watch_rules`) e guarda o cursor.

| Tarefa | Agenda | Por execução | Ciclo completo (~9,4 mil itens) |
|---|---|---|---|
| `prices` (preço atual) | a cada 5 min | 20 chamadas × 150 itens | ~16 min |
| `history` (volume e preço médio 7/30 d) | a cada 10 min | 8 chamadas × 80 itens | ~2 h |

### Publicar (uma vez, pelo painel do Supabase)

1. **SQL Editor** → rodar `supabase/migrations/0003_collector.sql`.
2. **Edge Functions → Deploy a new function → Via Editor**: nome `collect-prices`,
   colar `supabase/functions/collect-prices/index.ts` e publicar.
3. Nos detalhes da função, **desligar "Verify JWT"** (a função usa o próprio segredo).
4. **Edge Functions → Secrets**: criar `COLLECTOR_SECRET` (valor no `.env.local.txt` do OneDrive).
5. **SQL Editor** → guardar o mesmo segredo no Vault:
   `select vault.create_secret('VALOR', 'collector_secret');`
6. **SQL Editor** → rodar `supabase/migrations/0004_collector_schedule.sql`.

Conferir: Administração → Coletor de preços (ou `select * from cron.job_run_details order by start_time desc limit 10;`).

## Estrutura

```text
app/
  (app)/            área logada (sidebar)
    dashboard/
  auth/             server actions de login + /auth/confirm (links de e-mail)
  login/ cadastro/ recuperar-senha/ atualizar-senha/
components/
  auth/  brand/  charts/  dashboard/  shell/  ui/
lib/
  supabase/         clients (browser, server, proxy)
  auth.ts           usuário atual (DAL)
supabase/migrations/
```
