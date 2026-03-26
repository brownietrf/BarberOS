# BarberOS — Arquitetura e Padrões

---

## Stack

| Tecnologia | Versão | Uso |
|---|---|---|
| Next.js | 15.2.3 | Framework (App Router) |
| React | 19.0.0 | UI |
| TypeScript | 5 | Linguagem |
| Tailwind CSS | 3.4.1 | Estilo |
| Supabase SSR | 0.6.1 | Auth + DB no App Router |
| Supabase JS | 2.49.4 | Cliente do banco |
| date-fns | 4.1.0 | Manipulação de datas |
| lucide-react | 0.487.0 | Ícones |
| tailwind-merge | 3.2.0 | Merge de classes Tailwind |
| clsx | 2.1.1 | Classes condicionais |

---

## Estrutura de Arquivos

```
src/
├── app/
│   ├── admin/                      # Painel administrativo (acesso via ADMIN_EMAIL)
│   │   ├── page.tsx                # Server: verifica admin + busca todas as barbearias
│   │   ├── client.tsx              # Client: tabela de usuários, modais, toggles
│   │   └── actions.ts              # Server Actions: updatePlan, toggleActive (adminClient)
│   ├── book/[slug]/                # Público — página de agendamento do cliente
│   │   ├── page.tsx                # Server: SEO og:*/twitter + viewport PWA + manifest link
│   │   ├── client.tsx              # Client: fluxo 4 etapas + "Adicionar ao calendário"
│   │   └── manifest.webmanifest/
│   │       └── route.ts            # Route Handler: manifest PWA dinâmico por slug
│   ├── dashboard/
│   │   ├── layout.tsx              # Server: auth guard + passa barbershop à sidebar
│   │   ├── page.tsx                # Server: stats do dia + banner do plano
│   │   ├── agenda/
│   │   │   ├── page.tsx            # Server: appointments_full + blocked_slots + services + customers
│   │   │   └── client.tsx          # Client: agenda dia/semana/mês, CRUD completo
│   │   ├── clientes/
│   │   │   ├── page.tsx            # Server: customers + loyalty_program + loyalty_rewards
│   │   │   └── client.tsx          # Client: tabela, busca, sort, CRUD + progresso de fidelidade
│   │   ├── fidelidade/
│   │   │   ├── page.tsx            # Server: loyalty_program + loyalty_rewards + customers
│   │   │   └── client.tsx          # Client: configurar programa, lista de aptos, histórico
│   │   ├── planos/
│   │   │   ├── page.tsx            # Server: barbershop + referrals
│   │   │   ├── client.tsx          # Client: cards planos, banner status, código indicação, bônus
│   │   │   └── actions.ts          # Server Action: updateSubscriptionPeriod
│   │   ├── relatorios/
│   │   │   ├── page.tsx            # Server: busca appointments_full (período pelo plano)
│   │   │   └── client.tsx          # Client: cards, gráficos, insights, gate de plano (blur)
│   │   ├── servicos/
│   │   │   ├── page.tsx            # Server: services por display_order
│   │   │   └── client.tsx          # Client: CRUD, múltiplas categorias, duplicatas
│   │   └── configuracoes/
│   │       ├── page.tsx            # Server: barbershop completo + user email
│   │       └── client.tsx          # Client: dados gerais, horários, link do Book
│   ├── login/page.tsx              # Client: login | cadastro | recuperar senha
│   ├── onboarding/page.tsx         # Client: wizard 3 passos + campo código indicação
│   ├── reset-password/page.tsx     # Client: troca de senha via token
│   ├── layout.tsx                  # Root layout (fontes Inter + Geist)
│   ├── page.tsx                    # Redirect → /login
│   └── globals.css                 # Tailwind + .input-base + html { overflow-x: hidden }
├── components/
│   ├── layout/sidebar.tsx          # Nav: desktop sidebar fixo + mobile drawer
│   │                               # Items: Visão Geral, Agenda, Clientes, Serviços,
│   │                               #        Relatórios, Fidelidade, Configurações
│   └── ui/modal.tsx                # Modal: backdrop blur, escape, scroll lock, size sm|md
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # createClient() — browser (usa cookies via @supabase/ssr)
│   │   ├── server.ts               # createClient() async — server (lê cookies do Next.js)
│   │   └── admin.ts                # adminClient — service_role, sem RLS
│   ├── plans.ts                    # Definição dos planos + helpers de trial + assinatura
│   ├── rate-limit.ts               # Sliding window rate limiter in-memory (20 req/min/IP)
│   └── utils.ts                    # cn(…) = clsx + tailwind-merge
├── types/
│   └── database.ts                 # Todos os types: Barbershop, Service, Customer,
│                                   # Appointment, AppointmentFull, WhatsappInstance,
│                                   # LoyaltyProgram, LoyaltyReward, Referral…
└── middleware.ts                   # Proteção: /dashboard/*, /onboarding/*, /admin/*
```

