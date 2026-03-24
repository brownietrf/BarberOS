# BarberOS — Documentação Técnica

## Estrutura de Arquivos

```
src/
├── app/
│   ├── admin/
│   │   ├── page.tsx            # Server: verifica ADMIN_EMAIL + busca barbershops + auth users
│   │   ├── client.tsx          # Client: stats, tabela de usuários, modal de edição de plano
│   │   └── actions.ts          # Server Actions: updatePlan, toggleActive (via adminClient)
│   ├── layout.tsx              # Root layout (fontes, metadata global)
│   ├── page.tsx                # Redireciona → /login
│   ├── globals.css             # Estilos globais: Tailwind + .input-base + html overflow-x hidden
│   ├── login/page.tsx          # Auth: login | cadastro | recuperar senha
│   ├── onboarding/page.tsx     # Wizard 3 passos: cria barbearia no Supabase
│   ├── reset-password/page.tsx # Troca de senha via exchangeCodeForSession
│   ├── book/[slug]/            # Página pública de agendamento (sem auth)
│   │   ├── page.tsx            # Server: busca barbearia + serviços pelo slug
│   │   └── client.tsx          # Client: fluxo 4 etapas de agendamento
│   └── dashboard/
│       ├── layout.tsx          # Server: verifica auth + busca barbershop → Sidebar
│       ├── page.tsx            # Server: stats do dia + banner do plano atual
│       ├── agenda/
│       │   ├── page.tsx        # Server: busca appointments_full + blocked_slots
│       │   └── client.tsx      # Client: visão dia/semana/mês, CRUD completo
│       ├── clientes/
│       │   ├── page.tsx        # Server: busca customers ordenados por last_visit_at
│       │   └── client.tsx      # Client: tabela, busca, sort, CRUD + máscara telefone
│       ├── planos/
│       │   ├── page.tsx        # Server: busca barbershop
│       │   └── client.tsx      # Client: cards de planos, banner status trial, texto vantagens
│       ├── relatorios/
│       │   ├── page.tsx        # Server: busca appointments_full com período do plano
│       │   └── client.tsx      # Client: cards, gráficos, insights, gate blur para Pro
│       ├── servicos/
│       │   ├── page.tsx        # Server: busca services ordenados por display_order
│       │   └── client.tsx      # Client: CRUD, categorias múltiplas, filtros, detecção duplicatas
│       └── configuracoes/
│           ├── page.tsx        # Server: busca barbershop completo por owner_id
│           └── client.tsx      # Client: edita dados gerais + horários + link do Book
├── components/
│   ├── layout/sidebar.tsx      # Nav responsiva: desktop sidebar + mobile drawer
│   │                           # Logo mobile = <Link href="/dashboard">
│   └── ui/modal.tsx            # Modal reutilizável (backdrop, escape, scroll lock)
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # createClient() — uso em 'use client' (browser)
│   │   ├── server.ts           # createClient() async — uso em Server Components / API
│   │   └── admin.ts            # adminClient — service role key, operações privilegiadas
│   ├── plans.ts                # PLANS config + isTrialActive/Expired/trialDaysLeft
│   └── utils.ts                # cn() — merge de classes Tailwind
├── types/database.ts           # Todos os types/interfaces do banco + AppointmentFull
└── middleware.ts               # Proteção de rotas: /dashboard/*, /onboarding/*, /admin/*
```

---

## Banco de Dados (Supabase — sa-east-1)

### Tabelas

| Tabela | Descrição |
|---|---|
| `barbershops` | Dados da barbearia (dono, slug, horários, plano, trial_ends_at) |
| `services` | Catálogo de serviços (preço, duração, categorias múltiplas) |
| `customers` | Clientes da barbearia (nome, telefone, total_visits) |
| `appointments` | Agendamentos (status, fonte, cliente, serviço, horários) |
| `blocked_slots` | Bloqueios de horário (sem agendamento) |
| `bot_sessions` | Estado da conversa do bot WhatsApp por telefone |
| `whatsapp_instances` | Instâncias Evolution API (status, qr_code) |

