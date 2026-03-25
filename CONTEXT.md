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
    admin/                → page.tsx (server) + client.tsx + actions.ts (painel admin)
    book/[slug]/          → page.tsx (server) + client.tsx (agendamento público, sem auth)
      manifest.webmanifest/ → route.ts (PWA manifest dinâmico por slug)
    dashboard/
      agenda/             → page.tsx (server) + client.tsx
      clientes/           → page.tsx (server) + client.tsx
      configuracoes/      → page.tsx (server) + client.tsx
      planos/             → page.tsx (server) + client.tsx (comparação de planos)
      relatorios/         → page.tsx (server) + client.tsx (analytics com gate de plano)
      servicos/           → page.tsx (server) + client.tsx
      layout.tsx          → sidebar + proteção de rota
      page.tsx            → visão geral com stats + banner do plano
    login/                → page.tsx (auth completo)
    onboarding/           → page.tsx (3 steps)
    reset-password/       → page.tsx
  components/
    layout/sidebar.tsx    → desktop sidebar + mobile drawer (logo é link para /dashboard)
    ui/modal.tsx
  lib/
    supabase/client.ts + server.ts + admin.ts
    plans.ts              → definição dos planos, features, helpers (isTrialActive etc.)
    rate-limit.ts         → rate limiter in-memory (sliding window por IP)
    utils.ts (cn)
  types/database.ts       → inclui AppointmentFull
  middleware.ts           → rate limit /book/*, protege /dashboard/*, /onboarding/*, /admin/*
public/
  icons/                  → icon-192.png + icon-512.png (fallback PWA — adicionar manualmente)
  og-default.png          → imagem Open Graph padrão 1200×630 (adicionar manualmente)
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
- Layout do painel com sidebar responsiva (mobile: logo clicável → /dashboard)
- Visão geral com stats + banner do plano atual com botão "Ver planos"
- Serviços (CRUD, categorias múltiplas, filtros, detecção de duplicatas, templates de serviços sugeridos)
- Clientes (tabela, busca, perfil, máscara de telefone, VIP)
- Configurações (dados da barbearia, upload de logo, preview do bot, horários, link do Book com compartilhamento)
- Agenda (dia/semana/mês, criar/editar/cancelar agendamentos, bloqueio de horários, botão de refresh)
- Agenda visão dia ordenada por horário (agendamentos + bloqueios mesclados)
- BarberOS Book (/book/[slug]) — agendamento público em 4 etapas, slots sincronizados, "Adicionar ao calendário"
- Book SEO — og:title, og:description, og:image (logo ou og-default.png), twitter:card
- Book PWA — manifest.webmanifest dinâmico por slug, themeColor âmbar, appleWebApp
- Rate limiting — 20 req/min por IP nas rotas /book/* (in-memory, sem dependência externa)
- Relatórios (/dashboard/relatorios) — cards+delta, gráfico recharts, insights, CSV/PDF, gate por plano
- Planos (/dashboard/planos) — tabela comparativa, banner de status, texto de vantagens dinâmico
- Painel Admin (/admin) — MRR/ARR, alerta trial expirando, gráfico de crescimento, mix de planos, CSV
- Sistema de planos (lib/plans.ts) — free trial / pro / premium com feature gates
- Supabase Storage — bucket `logos` para upload de logo por barbearia

## Planos
- free  → trial por período definido pelo admin, acesso 100%, chatbot conforme admin
- pro   → R$ 49,90/mês, clientes ilimitados, relatórios 7d básico, chatbot básico
- premium → R$ 89,90/mês, relatórios completos (7d/30d/90d/12m) com insights, chatbot completo

## Variáveis de ambiente necessárias
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-side/admin apenas
ADMIN_EMAIL=                 # e-mail do administrador da plataforma
NEXT_PUBLIC_APP_URL=         # URL pública do app (ex: https://barberos.vercel.app) — SEO og:url
# Futuro (chatbot):
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
```

## Próximos passos (MVP)
1. Deploy (Vercel + Render para Evolution API)
2. WhatsApp Bot (Evolution API — ver CHATBOT.md para prompt completo de implementação)
3. Notificações de lembrete (cron Vercel + bot)

## Padrão de código usado
- Server Components buscam dados e passam como props
- Client Components recebem initialData e fazem mutations
- Sempre usar o padrão page.tsx (server) + client.tsx (client)
- Supabase client: createClient() do @/lib/supabase/client
- Supabase server: await createClient() do @/lib/supabase/server
- Mutations admin: server actions em actions.ts usando adminClient (service role)

## Documentação detalhada
- ARCHITECTURE.md → padrões, convenções, tipos, componentes, fluxo de auth
- SUPABASE.md     → tabelas completas, RLS policies, functions, queries padrão
- DOCS.md         → referência técnica por módulo
- README.md       → visão geral, setup local, rotas
