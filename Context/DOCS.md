# BarberOS — Documentação Técnica

## Estrutura de Arquivos

```
src/
├── app/
│   ├── admin/
│   │   ├── page.tsx            # Server: verifica ADMIN_EMAIL + busca barbershops + auth users + referrals
│   │   ├── client.tsx          # Client: stats+MRR/ARR, gráficos recharts, tabela, seção indicações, modal bônus
│   │   └── actions.ts          # Server Actions: updatePlan, toggleActive, grantReferralBonus (via adminClient)
│   ├── layout.tsx              # Root layout (fontes, metadata global + metadataBase)
│   ├── page.tsx                # Redireciona → /login
│   ├── globals.css             # Estilos globais: Tailwind + .input-base + html overflow-x hidden
│   ├── login/page.tsx          # Auth: login | cadastro | recuperar senha
│   ├── onboarding/page.tsx     # Wizard 3 passos: cria barbearia + referral_code + campo referred_by
│   ├── reset-password/page.tsx # Troca de senha via exchangeCodeForSession
│   ├── book/[slug]/            # Página pública de agendamento (sem auth)
│   │   ├── page.tsx            # Server: SEO og:*/twitter:card + viewport PWA + manifest link
│   │   ├── client.tsx          # Client: menu (Agendar/Verificar/Cancelar) + fluxo 4 etapas + lookup por telefone
│   │   └── manifest.webmanifest/
│   │       └── route.ts        # Route Handler: manifest PWA dinâmico por slug
│   └── dashboard/
│       ├── layout.tsx          # Server: verifica auth + busca barbershop → Sidebar
│       ├── page.tsx            # Server: stats do dia + banner do plano atual
│       ├── agenda/
│       │   ├── page.tsx        # Server: busca appointments_full + blocked_slots
│       │   └── client.tsx      # Client: visão dia/semana/mês, CRUD completo, botão refresh
│       ├── clientes/
│       │   ├── page.tsx        # Server: customers + loyalty_program + loyalty_rewards
│       │   └── client.tsx      # Client: tabela, busca, sort, CRUD + progresso de fidelidade
│       ├── fidelidade/
│       │   ├── page.tsx        # Server: loyalty_program + loyalty_rewards + customers
│       │   └── client.tsx      # Client: ativar/configurar programa, lista de aptos, resgates
│       ├── planos/
│       │   ├── page.tsx        # Server: barbershop + referrals do indicador
│       │   ├── client.tsx      # Client: cards planos, banner status, código indicação, bônus
│       │   └── actions.ts      # Server Action: updateSubscriptionPeriod
│       ├── relatorios/
│       │   ├── page.tsx        # Server: busca appointments_full + período anterior + clientes
│       │   └── client.tsx      # Client: cards+delta, recharts timeline, insights, CSV/PDF, gate Pro
│       ├── servicos/
│       │   ├── page.tsx        # Server: busca services ordenados por display_order
│       │   └── client.tsx      # Client: CRUD, duplicatas, templates sugeridos (bulk insert)
│       └── configuracoes/
│           ├── page.tsx        # Server: busca barbershop completo por owner_id
│           └── client.tsx      # Client: logo upload (Storage), dados gerais, horários, link Book
├── components/
│   ├── layout/sidebar.tsx      # Nav responsiva: desktop sidebar + mobile drawer
│   │                           # Items: Visão Geral, Agenda, Clientes, Serviços,
│   │                           #        Relatórios, Fidelidade, Configurações
│   └── ui/modal.tsx            # Modal reutilizável (backdrop, escape, scroll lock)
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # createClient() — uso em 'use client' (browser)
│   │   ├── server.ts           # createClient() async — uso em Server Components / API
│   │   └── admin.ts            # adminClient — service role key, operações privilegiadas
│   ├── plans.ts                # PLANS + BILLING_PERIODS + todos os helpers de plano/assinatura
│   ├── rate-limit.ts           # Sliding window rate limiter in-memory (20 req/min/IP)
│   └── utils.ts                # cn() — merge de classes Tailwind
├── types/database.ts           # Types: Barbershop, Service, Customer, Appointment,
│                               # AppointmentFull, LoyaltyProgram, LoyaltyReward, Referral
└── middleware.ts               # Rate limit /book/*, proteção /dashboard/*, /onboarding/*, /admin/*
```

