import type { Barbershop, Plan } from '@/types/database'

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
