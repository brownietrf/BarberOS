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
│   │   │   ├── page.tsx            # Server: customers ordenados por last_visit_at
│   │   │   └── client.tsx          # Client: tabela, busca, sort, CRUD
│   │   ├── planos/
│   │   │   ├── page.tsx            # Server: busca barbershop
│   │   │   └── client.tsx          # Client: tabela comparativa, banner status, texto vantagens
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
│   ├── onboarding/page.tsx         # Client: wizard 3 passos (cria barbearia)
│   ├── reset-password/page.tsx     # Client: troca de senha via token
│   ├── layout.tsx                  # Root layout (fontes Inter + Geist)
│   ├── page.tsx                    # Redirect → /login
│   └── globals.css                 # Tailwind + .input-base + html { overflow-x: hidden }
├── components/
│   ├── layout/sidebar.tsx          # Nav: desktop sidebar fixo + mobile drawer
│   │                               # Logo mobile é <Link href="/dashboard">
│   └── ui/modal.tsx                # Modal: backdrop blur, escape, scroll lock, size sm|md
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # createClient() — browser (usa cookies via @supabase/ssr)
│   │   ├── server.ts               # createClient() async — server (lê cookies do Next.js)
│   │   └── admin.ts                # adminClient — service_role, sem RLS
│   ├── plans.ts                    # Definição dos planos + helpers de trial
│   ├── rate-limit.ts               # Sliding window rate limiter in-memory (20 req/min/IP)
│   └── utils.ts                    # cn(…) = clsx + tailwind-merge
├── types/
│   └── database.ts                 # Todos os types: Barbershop, Service, Customer,
│                                   # Appointment, AppointmentFull, WhatsappInstance…
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
Usado apenas no painel `/admin`. Mutations privilegiadas que precisam bypassar RLS:
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

// Helpers
isTrialActive(b)   → boolean (free + trial_ends_at no futuro)
isTrialExpired(b)  → boolean (free + trial_ends_at no passado)
trialDaysLeft(b)   → number  (dias restantes, mínimo 0)
```

### Gate de plano nos Relatórios
- **free**: acesso completo (período inicial conforme `reportPeriods[0]`)
- **pro**: apenas 7d, insights e gráficos visíveis mas com overlay `backdrop-blur + "Recurso Premium"`
- **premium**: acesso completo

O período inicial é calculado no server (`page.tsx`) com base em `PLANS[plan].reportPeriods[0]` para evitar flash de dados incorretos no client.

---

## Painel Admin (`/admin`)

- Acesso: apenas usuário com email == `process.env.ADMIN_EMAIL`
- Middleware bloqueia sem auth; verificação de email ocorre no server component
- Mutations via Server Actions + `adminClient` (service role) — SERVICE_ROLE_KEY nunca vai ao browser
- Funcionalidades: stats globais, busca/filtro por plano, toggle ativo/inativo, edição de plano + trial

---

## Fluxo de Autenticação

```
/login → signInWithPassword → redirect /dashboard
       → signUp → email confirmation → redirect /dashboard

/dashboard/* → middleware verifica session → sem auth = redirect /login
dashboard/layout.tsx → getUser() → sem barbershop = redirect /onboarding

/onboarding → cria barbershop com slug único → redirect /dashboard

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
| `/onboarding` | Autenticado | Cria barbearia |
| `/reset-password` | Público | Troca senha |
| `/book/[slug]` | **Público** | Booking do cliente |
| `/dashboard` | Autenticado | Visão geral + banner de plano |
| `/dashboard/agenda` | Autenticado | Agenda |
| `/dashboard/clientes` | Autenticado | Gestão de clientes |
| `/dashboard/servicos` | Autenticado | Catálogo |
| `/dashboard/configuracoes` | Autenticado | Configurações |
| `/dashboard/relatorios` | Autenticado | Analytics (gateado por plano) |
| `/dashboard/planos` | Autenticado | Tabela comparativa de planos |
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
type ServiceCategory   = 'Cabelo' | 'Barba' | 'Combo' | 'Químicas' | 'Extra'
type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
type AppointmentSource = 'whatsapp' | 'web' | 'manual'
type WhatsappStatus    = 'connected' | 'disconnected' | 'connecting' | 'banned'

// Horários
interface DaySchedule  { open: string; close: string; active: boolean }
interface WorkingHours { seg: DaySchedule; ter: DaySchedule; qua: DaySchedule
                         qui: DaySchedule; sex: DaySchedule; sab: DaySchedule; dom: DaySchedule }

// Entidades principais
interface Barbershop { id, owner_id, name, slug, phone, whatsapp, bot_name,
                       address, city, logo_url, working_hours: WorkingHours,
                       slot_duration, is_active, plan, trial_ends_at, ... }

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
- Nav items: Visão Geral, Agenda, Clientes, Serviços, Relatórios, Configurações
- Logout via `supabase.auth.signOut()`

### `.input-base` (globals.css)
Classe Tailwind para todos os inputs/textareas do projeto.

---

## O que está implementado

| Módulo | Status | Observações |
|---|---|---|
| Auth (login/cadastro/recuperação) | ✅ | Templates de e-mail configurados |
| Onboarding 3 passos | ✅ | Cria barbershop com slug único |
| Dashboard overview | ✅ | Stats do dia + banner de plano |
| Agenda (dia/semana/mês) | ✅ | CRUD + bloqueios, ordenado por horário, botão refresh |
| Clientes | ✅ | CRUD + VIP + busca + sort |
| Serviços | ✅ | CRUD + categorias + duplicatas + templates sugeridos (bulk) |
| Configurações | ✅ | Logo upload (Storage) + dados gerais + horários + link Book |
| BarberOS Book (`/book/[slug]`) | ✅ | 4 etapas + "Adicionar ao calendário" + rate limiting |
| Book SEO | ✅ | og:* + twitter:card + metadataBase |
| Book PWA | ✅ | manifest dinâmico por slug + themeColor + appleWebApp |
| Relatórios | ✅ | Cards+delta + recharts + insights + CSV/PDF + gate plano |
| Planos (`/dashboard/planos`) | ✅ | Tabela comparativa + texto dinâmico |
| Sistema de planos (`lib/plans.ts`) | ✅ | free/pro/premium com feature gates |
| Painel Admin (`/admin`) | ✅ | MRR/ARR + gráficos recharts + CSV + gestão de planos |
| Rate limiting | ✅ | `lib/rate-limit.ts` + middleware para /book/* |
| Race condition agendamentos | ✅ | Constraint `no_overlap_appointments` + erro 23P01 tratado |
| Mobile overflow fix | ✅ | html overflow-x hidden + wrappers nas tabelas |

## O que falta (MVP)

| Módulo | Prioridade | Dependências |
|---|---|---|
| Deploy | Alta | Vercel + Render |
| WhatsApp Bot | Alta | Evolution API no Render (ver CHATBOT.md) |
| Notificações de lembrete | Média | Bot funcionando + cron Vercel |
| Arquivos estáticos PWA/SEO | Baixa | og-default.png + icons/ (criar manualmente) |
