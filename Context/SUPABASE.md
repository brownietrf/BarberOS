# BarberOS — Referência Supabase

**Projeto:** BarberOS
**Região:** sa-east-1 (São Paulo)
**Timezone do banco:** UTC — todas as funções usam `timezone('America/Sao_Paulo', ...)` para converter horários locais

---

## Variáveis de Ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # exposta no browser, protegida por RLS
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # apenas server-side, nunca expor no client
ADMIN_EMAIL=admin@example.com               # e-mail do administrador da plataforma
```

---

## Clientes

```typescript
// Client Component ('use client')
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// Server Component / Route Handler
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// Operações admin (service role) — apenas em server actions/API routes
import { adminClient } from '@/lib/supabase/admin'
```

---

## Tabelas

### `barbershops`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `owner_id` | uuid FK → auth.users | Dono da barbearia |
| `name` | text | Nome da barbearia |
| `slug` | text UNIQUE | URL slug (ex: `barbearia-do-joao`) |
| `phone` | text | Telefone de contato |
| `whatsapp` | text | Número WhatsApp |
| `bot_name` | text | Nome do assistente virtual |
| `address` | text | Endereço |
| `city` | text | Cidade |
| `logo_url` | text | URL do logo |
| `working_hours` | jsonb | Horários por dia (ver estrutura abaixo) |
| `slot_duration` | int | Duração padrão do slot em minutos |
| `is_active` | boolean | Barbearia ativa |
| `plan` | text | `'free'` \| `'pro'` \| `'premium'` |
| `trial_ends_at` | timestamptz | Fim do período trial |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Estrutura de `working_hours` (JSONB):**
```json
{
  "seg": { "open": "08:00", "close": "19:00", "active": true },
  "ter": { "open": "08:00", "close": "19:00", "active": true },
  "qua": { "open": "08:00", "close": "19:00", "active": true },
  "qui": { "open": "08:00", "close": "19:00", "active": true },
  "sex": { "open": "08:00", "close": "19:00", "active": true },
  "sab": { "open": "08:00", "close": "17:00", "active": true },
  "dom": { "open": "08:00", "close": "12:00", "active": false }
}
```

---

### `services`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `barbershop_id` | uuid FK → barbershops | |
| `name` | text | Nome do serviço |
| `description` | text | Descrição opcional |
| `duration_min` | int | Duração em minutos |
| `price` | numeric | Preço em BRL |
| `is_active` | boolean | Serviço visível |
| `display_order` | int | Ordem de exibição |
| `category` | text[] | Array de categorias: `'Cabelo'` \| `'Barba'` \| `'Combo'` \| `'Químicas'` \| `'Extra'` |
| `created_at` | timestamptz | |

---

### `customers`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `barbershop_id` | uuid FK → barbershops | |
| `name` | text | Nome do cliente |
| `phone` | text | Telefone (apenas dígitos, ex: `11999999999`) |
| `notes` | text | Observações internas |
| `total_visits` | int | Contador de visitas (incrementado por trigger) |
| `last_visit_at` | timestamptz | Última visita |
| `created_at` | timestamptz | |

---

### `appointments`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `barbershop_id` | uuid FK → barbershops | |
| `customer_id` | uuid FK → customers | Nullable |
| `service_id` | uuid FK → services | Nullable |
| `start_time` | timestamptz | Início (UTC) |
| `end_time` | timestamptz | Fim (UTC) |
| `status` | text | `'pending'` \| `'confirmed'` \| `'cancelled'` \| `'completed'` \| `'no_show'` |
| `source` | text | `'whatsapp'` \| `'web'` \| `'manual'` |
| `notes` | text | Observações |
| `reminder_sent` | boolean | Lembrete enviado |
| `confirmed_at` | timestamptz | |
| `cancelled_at` | timestamptz | |
| `cancel_reason` | text | Motivo do cancelamento |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

### `blocked_slots`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `barbershop_id` | uuid FK → barbershops | |
| `start_time` | timestamptz | Início do bloqueio (UTC) |
| `end_time` | timestamptz | Fim do bloqueio (UTC) |
| `reason` | text | Motivo (opcional) |
| `created_at` | timestamptz | |

---

### `bot_sessions`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `barbershop_id` | uuid FK → barbershops | |
| `phone` | text | Telefone do usuário no WhatsApp |
| `state` | text | Estado atual da conversa no bot |
| `context` | jsonb | Dados acumulados da sessão |
| `last_message_at` | timestamptz | |
| `created_at` | timestamptz | |

---

### `whatsapp_instances`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `barbershop_id` | uuid FK → barbershops | |
| `instance_name` | text | Nome da instância na Evolution API |
| `phone_number` | text | Número conectado |
| `status` | text | `'connected'` \| `'disconnected'` \| `'connecting'` \| `'banned'` |
| `qr_code` | text | QR Code para conexão |
| `connected_at` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## View

### `appointments_full`
JOIN de `appointments` + `customers` + `services`. Exposta publicamente (SELECT liberado).

Colunas extras em relação a `appointments`:
- `customer_name` — customers.name
- `customer_phone` — customers.phone
- `service_name` — services.name
- `service_duration` — services.duration_min
- `service_price` — services.price

**Uso:**
```typescript
supabase.from('appointments_full').select('*')
  .eq('barbershop_id', id)
  .gte('start_time', start)
  .lte('start_time', end)
  .order('start_time', { ascending: true })