---

## Padrão Fundamental: page.tsx + client.tsx

**Regra inviolável:** todo módulo do dashboard segue este padrão.

```
dashboard/modulo/
  page.tsx    → Server Component: busca dados, passa como props, zero estado
  client.tsx  → Client Component: recebe initialData, gerencia estado + mutations
```

### page.tsx (Server)
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ModuloClient from './client'

export default async function ModuloPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!barbershop) redirect('/onboarding')

  const { data: items } = await supabase
    .from('tabela')
    .select('*')
    .eq('barbershop_id', barbershop.id)

  return <ModuloClient barbershop={barbershop} initialItems={items ?? []} />
}
```

### client.tsx (Client)
```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  barbershop: Barbershop
  initialItems: Item[]
}

export function ModuloClient({ barbershop, initialItems }: Props) {
  const supabase = createClient()           // instância única, sem await
  const [items, setItems] = useState(initialItems)

  async function handleCreate(data: Partial<Item>) {
    const { data: novo } = await supabase
      .from('tabela')
      .insert({ barbershop_id: barbershop.id, ...data })
      .select()
      .single()
    if (novo) setItems(prev => [...prev, novo])
  }
}
```

### actions.ts (Server Actions — admin)
Usado apenas no painel `/admin` e `/dashboard/planos`. Mutations privilegiadas que precisam bypassar RLS:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) throw new Error('Unauthorized')
}

export async function updatePlan(id: string, plan: string, trialEndsAt: string) {
  await verifyAdmin()
  await adminClient.from('barbershops').update({ plan, trial_ends_at: trialEndsAt }).eq('id', id)
  revalidatePath('/admin')
}
```

---

## Sistema de Planos (`src/lib/plans.ts`)

```typescript
// Planos disponíveis
PLANS: Record<Plan, PlanDef>
  free    → trial por período do admin, acesso 100%, chatbot conforme admin
  pro     → R$ 49,90/mês, relatórios 7d básico (sem insights/gráficos), chatbot básico
  premium → R$ 89,90/mês, relatórios completos com insights, chatbot completo

// Períodos de cobrança
BILLING_PERIODS: Record<SubscriptionPeriod, BillingPeriodDef>
  monthly  → sem desconto
  3months  → 5% off
  6months  → 10% off
  12months → 20% off

// Helpers de trial
isTrialActive(b)   → boolean (free + trial_ends_at no futuro)
isTrialExpired(b)  → boolean (free + trial_ends_at no passado)
trialDaysLeft(b)   → number  (dias restantes, mínimo 0)

// Helpers de assinatura paga
isSubscriptionExpired(b)    → boolean
subscriptionDaysLeft(b)     → number
isSubscriptionExpiring(b, days=7) → boolean (expira em breve)
gracePeriodDaysLeft(b)      → number (dias restantes de carência)
isGracePeriod(b)            → boolean (expirou mas ainda na carência)
isFullyLocked(b)            → boolean (carência também esgotada)
getSubscriptionPrice(plan, period) → { total, perMonth, discount }
```

### Gate de plano nos Relatórios
- **free**: acesso completo (período inicial conforme `reportPeriods[0]`)
- **pro**: apenas 7d, insights e gráficos visíveis mas com overlay `backdrop-blur + "Recurso Premium"`
- **premium**: acesso completo

---

## Painel Admin (`/admin`)

- Acesso: apenas usuário com email == `process.env.ADMIN_EMAIL`
- Middleware bloqueia sem auth; verificação de email ocorre no server component
- Mutations via Server Actions + `adminClient` (service role) — SERVICE_ROLE_KEY nunca vai ao browser
- Funcionalidades: stats globais (MRR/ARR/carência/locked), busca/filtro por plano e status de assinatura,
  toggle ativo/inativo, edição de plano + trial + subscription_ends_at + grace_period_days,
  gráfico de crescimento mensal, mix de planos (donut), exportação CSV

---

## Programa de Fidelidade (`/dashboard/fidelidade`)

- Opt-in: barbeiro ativa/configura ou deixa desativado
- Configuração: `visits_required` (quantas visitas = recompensa) + `reward_description`
- Progresso calculado client-side: `total_visits - visits_at_redemption_do_último_resgate`
- Resgate: barbeiro clica "Resgatar" no cliente elegível → cria registro em `loyalty_rewards`
- Histórico de resgates exibido na página e barra de progresso no modal de perfil do cliente

---

## Sistema de Indicação

