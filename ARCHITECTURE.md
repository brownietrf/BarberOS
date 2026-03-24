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
│   ├── book/[slug]/            # Público — página de agendamento do cliente
│   │   ├── page.tsx            # Server: busca barbershop + services pelo slug
│   │   └── client.tsx          # Client: fluxo 4 etapas (serviço→data→dados→ok)
│   ├── dashboard/
│   │   ├── layout.tsx          # Server: auth guard + passa barbershop à sidebar
│   │   ├── page.tsx            # Server: stats do dia
│   │   ├── agenda/
│   │   │   ├── page.tsx        # Server: appointments_full + blocked_slots + services + customers
│   │   │   └── client.tsx      # Client: agenda dia/semana/mês, CRUD completo
│   │   ├── clientes/
│   │   │   ├── page.tsx        # Server: customers ordenados por last_visit_at
│   │   │   └── client.tsx      # Client: tabela, busca, sort, CRUD
│   │   ├── servicos/
│   │   │   ├── page.tsx        # Server: services por display_order
│   │   │   └── client.tsx      # Client: CRUD, múltiplas categorias, duplicatas
│   │   └── configuracoes/
│   │       ├── page.tsx        # Server: barbershop completo + user email
│   │       └── client.tsx      # Client: dados gerais, horários, link do Book
│   ├── login/page.tsx          # Client: login | cadastro | recuperar senha
│   ├── onboarding/page.tsx     # Client: wizard 3 passos (cria barbearia)
│   ├── reset-password/page.tsx # Client: troca de senha via token
│   ├── layout.tsx              # Root layout (fontes Inter + Geist)
│   ├── page.tsx                # Redirect → /login
│   └── globals.css             # Tailwind + .input-base utility class
├── components/
│   ├── layout/sidebar.tsx      # Nav: desktop sidebar fixo + mobile drawer
│   └── ui/modal.tsx            # Modal: backdrop blur, escape, scroll lock, size sm|md
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # createClient() — browser (usa cookies via @supabase/ssr)
│   │   ├── server.ts           # createClient() async — server (lê cookies do Next.js)
│   │   └── admin.ts            # adminClient — service_role, sem RLS
│   └── utils.ts                # cn(…) = clsx + tailwind-merge
├── types/
│   └── database.ts             # Todos os types: Barbershop, Service, Customer, Appointment…
└── middleware.ts               # Proteção: /dashboard/*, /onboarding/* exigem auth
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
// Sempre async, sempre server
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
  // ...
}
```

---

## Fluxo de Autenticação

```
/login → signInWithPassword → redirect /dashboard
       → signUp → email confirmation → redirect /dashboard

/dashboard/* → middleware verifica session → sem auth = redirect /login
dashboard/layout.tsx → getUser() → sem barbershop = redirect /onboarding

/onboarding → cria barbershop com slug único → redirect /dashboard

/reset-password → exchangeCodeForSession(code) → updateUser({ password })
```

### Middleware (`src/middleware.ts`)
- Roda em: `/dashboard/:path*`, `/onboarding/:path*`, `/login`, `/reset-password`
- Lógica: sem user → redirect `/login`; user em `/login` → redirect `/dashboard`
- Rotas públicas (não no matcher): `/`, `/book/:slug*`

---

## Proteção de Dados (RLS)

O Supabase usa Row-Level Security. Padrão para recursos do barbeiro:
```sql
-- Dono acessa apenas os próprios dados
USING (barbershop_id IN (
  SELECT id FROM barbershops WHERE owner_id = auth.uid()
))
```

Rotas públicas (`/book/[slug]`) usam a chave `anon` e dependem de policies explícitas para leitura de `barbershops`, `services`, e inserção em `customers` e `appointments`.

---

## Rotas

| Rota | Auth | Server busca | Descrição |
|---|---|---|---|
| `/` | — | — | Redirect → /login |
| `/login` | Público | — | Auth completo |
| `/onboarding` | Autenticado | — | Cria barbearia |
| `/reset-password` | Público | — | Troca senha |
| `/book/[slug]` | **Público** | barbershop + services | Booking do cliente |
| `/dashboard` | Autenticado | stats do dia | Visão geral |
| `/dashboard/agenda` | Autenticado | appointments + blocked_slots + services + customers | Agenda |
| `/dashboard/clientes` | Autenticado | customers | Gestão de clientes |
| `/dashboard/servicos` | Autenticado | services | Catálogo |
| `/dashboard/configuracoes` | Autenticado | barbershop + user | Configurações |

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
                        reminder_sent, confirmed_at, cancelled_at, cancel_reason,
                        customer?: Customer, service?: Service, ... }
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
- Logout via `supabase.auth.signOut()`

### `.input-base` (globals.css)
Classe Tailwind para todos os inputs/textareas do projeto.

---

## Utilitários Recorrentes

```typescript
// cn() — merge de classes Tailwind
import { cn } from '@/lib/utils'
cn('base-class', condition && 'conditional', { 'object-syntax': true })

// Formatação de datas (date-fns + ptBR)
format(date, "dd 'de' MMMM", { locale: ptBR })
format(parseISO(isoString), 'HH:mm')

// Telefone (em clientes/book)
maskPhone(v)      // formata input enquanto digita: (11) 99999-9999
normalizePhone(v) // remove não-dígitos
isValidPhone(v)   // valida 10-11 dígitos

// Preço
price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
```

---

## O que está implementado

| Módulo | Status | Observações |
|---|---|---|
| Auth (login/cadastro/recuperação) | ✅ | Templates de e-mail configurados |
| Onboarding 3 passos | ✅ | Cria barbershop com slug único |
| Dashboard overview | ✅ | Stats do dia em tempo real |
| Agenda (dia/semana/mês) | ✅ | CRUD + bloqueios, ordenado por horário |
| Clientes | ✅ | CRUD + VIP + busca + sort |
| Serviços | ✅ | CRUD + categorias múltiplas + duplicatas |
| Configurações | ✅ | Dados gerais + horários + link do Book |
| BarberOS Book (`/book/[slug]`) | ✅ | Agendamento público em 4 etapas |

## O que falta (MVP)

| Módulo | Prioridade | Dependências |
|---|---|---|
| WhatsApp Bot | Alta | Evolution API no Railway |
| Deploy | Alta | Vercel + Railway |
| Notificações de lembrete | Média | Bot funcionando |
