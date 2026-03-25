import { format, parse, isValid, addMinutes } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { adminClient } from '@/lib/supabase/admin'
import { normalizeText } from '@/lib/bot/normalizers'
import type { Barbershop, BotSession, Service } from '@/types/database'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type BotState =
  | 'IDLE'
  | 'MENU'
  | 'SELECT_SERVICE'
  | 'SELECT_DATE'
  | 'SELECT_TIME'
  | 'COLLECT_NAME'
  | 'CONFIRM'
  | 'DONE'
  | 'VIEW_APPOINTMENT'
  | 'CANCEL_APPOINTMENT'
  | 'CANCEL_CONFIRM'

export interface BotContext {
  service_id?: string
  service_name?: string
  service_price?: number
  service_duration?: number
  date?: string           // YYYY-MM-DD
  slot?: string           // HH:mm
  name?: string
  pending_cancel_id?: string
}

export interface ProcessResult {
  reply: string
  newState: BotState
  newContext: BotContext
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TZ = 'America/Sao_Paulo'
const SESSION_TIMEOUT_MIN = 30
const DAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const

// ─── Entrada principal ────────────────────────────────────────────────────────

export async function processMessage(
  session: BotSession,
  rawMessage: string,
  barbershop: Barbershop,
  services: Service[]
): Promise<ProcessResult> {
  const message = normalizeText(rawMessage)

  const lastActivity = new Date(session.last_message_at)
  const minutesIdle = (Date.now() - lastActivity.getTime()) / 60_000
  const timedOut = minutesIdle > SESSION_TIMEOUT_MIN

  const state: BotState = timedOut ? 'IDLE' : (session.state as BotState)
  const ctx: BotContext = timedOut ? {} : (session.context as BotContext)

  return handleState(state, ctx, message, barbershop, services, session.phone)
}

// ─── Despachante ──────────────────────────────────────────────────────────────

async function handleState(
  state: BotState,
  ctx: BotContext,
  message: string,
  barbershop: Barbershop,
  services: Service[],
  phone: string
): Promise<ProcessResult> {
  switch (state) {
    case 'IDLE':
      return toMenu(barbershop)

    case 'MENU':
      return handleMenu(message, ctx, barbershop, services, phone)

    case 'SELECT_SERVICE':
      return handleSelectService(message, ctx, services)

    case 'SELECT_DATE':
      return handleSelectDate(message, ctx, barbershop)

    case 'SELECT_TIME':
      return handleSelectTime(message, ctx, barbershop, phone)

    case 'COLLECT_NAME':
      return handleCollectName(message, ctx)

    case 'CONFIRM':
      return handleConfirm(message, ctx, barbershop, phone)

    case 'VIEW_APPOINTMENT':
      return handleViewAppointment(barbershop, phone)

    case 'CANCEL_APPOINTMENT':
      return handleCancelAppointment(barbershop, phone)

    case 'CANCEL_CONFIRM':
      return handleCancelConfirm(message, ctx)

    case 'DONE':
      return toMenu(barbershop)

    default:
      return toMenu(barbershop)
  }
}

// ─── Helpers de menu ──────────────────────────────────────────────────────────

function menuText(barbershop: Barbershop): string {
  return (
    `Oi! 👋 Aqui é o *${barbershop.bot_name || 'Bot'}* da *${barbershop.name}*!\n` +
    `Como posso te ajudar?\n\n` +
    `1️⃣ Agendar horário\n` +
    `2️⃣ Ver meu agendamento\n` +
    `3️⃣ Cancelar agendamento`
  )
}

function toMenu(barbershop: Barbershop): ProcessResult {
  return { reply: menuText(barbershop), newState: 'MENU', newContext: {} }
}

function serviceListText(services: Service[]): string {
  const active = services.filter((s) => s.is_active)
  if (active.length === 0) return 'Nenhum serviço disponível no momento.'
  const lines = active
    .map((s, i) => `${i + 1}. *${s.name}* — ${formatPrice(s.price)} (${s.duration_min} min)`)
    .join('\n')
  return `Escolha o serviço digitando o número:\n\n${lines}`
}

// ─── MENU ─────────────────────────────────────────────────────────────────────

async function handleMenu(
  message: string,
  ctx: BotContext,
  barbershop: Barbershop,
  services: Service[],
  phone: string
): Promise<ProcessResult> {
  if (message === '1') {
    // Mostra lista de serviços imediatamente
    return {
      reply: serviceListText(services),
      newState: 'SELECT_SERVICE',
      newContext: {},
    }
  }
  if (message === '2') {
    return handleViewAppointment(barbershop, phone)
  }
  if (message === '3') {
    return handleCancelAppointment(barbershop, phone)
  }
  return {
    reply: menuText(barbershop) + '\n\nPor favor, responda com *1*, *2* ou *3*.',
    newState: 'MENU',
    newContext: {},
  }
}

// ─── SELECT_SERVICE ───────────────────────────────────────────────────────────

function handleSelectService(
  message: string,
  ctx: BotContext,
  services: Service[]
): ProcessResult {
  const active = services.filter((s) => s.is_active)
  const choice = parseInt(message)

  if (!isNaN(choice) && choice >= 1 && choice <= active.length) {
    const svc = active[choice - 1]
    const newCtx: BotContext = {
      service_id: svc.id,
      service_name: svc.name,
      service_price: svc.price,
      service_duration: svc.duration_min,
    }
    return {
      reply: `Ótimo! *${svc.name}* selecionado.\n\nPara qual dia? Responda no formato *DD/MM* (ex: 15/04).`,
      newState: 'SELECT_DATE',
      newContext: newCtx,
    }
  }

  return {
    reply: serviceListText(services) + '\n\nDigite o número do serviço desejado.',
    newState: 'SELECT_SERVICE',
    newContext: ctx,
  }
}

// ─── SELECT_DATE ──────────────────────────────────────────────────────────────

function handleSelectDate(
  message: string,
  ctx: BotContext,
  barbershop: Barbershop
): ProcessResult {
  const year = new Date().getFullYear()
  const parsed = parse(`${message}/${year}`, 'dd/MM/yyyy', new Date())

  if (!isValid(parsed)) {
    return {
      reply: 'Data inválida. Por favor, responda no formato *DD/MM* (ex: 15/04).',
      newState: 'SELECT_DATE',
      newContext: ctx,
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (parsed < today) {
    return {
      reply: 'Esta data já passou. Por favor, escolha uma data futura no formato *DD/MM*.',
      newState: 'SELECT_DATE',
      newContext: ctx,
    }
  }

  const dayKey = DAY_KEYS[parsed.getDay()]
  const daySchedule = barbershop.working_hours?.[dayKey]
  if (!daySchedule?.active) {
    const label = format(parsed, "EEEE, dd 'de' MMMM", { locale: ptBR })
    return {
      reply: `Não atendemos na ${label}. Por favor, escolha outro dia no formato *DD/MM*.`,
      newState: 'SELECT_DATE',
      newContext: ctx,
    }
  }

  const dateStr = format(parsed, 'yyyy-MM-dd')
  return {
    reply: `Data selecionada: *${formatDateBR(dateStr)}*.\n\nAguarde, buscando horários disponíveis...`,
    newState: 'SELECT_TIME',
    newContext: { ...ctx, date: dateStr },
  }
}

// ─── SELECT_TIME ──────────────────────────────────────────────────────────────

async function handleSelectTime(
  message: string,
  ctx: BotContext,
  barbershop: Barbershop,
  phone: string
): Promise<ProcessResult> {
  const { data: slots, error } = await adminClient.rpc('get_available_slots', {
    p_barbershop_id: barbershop.id,
    p_date: ctx.date,
    p_duration_min: ctx.service_duration,
    p_timezone: TZ,
  })

  if (error || !slots) {
    return {
      reply: 'Erro ao buscar horários. Tente novamente mais tarde.',
      newState: 'SELECT_DATE',
      newContext: ctx,
    }
  }

  const available = (slots as { slot_time: string; available: boolean }[]).filter(
    (s) => s.available
  )

  if (available.length === 0) {
    return {
      reply: `Não há horários disponíveis para *${formatDateBR(ctx.date!)}*.\n\nEscolha outro dia no formato *DD/MM*.`,
      newState: 'SELECT_DATE',
      newContext: ctx,
    }
  }

  const choice = parseInt(message)
  if (!isNaN(choice) && choice >= 1 && choice <= available.length) {
    const slot = available[choice - 1].slot_time.slice(0, 5)
    const newCtx: BotContext = { ...ctx, slot }

    // Verifica se cliente já existe no banco
    const { data: customer } = await adminClient
      .from('customers')
      .select('name')
      .eq('barbershop_id', barbershop.id)
      .eq('phone', phone)
      .maybeSingle()

    if (customer) {
      // Cliente conhecido → pula COLLECT_NAME
      const ctxWithName: BotContext = { ...newCtx, name: customer.name }
      return {
        reply: buildConfirmSummary(ctxWithName),
        newState: 'CONFIRM',
        newContext: ctxWithName,
      }
    }

    return {
      reply: 'Qual é o seu nome?',
      newState: 'COLLECT_NAME',
      newContext: newCtx,
    }
  }

  // Mostra lista de horários
  const lines = available.map((s, i) => `${i + 1}. ${s.slot_time.slice(0, 5)}`).join('\n')
  return {
    reply: `Horários disponíveis para *${formatDateBR(ctx.date!)}*:\n\n${lines}\n\nDigite o número do horário desejado.`,
    newState: 'SELECT_TIME',
    newContext: ctx,
  }
}

// ─── COLLECT_NAME ─────────────────────────────────────────────────────────────

function handleCollectName(message: string, ctx: BotContext): ProcessResult {
  const raw = message.trim()
  if (raw.length < 2) {
    return {
      reply: 'Por favor, informe seu nome completo.',
      newState: 'COLLECT_NAME',
      newContext: ctx,
    }
  }
  const name = raw
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')

  const newCtx: BotContext = { ...ctx, name }
  return {
    reply: buildConfirmSummary(newCtx),
    newState: 'CONFIRM',
    newContext: newCtx,
  }
}

// ─── CONFIRM ──────────────────────────────────────────────────────────────────

async function handleConfirm(
  message: string,
  ctx: BotContext,
  barbershop: Barbershop,
  phone: string
): Promise<ProcessResult> {
  if (message !== 'sim' && message !== 'não' && message !== 'nao') {
    return {
      reply: buildConfirmSummary(ctx) + '\n\nResponda *SIM* ou *NÃO*.',
      newState: 'CONFIRM',
      newContext: ctx,
    }
  }

  if (message === 'não' || message === 'nao') {
    return {
      reply: 'Tudo bem! Quando quiser agendar, é só me chamar. 😊',
      newState: 'IDLE',
      newContext: {},
    }
  }

  // Upsert cliente
  const { data: customerId, error: custErr } = await adminClient.rpc('upsert_customer', {
    p_barbershop_id: barbershop.id,
    p_name: ctx.name!,
    p_phone: phone,
  })

  if (custErr || !customerId) {
    return {
      reply: 'Erro ao salvar seus dados. Tente novamente.',
      newState: 'CONFIRM',
      newContext: ctx,
    }
  }

  const startDt = new Date(`${ctx.date}T${ctx.slot}:00`)
  const endDt = addMinutes(startDt, ctx.service_duration!)

  const { error: aptErr } = await adminClient.from('appointments').insert({
    barbershop_id: barbershop.id,
    customer_id: customerId,
    service_id: ctx.service_id,
    start_time: startDt.toISOString(),
    end_time: endDt.toISOString(),
    status: 'confirmed',
    source: 'whatsapp',
  })

  if (aptErr) {
    return {
      reply: 'Erro ao criar agendamento. Tente novamente.',
      newState: 'CONFIRM',
      newContext: ctx,
    }
  }

  return {
    reply:
      `✅ *Agendamento confirmado!*\n\n` +
      `📋 ${ctx.service_name}\n` +
      `🗓️ ${formatDateBR(ctx.date!)} às *${ctx.slot}*\n` +
      `💰 ${formatPrice(ctx.service_price!)}\n\n` +
      `Te esperamos! Qualquer dúvida é só chamar. 😊`,
    newState: 'IDLE',
    newContext: {},
  }
}

// ─── VIEW_APPOINTMENT ─────────────────────────────────────────────────────────

async function handleViewAppointment(
  barbershop: Barbershop,
  phone: string
): Promise<ProcessResult> {
  const now = new Date().toISOString()

  const { data: customer } = await adminClient
    .from('customers')
    .select('id')
    .eq('barbershop_id', barbershop.id)
    .eq('phone', phone)
    .maybeSingle()

  if (!customer) {
    return { reply: 'Você não possui agendamentos futuros.', newState: 'IDLE', newContext: {} }
  }

  const { data: nextApt } = await adminClient
    .from('appointments')
    .select('*, service:services(name, price)')
    .eq('barbershop_id', barbershop.id)
    .eq('customer_id', customer.id)
    .in('status', ['pending', 'confirmed'])
    .gte('start_time', now)
    .order('start_time', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!nextApt) {
    return { reply: 'Você não possui agendamentos futuros.', newState: 'IDLE', newContext: {} }
  }

  const svc = nextApt.service as { name: string; price: number } | null
  const dateStr = nextApt.start_time.slice(0, 10)
  const timeStr = nextApt.start_time.slice(11, 16)

  return {
    reply:
      `📅 *Seu próximo agendamento:*\n\n` +
      `📋 ${svc?.name ?? 'Serviço'}\n` +
      `🗓️ ${formatDateBR(dateStr)} às *${timeStr}*\n` +
      `💰 ${formatPrice(svc?.price ?? 0)}\n\n` +
      `Para cancelar, envie *oi* e escolha a opção 3.`,
    newState: 'IDLE',
    newContext: {},
  }
}

// ─── CANCEL_APPOINTMENT ───────────────────────────────────────────────────────

async function handleCancelAppointment(
  barbershop: Barbershop,
  phone: string
): Promise<ProcessResult> {
  const now = new Date().toISOString()

  const { data: customer } = await adminClient
    .from('customers')
    .select('id')
    .eq('barbershop_id', barbershop.id)
    .eq('phone', phone)
    .maybeSingle()

  if (!customer) {
    return { reply: 'Você não possui agendamentos para cancelar.', newState: 'IDLE', newContext: {} }
  }

  const { data: nextApt } = await adminClient
    .from('appointments')
    .select('*, service:services(name)')
    .eq('barbershop_id', barbershop.id)
    .eq('customer_id', customer.id)
    .in('status', ['pending', 'confirmed'])
    .gte('start_time', now)
    .order('start_time', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!nextApt) {
    return { reply: 'Você não possui agendamentos para cancelar.', newState: 'IDLE', newContext: {} }
  }

  const svc = nextApt.service as { name: string } | null
  const dateStr = nextApt.start_time.slice(0, 10)
  const timeStr = nextApt.start_time.slice(11, 16)

  return {
    reply:
      `Deseja cancelar este agendamento?\n\n` +
      `📋 ${svc?.name ?? 'Serviço'}\n` +
      `🗓️ ${formatDateBR(dateStr)} às *${timeStr}*\n\n` +
      `Responda *SIM* para cancelar ou *NÃO* para manter.`,
    newState: 'CANCEL_CONFIRM',
    newContext: { pending_cancel_id: nextApt.id },
  }
}

// ─── CANCEL_CONFIRM ───────────────────────────────────────────────────────────

async function handleCancelConfirm(
  message: string,
  ctx: BotContext
): Promise<ProcessResult> {
  if (message !== 'sim' && message !== 'não' && message !== 'nao') {
    return {
      reply: 'Responda *SIM* para cancelar ou *NÃO* para manter o agendamento.',
      newState: 'CANCEL_CONFIRM',
      newContext: ctx,
    }
  }

  if (message === 'não' || message === 'nao') {
    return {
      reply: 'Cancelamento não realizado. Seu agendamento continua ativo. 👍',
      newState: 'IDLE',
      newContext: {},
    }
  }

  const { error } = await adminClient
    .from('appointments')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', ctx.pending_cancel_id!)

  if (error) {
    return {
      reply: 'Erro ao cancelar o agendamento. Por favor, tente novamente.',
      newState: 'CANCEL_CONFIRM',
      newContext: ctx,
    }
  }

  return {
    reply: '✅ Agendamento cancelado com sucesso!\n\nSe quiser reagendar, é só me chamar. 😊',
    newState: 'IDLE',
    newContext: {},
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildConfirmSummary(ctx: BotContext): string {
  return (
    `Confirme seu agendamento:\n\n` +
    `📋 *${ctx.service_name}*\n` +
    `🗓️ ${formatDateBR(ctx.date!)} às *${ctx.slot}*\n` +
    `💰 ${formatPrice(ctx.service_price!)}\n` +
    (ctx.name ? `👤 ${ctx.name}\n` : '') +
    `\nResponda *SIM* para confirmar ou *NÃO* para cancelar.`
  )
}

function formatDateBR(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return format(dt, "EEEE, dd/MM/yyyy", { locale: ptBR })
}

function formatPrice(price: number): string {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
