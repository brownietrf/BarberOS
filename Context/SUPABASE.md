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
| `subscription_ends_at` | timestamptz | Fim da assinatura paga |
| `subscription_period` | text | `'monthly'` \| `'3months'` \| `'6months'` \| `'12months'` |
| `grace_period_days` | int | Dias de carência após expiração (default: 10) |
| `referral_code` | text UNIQUE | Código de indicação desta barbearia |
| `referred_by` | text | Código de indicação usado no cadastro |
| `referral_bonus_ends_at` | timestamptz | Até quando o bônus de indicação está ativo |
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

### `loyalty_programs`
Configuração do programa de fidelidade (uma por barbearia, opt-in pelo barbeiro).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `barbershop_id` | uuid FK → barbershops UNIQUE | |
| `is_active` | boolean | Programa ativo ou pausado |
| `visits_required` | int | Visitas necessárias para ganhar recompensa (mín. 1) |
| `reward_description` | text | Descrição da recompensa (ex: "1 corte grátis") |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

### `loyalty_rewards`
Histórico de resgates de recompensas de fidelidade.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `barbershop_id` | uuid FK → barbershops | |
| `customer_id` | uuid FK → customers | |
| `visits_at_redemption` | int | `total_visits` do cliente no momento do resgate |
| `notes` | text | Observação opcional do barbeiro |
| `redeemed_at` | timestamptz | Data/hora do resgate |

**Lógica de progresso:**
```typescript
// visitas desde o último resgate = total_visits - visits_at_redemption do último reward
// se nunca resgatou: progresso = total_visits
const lastReward = rewards.filter(r => r.customer_id === id).sort(desc)[0]
const progress   = customer.total_visits - (lastReward?.visits_at_redemption ?? 0)
const eligible   = progress >= program.visits_required
```

---

### `referrals`
Rastreamento de indicações entre barbeiros.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `referrer_barbershop_id` | uuid FK → barbershops (SET NULL on delete) | Quem indicou |
| `referred_barbershop_id` | uuid FK → barbershops (SET NULL on delete) | Quem foi indicado |
| `status` | text | `'pending'` \| `'qualified'` \| `'rewarded'` |
| `reward_granted_at` | timestamptz | Quando o bônus foi concedido ao indicador |
| `created_at` | timestamptz | |

**Fluxo de indicação:**
1. Barbeiro A tem `referral_code` gerado no onboarding (ex: `joao-A1B2`)
2. Barbeiro B se cadastra informando o código de A no campo "Código de indicação"
3. O onboarding cria registro em `referrals` com `status = 'pending'` e preenche `referred_by` em B
4. Admin muda o plano de B para `pro` ou `premium` → `updatePlan` qualifica automaticamente: `status = 'qualified'`
5. Admin acessa a seção "Indicações" em `/admin` → botão "Dar" → modal de bônus:
   - **Mês grátis**: `subscription_ends_at` de A +30 dias + `referral_bonus_ends_at` +30 dias
   - **Upgrade de plano**: muda `plan` de A + idem acima
   - `grantReferralBonus` (Server Action): aplica as mudanças em A + marca referral como `status = 'rewarded'` + `reward_granted_at = now()`

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
| `anon can cancel appointments` | UPDATE | `true` (anon) — necessário para "Cancelar Agendamento" no Book |

**Policy de cancelamento anônimo** — execute no SQL Editor:
```sql
CREATE POLICY "anon can cancel appointments"
  ON appointments FOR UPDATE TO anon
  USING (status IN ('pending', 'confirmed'))
  WITH CHECK (status = 'cancelled');
```
Permite que qualquer usuário anônimo altere `status` de `pending`/`confirmed` para `cancelled`. Só libera essa transição; qualquer outro UPDATE é bloqueado.

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

### `loyalty_programs`
| Policy | Cmd | Regra |
|---|---|---|
| `owner can manage loyalty program` | ALL | barbershop pertence ao `auth.uid()` |
| `public can view active loyalty programs` | SELECT | `is_active = true` (anon) |

### `loyalty_rewards`
| Policy | Cmd | Regra |
|---|---|---|
| `owner can manage loyalty rewards` | ALL | barbershop pertence ao `auth.uid()` |

### `referrals`
| Policy | Cmd | Regra |
|---|---|---|
| `referrer can view own referrals` | SELECT | `referrer_barbershop_id` pertence ao `auth.uid()` |
| `authenticated can insert referral` | INSERT | `referred_barbershop_id` pertence ao `auth.uid()` — permite o indicado criar o registro no onboarding |
| `service role can manage referrals` | ALL | `auth.role() = 'service_role'` |

---

## Migração: Fidelidade + Indicações

Arquivo: `supabase/migrations/20260326_loyalty_and_referrals.sql`

Execute no SQL Editor do Supabase. Inclui:
- `ALTER TABLE barbershops ADD COLUMN ...` (referral_code, referred_by, referral_bonus_ends_at)
- `CREATE TABLE loyalty_programs` + RLS
- `CREATE TABLE loyalty_rewards` + RLS + índice
- `CREATE TABLE referrals` + RLS + índices

---

## Constraint anti-race condition em agendamentos

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE appointments ADD CONSTRAINT no_overlap_appointments
EXCLUDE USING gist (
  barbershop_id WITH =,
  tstzrange(start_time, end_time, '[)') WITH &&
)
WHERE (status IN ('pending', 'confirmed'));
```
Código de erro: `23P01` (exclusion_violation) — tratado explicitamente no Book e na Agenda.

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

// Programa de fidelidade da barbearia
const { data } = await supabase
  .from('loyalty_programs')
  .select('*')
  .eq('barbershop_id', barbershop.id)
  .maybeSingle()

// Resgates de fidelidade (para calcular progresso)
const { data } = await supabase
  .from('loyalty_rewards')
  .select('customer_id, visits_at_redemption, redeemed_at')
  .eq('barbershop_id', barbershop.id)

// Indicações feitas por esta barbearia
const { data } = await supabase
  .from('referrals')
  .select('id, referred_barbershop_id, status, reward_granted_at, created_at')
  .eq('referrer_barbershop_id', barbershop.id)
  .order('created_at', { ascending: false })

// Admin — buscar todas as barbearias (service role, sem RLS)
const { data } = await adminClient
  .from('barbershops')
  .select('id, name, slug, owner_id, plan, trial_ends_at, subscription_ends_at, subscription_period, grace_period_days, is_active, created_at')
  .order('created_at', { ascending: false })

// Admin — listar todos os usuários
const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
```