- Cada barbearia tem `referral_code` único gerado no onboarding
- No onboarding, campo opcional "Código de indicação" → registra `referred_by` + cria `referrals`
- Barbearia indicadora vê seus indicados e status em `/dashboard/planos`
- Bônus ativo: `referral_bonus_ends_at` no futuro → banner exibido em Planos
- Aprovação: admin seta `status = 'rewarded'` + preenche `referral_bonus_ends_at` no indicador

---

## Fluxo de Autenticação

```
/login → signInWithPassword → redirect /dashboard
       → signUp → email confirmation → redirect /dashboard

/dashboard/* → middleware verifica session → sem auth = redirect /login
dashboard/layout.tsx → getUser() → sem barbershop = redirect /onboarding

/onboarding → cria barbershop com slug único + referral_code → redirect /dashboard
           → se referred_by válido → cria registro em referrals

/reset-password → exchangeCodeForSession(code) → updateUser({ password })

/admin/* → middleware verifica session → sem auth = redirect /login
         → page.tsx verifica email == ADMIN_EMAIL → senão redirect /dashboard
```

### Middleware (`src/middleware.ts`)
- Matcher: `/book/:path*`, `/dashboard/:path*`, `/onboarding/:path*`, `/admin/:path*`, `/login`, `/reset-password`
- `/book/*`: rate limiting 20 req/min/IP via `lib/rate-limit.ts` → retorna 429 se excedido
- Demais rotas: init Supabase apenas quando necessário (evita overhead no /book)
- Lógica auth: sem user → redirect `/login`; user em `/login` → redirect `/dashboard`

---

## Proteção de Dados (RLS)

O Supabase usa Row-Level Security. Padrão para recursos do barbeiro:
```sql
USING (barbershop_id IN (
  SELECT id FROM barbershops WHERE owner_id = auth.uid()
))
```

Rotas públicas (`/book/[slug]`) usam a chave `anon` e dependem de policies explícitas.
Painel admin usa `adminClient` (service_role) que bypassa RLS completamente.

---

## Rotas

| Rota | Auth | Descrição |
|---|---|---|
| `/` | — | Redirect → /login |
| `/login` | Público | Auth completo |
| `/onboarding` | Autenticado | Cria barbearia + código de indicação |
| `/reset-password` | Público | Troca senha |
| `/book/[slug]` | **Público** | Booking do cliente |
| `/dashboard` | Autenticado | Visão geral + banner de plano |
| `/dashboard/agenda` | Autenticado | Agenda |
| `/dashboard/clientes` | Autenticado | Gestão de clientes + progresso fidelidade |
| `/dashboard/servicos` | Autenticado | Catálogo |
| `/dashboard/fidelidade` | Autenticado | Programa de fidelidade |
| `/dashboard/configuracoes` | Autenticado | Configurações |
| `/dashboard/relatorios` | Autenticado | Analytics (gateado por plano) |
| `/dashboard/planos` | Autenticado | Tabela comparativa + indicações |
| `/admin` | Admin only | Gestão de usuários e planos |

---

## Convenções de Estilo (Tailwind)

```
Backgrounds:  zinc-950 (página)  zinc-900 (card)  zinc-800 (input/borda)
Bordas:       zinc-800 (padrão)  zinc-700 (hover)  amber-500 (focus)
Texto:        white (primário)   zinc-400 (secundário)  zinc-600 (placeholder)
Accent:       amber-500 (#f59e0b) — botões primários, destaques, active states
Sucesso:      green-400 / green-500/10
Erro:         red-400 / red-500/10
Aviso:        yellow-400 / yellow-500/10

Input padrão: .input-base (definido em globals.css)
  → bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3
     text-white placeholder:text-zinc-600
     focus:border-amber-500 focus:outline-none

Overflow mobile: html { overflow-x: hidden } em globals.css
                 main do dashboard com overflow-x-hidden
                 tabelas largas com overflow-x-auto + min-w-[Npx]
```

---

## Tipos TypeScript (`src/types/database.ts`)