### View
- `appointments_full` — JOIN de appointments + customers + services

### Functions (RPC)
| Função | Parâmetros | Uso |
|---|---|---|
| `get_available_slots` | barbershop_id, date, duration_min, timezone | Retorna horários livres ⚠️ não criar overloads |
| `upsert_customer` | barbershop_id, name, phone | Cria ou retorna cliente existente |
| `upsert_bot_session` | — | Gerencia sessão do bot |
| `get_pending_reminders` | — | Lista agendamentos que precisam de lembrete |
| `handle_appointment_completed` | — | Trigger ao completar agendamento |
| `cleanup_old_sessions` | — | Remove sessões antigas do bot |

---

## Tipos Principais (`types/database.ts`)

```typescript
Plan = 'free' | 'pro' | 'premium'
ServiceCategory = 'Cabelo' | 'Barba' | 'Combo' | 'Químicas' | 'Extra'
AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
AppointmentSource = 'whatsapp' | 'web' | 'manual'
WhatsappStatus = 'connected' | 'disconnected' | 'connecting' | 'banned'

WorkingHours = { seg|ter|qua|qui|sex|sab|dom: DaySchedule }
DaySchedule = { open: string, close: string, active: boolean }

AppointmentFull extends Appointment {
  customer_name, customer_phone, service_name, service_duration, service_price
}
```

---

## Sistema de Planos (`lib/plans.ts`)

```typescript
interface PlanDef {
  label, price, priceNote
  reportPeriods: ('7d' | '30d' | '90d' | '12m')[]
  reportInsights: boolean
  reportDetailed: boolean
  chatbot: boolean | 'full'
  maxClients: number | null
  maxServices: number | null
}

PLANS.free    → trial, acesso total, reportPeriods: ['7d', '30d']
PLANS.pro     → R$49,90, reportPeriods: ['7d'], reportInsights: false
PLANS.premium → R$89,90, reportPeriods: ['7d','30d','90d','12m'], tudo incluso

isTrialActive(barbershop)  → boolean
isTrialExpired(barbershop) → boolean
trialDaysLeft(barbershop)  → number
```

---

## Padrões de Código

### Fluxo de dados
```
page.tsx (server) → busca dados Supabase → passa como props
client.tsx (client) → recebe initialData → gerencia state + mutations
```

### Supabase
```typescript
// Server Component
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// Client Component
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// Server Action com privilégio (admin)
import { adminClient } from '@/lib/supabase/admin'
// usar apenas em arquivos 'use server', nunca expor ao browser
```

### Proteção de rotas
- Middleware (`middleware.ts`): bloqueia `/dashboard/*`, `/onboarding/*`, `/admin/*` sem auth
- `dashboard/layout.tsx`: valida auth + existência de barbershop
- `/admin/page.tsx`: valida `user.email === process.env.ADMIN_EMAIL`