---

## Banco de Dados (Supabase — sa-east-1)

### Tabelas

| Tabela | Descrição |
|---|---|
| `barbershops` | Dados da barbearia (dono, slug, horários, plano, trial, assinatura, indicação) |
| `services` | Catálogo de serviços (preço, duração, categorias múltiplas) |
| `customers` | Clientes da barbearia (nome, telefone, total_visits) |
| `appointments` | Agendamentos (status, fonte, cliente, serviço, horários) |
| `blocked_slots` | Bloqueios de horário (sem agendamento) |
| `bot_sessions` | Estado da conversa do bot WhatsApp por telefone |
| `whatsapp_instances` | Instâncias Evolution API (status, qr_code) |
| `loyalty_programs` | Configuração do programa de fidelidade por barbearia (opt-in) |
| `loyalty_rewards` | Histórico de resgates de recompensas de fidelidade |
| `referrals` | Rastreamento de indicações entre barbeiros |

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
Plan             = 'free' | 'pro' | 'premium'
SubscriptionPeriod = 'monthly' | '3months' | '6months' | '12months'
ServiceCategory  = 'Cabelo' | 'Barba' | 'Combo' | 'Químicas' | 'Extra'
AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
AppointmentSource = 'whatsapp' | 'web' | 'manual'
WhatsappStatus   = 'connected' | 'disconnected' | 'connecting' | 'banned'
ReferralStatus   = 'pending' | 'qualified' | 'rewarded'

WorkingHours = { seg|ter|qua|qui|sex|sab|dom: DaySchedule }
DaySchedule  = { open: string, close: string, active: boolean }

AppointmentFull extends Appointment {
  customer_name, customer_phone, service_name, service_duration, service_price
}

LoyaltyProgram {
  id, barbershop_id, is_active, visits_required, reward_description, created_at, updated_at
}

LoyaltyReward {
  id, barbershop_id, customer_id, visits_at_redemption, notes, redeemed_at
}

Referral {
  id, referrer_barbershop_id, referred_barbershop_id,
  status: ReferralStatus, reward_granted_at, created_at
}
```

---

## Sistema de Planos (`lib/plans.ts`)

```typescript
interface PlanDef {
  label, price, priceNote, highlight, badge?
  reportPeriods: ('7d' | '30d' | '90d' | '12m')[]
  reportInsights: boolean
  reportDetailed: boolean
  chatbot: boolean | 'full'
  maxClients: number | null
  maxServices: number | null
}

interface BillingPeriodDef {
  label: string
  months: number
  discount: number   // 0 | 5 | 10 | 20
  badge?: string
}

PLANS.free    → trial, acesso total, reportPeriods: ['7d', '30d']
PLANS.pro     → R$49,90, reportPeriods: ['7d'], reportInsights: false
PLANS.premium → R$89,90, reportPeriods: ['7d','30d','90d','12m'], tudo incluso

BILLING_PERIODS.monthly  → 0% off
BILLING_PERIODS.3months  → 5% off
BILLING_PERIODS.6months  → 10% off
BILLING_PERIODS.12months → 20% off

// Helpers de trial
isTrialActive(b)   isTrialExpired(b)   trialDaysLeft(b)

// Helpers de assinatura paga
isSubscriptionExpired(b)    subscriptionDaysLeft(b)
isSubscriptionExpiring(b, days=7)
gracePeriodDaysLeft(b)      isGracePeriod(b)      isFullyLocked(b)
getSubscriptionPrice(plan, period) → { total, perMonth, discount }
calcSubscriptionEndsAt(period)     → Date
GRACE_PERIOD_DAYS = 10
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
- Botão de refresh manual: recarrega o período atual sem recarregar a página
- Erro específico `23P01` (exclusion violation) → mensagem "horário já ocupado"

