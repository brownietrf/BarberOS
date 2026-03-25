# WhatsApp Chatbot — BarberOS

## Contexto do projeto

Estou construindo o **BarberOS**, uma plataforma SaaS multi-tenant de agendamento para barbearias. O projeto já está funcional com:

- **Next.js 15** App Router (TypeScript, Tailwind CSS)
- **Supabase** como banco de dados (PostgreSQL, sa-east-1), autenticação e storage
- **Vercel** para deploy da aplicação Next.js
- Cada barbearia tem seu próprio slug, serviços, horários e clientes cadastrados

O objetivo agora é implementar um **chatbot de agendamento via WhatsApp** com o **menor custo possível — idealmente 100% gratuito**.

---

## Stack tecnológica obrigatória (custo zero)

- **Evolution API** (open source, gratuita) — conecta ao WhatsApp via WhatsApp Web, sem custo de mensagens
- **Render.com** (free tier) — para hospedar o container da Evolution API
- **Webhook handler** como API Route dentro do próprio projeto Next.js no Vercel — sem custo extra de hosting
- **Supabase** (já usado no projeto) — persiste sessões do bot e dados de agendamento
- **Sem IA/LLM** — fluxo por máquina de estados (mais rápido, sem custo, sem tokens)

---

## Banco de dados existente (Supabase)

### Tabelas relevantes

```sql
-- Barbearias
barbershops (
  id uuid PRIMARY KEY,
  name text,
  slug text UNIQUE,
  phone text,            -- telefone do barbeiro
  whatsapp text,         -- número que o bot responde
  bot_name text,         -- ex: "El Patron Bot"
  working_hours jsonb,   -- { seg: { open, close, active }, ter: ..., ... }
  slot_duration int,     -- duração padrão do slot em minutos
  plan text,             -- 'free' | 'pro' | 'premium'
  trial_ends_at timestamptz,
  is_active boolean
)

-- Serviços
services (
  id uuid PRIMARY KEY,
  barbershop_id uuid,
  name text,
  duration_min int,
  price numeric,
  is_active boolean,
  display_order int
)

-- Clientes
customers (
  id uuid PRIMARY KEY,
  barbershop_id uuid,
  name text,
  phone text,            -- normalizado: apenas dígitos, sem +55
  total_visits int,
  last_visit_at timestamptz
)

-- Agendamentos
appointments (
  id uuid PRIMARY KEY,
  barbershop_id uuid,
  customer_id uuid,
  service_id uuid,
  start_time timestamptz,
  end_time timestamptz,
  status text,           -- 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  source text,           -- usar 'whatsapp' para agendamentos do bot
  notes text,
  reminder_sent boolean
)

-- Sessões do bot (máquina de estados por telefone)
bot_sessions (
  id uuid PRIMARY KEY,
  barbershop_id uuid,
  phone text,            -- telefone do cliente
  state text,            -- estado atual do fluxo
  context jsonb,         -- dados coletados até agora (serviço, data, etc.)
  last_message_at timestamptz
)

-- Instâncias da Evolution API
whatsapp_instances (
  id uuid PRIMARY KEY,
  barbershop_id uuid,
  instance_name text,    -- nome único na Evolution API
  phone_number text,
  status text,           -- 'connected' | 'disconnected' | 'connecting' | 'banned'
  qr_code text,          -- base64 do QR code para conectar
  connected_at timestamptz
)
```

### RPCs existentes no banco

```sql
-- Retorna horários livres para uma data/serviço
get_available_slots(
  p_barbershop_id uuid,
  p_date date,
  p_duration_min int,
  p_timezone text        -- ex: 'America/Sao_Paulo'
) RETURNS TABLE (slot_time time, available boolean)

-- Cria ou retorna cliente existente pelo telefone
upsert_customer(
  p_barbershop_id uuid,
  p_name text,
  p_phone text
) RETURNS uuid

-- Retorna agendamentos que precisam de lembrete (confirmados, D-1)
get_pending_reminders() RETURNS TABLE(...)

-- Gerencia sessão do bot (upsert por phone + barbershop_id)
upsert_bot_session(...)

-- Remove sessões com mais de 24h sem atividade
cleanup_old_sessions()
```

---

## Fluxo do bot (máquina de estados)

O telefone do WhatsApp do barbeiro fica conectado na Evolution API. Quando um cliente envia mensagem, o webhook recebe e processa.

### Estados do fluxo de agendamento (`state` na tabela `bot_sessions`)

