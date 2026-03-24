# BarberOS

Sistema completo de gestão para barbearias. Painel administrativo para o barbeiro e página pública de agendamento para o cliente — tudo em um só lugar.

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
- **Visão Geral** — stats do dia: agendamentos, pendentes, clientes, concluídos
- **Agenda** — visualização dia / semana / mês, criar, editar e cancelar agendamentos, bloquear horários
- **Clientes** — cadastro, busca, ordenação, indicador VIP (10+ visitas)
- **Serviços** — CRUD com categorias múltiplas, filtros, detecção de duplicatas
- **Configurações** — dados da barbearia, horários de funcionamento por dia da semana

### BarberOS Book (`/book/[slug]`)
Página pública de autoatendimento. O cliente acessa pelo link da barbearia e agenda sem precisar de conta:

1. Escolhe o serviço
2. Seleciona data e horário disponível
3. Informa nome e WhatsApp
4. Recebe confirmação na tela

### Auth
- Login, cadastro e recuperação de senha
- Onboarding de 3 passos para configurar a barbearia
- Proteção de rotas via middleware

---

## Estrutura do Projeto

```
BarberOS/
├── src/
│   ├── app/
│   │   ├── book/
│   │   │   └── [slug]/
│   │   │       ├── page.tsx       # Server: busca barbearia + serviços pelo slug
│   │   │       └── client.tsx     # Client: fluxo de agendamento em 4 etapas
│   │   ├── dashboard/
│   │   │   ├── layout.tsx         # Proteção de rota + sidebar
│   │   │   ├── page.tsx           # Visão geral com stats
│   │   │   ├── agenda/
│   │   │   │   ├── page.tsx       # Server: appointments_full + blocked_slots
│   │   │   │   └── client.tsx     # Client: agenda dia/semana/mês, CRUD
│   │   │   ├── clientes/
│   │   │   │   ├── page.tsx       # Server: lista de clientes
│   │   │   │   └── client.tsx     # Client: tabela, busca, CRUD
│   │   │   ├── servicos/
│   │   │   │   ├── page.tsx       # Server: lista de serviços
│   │   │   │   └── client.tsx     # Client: CRUD, categorias, filtros
│   │   │   └── configuracoes/
│   │   │       ├── page.tsx       # Server: dados da barbearia
│   │   │       └── client.tsx     # Client: edição de dados e horários
│   │   ├── login/
│   │   │   └── page.tsx           # Login, cadastro e recuperação de senha
│   │   ├── onboarding/
│   │   │   └── page.tsx           # Wizard 3 passos: cria a barbearia
│   │   ├── reset-password/
│   │   │   └── page.tsx           # Troca de senha via token
│   │   ├── globals.css
│   │   ├── layout.tsx             # Root layout
│   │   └── page.tsx               # Redireciona para /login
│   ├── components/
│   │   ├── layout/
│   │   │   └── sidebar.tsx        # Nav responsiva (desktop + mobile drawer)
│   │   └── ui/
│   │       └── modal.tsx          # Modal reutilizável
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # Supabase para Client Components
│   │   │   ├── server.ts          # Supabase para Server Components
│   │   │   └── admin.ts           # Supabase com service role (admin)
│   │   └── utils.ts               # cn() — merge de classes Tailwind
│   ├── types/
│   │   └── database.ts            # Types e interfaces do banco
│   └── middleware.ts              # Proteção de rotas /dashboard e /onboarding
├── CONTEXT.md                     # Contexto técnico do projeto
├── DOCS.md                        # Documentação técnica detalhada
└── README.md
```

---

## Banco de Dados (Supabase)

### Tabelas

| Tabela | Descrição |
|---|---|
| `barbershops` | Dados da barbearia (slug, horários, plano, bot) |
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
| `get_available_slots(barbershop_id, date, duration_min)` | Retorna horários livres |
| `upsert_customer(barbershop_id, name, phone)` | Cria ou retorna cliente |
| `get_pending_reminders()` | Agendamentos que precisam de lembrete |
| `handle_appointment_completed()` | Trigger ao completar agendamento |
| `cleanup_old_sessions()` | Remove sessões antigas do bot |

### RLS — Permissões necessárias para o Book público

A rota `/book/[slug]` não exige autenticação. Configure as políticas abaixo no Supabase:

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
```

### 3. Configure o banco

Execute as migrations no Supabase SQL Editor. Tabelas, views, functions e policies estão descritas em `DOCS.md`.

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
```

```typescript
// Server Component — page.tsx
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// Client Component — client.tsx
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
```

---

## Rotas

| Rota | Acesso | Descrição |
|---|---|---|
| `/` | Público | Redireciona para `/login` |
| `/login` | Público | Login, cadastro e recuperação de senha |
| `/onboarding` | Autenticado | Configuração inicial da barbearia |
| `/reset-password` | Público | Troca de senha via token |
| `/dashboard` | Autenticado | Visão geral |
| `/dashboard/agenda` | Autenticado | Agenda completa |
| `/dashboard/clientes` | Autenticado | Gestão de clientes |
| `/dashboard/servicos` | Autenticado | Catálogo de serviços |
| `/dashboard/configuracoes` | Autenticado | Configurações da barbearia |
| `/book/[slug]` | Público | Página de agendamento do cliente |

---

## Próximos Passos

- [ ] WhatsApp Bot — integração com Evolution API no Railway
- [ ] Deploy — Vercel + Railway
- [ ] Notificações de lembrete de agendamento