### `dashboard/clientes/client.tsx`
- `maskPhone(v)` / `normalizePhone(v)` / `isValidPhone(v)` — utilitários de telefone
- VIP: clientes com `total_visits >= 10`
- Tabela: `overflow-x-auto` + `min-w-[580px]` para mobile
- Modal de perfil: exibe barra de progresso de fidelidade (se programa ativo)
  - Calcula `total_visits - visits_at_redemption_do_último_resgate`
  - Badge âmbar quando elegível ao resgate

### `dashboard/fidelidade/client.tsx`
- Toggle ativo/pausado com update otimista
- Modal de configuração: `visits_required` (mín. 1) + `reward_description`
  - Cria `loyalty_programs` se não existir; atualiza se já existir
- Lista de clientes ordenada por `total_visits` descendente
  - Barra de progresso colorida (zinc → amber quando elegível)
  - Botão "Resgatar" aparece apenas para clientes elegíveis e programa ativo
- Resgate: insere em `loyalty_rewards` com `visits_at_redemption = customer.total_visits`
- Histórico: últimos 20 resgates com nome do cliente e data

### `dashboard/servicos/client.tsx`
- Categorias múltiplas por serviço (array `ServiceCategory[]`)
- Detecção de duplicata por nome (exato + similaridade) com debounce 400ms
- `handleSave(force?)` — flag `force` ignora aviso de duplicata
- `SERVICE_TEMPLATES` — 13 serviços pré-definidos (Cabelo, Barba, Combo, Químicas, Extra)
- Painel de sugestões auto-exibido para ≤ 5 serviços; botão sutil "Sugestões" para > 5
- `availableTemplates` (useMemo) filtra templates já cadastrados pelo nome
- `handleAddTemplates()` — insert em lote, `display_order` sequencial a partir do total atual

### `dashboard/configuracoes/client.tsx`
- `saveGeneral()` / `saveHours()` — saves independentes por seção
- `applyToAll()` — copia horários de um dia para todos os dias ativos
- Link do Book: `useState('')` + `useEffect` para evitar hydration mismatch com `window.location.origin`
- Upload de logo: Supabase Storage bucket `logos`, path `{barbershop_id}/logo`, `upsert: true`
- Cache-bust `?t=timestamp` na URL salva para forçar reload da imagem no browser
- Remoção de logo: seta `logo_url = null` no banco

### `dashboard/relatorios/client.tsx`
- Período inicial determinado pelo servidor com base em `PLANS[plan].reportPeriods[0]`
- Seletor de período: botões desabilitados/acinzentados para períodos fora do plano
- Gate de plano Pro: insights + gráficos renderizados mas cobertos por overlay `backdrop-blur-sm` com card "Recurso Premium"
- Métricas computadas client-side: agendamentos ativos, receita realizada, status breakdown, top services, por hora/dia
- Insights automáticos gerados a partir dos dados (dia mais movimentado, horário disputado, etc.)
- Cards com delta (▲▼ %) comparando período atual com período anterior de igual duração
- Gráfico recharts `ComposedChart`: barras âmbar (agendamentos) + linha verde (receita), dual Y-axis
- `exportCSV()` — CSV com BOM (compatível com Excel), separador `;`, download direto
- `exportPDF()` — jsPDF + autotable: cabeçalho escuro, 4 KPIs, tabela top serviços, tabela completa com paginação

### `dashboard/planos/client.tsx`
- 3 cards lado a lado (free/pro/premium) — plano atual destacado com borda amber
- Seletor de período de cobrança (monthly/3m/6m/12m) com desconto visível
- `updateSubscriptionPeriod` — Server Action para salvar período preferido
- `CurrentPlanBanner`: status contextual (trial ativo/expirando/expirado, plano pago, expirado)
- `AdvantagesSection`: texto dinâmico diferente por plano
- `ReferralSection`: código de indicação com botão copiar, bônus ativo se `referral_bonus_ends_at` no futuro, stats (total indicados / assinaram / pendentes)