```
IDLE
  → cliente manda qualquer mensagem
  → bot envia menu principal

MENU
  → cliente responde "1" → vai para SELECT_SERVICE
  → cliente responde "2" → vai para VIEW_APPOINTMENT
  → cliente responde "3" → vai para CANCEL_APPOINTMENT

SELECT_SERVICE
  → bot lista serviços numerados (nome + preço + duração)
  → cliente escolhe número → salva service_id no context → vai para SELECT_DATE

SELECT_DATE
  → bot pergunta a data (ex: "Para qual dia? Responda no formato DD/MM")
  → valida se o dia tem horário de funcionamento ativo
  → salva date no context → vai para SELECT_TIME

SELECT_TIME
  → bot chama get_available_slots com a data e duração do serviço
  → lista os horários disponíveis numerados
  → cliente escolhe número → salva slot no context → vai para COLLECT_NAME

COLLECT_NAME (somente se cliente não existe no banco)
  → bot pergunta "Qual o seu nome?"
  → salva name no context → vai para CONFIRM

CONFIRM
  → bot exibe resumo: serviço, data, horário, preço
  → "Confirmar? Responda SIM ou NÃO"
  → SIM → insere appointment + upsert_customer → vai para DONE
  → NÃO → volta para MENU

DONE
  → bot envia confirmação com detalhes
  → limpa context, volta para IDLE

VIEW_APPOINTMENT
  → busca próximo agendamento ativo do cliente pelo telefone
  → exibe ou diz que não há agendamento

CANCEL_APPOINTMENT
  → busca próximo agendamento ativo
  → pergunta confirmação
  → cancela e confirma
```

### Mensagem de boas-vindas / menu

```
Oi! 👋 Aqui é o {bot_name} da {barbershop_name}!
Como posso te ajudar?

1️⃣ Agendar horário
2️⃣ Ver meu agendamento
3️⃣ Cancelar agendamento
```

### Regras importantes

- Telefones são normalizados antes de qualquer query: remover `+55`, remover espaços, remover `-`
- Mensagens do cliente são normalizadas: `.trim().toLowerCase()`
- Se cliente manda mensagem fora do fluxo (palavra solta), o bot reexibe o menu
- Sessão expira após 30 minutos de inatividade → limpa context, volta para IDLE
- Se a barbearia estiver `is_active = false` → bot não responde
- O `source` do appointment criado pelo bot deve ser `'whatsapp'`
- Usar timezone `America/Sao_Paulo` em todas as operações de data/hora

---

## Webhook handler (Next.js API Route)

Criar em `src/app/api/webhook/whatsapp/route.ts`.

A Evolution API envia um POST para este endpoint sempre que chega uma mensagem. O payload tem a estrutura:

```json
{
  "event": "messages.upsert",
  "instance": "nome-da-instancia",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false
    },
    "message": {
      "conversation": "texto da mensagem"
    },
    "messageTimestamp": 1234567890
  }
}
```

O handler deve:
1. Ignorar mensagens com `fromMe: true` (o próprio bot)
2. Ignorar eventos que não sejam `messages.upsert`
3. Extrair o telefone do `remoteJid` (remover `@s.whatsapp.net`)
4. Descobrir qual `barbershop_id` corresponde à `instance` recebida (buscar em `whatsapp_instances`)
5. Carregar ou criar a sessão do bot via `bot_sessions`
6. Processar a mensagem com a máquina de estados
7. Responder via Evolution API REST (`POST /message/sendText/{instance}`)
8. Salvar o novo estado na sessão

---

## Envio de mensagens

A Evolution API tem um endpoint REST simples:

```
POST https://{evolution-url}/message/sendText/{instance}
Authorization: Bearer {api-key}
Content-Type: application/json

{
  "number": "5511999999999",
  "text": "Mensagem aqui"
}
```

---

## Lembretes automáticos (plano Premium)

Criar um endpoint `src/app/api/cron/reminders/route.ts` que:
1. Chama `get_pending_reminders()` no Supabase
2. Para cada agendamento retornado, envia mensagem via Evolution API:
   ```
   Olá {nome}! Lembrete do seu agendamento amanhã às {hora} na {barbearia}.
   Responda CONFIRMAR ou CANCELAR.
   ```
3. Atualiza `reminder_sent = true` no agendamento

Configurar no `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "0 18 * * *" }
  ]
}
```

---

## Deploy da Evolution API no Render (free tier)

1. Criar conta em render.com
2. New → Web Service → Docker image: `atendai/evolution-api:latest`
3. Variáveis de ambiente:
   ```
   AUTHENTICATION_TYPE=apikey
   AUTHENTICATION_API_KEY=sua-chave-secreta
   DATABASE_ENABLED=false   # usa armazenamento em memória (free tier)
   ```
4. Free tier dorme após 15 min de inatividade — configurar um health check ping ou aceitar o cold start

---

## Variáveis de ambiente a adicionar no projeto Next.js

```env
EVOLUTION_API_URL=https://sua-instancia.onrender.com
EVOLUTION_API_KEY=sua-chave-secreta
WEBHOOK_SECRET=chave-para-validar-origem-do-webhook  # opcional mas recomendado
```

---

## O que NÃO implementar agora

- Envio de promoções em massa (feature Premium — implementar depois)
- Múltiplos profissionais por barbearia (requer mudança de schema)
- Pagamento via bot
- Qualquer integração com IA/LLM

---

## Resumo das entregas esperadas

| Arquivo | Descrição |
|---|---|
| `src/app/api/webhook/whatsapp/route.ts` | Handler do webhook da Evolution API |
| `src/lib/bot/state-machine.ts` | Lógica da máquina de estados |
| `src/lib/bot/evolution.ts` | Client para enviar mensagens via Evolution API |
| `src/lib/bot/normalizers.ts` | Normalização de telefone e texto |
| `src/app/api/cron/reminders/route.ts` | Cron de lembretes (Premium) |
| `vercel.json` | Configuração do cron |
