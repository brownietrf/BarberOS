# BarberOS — Documentação Técnica

## Estrutura de Arquivos

```
src/
├── app/
│   ├── layout.tsx              # Root layout (fontes, metadata global)
│   ├── page.tsx                # Redireciona → /login
│   ├── globals.css             # Estilos globais + variáveis Tailwind
│   ├── login/page.tsx          # Auth: login | cadastro | recuperar senha
│   ├── onboarding/page.tsx     # Wizard 3 passos: cria barbearia no Supabase
│   ├── reset-password/page.tsx # Troca de senha via exchangeCodeForSession
│   ├── book/[slug]/            # Página pública de agendamento (sem auth)
│   │   ├── page.tsx            # Server: busca barbearia + serviços pelo slug
│   │   └── client.tsx          # Client: fluxo 4 etapas de agendamento
│   └── dashboard/
│       ├── layout.tsx          # Server: verifica auth + busca barbershop → Sidebar
│       ├── page.tsx            # Server: stats do dia (agendamentos, clientes, etc.)
│       ├── agenda/
│       │   ├── page.tsx        # Server: busca appointments_full + blocked_slots
│       │   └── client.tsx      # Client: visão dia/semana/mês, CRUD completo
│       ├── clientes/
│       │   ├── page.tsx        # Server: busca customers ordenados por last_visit_at
│       │   └── client.tsx      # Client: tabela, busca, sort, CRUD + máscara telefone
│       ├── servicos/
│       │   ├── page.tsx        # Server: busca services ordenados por display_order
│       │   └── client.tsx      # Client: CRUD, categorias múltiplas, filtros, detecção duplicatas
│       └── configuracoes/
│           ├── page.tsx        # Server: busca barbershop completo por owner_id
│           └── client.tsx      # Client: edita dados gerais + horários de funcionamento
├── components/
│   ├── layout/sidebar.tsx      # Nav responsiva: desktop sidebar + mobile drawer
│   └── ui/modal.tsx            # Modal reutilizável (backdrop, escape, scroll lock)
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # createClient() — uso em 'use client' (browser)
│   │   ├── server.ts           # createClient() async — uso em Server Components / API
│   │   └── admin.ts            # adminClient — service role key, operações privilegiadas
│   └── utils.ts                # cn() — merge de classes Tailwind
├── types/database.ts           # Todos os types/interfaces do banco
└── middleware.ts               # Proteção de rotas: /dashboard/* e /onboarding/*
```

---

## Banco de Dados (Supabase — sa-east-1)

### Tabelas

| Tabela | Descrição |
|---|---|
| `barbershops` | Dados da barbearia (dono, slug, horários, plano) |
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
| `get_available_slots` | barbershop_id, date, duration_min | Retorna horários livres para agendamento |
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
```

### Proteção de rotas
- Middleware (`middleware.ts`): bloqueia `/dashboard/*` e `/onboarding/*` sem auth
- `dashboard/layout.tsx`: valida auth + existência de barbershop, redireciona se necessário

### Estilo (Tailwind)
- Background: `zinc-950` (base), `zinc-900` (cards), `zinc-800` (bordas)
- Accent: `amber-500` (#f59e0b)
- Texto: `white` (primário), `zinc-400` (secundário), `zinc-600` (placeholder)

---

## Módulos em Detalhes

### `dashboard/agenda/client.tsx`
- Views: `day | week | month`
- `genSlots(hours, duration)` — gera slots baseado em working_hours e slot_duration
- `fetchDay(date)` / `fetchRange(start, end)` — recarrega agendamentos por período
- Mutations: criar, editar, cancelar agendamento + criar/editar/deletar bloqueio
- Usa view `appointments_full` (com joins de customer e service)

### `dashboard/clientes/client.tsx`
- `maskPhone(v)` / `normalizePhone(v)` / `isValidPhone(v)` — utilitários de telefone
- VIP: clientes com `total_visits >= 10`
- Detecção de duplicata por telefone antes de salvar

### `dashboard/servicos/client.tsx`
- Categorias múltiplas por serviço (array `ServiceCategory[]`)
- Detecção de duplicata por nome (exato + similaridade) com debounce 400ms
- `handleSave(force?)` — flag `force` ignora aviso de duplicata

### `dashboard/configuracoes/client.tsx`
- `saveGeneral()` / `saveHours()` — saves independentes por seção
- `applyToAll()` — copia horários de um dia para todos os dias ativos
- `SaveStatus = 'idle' | 'saving' | 'saved' | 'error'`

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
```

---

## Próximos Passos (MVP)

1. **WhatsApp Bot** — Evolution API no Railway, integração via `bot_sessions` + `whatsapp_instances`
2. **Página de agendamento** (`/book/[slug]`) — ✅ Implementado
3. **Deploy** — Vercel (Next.js) + Railway (Evolution API)
