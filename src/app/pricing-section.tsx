'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, X, Star, Zap, Crown, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BILLING_PERIODS, getSubscriptionPrice } from '@/lib/plans'
import type { SubscriptionPeriod } from '@/types/database'

const PERIOD_ORDER: SubscriptionPeriod[] = ['monthly', '3months', '6months', '12months']

const PLANS = [
  {
    id: 'free' as const,
    label: 'Free Trial',
    highlight: false,
    badge: null as string | null,
    icon: Star,
    features: [
      { label: 'Agenda completa', included: true },
      { label: 'Clientes e serviços ilimitados', included: true },
      { label: 'Book público de agendamento', included: true },
      { label: 'Relatórios básicos', included: true },
      { label: 'Chatbot WhatsApp', included: true },
      { label: 'Relatórios avançados + insights', included: false },
      { label: 'Confirmações e promoções via bot', included: false },
      { label: 'Suporte prioritário', included: false },
    ],
    cta: 'Começar grátis',
  },
  {
    id: 'pro' as const,
    label: 'Pro',
    highlight: true,
    badge: 'Mais popular',
    icon: Zap,
    features: [
      { label: 'Agenda completa', included: true },
      { label: 'Clientes e serviços ilimitados', included: true },
      { label: 'Book público de agendamento', included: true },
      { label: 'Relatórios básicos (últimos 7 dias)', included: true },
      { label: 'Chatbot WhatsApp de agendamento', included: true },
      { label: 'Relatórios avançados + insights', included: false },
      { label: 'Confirmações e promoções via bot', included: false },
      { label: 'Suporte prioritário', included: false },
    ],
    cta: 'Assinar Pro',
  },
  {
    id: 'premium' as const,
    label: 'Premium',
    highlight: false,
    badge: 'Completo',
    icon: Crown,
    features: [
      { label: 'Tudo do plano Pro', included: true },
      { label: 'Relatórios 7d, 30d, 90d e 12 meses', included: true },
      { label: 'Insights automáticos de desempenho', included: true },
      { label: 'Chatbot completo com confirmações', included: true },
      { label: 'Envio de promoções via WhatsApp', included: true },
      { label: 'Suporte prioritário', included: true },
    ],
    cta: 'Assinar Premium',
  },
]

export function PricingSection() {
  const [selectedPeriod, setSelectedPeriod] = useState<SubscriptionPeriod>('monthly')

  return (
    <section id="planos" className="bg-zinc-900/50 border-y border-zinc-800">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-24">

        <div className="text-center mb-12">
          <p className="text-amber-500 text-sm font-semibold uppercase tracking-widest mb-3">Planos</p>
          <h2 className="text-3xl sm:text-4xl font-bold">Preços simples e transparentes</h2>
          <p className="text-zinc-400 mt-3">Comece grátis. Faça upgrade quando quiser crescer mais.</p>
        </div>

        {/* Period selector */}
        <div className="flex justify-center mb-10">
          <div className="flex flex-wrap justify-center gap-2 bg-zinc-900 border border-zinc-800 p-1.5 rounded-2xl">
            {PERIOD_ORDER.map(p => {
              const def = BILLING_PERIODS[p]
              return (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={cn(
                    'relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                    selectedPeriod === p
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  {def.label}
                  {def.discount > 0 && (
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                      selectedPeriod === p
                        ? 'bg-black/20 text-black'
                        : 'bg-green-500/15 text-green-400'
                    )}>
                      -{def.discount}%
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PLANS.map(plan => {
            const Icon    = plan.icon
            const pricing = plan.id !== 'free'
              ? getSubscriptionPrice(plan.id, selectedPeriod)
              : null

            return (
              <div
                key={plan.id}
                className={cn(
                  'relative rounded-2xl border p-7 flex flex-col',
                  plan.highlight
                    ? 'bg-amber-500/5 border-amber-500/40 shadow-lg shadow-amber-500/10'
                    : 'bg-zinc-900 border-zinc-800'
                )}
              >
                {plan.badge && (
                  <div className={cn(
                    'absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold whitespace-nowrap',
                    plan.highlight ? 'bg-amber-500 text-black' : 'bg-zinc-700 text-zinc-300'
                  )}>
                    {plan.badge}
                  </div>
                )}

                <div className="flex items-center gap-3 mb-5">
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center',
                    plan.highlight ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-amber-500'
                  )}>
                    <Icon size={18} />
                  </div>
                  <h3 className="font-bold text-white text-lg">{plan.label}</h3>
                </div>

                {/* Price */}
                <div className="mb-6">
                  {pricing ? (
                    <>
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-3xl font-extrabold text-white">
                          R$ {pricing.perMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <span className="text-zinc-500 text-sm">/mês</span>
                      </div>
                      {selectedPeriod !== 'monthly' ? (
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-zinc-500">
                            R$ {pricing.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em {BILLING_PERIODS[selectedPeriod].months}x
                          </span>
                          <span className="text-[10px] font-bold bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Tag size={9} /> {pricing.discount}% off
                          </span>
                        </div>
                      ) : (
                        <p className="text-zinc-500 text-sm mt-0.5">por mês</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-extrabold text-white">Grátis</p>
                      <p className="text-zinc-500 text-sm">por período de teste</p>
                    </>
                  )}
                </div>

                <Link
                  href="/login"
                  className={cn(
                    'w-full text-center font-semibold py-3 rounded-xl text-sm transition-colors mb-6 block',
                    plan.highlight
                      ? 'bg-amber-500 hover:bg-amber-400 text-black'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                  )}
                >
                  {plan.cta}
                </Link>

                <ul className="space-y-2.5 flex-1">
                  {plan.features.map(feat => (
                    <li key={feat.label} className="flex items-start gap-2.5 text-sm">
                      {feat.included
                        ? <Check size={14} className="text-amber-500 mt-0.5 shrink-0" />
                        : <X size={14} className="text-zinc-700 mt-0.5 shrink-0" />
                      }
                      <span className={feat.included ? 'text-zinc-300' : 'text-zinc-600'}>
                        {feat.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <p className="text-center text-zinc-600 text-sm mt-8">
          Todos os planos incluem suporte via e-mail e atualizações gratuitas.
        </p>
      </div>
    </section>
  )
}