### `onboarding/page.tsx`
- 3 steps: dados da barbearia → personalização do bot → tempo de atendimento + código de indicação
- Gera `referral_code` único no momento do insert (`slug-XXXX`)
- Valida `referred_by` contra `barbershops.referral_code` antes de inserir
- Se válido, cria registro em `referrals` com `status = 'pending'`

### `admin/client.tsx`
- Stats: 8 cards — total barbearias, em trial, trial expirado, planos pagos, MRR, ARR, em carência, bloqueados
- MRR = Pro × R$49,90 + Premium × R$89,90; ARR = MRR × 12
- Alertas automáticos quando há barbearias com trial, assinatura expirando em ≤ 7 dias, em carência ou bloqueadas
- Gráfico de crescimento: `BarChart` recharts, barbearias criadas por mês (últimos 12 meses)
- Gráfico de mix de planos: `PieChart` donut com legenda (Free/Pro/Premium)
- `exportCSV()` — exporta tabela filtrada com BOM para Excel
- Tabela com `overflow-x-auto` + busca por nome/email/slug + filtro por plano + filtro por status assinatura
- Toggle ativo/inativo: update otimista + rollback se server action falhar
- Modal de edição: seletor de plano (3 cards), date inputs para trial_ends_at + subscription_ends_at, subscription_period, grace_period_days, toggle is_active
- **Seção de indicações**: tabela referrer → referred com plano do indicado, status badge (pendente/qualificada/bonificada) e data; qualificadas mostram botão "Dar" bônus
- **Modal de bônus**: seletor de tipo (mês grátis / upgrade de plano) + seletor do plano de destino se upgrade; chama `grantReferralBonus`; update otimista no estado local

### `admin/actions.ts`
- `verifyAdmin()` — valida `user.email === process.env.ADMIN_EMAIL` antes de qualquer mutação
- `updatePlan(id, plan, trialEndsAt, subscriptionEndsAt?, subscriptionPeriod?, gracePeriodDays?)` — atualiza via adminClient; qualifica automaticamente indicações pendentes quando plano vai para `pro` ou `premium`
- `toggleActive(id, isActive)` — ativa/desativa barbearia via adminClient
- `grantReferralBonus(referralId, referrerBarbershopId, bonusType, upgradePlan?)`:
  - Busca `subscription_ends_at` atual do indicador
  - Estende sub em +30 dias (a partir do fim atual se futuro, ou de agora)
  - `free_month`: mantém plano + seta `referral_bonus_ends_at`
  - `plan_upgrade`: muda plano + estende sub + seta `referral_bonus_ends_at`
  - Marca referral como `rewarded` + preenche `reward_granted_at`

### `book/[slug]/client.tsx` (Booking público)
- `mode: null | 'book' | 'check' | 'cancel'` — controla qual tela exibir
- **Home menu** (`mode === null`): 3 cards com ícone colorido — Agendar (âmbar), Verificar (azul), Cancelar (vermelho)
- **Agendar** (`mode === 'book'`): 4 etapas — Serviço → Data/Hora → Dados pessoais → Confirmação
  - Usa `get_available_slots` RPC; faz upsert de customer por telefone
  - Cria appointment com `source: 'web'`, `status: 'pending'`
  - Erro `23P01` → mensagem + recarrega slots automaticamente
  - `addToCalendar()`: Web Share API `.ics` (mobile) ou download direto (desktop)
  - Step 1 tem botão "Voltar" que retorna ao menu; step 4 "Fazer novo agendamento" também
- **Verificar** (`mode === 'check'`): campo de telefone → busca customer → lista agendamentos futuros (pending/confirmed)
  - Estado vazio com mensagem amigável se nenhum agendamento encontrado
