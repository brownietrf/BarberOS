'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  PLANS, BILLING_PERIODS, isTrialActive, isTrialExpired, trialDaysLeft,
  isSubscriptionExpired, subscriptionDaysLeft, getSubscriptionPrice,
} from '@/lib/plans'
import type { Barbershop, Plan, SubscriptionPeriod } from '@/types/database'
import { Check, X, Sparkles, Zap, Crown, Clock, ArrowLeft, AlertTriangle, Tag, RefreshCw, CheckCircle, Copy, Gift, Users } from 'lucide-react'
import Link from 'next/link'
import { updateSubscriptionPeriod } from './actions'
import type { Referral } from '@/types/database'

interface Props {
  barbershop: Barbershop
  referrals: Referral[]
}

const PLAN_ORDER: Plan[] = ['free', 'pro', 'premium']

const PLAN_ICON = {
  free:    { icon: Clock,    color: 'text-zinc-400',  bg: 'bg-zinc-700/50' },
  pro:     { icon: Zap,      color: 'text-blue-400',  bg: 'bg-blue-500/10' },
  premium: { icon: Crown,    color: 'text-amber-400', bg: 'bg-amber-500/10' },
}

const PERIOD_ORDER: SubscriptionPeriod[] = ['monthly', '3months', '6months', '12months']