### Estilo (Tailwind)
- Background: `zinc-950` (base), `zinc-900` (cards), `zinc-800` (bordas)
- Accent: `amber-500` (#f59e0b)
- Texto: `white` (primário), `zinc-400` (secundário), `zinc-600` (placeholder)
- Mobile: `html { overflow-x: hidden }` + tabelas largas em `overflow-x-auto`

---

## Módulos em Detalhes

### `dashboard/page.tsx`
- Stats do dia: agendamentos hoje, pendentes, total clientes, concluídos
- `PlanBanner` component: exibe status do plano antes dos cards
  - free (trial ativo): dias restantes com urgência colorida + botão "Ver planos"
  - free (expirado): banner vermelho + CTA
  - pro/premium: badge do plano + link discreto "Ver planos"

### `dashboard/agenda/client.tsx`
- Views: `day | week | month`
- View dia: lista unificada `DayItem[]` mesclando appointments + blocked_slots, ordenada por `start_time`
- `fetchDay(date)` / `fetchRange(start, end)` — recarrega agendamentos por período
- Mutations: criar, editar, cancelar agendamento + criar/editar/deletar bloqueio
- Tag "via Book" para appointments com `source === 'web'`

### `dashboard/clientes/client.tsx`
- `maskPhone(v)` / `normalizePhone(v)` / `isValidPhone(v)` — utilitários de telefone
- VIP: clientes com `total_visits >= 10`
- Tabela: `overflow-x-auto` + `min-w-[580px]` para mobile

### `dashboard/servicos/client.tsx`
- Categorias múltiplas por serviço (array `ServiceCategory[]`)
- Detecção de duplicata por nome (exato + similaridade) com debounce 400ms
- `handleSave(force?)` — flag `force` ignora aviso de duplicata

### `dashboard/configuracoes/client.tsx`
- `saveGeneral()` / `saveHours()` — saves independentes por seção
- `applyToAll()` — copia horários de um dia para todos os dias ativos
- Link do Book: cópia para clipboard + compartilhamento via WhatsApp

### `dashboard/relatorios/client.tsx`
- Período inicial determinado pelo servidor com base em `PLANS[plan].reportPeriods[0]`
- Seletor de período: botões desabilitados/acinzentados para períodos fora do plano
- Gate de plano Pro: insights + gráficos renderizados mas cobertos por overlay `backdrop-blur-sm` com card "Recurso Premium"
- Métricas computadas client-side: agendamentos ativos, receita realizada, status breakdown, top services, por hora/dia
- Insights automáticos gerados a partir dos dados (dia mais movimentado, horário disputado, etc.)

### `dashboard/planos/client.tsx`
- 3 cards lado a lado (free/pro/premium) — plano atual destacado com borda amber
- `CurrentPlanBanner`: status contextual (trial ativo/expirando/expirado, ou plano pago)
- `AdvantagesSection`: texto dinâmico diferente por plano (free = apresentação do BarberOS, pro = destaque Pro + teaser Premium, premium = celebração do plano)

### `admin/client.tsx`
- Stats: total barbearias, em teste, teste expirado, planos pagos
- Tabela com `overflow-x-auto` + busca por nome/email/slug + filtro por plano
- Toggle ativo/inativo: update otimista + rollback se server action falhar
- Modal de edição: seletor de plano (3 cards), date input para trial_ends_at, toggle is_active
- Toggle CSS: `left-0.5` explícito + `translate-x-0` / `translate-x-5`

### `admin/actions.ts`
- `verifyAdmin()` — valida `user.email === process.env.ADMIN_EMAIL` antes de qualquer mutação
- `updatePlan(id, plan, trialEndsAt)` — atualiza plan + trial_ends_at via adminClient
- `toggleActive(id, isActive)` — ativa/desativa barbearia via adminClient

### `book/[slug]/client.tsx` (Booking público)
- 4 etapas: Serviço → Data/Hora → Dados pessoais → Confirmação
- Usa `get_available_slots` RPC para carregar horários livres
- Faz upsert de customer (busca por telefone, insere se não existir)
- Cria appointment com `source: 'web'`, `status: 'pending'`

---

## Autenticação

| Operação | Supabase |
|---|---|
| Login | `signInWithPassword` |
| Cadastro | `signUp` (email confirmation) |
| Recuperar senha | `resetPasswordForEmail` |
| Trocar senha | `exchangeCodeForSession` + `updateUser` |
| Logout | `auth.signOut()` (sidebar) |

---

## Variáveis de Ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # apenas server/admin
ADMIN_EMAIL=                 # e-mail do administrador da plataforma
```

---

## Próximos Passos (MVP)

1. **WhatsApp Bot** — Evolution API no Railway, integração via `bot_sessions` + `whatsapp_instances`
2. **Deploy** — Vercel (Next.js) + Railway (Evolution API)
3. **Notificações de lembrete** — bot envia lembrete antes do agendamento
