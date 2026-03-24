'use client'

import { cn } from '@/lib/utils'
import { PLANS, isTrialActive, isTrialExpired, trialDaysLeft } from '@/lib/plans'
import type { Barbershop, Plan } from '@/types/database'
import { Check, X, Sparkles, Zap, Crown, Clock, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Props {
  barbershop: Barbershop
}

const PLAN_ORDER: Plan[] = ['free', 'pro', 'premium']

const PLAN_ICON = {
  free:    { icon: Clock,    color: 'text-zinc-400',  bg: 'bg-zinc-700/50' },
  pro:     { icon: Zap,      color: 'text-blue-400',  bg: 'bg-blue-500/10' },
  premium: { icon: Crown,    color: 'text-amber-400', bg: 'bg-amber-500/10' },
}

export function PlanosClient({ barbershop }: Props) {
  const plan        = barbershop.plan
  const trialActive = isTrialActive(barbershop)
  const trialExpd   = isTrialExpired(barbershop)
  const daysLeft    = trialDaysLeft(barbershop)

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-4 w-fit">
          <ArrowLeft size={14} /> Voltar ao início
        </Link>
        <h1 className="text-2xl font-bold text-white">Planos BarberOS</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Escolha o plano ideal para a sua barbearia
        </p>
      </div>

      {/* Status atual */}
      <CurrentPlanBanner plan={plan} trialActive={trialActive} trialExpired={trialExpd} daysLeft={daysLeft} />

      {/* Cards de planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {PLAN_ORDER.map(p => {
          const def     = PLANS[p]
          const isCurrent = p === plan
          const Icon    = PLAN_ICON[p].icon

          return (
            <div
              key={p}
              className={cn(
                'relative bg-zinc-900 border rounded-2xl p-6 flex flex-col transition-all',
                isCurrent
                  ? 'border-amber-500 shadow-[0_0_0_1px_rgba(245,158,11,0.3)]'
                  : def.highlight
                    ? 'border-blue-500/40'
                    : 'border-zinc-800'
              )}
            >
              {/* Badge */}
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  Seu plano atual
                </span>
              )}
              {!isCurrent && def.badge && (
                <span className={cn(
                  'absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap',
                  p === 'pro' ? 'bg-blue-500 text-white' : 'bg-amber-500 text-black'
                )}>
                  {def.badge}
                </span>
              )}

              {/* Icon + Label */}
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4', PLAN_ICON[p].bg)}>
                <Icon size={20} className={PLAN_ICON[p].color} />
              </div>

              <h2 className="text-lg font-bold text-white mb-1">{def.label}</h2>

              {/* Price */}
              <div className="mb-5">
                <span className="text-3xl font-bold text-white">{def.price}</span>
                <span className="text-zinc-500 text-sm ml-1">{def.priceNote}</span>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 flex-1">
                {def.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    {f.included
                      ? <Check size={15} className="text-green-400 shrink-0 mt-0.5" />
                      : <X     size={15} className="text-zinc-700 shrink-0 mt-0.5" />
                    }
                    <span className={cn(f.included ? 'text-zinc-300' : 'text-zinc-600')}>
                      {f.label}
                      {f.note && <span className="text-zinc-500 text-xs ml-1">({f.note})</span>}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {!isCurrent && (
                <button className={cn(
                  'mt-6 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors',
                  p === 'premium'
                    ? 'bg-amber-500 hover:bg-amber-400 text-black'
                    : p === 'pro'
                      ? 'bg-blue-500 hover:bg-blue-400 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                )}>
                  {p === 'free' ? 'Plano atual' : `Assinar ${def.label}`}
                </button>
              )}
              {isCurrent && (
                <div className="mt-6 w-full py-2.5 rounded-xl text-sm font-medium text-center text-amber-500 bg-amber-500/10 border border-amber-500/20">
                  Plano ativo
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Texto de vantagens dinâmico */}
      <AdvantagesSection plan={plan} barbershopName={barbershop.name} trialActive={trialActive} daysLeft={daysLeft} />

    </div>
  )
}

// ─── Banner do plano atual ─────────────────────────────────────────────────────

function CurrentPlanBanner({ plan, trialActive, trialExpired, daysLeft }: {
  plan: Plan
  trialActive: boolean
  trialExpired: boolean
  daysLeft: number
}) {
  if (plan === 'free' && trialActive) {
    return (
      <div className={cn(
        'mb-8 rounded-xl px-5 py-4 border flex items-center gap-3',
        daysLeft <= 3
          ? 'bg-red-500/5 border-red-500/20'
          : daysLeft <= 7
            ? 'bg-orange-500/5 border-orange-500/20'
            : 'bg-amber-500/5 border-amber-500/20'
      )}>
        <Clock size={18} className={daysLeft <= 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-orange-400' : 'text-amber-400'} />
        <div>
          <p className={cn('text-sm font-medium', daysLeft <= 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-orange-400' : 'text-amber-400')}>
            {daysLeft <= 3
              ? `Atenção: seu trial expira em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}!`
              : `Trial ativo — ${daysLeft} dias restantes`
            }
          </p>
          <p className="text-zinc-500 text-xs mt-0.5">
            Escolha um plano para continuar usando o BarberOS após o período de teste.
          </p>
        </div>
      </div>
    )
  }

  if (plan === 'free' && trialExpired) {
    return (
      <div className="mb-8 bg-red-500/5 border border-red-500/20 rounded-xl px-5 py-4 flex items-center gap-3">
        <X size={18} className="text-red-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-400">Período de teste encerrado</p>
          <p className="text-zinc-500 text-xs mt-0.5">Assine um plano para continuar utilizando a plataforma.</p>
        </div>
      </div>
    )
  }

  const def  = PLANS[plan]
  const Icon = PLAN_ICON[plan].icon

  return (
    <div className="mb-8 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 flex items-center gap-3">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', PLAN_ICON[plan].bg)}>
        <Icon size={16} className={PLAN_ICON[plan].color} />
      </div>
      <div>
        <p className="text-sm font-medium text-white">Você está no plano <strong className={plan === 'premium' ? 'text-amber-400' : 'text-blue-400'}>{def.label}</strong></p>
        <p className="text-zinc-500 text-xs mt-0.5">{def.price} {def.priceNote}</p>
      </div>
    </div>
  )
}

// ─── Texto de vantagens ────────────────────────────────────────────────────────

function AdvantagesSection({ plan, barbershopName, trialActive, daysLeft }: {
  plan: Plan
  barbershopName: string
  trialActive: boolean
  daysLeft: number
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
      <div className="flex items-center gap-2 mb-5">
        <Sparkles size={16} className="text-amber-500" />
        <h2 className="text-base font-semibold text-white">
          {plan === 'free' ? 'Por que o BarberOS vai transformar sua barbearia?' : 'O que você tem com seu plano'}
        </h2>
      </div>

      {plan === 'free' && (
        <div className="space-y-5 text-sm text-zinc-400 leading-relaxed">
          <p>
            Olá, <strong className="text-white">{barbershopName}</strong>! Você está no <strong className="text-amber-400">período de teste gratuito</strong>{trialActive ? ` com ${daysLeft} dias restantes` : ' (encerrado)'}. Aproveite para explorar tudo o que o BarberOS oferece.
          </p>
          <p>
            O BarberOS foi criado para barbearias modernas que querem <strong className="text-white">profissionalizar o atendimento e crescer</strong> sem depender de papel, planilha ou grupo de WhatsApp. Com a plataforma, você centraliza agenda, clientes e serviços num único lugar — acessível do celular ou computador.
          </p>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 space-y-2">
            <p className="text-zinc-300 font-medium">Com o BarberOS você:</p>
            <ul className="space-y-1.5 text-zinc-400">
              <li className="flex items-start gap-2"><Check size={14} className="text-green-400 shrink-0 mt-0.5" /> Elimina conflitos de horário com agenda sincronizada em tempo real</li>
              <li className="flex items-start gap-2"><Check size={14} className="text-green-400 shrink-0 mt-0.5" /> Permite que clientes agendem sozinhos pelo link do Book — sem você precisar responder mensagem</li>
              <li className="flex items-start gap-2"><Check size={14} className="text-green-400 shrink-0 mt-0.5" /> Tem histórico completo de clientes, visitas e preferências</li>
              <li className="flex items-start gap-2"><Check size={14} className="text-green-400 shrink-0 mt-0.5" /> Visualiza relatórios de desempenho para tomar decisões mais inteligentes</li>
              <li className="flex items-start gap-2"><Check size={14} className="text-green-400 shrink-0 mt-0.5" /> Pode ter um chatbot no WhatsApp agendando por você, 24 horas por dia</li>
            </ul>
          </div>
          <p>
            Após o trial, o <strong className="text-blue-400">plano Pro (R$ 49,90/mês)</strong> é ideal para barbearias que querem continuar com clientes ilimitados e automação de agendamento. Se você quer o pacote completo — relatórios profundos, confirmações automáticas e envio de promoções — o <strong className="text-amber-400">plano Premium (R$ 89,90/mês)</strong> entrega tudo isso.
          </p>
        </div>
      )}

      {plan === 'pro' && (
        <div className="space-y-5 text-sm text-zinc-400 leading-relaxed">
          <p>
            Com o <strong className="text-blue-400">plano Pro</strong>, sua barbearia tem acesso às funcionalidades essenciais para profissionalizar o atendimento e automatizar os agendamentos — sem limite de clientes ou serviços.
          </p>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 space-y-2">
            <p className="text-zinc-300 font-medium">O que está incluso no seu plano:</p>
            <ul className="space-y-1.5 text-zinc-400">
              <li className="flex items-start gap-2"><Check size={14} className="text-green-400 shrink-0 mt-0.5" /> <strong className="text-zinc-300">Clientes ilimitados</strong> — sem restrição de cadastro ou histórico</li>
              <li className="flex items-start gap-2"><Check size={14} className="text-green-400 shrink-0 mt-0.5" /> <strong className="text-zinc-300">Chatbot de agendamento</strong> — clientes agendam via WhatsApp automaticamente, sem você precisar responder</li>
              <li className="flex items-start gap-2"><Check size={14} className="text-green-400 shrink-0 mt-0.5" /> <strong className="text-zinc-300">Book público</strong> — link de agendamento para compartilhar nas redes sociais</li>
              <li className="flex items-start gap-2"><Check size={14} className="text-green-400 shrink-0 mt-0.5" /> <strong className="text-zinc-300">Relatórios básicos</strong> — acompanhe os últimos 7 dias de desempenho</li>
            </ul>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
            <p className="text-amber-400 font-medium text-xs mb-2">Quer mais? Conheça o Premium:</p>
            <ul className="space-y-1.5 text-zinc-400 text-xs">
              <li className="flex items-start gap-2"><Sparkles size={12} className="text-amber-500 shrink-0 mt-0.5" /> Relatórios de 30d, 90d e 12 meses com insights automáticos</li>
              <li className="flex items-start gap-2"><Sparkles size={12} className="text-amber-500 shrink-0 mt-0.5" /> Bot que confirma agendamentos e envia lembretes automaticamente</li>
              <li className="flex items-start gap-2"><Sparkles size={12} className="text-amber-500 shrink-0 mt-0.5" /> Envio de promoções e comunicados em massa pelo WhatsApp</li>
            </ul>
          </div>
        </div>
      )}

      {plan === 'premium' && (
        <div className="space-y-5 text-sm text-zinc-400 leading-relaxed">
          <p>
            Você está no <strong className="text-amber-400">plano Premium</strong> — o pacote completo do BarberOS. Sua barbearia tem acesso a todas as funcionalidades disponíveis na plataforma.
          </p>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 space-y-2">
            <p className="text-zinc-300 font-medium">Tudo incluso no seu plano:</p>
            <ul className="space-y-1.5 text-zinc-400">
              <li className="flex items-start gap-2"><Check size={14} className="text-green-400 shrink-0 mt-0.5" /> <strong className="text-zinc-300">Relatórios completos</strong> — análise de 7 dias até 12 meses com insights automáticos sobre dias mais movimentados, serviços, horários e mais</li>
              <li className="flex items-start gap-2"><Check size={14} className="text-green-400 shrink-0 mt-0.5" /> <strong className="text-zinc-300">Chatbot completo</strong> — agendamento, confirmação automática de horários e envio de lembretes sem intervenção manual</li>
              <li className="flex items-start gap-2"><Check size={14} className="text-green-400 shrink-0 mt-0.5" /> <strong className="text-zinc-300">Promoções via WhatsApp</strong> — comunique-se em massa com sua base de clientes</li>
              <li className="flex items-start gap-2"><Check size={14} className="text-green-400 shrink-0 mt-0.5" /> <strong className="text-zinc-300">Suporte prioritário</strong> — atendimento com prioridade para resolver qualquer dúvida ou problema</li>
            </ul>
          </div>
          <p>
            Com o BarberOS Premium, você tem uma barbearia que <strong className="text-white">funciona de forma autônoma</strong> — os agendamentos entram, os clientes recebem confirmação e você acompanha tudo nos relatórios. Foco total no atendimento, a plataforma cuida do resto.
          </p>
        </div>
      )}
    </div>
  )
}