```

---

## Functions (RPC)

### `get_available_slots` ⚠️ única versão — não criar overloads
```sql
get_available_slots(
  p_barbershop_id uuid,
  p_date          date,
  p_duration_min  integer DEFAULT 30,
  p_timezone      text    DEFAULT 'America/Sao_Paulo'
)
RETURNS TABLE(slot_time timestamptz, available boolean)
SECURITY DEFINER
```

- Lê `working_hours` da barbearia para o dia da semana informado
- Converte horários locais → UTC via `timezone(p_timezone, ...)`
- Marca `available = false` se houver `appointments` (pending/confirmed) ou `blocked_slots` sobrepostos, ou se o slot já passou
- **Retorna TODOS os slots** (disponíveis e indisponíveis) — filtrar no client

**Uso no client:**
```typescript
const { data } = await supabase.rpc('get_available_slots', {
  p_barbershop_id: barbershop.id,
  p_date: '2026-03-25',          // yyyy-MM-dd
  p_duration_min: 30,
})
const available = (data as { slot_time: string; available: boolean }[])
  .filter(r => r.available)
  .map(r => r.slot_time)
```

---

### Outras funções
| Função | Uso previsto |
|---|---|
| `upsert_customer` | Cria ou retorna cliente por telefone |
| `upsert_bot_session` | Gerencia estado da conversa do bot |
| `get_pending_reminders` | Agendamentos que precisam de lembrete WhatsApp |
| `handle_appointment_completed` | Trigger: incrementa total_visits do cliente |
| `cleanup_old_sessions` | Remove sessões do bot expiradas |

---

## RLS Policies

### `barbershops`
| Policy | Cmd | Regra |
|---|---|---|
| `owner can view own barbershop` | SELECT | `owner_id = auth.uid()` |
| `owner can insert own barbershop` | INSERT | `owner_id = auth.uid()` |
| `owner can update own barbershop` | UPDATE | `owner_id = auth.uid()` |
| `public can view active barbershops` | SELECT | `is_active = true` (anon) |

### `services`
| Policy | Cmd | Regra |
|---|---|---|
| `owner can manage services` | ALL | barbershop pertence ao `auth.uid()` |
| `public can view active services` | SELECT | `is_active = true` (anon) |

### `customers`
| Policy | Cmd | Regra |
|---|---|---|
| `owner can manage customers` | ALL | barbershop pertence ao `auth.uid()` |
| `public can select customers for upsert` | SELECT | `true` (anon) — necessário para Book |
| `public can insert customers` | INSERT | `true` (anon) — necessário para Book |

### `appointments`
| Policy | Cmd | Regra |
|---|---|---|
| `owner can manage appointments` | ALL | barbershop pertence ao `auth.uid()` |
| `public can insert appointment` | INSERT | `true` (anon) — necessário para Book |

### `blocked_slots`
| Policy | Cmd | Regra |
|---|---|---|
| `owner can manage blocked slots` | ALL | barbershop pertence ao `auth.uid()` |
| `public can view blocked slots` | SELECT | `true` (anon) — necessário para `get_available_slots` |

### `bot_sessions`
| Policy | Cmd | Regra |
|---|---|---|
| `owner can manage bot sessions` | ALL | barbershop pertence ao `auth.uid()` |
| `service role can manage bot sessions` | ALL | `auth.role() = 'service_role'` |

### `whatsapp_instances`
| Policy | Cmd | Regra |
|---|---|---|
| `owner can manage whatsapp instance` | ALL | barbershop pertence ao `auth.uid()` |

---

## Padrões de Query

```typescript
// Buscar barbearia do usuário autenticado
const { data } = await supabase
  .from('barbershops')
  .select('*')
  .eq('owner_id', user.id)
  .single()

// Buscar barbearia por slug (público)
const { data } = await supabase
  .from('barbershops')
  .select('id, name, slug, working_hours, slot_duration, logo_url, city')
  .eq('slug', slug)
  .eq('is_active', true)
  .single()

// Agendamentos do dia com joins
const { data } = await supabase
  .from('appointments_full')
  .select('*')
  .eq('barbershop_id', id)
  .gte('start_time', startOfDay.toISOString())
  .lte('start_time', endOfDay.toISOString())
  .order('start_time', { ascending: true })

// Relatórios — período baseado no plano
const defaultPeriod = PLANS[barbershop.plan].reportPeriods[0]  // '7d' para pro
const start = subDays(new Date(), defaultPeriod === '7d' ? 7 : 30)
const { data } = await supabase
  .from('appointments_full')
  .select('id, start_time, status, source, customer_name, service_name, service_price')
  .eq('barbershop_id', id)
  .gte('start_time', start.toISOString())

// Admin — buscar todas as barbearias (service role, sem RLS)
const { data } = await adminClient
  .from('barbershops')
  .select('id, name, slug, owner_id, plan, trial_ends_at, is_active, created_at')
  .order('created_at', { ascending: false })

// Admin — listar todos os usuários
const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
```
