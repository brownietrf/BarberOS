import type { Barbershop, Plan, SubscriptionPeriod } from '@/types/database'

export interface PlanFeature {
  label: string
  included: boolean
  note?: string
}

export interface PlanDef {
  label: string
  price: string
  priceNote: string
  highlight: boolean
  badge?: string
  features: PlanFeature[]
  reportPeriods: ('7d' | '30d' | '90d' | '12m')[]
  reportInsights: boolean
  reportDetailed: boolean
  chatbot: boolean | 'full'   // false | 'basic' | 'full'
  maxClients: number | null
  maxServices: number | null
}

export const PLANS: Record<Plan, PlanDef> = {
  free: {
    label: 'Free Trial',
    price: 'Grátis',
    priceNote: 'por período definido pelo admin',
    highlight: false,
    features: [
      { label: 'Acesso completo durante o trial', included: true },
      { label: 'Agenda (criar, editar, cancelar)', included: true },
      { label: 'Clientes e serviços', included: true },
      { label: 'Book público de agendamento', included: true },
      { label: 'Configurações da barbearia', included: true },
      { label: 'Relatórios básicos', included: true },
      { label: 'Chatbot WhatsApp', included: true, note: 'conforme liberado pelo admin' },
    ],
    reportPeriods: ['7d', '30d'],
    reportInsights: true,
    reportDetailed: true,
    chatbot: true,
    maxClients: null,
    maxServices: null,
  },
  pro: {
    label: 'Pro',
    price: 'R$ 49,90',
    priceNote: 'por mês',
    highlight: true,
    badge: 'Mais popular',
    features: [
      { label: 'Clientes ilimitados', included: true },
      { label: 'Serviços ilimitados', included: true },
      { label: 'Agenda completa', included: true },
      { label: 'Book público de agendamento', included: true },
      { label: 'Relatórios básicos (últimos 7 dias)', included: true },
      { label: 'Insights e detalhamento dos relatórios', included: false },
      { label: 'Chatbot de agendamento básico', included: true },
      { label: 'Confirmações e promoções via bot', included: false },
    ],
    reportPeriods: ['7d'],
    reportInsights: false,
    reportDetailed: false,
    chatbot: true,      // basic
    maxClients: null,
    maxServices: null,
  },
  premium: {
    label: 'Premium',
    price: 'R$ 89,90',
    priceNote: 'por mês',
    highlight: false,
    badge: 'Completo',
    features: [
      { label: 'Tudo do plano Pro', included: true },
      { label: 'Relatórios completos (7d, 30d, 90d, 12m)', included: true },
      { label: 'Insights automáticos de desempenho', included: true },
      { label: 'Detalhamento completo dos relatórios', included: true },
      { label: 'Chatbot completo com confirmações', included: true },
      { label: 'Envio de promoções via WhatsApp', included: true },
      { label: 'Suporte prioritário', included: true },
    ],
    reportPeriods: ['7d', '30d', '90d', '12m'],
    reportInsights: true,
    reportDetailed: true,
    chatbot: 'full',
    maxClients: null,
    maxServices: null,
  },
}

// ─── Billing Periods ──────────────────────────────────────────────────────────

export interface BillingPeriodDef {
  label: string
  months: number
  discount: number   // percentage (0 = no discount, 20 = 20% off)
  badge?: string
}

export const BILLING_PERIODS: Record<SubscriptionPeriod, BillingPeriodDef> = {
  monthly:  { label: 'Mensal',     months: 1,  discount: 0  },
  '3months':  { label: '3 meses',   months: 3,  discount: 5,  badge: '5% off'  },
  '6months':  { label: '6 meses',   months: 6,  discount: 10, badge: '10% off' },
  '12months': { label: '12 meses',  months: 12, discount: 20, badge: '20% off' },
}

/** Returns total price and monthly equivalent for a given plan + period */
export function getSubscriptionPrice(plan: 'pro' | 'premium', period: SubscriptionPeriod): {
  total: number
  perMonth: number
  discount: number
} {
  const base   = plan === 'pro' ? 49.9 : 89.9
  const def    = BILLING_PERIODS[period]
  const factor = 1 - def.discount / 100
  const total  = base * def.months * factor
  return {
    total:    Math.round(total * 100) / 100,
    perMonth: Math.round((total / def.months) * 100) / 100,
    discount: def.discount,
  }
}

/** Calculates subscription_ends_at from today for a given period */
export function calcSubscriptionEndsAt(period: SubscriptionPeriod): Date {
  const d = new Date()
  d.setMonth(d.getMonth() + BILLING_PERIODS[period].months)
  return d
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isTrialActive(b: Pick<Barbershop, 'plan' | 'trial_ends_at'>): boolean {
  return b.plan === 'free' && new Date(b.trial_ends_at) > new Date()
}

export function isTrialExpired(b: Pick<Barbershop, 'plan' | 'trial_ends_at'>): boolean {
  return b.plan === 'free' && new Date(b.trial_ends_at) <= new Date()
}

export function trialDaysLeft(b: Pick<Barbershop, 'trial_ends_at'>): number {
  return Math.max(0, Math.ceil(
    (new Date(b.trial_ends_at).getTime() - Date.now()) / 86_400_000
  ))
}

/** Grace period after subscription expiry before full lockout */
export const GRACE_PERIOD_DAYS = 10

/** True when a paid plan subscription has passed its end date */
export function isSubscriptionExpired(b: Pick<Barbershop, 'plan' | 'subscription_ends_at'>): boolean {
  if (b.plan === 'free') return false
  if (!b.subscription_ends_at) return false
  return new Date(b.subscription_ends_at) <= new Date()
}

/** Days left on a paid subscription (0 if null or expired) */
export function subscriptionDaysLeft(b: Pick<Barbershop, 'subscription_ends_at'>): number {
  if (!b.subscription_ends_at) return 0
  return Math.max(0, Math.ceil(
    (new Date(b.subscription_ends_at).getTime() - Date.now()) / 86_400_000
  ))
}

/** True when subscription expires within `days` days (default 7) */
export function isSubscriptionExpiring(
  b: Pick<Barbershop, 'plan' | 'subscription_ends_at'>,
  days = 7,
): boolean {
  if (b.plan === 'free' || !b.subscription_ends_at) return false
  const left = subscriptionDaysLeft(b)
  return left > 0 && left <= days
}

/** Days remaining in the grace period after expiry (0 if not in grace or fully locked) */
export function gracePeriodDaysLeft(b: Pick<Barbershop, 'plan' | 'subscription_ends_at' | 'grace_period_days'>): number {
  if (!isSubscriptionExpired(b) || !b.subscription_ends_at) return 0
  const days = b.grace_period_days ?? GRACE_PERIOD_DAYS
  const graceEnd = new Date(b.subscription_ends_at)
  graceEnd.setDate(graceEnd.getDate() + days)
  return Math.max(0, Math.ceil((graceEnd.getTime() - Date.now()) / 86_400_000))
}

/** True when expired but still within the grace period (partial block, agenda still works) */
export function isGracePeriod(b: Pick<Barbershop, 'plan' | 'subscription_ends_at' | 'grace_period_days'>): boolean {
  return isSubscriptionExpired(b) && gracePeriodDaysLeft(b) > 0
}

/** True when grace period has also passed — full platform lockout */
export function isFullyLocked(b: Pick<Barbershop, 'plan' | 'subscription_ends_at' | 'grace_period_days'>): boolean {
  return isSubscriptionExpired(b) && gracePeriodDaysLeft(b) === 0
}
