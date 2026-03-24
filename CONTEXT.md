# BarberOS — Contexto do Projeto

## Stack
- Next.js 15 + TypeScript + Tailwind CSS
- Supabase (PostgreSQL + Auth + RLS) — região sa-east-1
- date-fns para datas
- lucide-react para ícones

## Estrutura de pastas relevante
```
src/
  app/
    book/[slug]/     → page.tsx (server) + client.tsx (agendamento público, sem auth)
    dashboard/
      agenda/        → page.tsx (server) + client.tsx (client)
      clientes/      → page.tsx (server) + client.tsx (client)
      configuracoes/ → page.tsx (server) + client.tsx (client)
      servicos/      → page.tsx (server) + client.tsx (client)
      layout.tsx     → sidebar + proteção de rota
      page.tsx       → visão geral com stats
    login/           → page.tsx (auth completo)
    onboarding/      → page.tsx (3 steps)
    reset-password/  → page.tsx
  components/
    layout/sidebar.tsx
    ui/modal.tsx
  lib/
    supabase/client.ts + server.ts + admin.ts
    utils.ts (cn)
  types/database.ts
  middleware.ts
```

## Banco de dados (Supabase — sa-east-1)
Tabelas: barbershops, services, customers, appointments,
         blocked_slots, bot_sessions, whatsapp_instances
View: appointments_full (join com customers e services — SELECT público)
Functions: get_available_slots (única versão — não criar overloads!),
           upsert_customer, upsert_bot_session,
           get_pending_reminders, handle_appointment_completed, cleanup_old_sessions

## O que está pronto
- Auth completo (login, cadastro, recuperação de senha, templates de e-mail)
- Onboarding (3 steps)
- Layout do painel com sidebar responsiva
- Visão geral com stats
- Serviços (CRUD, categorias múltiplas, filtros, detecção de duplicatas)
- Clientes (tabela, busca, perfil, máscara de telefone, VIP)
- Configurações (dados da barbearia, preview do bot, horários, link do Book com compartilhamento)
- Agenda (dia/semana/mês, criar/editar/cancelar agendamentos, bloqueio de horários)
- Agenda visão dia ordenada por horário (agendamentos + bloqueios mesclados)
- BarberOS Book (/book/[slug]) — agendamento público em 4 etapas, slots sincronizados

## Próximos passos (MVP)
1. WhatsApp Bot (Evolution API no Railway)
2. Deploy (Vercel + Railway)

## Padrão de código usado
- Server Components buscam dados e passam como props
- Client Components recebem initialData e fazem mutations
- Sempre usar o padrão page.tsx (server) + client.tsx (client)
- Supabase client: createClient() do @/lib/supabase/client
- Supabase server: await createClient() do @/lib/supabase/server

## Documentação detalhada
- ARCHITECTURE.md → padrões, convenções, tipos, componentes, fluxo de auth
- SUPABASE.md     → tabelas completas, RLS policies, functions, queries padrão
- DOCS.md         → referência técnica por módulo
- README.md       → visão geral, setup local, rotas
