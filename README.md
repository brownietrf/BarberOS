# BarberOS

Sistema completo de gestão para barbearias. Painel administrativo para o barbeiro, página pública de agendamento para o cliente e painel de administração da plataforma — tudo em um só lugar.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript |
| Estilo | Tailwind CSS |
| Backend / Auth / DB | Supabase (PostgreSQL + RLS) |
| Datas | date-fns |
| Ícones | lucide-react |
| Deploy | Vercel (app) + Railway (bot) |

---

## Funcionalidades

### Painel do Barbeiro (`/dashboard`)
- **Visão Geral** — stats do dia + banner com status do plano e botão "Ver planos"
- **Agenda** — visualização dia / semana / mês, criar, editar e cancelar agendamentos, bloquear horários. Visão dia ordenada por horário, mesclando agendamentos e bloqueios. Botão de refresh manual
- **Clientes** — cadastro, busca, ordenação, indicador VIP (10+ visitas), barra de progresso de fidelidade no perfil
- **Serviços** — CRUD com categorias múltiplas, filtros, detecção de duplicatas. Painel de serviços sugeridos (13 templates) com insert em lote — exibido automaticamente para novos usuários
- **Configurações** — upload de logo (Supabase Storage), dados da barbearia, horários por dia da semana, link do Book com cópia e compartilhamento via WhatsApp
- **Relatórios** — cards com delta (▲▼ %), gráfico recharts de timeline, insights automáticos, exportação CSV e PDF. Conteúdo gateado por plano (Pro: blur "Recurso Premium")
- **Fidelidade** — programa de fidelidade opt-in: configurar número de visitas e recompensa, visualizar progresso por cliente, registrar resgates com histórico
- **Planos** — tabela comparativa free/pro/premium com períodos de cobrança (mensal/3m/6m/12m), código de indicação, bônus ativo

### BarberOS Book (`/book/[slug]`)
Página pública de autoatendimento. O cliente acessa pelo link da barbearia e agenda sem precisar de conta:
1. Escolhe o serviço
2. Seleciona data e horário disponível (sincronizado com agenda e horários de funcionamento)
3. Informa nome e WhatsApp
4. Recebe confirmação na tela com opção "Adicionar ao calendário" (.ics / Web Share API)

**SEO**: og:title, og:description, og:image (logo da barbearia ou og-default.png), twitter:card
**PWA**: manifest dinâmico por slug, tema âmbar, "Adicionar à tela inicial" no Android e iOS
**Rate limiting**: 20 requisições/minuto por IP

### Painel Admin (`/admin`)
Acesso restrito ao e-mail definido em `ADMIN_EMAIL`:
- Stats: total barbearias, em trial, expirado, planos pagos, MRR e ARR
- Alerta automático de trials e assinaturas expirando em ≤ 7 dias
- Gráfico de crescimento mensal (recharts) e mix de planos (donut chart)
- Exportação CSV da tabela filtrada
- Edição de plano, trial, subscription_ends_at, subscription_period, grace_period_days e status ativo/inativo
- Mutations via Server Actions com service role (sem exposição da chave no browser)

### Auth
- Login, cadastro e recuperação de senha
- Onboarding de 3 passos para configurar a barbearia (inclui campo de código de indicação)
- Proteção de rotas via middleware (`/dashboard/*`, `/onboarding/*`, `/admin/*`)

---

## Sistema de Planos

| Plano | Preço | Relatórios | Chatbot |
|---|---|---|---|
| Free Trial | Grátis (período admin) | 7d e 30d + insights | Conforme admin |
| Pro | R$ 49,90/mês | 7d básico (sem insights) | Agendamento básico |
| Premium | R$ 89,90/mês | 7d/30d/90d/12m + insights | Completo (confirmações + promoções) |

**Períodos de cobrança:** Mensal / 3 meses (5% off) / 6 meses (10% off) / 12 meses (20% off)
**Carência:** `grace_period_days` dias após expiração (padrão: 10) — agenda continua, features bloqueadas

---

## Programa de Fidelidade

- Opt-in por barbearia — barbeiro ativa e configura livremente
- Configuração: número de visitas necessárias + descrição da recompensa
- Progresso: calculado a partir de visitas desde o último resgate
- Resgate registrado pelo barbeiro com histórico completo

---

## Sistema de Indicação

- Cada barbearia recebe um `referral_code` único no cadastro
- Barbeiro indicado informa o código no onboarding
- Ao assinar um plano pago, o indicador ganha bônus de 1 mês grátis (aprovado pelo admin)
- Painel de indicações visível em `/dashboard/planos`

---

## Estrutura do Projeto