```typescript
// Enums
type Plan              = 'free' | 'pro' | 'premium'
type SubscriptionPeriod = 'monthly' | '3months' | '6months' | '12months'
type ServiceCategory   = 'Cabelo' | 'Barba' | 'Combo' | 'Químicas' | 'Extra'
type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
type AppointmentSource = 'whatsapp' | 'web' | 'manual'
type WhatsappStatus    = 'connected' | 'disconnected' | 'connecting' | 'banned'
type ReferralStatus    = 'pending' | 'qualified' | 'rewarded'

// Horários
interface DaySchedule  { open: string; close: string; active: boolean }
interface WorkingHours { seg: DaySchedule; ter: DaySchedule; qua: DaySchedule
                         qui: DaySchedule; sex: DaySchedule; sab: DaySchedule; dom: DaySchedule }

// Entidades principais
interface Barbershop { id, owner_id, name, slug, phone, whatsapp, bot_name,
                       address, city, logo_url, working_hours: WorkingHours,
                       slot_duration, is_active, plan, trial_ends_at,
                       subscription_ends_at, subscription_period, grace_period_days,
                       referral_code, referred_by, referral_bonus_ends_at, ... }

interface Service    { id, barbershop_id, name, description, duration_min,
                       price, is_active, display_order, category: ServiceCategory[], ... }

interface Customer   { id, barbershop_id, name, phone, notes,
                       total_visits, last_visit_at, created_at }

interface Appointment { id, barbershop_id, customer_id, service_id,
                        start_time, end_time, status, source, notes,
                        reminder_sent, confirmed_at, cancelled_at, cancel_reason, ... }

// View appointments_full (extends Appointment)
interface AppointmentFull extends Appointment {
  customer_name, customer_phone, service_name, service_duration, service_price
}

// Fidelidade
interface LoyaltyProgram { id, barbershop_id, is_active, visits_required,
                           reward_description, created_at, updated_at }

interface LoyaltyReward  { id, barbershop_id, customer_id,
                           visits_at_redemption, notes, redeemed_at }

// Indicações
interface Referral { id, referrer_barbershop_id, referred_barbershop_id,
                     status: ReferralStatus, reward_granted_at, created_at }
```

---

## Componentes Reutilizáveis

### `Modal` (`src/components/ui/modal.tsx`)
```typescript
<Modal open={boolean} onClose={() => void} title="string" size="sm" | "md">
  {children}
</Modal>
```
Fecha com: clique no backdrop, tecla Escape. Bloqueia scroll do body.

### `Sidebar` (`src/components/layout/sidebar.tsx`)
- Props: `barbershopName: string`
- Desktop: sidebar fixa à esquerda (w-56)
- Mobile: botão hambúrguer + drawer com overlay
- Logo mobile: `<Link href="/dashboard">` (clicável para voltar ao início)
- Nav items: Visão Geral, Agenda, Clientes, Serviços, Relatórios, **Fidelidade**, Configurações
- Logout via `supabase.auth.signOut()`

### `.input-base` (globals.css)
Classe Tailwind para todos os inputs/textareas do projeto.

---

## O que está implementado

| Módulo | Status | Observações |
|---|---|---|
| Auth (login/cadastro/recuperação) | ✅ | Templates de e-mail configurados |
| Onboarding 3 passos | ✅ | Cria barbershop + referral_code + campo referred_by |
| Dashboard overview | ✅ | Stats do dia + banner de plano |
| Agenda (dia/semana/mês) | ✅ | CRUD + bloqueios, ordenado por horário, botão refresh |
| Clientes | ✅ | CRUD + VIP + busca + sort + progresso de fidelidade no modal |
| Serviços | ✅ | CRUD + categorias + duplicatas + templates sugeridos (bulk) |
| Configurações | ✅ | Logo upload (Storage) + dados gerais + horários + link Book |
| BarberOS Book (`/book/[slug]`) | ✅ | 4 etapas + "Adicionar ao calendário" + rate limiting |
| Book SEO | ✅ | og:* + twitter:card + metadataBase |
| Book PWA | ✅ | manifest dinâmico por slug + themeColor + appleWebApp |
| Relatórios | ✅ | Cards+delta + recharts + insights + CSV/PDF + gate plano |
| Planos (`/dashboard/planos`) | ✅ | Tabela comparativa + períodos + texto dinâmico + indicações |
| Sistema de planos (`lib/plans.ts`) | ✅ | free/pro/premium + billing periods + grace period |
| Painel Admin (`/admin`) | ✅ | MRR/ARR + gráficos recharts + CSV + gestão de planos/assinaturas |
| Rate limiting | ✅ | `lib/rate-limit.ts` + middleware para /book/* |
| Race condition agendamentos | ✅ | Constraint `no_overlap_appointments` + erro 23P01 tratado |
| Mobile overflow fix | ✅ | html overflow-x hidden + wrappers nas tabelas |
| **Programa de Fidelidade** | ✅ | Opt-in, configurável, progresso por cliente, histórico |
| **Sistema de Indicação** | ✅ | referral_code único, campo no onboarding, bônus ao indicador |

## O que falta (MVP)

| Módulo | Prioridade | Dependências |
|---|---|---|
| Deploy | Alta | Vercel + Render |
| WhatsApp Bot | Alta | Evolution API no Render (ver CHATBOT.md) |
| Notificações de lembrete | Média | Bot funcionando + cron Vercel |
| Aprovação automática de indicações | Média | Webhook de pagamento ou trigger no admin |
| Arquivos estáticos PWA/SEO | Baixa | og-default.png + icons/ (criar manualmente) |