- **Cancelar** (`mode === 'cancel'`): mesmo lookup de telefone + botão "Cancelar" por card → inline confirm "Tem certeza? / Não / Sim, cancelar"
  - Usa `UPDATE appointments SET status = 'cancelled'` pelo cliente anônimo ⚠️ requer policy RLS (ver SUPABASE.md)
  - Feedback de sucesso/erro por mensagem inline
- `openLookup(mode)` — reseta estados de busca ao entrar em check/cancel
- `handleLookup()`: busca customer por barbershop_id + phone → busca appointments futuros com join em services
- `handleCancel(id)`: update otimista no estado local + rollback implícito se server retornar erro
- `today` e `maxDate` via `useState('')` + `useEffect` para evitar hydration mismatch

### `book/[slug]/page.tsx` (SEO + PWA)
- `generateMetadata` produz `og:title`, `og:description`, `og:image` (logo ou og-default.png), `twitter:card`
- `og:image` usa `logo_url` da barbearia se existir; fallback: `/public/og-default.png` (1200×630)
- `viewport.themeColor = '#f59e0b'` — barra do browser âmbar no Android
- `appleWebApp.capable = true` — "Adicionar à tela inicial" no iOS sem Chrome
- `manifest: /book/${slug}/manifest.webmanifest` — linka o manifest PWA dinâmico

### `book/[slug]/manifest.webmanifest/route.ts`
- Route Handler que retorna JSON do manifest PWA personalizado por barbearia
- Usa `logo_url` como ícone se existir; fallback: `/icons/icon-192.png` + `/icons/icon-512.png`
- `display: 'standalone'`, `theme_color: '#f59e0b'`, `background_color: '#09090b'`
- Cache-Control: public, max-age=3600

### `lib/rate-limit.ts`
- Sliding window in-memory: `Map<string, { count, resetAt }>`
- `rateLimit(key, limit, windowMs)` → `{ success, remaining, resetAt }`
- `cleanup()` executado a cada chamada para evitar leak de memória
- ⚠️ Funciona por instância — para multi-region produção migrar para Upstash

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
SUPABASE_SERVICE_ROLE_KEY=    # apenas server/admin
ADMIN_EMAIL=                  # e-mail do administrador da plataforma
NEXT_PUBLIC_APP_URL=          # URL pública (ex: https://barberos.vercel.app) — og:url e manifest
# Futuro — chatbot:
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
WEBHOOK_SECRET=               # opcional: valida origem do webhook da Evolution API
```

---

## Arquivos estáticos obrigatórios (criar manualmente)

| Arquivo | Tamanho | Uso |
|---|---|---|
| `public/og-default.png` | 1200×630 px | Fallback og:image quando barbearia não tem logo |
| `public/icons/icon-192.png` | 192×192 px | Fallback ícone PWA |
| `public/icons/icon-512.png` | 512×512 px | Fallback ícone PWA (splash screen) |

---

## Supabase Storage

| Bucket | Visibilidade | Path | Uso |
|---|---|---|---|
| `logos` | Public | `{barbershop_id}/logo` | Logo da barbearia (upsert) |

Políticas necessárias: SELECT público (anon), INSERT/UPDATE/DELETE apenas para o dono da barbearia (`owner_id = auth.uid()`).

---

## Proteção anti-race condition em agendamentos

Constraint no banco (executada via SQL Editor do Supabase):
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE appointments ADD CONSTRAINT no_overlap_appointments
EXCLUDE USING gist (
  barbershop_id WITH =,
  tstzrange(start_time, end_time, '[)') WITH &&
)
WHERE (status IN ('pending', 'confirmed'));
```
Código de erro retornado: `23P01` (exclusion_violation) — tratado explicitamente no book e na agenda.

---

## Próximos Passos (MVP)

1. **Deploy** — Vercel (Next.js) + Render (Evolution API)
2. **WhatsApp Bot** — Evolution API, integração via `bot_sessions` + `whatsapp_instances` (ver `CHATBOT.md`)
3. **Notificações de lembrete** — cron Vercel às 18h + bot envia via Evolution API
4. **Aprovação automática de indicações** — quando indicado assinar plano pago via webhook de pagamento
