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
- **Clientes** — cadastro, busca, ordenação, indicador VIP (10+ visitas)
- **Serviços** — CRUD com categorias múltiplas, filtros, detecção de duplicatas. Painel de serviços sugeridos (13 templates) com insert em lote — exibido automaticamente para novos usuários
- **Configurações** — upload de logo (Supabase Storage), dados da barbearia, horários por dia da semana, link do Book com cópia e compartilhamento via WhatsApp
- **Relatórios** — cards com delta (▲▼ %), gráfico recharts de timeline, insights automáticos, exportação CSV e PDF. Conteúdo gateado por plano (Pro: blur "Recurso Premium")
- **Planos** — tabela comparativa free/pro/premium com texto de vantagens dinâmico conforme o plano atual

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
- Alerta automático de trials expirando em ≤ 7 dias
- Gráfico de crescimento mensal (recharts) e mix de planos (donut chart)
- Exportação CSV da tabela filtrada
- Edição de plano (free/pro/premium), data de fim do trial e status ativo/inativo
- Mutations via Server Actions com service role (sem exposição da chave no browser)

### Auth
- Login, cadastro e recuperação de senha
- Onboarding de 3 passos para configurar a barbearia
- Proteção de rotas via middleware (`/dashboard/*`, `/onboarding/*`, `/admin/*`)

---

## Sistema de Planos

| Plano | Preço | Relatórios | Chatbot |
|---|---|---|---|
| Free Trial | Grátis (período admin) | 7d e 30d + insights | Conforme admin |
| Pro | R$ 49,90/mês | 7d básico (sem insights) | Agendamento básico |
| Premium | R$ 89,90/mês | 7d/30d/90d/12m + insights | Completo (confirmações + promoções) |

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
│   │   │   ├── clientes/          # page.tsx + client.tsx
│   │   │   ├── configuracoes/     # page.tsx + client.tsx
│   │   │   ├── planos/            # page.tsx + client.tsx
│   │   │   ├── relatorios/        # page.tsx + client.tsx
│   │   │   └── servicos/          # page.tsx + client.tsx
│   │   ├── login/page.tsx
│   │   ├── onboarding/page.tsx
│   │   └── reset-password/page.tsx
│   ├── components/
│   │   ├── layout/sidebar.tsx     # Nav responsiva (logo mobile = link para /dashboard)
│   │   └── ui/modal.tsx           # Modal reutilizável
│   ├── lib/
│   │   ├── supabase/              # client.ts + server.ts + admin.ts
│   │   ├── plans.ts               # Definição dos planos + helpers de trial
│   │   └── utils.ts               # cn()
│   ├── types/database.ts          # Types e interfaces do banco
│   └── middleware.ts              # Proteção de rotas
├── CONTEXT.md                     # Contexto técnico resumido
├── ARCHITECTURE.md                # Padrões, arquitetura, tipos
├── SUPABASE.md                    # Tabelas, RLS, functions, queries
├── DOCS.md                        # Documentação técnica por módulo
└── README.md
```

---

## Banco de Dados (Supabase)

### Tabelas

| Tabela | Descrição |
|---|---|
| `barbershops` | Dados da barbearia (slug, horários, plano, trial_ends_at) |
| `services` | Serviços oferecidos (preço, duração, categorias) |
| `customers` | Clientes cadastrados (nome, telefone, visitas) |
| `appointments` | Agendamentos (status, fonte, horários) |
| `blocked_slots` | Bloqueios de horário |
| `bot_sessions` | Estado da conversa do bot WhatsApp |
| `whatsapp_instances` | Instâncias Evolution API |

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

### RLS — Permissões para o Book público

```sql
-- Leitura pública de barbearias ativas
CREATE POLICY "public_read_barbershops"
  ON barbershops FOR SELECT TO anon
  USING (is_active = true);

-- Leitura pública de serviços ativos
CREATE POLICY "public_read_services"
  ON services FOR SELECT TO anon
  USING (is_active = true);

-- Inserção e leitura de clientes (para upsert por telefone)
CREATE POLICY "public_insert_customers"
  ON customers FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "public_select_customers"
  ON customers FOR SELECT TO anon USING (true);

-- Inserção de agendamentos via web
CREATE POLICY "public_insert_appointments"
  ON appointments FOR INSERT TO anon
  WITH CHECK (source = 'web');

-- Leitura de blocked_slots (necessário para get_available_slots)
CREATE POLICY "public_read_blocked_slots"
  ON blocked_slots FOR SELECT TO anon USING (true);
```

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

Execute as migrations no Supabase SQL Editor. Tabelas, views, functions e policies estão descritas em `SUPABASE.md`.

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
  actions.ts  → Server Actions (apenas admin): mutations privilegiadas com adminClient
```

```typescript
// Server Component — page.tsx
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// Client Component — client.tsx
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// Server Action — actions.ts (admin only)
'use server'
import { adminClient } from '@/lib/supabase/admin'
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
| `/dashboard/configuracoes` | Autenticado | Configurações da barbearia |
| `/dashboard/relatorios` | Autenticado | Analytics (gateado por plano) |
| `/dashboard/planos` | Autenticado | Tabela comparativa de planos |
| `/admin` | Admin only | Gestão de usuários e planos |

---

## Próximos Passos

- [ ] Deploy — Vercel (Next.js) + Render (Evolution API)
- [ ] WhatsApp Bot — Evolution API + webhook Next.js (ver `CHATBOT.md`)
- [ ] Notificações de lembrete — cron Vercel + bot envia via Evolution API