export function PlanosClient({ barbershop, referrals }: Props) {
  const plan        = barbershop.plan
  const trialActive = isTrialActive(barbershop)
  const trialExpd   = isTrialExpired(barbershop)
  const daysLeft    = trialDaysLeft(barbershop)
  const subExpired  = isSubscriptionExpired(barbershop)
  const subDays     = subscriptionDaysLeft(barbershop)

  const [selectedPeriod, setSelectedPeriod] = useState<SubscriptionPeriod>(
    (barbershop.subscription_period as SubscriptionPeriod) ?? 'monthly'
  )
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [saveError, setSaveError] = useState('')

  const currentPeriod = (barbershop.subscription_period as SubscriptionPeriod) ?? 'monthly'
  const periodChanged = plan !== 'free' && !subExpired && selectedPeriod !== currentPeriod

  async function handlePeriodChange() {
    if (!periodChanged) return
    setSaving(true)
    setSaveError('')
    const { error } = await updateSubscriptionPeriod(selectedPeriod)
    if (error) {
      setSaveError(error)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-4 w-fit">
          <ArrowLeft size={14} /> Voltar ao início
        </Link>
        <h1 className="text-2xl font-bold text-white">Planos BarberOS</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Escolha o plano e período ideal para a sua barbearia
        </p>
      </div>

      {/* Status atual */}
      <CurrentPlanBanner
        plan={plan}
        trialActive={trialActive}
        trialExpired={trialExpd}
        daysLeft={daysLeft}
        subExpired={subExpired}
        subDays={subDays}
        subEndsAt={barbershop.subscription_ends_at}
        subPeriod={barbershop.subscription_period}
      />

      {/* Seletor de período — visível para todos */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-zinc-500">Período de cobrança</p>
          {plan !== 'free' && !subExpired && (
            <p className="text-xs text-zinc-600">Período atual: <span className="text-zinc-400">{BILLING_PERIODS[currentPeriod].label}</span></p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIOD_ORDER.map(p => {
            const def = BILLING_PERIODS[p]
            return (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all',
                  selectedPeriod === p
                    ? 'bg-amber-500 border-amber-500 text-black'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600'
                )}
              >
                {def.label}
                {def.discount > 0 && (
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    selectedPeriod === p ? 'bg-black/20 text-black' : 'bg-green-500/15 text-green-400'
                  )}>
                    -{def.discount}%
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Change period button for paid active subscribers */}
        {periodChanged && (
          <div className="mt-4 flex items-center gap-3 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3">
            <div className="flex-1">
              <p className="text-sm text-white font-medium">Alterar período de cobrança</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Mudança para <strong className="text-zinc-300">{BILLING_PERIODS[selectedPeriod].label}</strong> entra em vigor no próximo ciclo ({barbershop.subscription_ends_at ? new Date(barbershop.subscription_ends_at).toLocaleDateString('pt-BR') : '—'})
              </p>
            </div>
            {saved ? (
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <CheckCircle size={14} /> Salvo
              </span>
            ) : (
              <button
                onClick={handlePeriodChange}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw size={13} className={saving ? 'animate-spin' : ''} />
                {saving ? 'Salvando…' : 'Confirmar'}
              </button>
            )}
          </div>
        )}
        {saveError && (
          <p className="mt-2 text-xs text-red-400">{saveError}</p>
        )}
      </div>

      {/* Cards de planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {PLAN_ORDER.map(p => {
          const def       = PLANS[p]
          const isCurrent = p === plan
          const Icon      = PLAN_ICON[p].icon

          // Pricing for paid plans with period discount
          const pricing = p !== 'free'
            ? getSubscriptionPrice(p as 'pro' | 'premium', selectedPeriod)
            : null

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
                {pricing ? (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold text-white">
                        R$ {pricing.perMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-zinc-500 text-sm">/mês</span>
                    </div>
                    {selectedPeriod !== 'monthly' && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-zinc-500">
                          Total: R$ {pricing.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em {BILLING_PERIODS[selectedPeriod].months}x
                        </span>
                        <span className="text-[10px] font-bold bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Tag size={9} /> {pricing.discount}% off
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-white">{def.price}</span>
                    <span className="text-zinc-500 text-sm ml-1">{def.priceNote}</span>
                  </>
                )}
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

      {/* Programa de indicação */}
      <ReferralSection barbershop={barbershop} referrals={referrals} />

    </div>
  )
}

// ─── Banner do plano atual ─────────────────────────────────────────────────────

function CurrentPlanBanner({ plan, trialActive, trialExpired, daysLeft, subExpired, subDays, subEndsAt, subPeriod }: {
  plan: Plan
  trialActive: boolean
  trialExpired: boolean
  daysLeft: number
  subExpired: boolean
  subDays: number
  subEndsAt: string | null
  subPeriod: SubscriptionPeriod | null
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

  // Paid plan — expired
  if (subExpired) {
    return (
      <div className="mb-8 bg-red-500/5 border border-red-500/20 rounded-xl px-5 py-4 flex items-center gap-3">
        <AlertTriangle size={18} className="text-red-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-400">Assinatura expirada</p>
          <p className="text-zinc-500 text-xs mt-0.5">Renove para reativar relatórios e edição de serviços.</p>
        </div>
      </div>
    )
  }

  const def        = PLANS[plan]
  const Icon       = PLAN_ICON[plan].icon
  const renewDate  = subEndsAt ? new Date(subEndsAt).toLocaleDateString('pt-BR') : null
  const periodLabel = subPeriod ? BILLING_PERIODS[subPeriod].label : null

  return (
    <div className="mb-8 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 flex items-center gap-3">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', PLAN_ICON[plan].bg)}>
        <Icon size={16} className={PLAN_ICON[plan].color} />
      </div>
      <div>
        <p className="text-sm font-medium text-white">
          Você está no plano <strong className={plan === 'premium' ? 'text-amber-400' : 'text-blue-400'}>{def.label}</strong>
          {periodLabel && <span className="text-zinc-500 font-normal"> · {periodLabel}</span>}
        </p>
        <p className="text-zinc-500 text-xs mt-0.5">
          {renewDate
            ? `Renova em ${renewDate} — ${subDays} dia${subDays !== 1 ? 's' : ''} restante${subDays !== 1 ? 's' : ''}`
            : `${def.price} ${def.priceNote}`
          }
        </p>
      </div>
    </div>
  )
}

// ─── Seção de indicação ────────────────────────────────────────────────────────

function ReferralSection({ barbershop, referrals }: { barbershop: Barbershop; referrals: Referral[] }) {
  const [copied, setCopied] = useState(false)
  const code = barbershop.referral_code

  const bonusActive = barbershop.referral_bonus_ends_at
    && new Date(barbershop.referral_bonus_ends_at) > new Date()

  const bonusDays = bonusActive
    ? Math.ceil((new Date(barbershop.referral_bonus_ends_at!).getTime() - Date.now()) / 86_400_000)
    : 0

  function handleCopy() {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const qualifiedCount = referrals.filter(r => r.status === 'qualified' || r.status === 'rewarded').length
  const pendingCount   = referrals.filter(r => r.status === 'pending').length

  return (
    <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
      <div className="flex items-center gap-2 mb-5">
        <Gift size={16} className="text-amber-500" />
        <h2 className="text-base font-semibold text-white">Programa de Indicação</h2>
      </div>

      <p className="text-sm text-zinc-400 mb-5 leading-relaxed">
        Indique o BarberOS para outros barbeiros. Quando o indicado <strong className="text-white">assinar um plano pago</strong>, você ganha <strong className="text-amber-400">1 mês grátis</strong> no seu plano atual.
      </p>

      {/* Bônus ativo */}
      {bonusActive && (
        <div className="mb-5 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <CheckCircle size={16} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-400">Bônus de indicação ativo!</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Você tem <strong className="text-zinc-300">{bonusDays} dias</strong> grátis aplicados ao seu plano.
            </p>
          </div>
        </div>
      )}

      {/* Código de indicação */}
      <div className="flex flex-col gap-1.5 mb-5">
        <p className="text-xs text-zinc-500">Seu código de indicação</p>
        {code ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 font-mono text-sm text-amber-400 tracking-widest select-all">
              {code}
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm px-3 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              {copied
                ? <><CheckCircle size={14} className="text-green-400" /> Copiado</>
                : <><Copy size={14} /> Copiar</>
              }
            </button>
          </div>
        ) : (
          <p className="text-xs text-zinc-600 italic">Código gerado automaticamente no cadastro.</p>
        )}
        <p className="text-xs text-zinc-600">Compartilhe este código com outros barbeiros ao indicar o BarberOS.</p>
      </div>

      {/* Stats de indicações */}
      {referrals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-800 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-white">{referrals.length}</div>
            <div className="text-xs text-zinc-500 mt-0.5 flex items-center justify-center gap-1">
              <Users size={10} /> Indicados
            </div>
          </div>
          <div className="bg-zinc-800 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-amber-400">{qualifiedCount}</div>
            <div className="text-xs text-zinc-500 mt-0.5">Assinaram</div>
          </div>
          <div className="bg-zinc-800 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-zinc-400">{pendingCount}</div>
            <div className="text-xs text-zinc-500 mt-0.5">Pendentes</div>
          </div>
        </div>
      )}

      {referrals.length === 0 && (
        <div className="bg-zinc-800/50 border border-zinc-700 border-dashed rounded-xl p-5 text-center">
          <p className="text-zinc-500 text-sm">Você ainda não tem indicações. Compartilhe seu código!</p>
        </div>
      )}
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