```
BarberOS/
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── page.tsx           # Server: verifica admin + busca usuários
│   │   │   ├── client.tsx         # Client: painel de gestão
│   │   │   └── actions.ts         # Server Actions: updatePlan, toggleActive
│   │   ├── book/
│   │   │   └── [slug]/
│   │   │       ├── page.tsx       # Server: busca barbearia + serviços pelo slug
│   │   │       └── client.tsx     # Client: fluxo de agendamento em 4 etapas
│   │   ├── dashboard/
│   │   │   ├── layout.tsx         # Proteção de rota + sidebar
│   │   │   ├── page.tsx           # Visão geral com stats + banner de plano
│   │   │   ├── agenda/            # page.tsx + client.tsx
│   │   │   ├── clientes/          # page.tsx + client.tsx (+ loyalty data)
│   │   │   ├── configuracoes/     # page.tsx + client.tsx
│   │   │   ├── fidelidade/        # page.tsx + client.tsx  ← novo
│   │   │   ├── planos/            # page.tsx + client.tsx + actions.ts
│   │   │   ├── relatorios/        # page.tsx + client.tsx
│   │   │   └── servicos/          # page.tsx + client.tsx
│   │   ├── login/page.tsx
│   │   ├── onboarding/page.tsx    # (+ campo código de indicação)
│   │   └── reset-password/page.tsx
│   ├── components/
│   │   ├── layout/sidebar.tsx     # Nav responsiva (+ item Fidelidade)
│   │   └── ui/modal.tsx           # Modal reutilizável
│   ├── lib/
│   │   ├── supabase/              # client.ts + server.ts + admin.ts
│   │   ├── plans.ts               # Planos + billing periods + helpers
│   │   └── utils.ts               # cn()
│   ├── types/database.ts          # Types + LoyaltyProgram, LoyaltyReward, Referral
│   └── middleware.ts              # Proteção de rotas
├── supabase/
│   └── migrations/
│       └── 20260326_loyalty_and_referrals.sql
├── Context/
│   ├── CONTEXT.md
│   ├── ARCHITECTURE.md
│   ├── SUPABASE.md
│   ├── DOCS.md
│   └── CHATBOT.md
└── README.md
```

---

## Banco de Dados (Supabase)

### Tabelas

| Tabela | Descrição |
|---|---|
| `barbershops` | Dados da barbearia (slug, horários, plano, assinatura, indicação) |
| `services` | Serviços oferecidos (preço, duração, categorias) |
| `customers` | Clientes cadastrados (nome, telefone, visitas) |
| `appointments` | Agendamentos (status, fonte, horários) |
| `blocked_slots` | Bloqueios de horário |
| `bot_sessions` | Estado da conversa do bot WhatsApp |
| `whatsapp_instances` | Instâncias Evolution API |
| `loyalty_programs` | Configuração do programa de fidelidade por barbearia |
| `loyalty_rewards` | Histórico de resgates de recompensas |
| `referrals` | Rastreamento de indicações entre barbeiros |

### View
- `appointments_full` — JOIN de agendamentos com cliente e serviço

### Functions (RPC)

| Função | Descrição |
|---|---|
| `get_available_slots(barbershop_id, date, duration_min, timezone)` | Retorna horários livres ⚠️ única versão — não criar overloads |
| `upsert_customer(barbershop_id, name, phone)` | Cria ou retorna cliente |
| `get_pending_reminders()` | Agendamentos que precisam de lembrete |
| `handle_appointment_completed()` | Trigger ao completar agendamento |
| `cleanup_old_sessions()` | Remove sessões antigas do bot |

---

## Configuração Local

### Pré-requisitos
- Node.js 18+
- Conta no [Supabase](https://supabase.com)

### 1. Clone e instale

```bash
git clone https://github.com/seu-usuario/barberos.git
cd barberos
npm install
```

### 2. Variáveis de ambiente

Crie o arquivo `.env.local` na raiz:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ADMIN_EMAIL=seu@email.com
NEXT_PUBLIC_APP_URL=https://seu-dominio.vercel.app
```

### 3. Configure o banco

Execute as migrations no Supabase SQL Editor. Tabelas, views, functions e policies estão descritas em `Context/SUPABASE.md`.

Para a migração de fidelidade e indicações, execute também:
```
supabase/migrations/20260326_loyalty_and_referrals.sql
```

### 4. Inicie o servidor

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

---

## Padrão de Código

Todos os módulos seguem o mesmo padrão:

```
modulo/
  page.tsx    → Server Component: busca dados no Supabase e passa como props
  client.tsx  → Client Component: recebe initialData, gerencia estado e mutations
  actions.ts  → Server Actions (apenas admin/planos): mutations privilegiadas com adminClient
```

---

## Rotas

| Rota | Acesso | Descrição |
|---|---|---|
| `/` | Público | Redireciona para `/login` |
| `/login` | Público | Login, cadastro e recuperação de senha |
| `/onboarding` | Autenticado | Configuração inicial da barbearia |
| `/reset-password` | Público | Troca de senha via token |
| `/book/[slug]` | **Público** | Página de agendamento do cliente |
| `/dashboard` | Autenticado | Visão geral + banner de plano |
| `/dashboard/agenda` | Autenticado | Agenda completa |
| `/dashboard/clientes` | Autenticado | Gestão de clientes |
| `/dashboard/servicos` | Autenticado | Catálogo de serviços |
| `/dashboard/fidelidade` | Autenticado | Programa de fidelidade |
| `/dashboard/configuracoes` | Autenticado | Configurações da barbearia |
| `/dashboard/relatorios` | Autenticado | Analytics (gateado por plano) |
| `/dashboard/planos` | Autenticado | Tabela comparativa de planos + indicações |
| `/admin` | Admin only | Gestão de usuários e planos |

---

## Próximos Passos

- [ ] Deploy — Vercel (Next.js) + Render (Evolution API)
- [ ] WhatsApp Bot — Evolution API + webhook Next.js (ver `Context/CHATBOT.md`)
- [ ] Notificações de lembrete — cron Vercel + bot envia via Evolution API
- [ ] Aprovação automática de indicações via webhook de pagamento
