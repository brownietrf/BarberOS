import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarDays, Users, Scissors, TrendingUp, Clock, Zap, Crown, AlertTriangle } from 'lucide-react'
import {
  isTrialExpired, trialDaysLeft, PLANS,
  subscriptionDaysLeft, isSubscriptionExpiring,
  isGracePeriod, gracePeriodDaysLeft, GRACE_PERIOD_DAYS,
} from '@/lib/plans'
import type { Plan } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!barbershop) redirect('/onboarding')

  // Busca stats básicos
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [
    { count: todayCount },
    { count: totalClients },
    { count: pendingCount },
    { count: totalAppointments },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('barbershop_id', barbershop.id)
      .gte('start_time', today.toISOString())
      .lt('start_time', tomorrow.toISOString())
      .neq('status', 'cancelled'),
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('barbershop_id', barbershop.id),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('barbershop_id', barbershop.id)
      .eq('status', 'pending'),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('barbershop_id', barbershop.id)
      .eq('status', 'completed'),
  ])

  const stats = [
    {
      label: 'Agendamentos hoje',
      value: todayCount ?? 0,
      icon: CalendarDays,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      hint: 'agendamentos para hoje',
    },
    {
      label: 'Aguardando confirmação',
      value: pendingCount ?? 0,
      icon: TrendingUp,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      hint: 'aguardando confirmação',
    },
    {
      label: 'Total de clientes',
      value: totalClients ?? 0,
      icon: Users,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      hint: 'clientes cadastrados',
    },
    {
      label: 'Atendimentos realizados',
      value: totalAppointments ?? 0,
      icon: Scissors,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      hint: 'atendimentos concluídos',
    },
  ]

  const daysLeft    = trialDaysLeft(barbershop)
  const trialExpd   = isTrialExpired(barbershop)
  const subExpiring = isSubscriptionExpiring(barbershop)
  const subDays     = subscriptionDaysLeft(barbershop)
  const inGrace     = isGracePeriod(barbershop)
  const graceDays   = gracePeriodDaysLeft(barbershop)

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Olá! 👋
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Aqui está um resumo da {barbershop.name}
        </p>
      </div>

      {/* Plan status banner */}
      <PlanBanner
        plan={barbershop.plan as Plan}
        trialExpired={trialExpd}
        daysLeft={daysLeft}
        subExpiring={subExpiring}
        subDays={subDays}
        subEndsAt={barbershop.subscription_ends_at}
        inGrace={inGrace}
        graceDays={graceDays}
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className={`w-9 h-9 ${stat.bg} rounded-lg flex items-center justify-center mb-4`}>
                <Icon size={18} className={stat.color} />
              </div>
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-xs text-zinc-500">{stat.label}</div>
            </div>
          )
        })}
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Ações rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a href="/dashboard/agenda" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 flex items-center gap-3 transition-all group">
            <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <CalendarDays size={18} className="text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Ver agenda</p>
              <p className="text-xs text-zinc-500">Horários de hoje</p>
            </div>
          </a>
          <a href="/dashboard/clientes" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 flex items-center gap-3 transition-all group">
            <div className="w-9 h-9 bg-green-500/10 rounded-lg flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
              <Users size={18} className="text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Clientes</p>
              <p className="text-xs text-zinc-500">Gerenciar clientes</p>
            </div>
          </a>
          <a href="/dashboard/servicos" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 flex items-center gap-3 transition-all group">
            <div className="w-9 h-9 bg-purple-500/10 rounded-lg flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
              <Scissors size={18} className="text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Serviços</p>
              <p className="text-xs text-zinc-500">Preços e duração</p>
            </div>
          </a>
        </div>
      </div>

      {/* Empty state se não tem agendamentos */}
      {(todayCount ?? 0) === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-xl p-10 text-center">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="text-white font-medium mb-1">Nenhum agendamento hoje</h3>
          <p className="text-zinc-500 text-sm mb-4">
            Configure seus serviços e conecte o WhatsApp para começar a receber agendamentos.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href="/dashboard/servicos"
              className="text-sm bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded-lg transition-colors">
              Cadastrar serviços
            </a>
            <a href="/dashboard/bot"
              className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-4 py-2 rounded-lg transition-colors">
              Conectar WhatsApp
            </a>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Plan Banner ──────────────────────────────────────────────────────────────

function PlanBanner({ plan, trialExpired, daysLeft, subExpiring, subDays, subEndsAt, inGrace, graceDays }: {
  plan: Plan
  trialExpired: boolean
  daysLeft: number
  subExpiring: boolean
  subDays: number
  subEndsAt: string | null
  inGrace: boolean
  graceDays: number
}) {
  const def = PLANS[plan]

  // Free trial
  if (plan === 'free') {
    const urgent    = daysLeft <= 3
    const warning   = daysLeft <= 7
    const color     = urgent ? 'border-red-500/25 bg-red-500/5' : warning ? 'border-orange-500/25 bg-orange-500/5' : 'border-amber-500/20 bg-amber-500/5'
    const textColor = urgent ? 'text-red-400' : warning ? 'text-orange-400' : 'text-amber-400'

    return (
      <div className={`mb-6 border rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap ${color}`}>
        <div className="flex items-center gap-3">
          <Clock size={16} className={textColor} />
          <div>
            <p className={`text-sm font-medium ${textColor}`}>
              {trialExpired
                ? 'Período de teste encerrado'
                : urgent
                  ? `Trial expira em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}!`
                  : `Free Trial — ${daysLeft} dias restantes`
              }
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">
              {trialExpired
                ? 'Assine um plano para continuar utilizando o BarberOS.'
                : 'Você tem acesso completo durante o período de teste.'}
            </p>
          </div>
        </div>
        <a href="/dashboard/planos" className="text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
          Ver planos
        </a>
      </div>
    )
  }

  // Plano pago — período de carência (expirado mas ainda dentro dos 10 dias)
  if (inGrace) {
    const urgent = graceDays <= 3
    return (
      <div className={`mb-6 border rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap ${urgent ? 'border-red-500/30 bg-red-500/5' : 'border-orange-500/25 bg-orange-500/5'}`}>
        <div className="flex items-center gap-3">
          <AlertTriangle size={16} className={urgent ? 'text-red-400 shrink-0' : 'text-orange-400 shrink-0'} />
          <div>
            <p className={`text-sm font-medium ${urgent ? 'text-red-400' : 'text-orange-400'}`}>
              Assinatura expirada — {graceDays} dia{graceDays !== 1 ? 's' : ''} para regularizar
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">
              Após esse prazo, o acesso à plataforma será suspenso completamente. Apenas o agendamento funcionará até lá.
            </p>
          </div>
        </div>
        <a href="/dashboard/planos" className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${urgent ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-orange-500 hover:bg-orange-400 text-white'}`}>
          Renovar agora
        </a>
      </div>
    )
  }

  // Plano pago — expirando em breve
  if (subExpiring) {
    const renewDate = subEndsAt ? new Date(subEndsAt).toLocaleDateString('pt-BR') : ''
    return (
      <div className="mb-6 border border-orange-500/25 bg-orange-500/5 rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Clock size={16} className="text-orange-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-400">
              Assinatura expira em {subDays} dia{subDays !== 1 ? 's' : ''}
              {renewDate && <span className="font-normal text-zinc-500"> ({renewDate})</span>}
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">Renove para não interromper o acesso.</p>
          </div>
        </div>
        <a href="/dashboard/planos" className="text-xs bg-orange-500 hover:bg-orange-400 text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
          Renovar
        </a>
      </div>
    )
  }

  // Plano pago — ativo
  const Icon       = plan === 'premium' ? Crown : Zap
  const iconColor  = plan === 'premium' ? 'text-amber-400' : 'text-blue-400'
  const badgeColor = plan === 'premium' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-blue-500/10 border-blue-500/20'
  const renewDate  = subEndsAt ? new Date(subEndsAt).toLocaleDateString('pt-BR') : null

  return (
    <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${badgeColor} border`}>
          <Icon size={14} className={iconColor} />
        </div>
        <div>
          <p className="text-sm text-zinc-300">
            Plano <strong className={iconColor}>{def.label}</strong>
            {renewDate && <span className="text-zinc-500 text-xs ml-2">· renova em {renewDate} ({subDays}d)</span>}
          </p>
        </div>
      </div>
      <a href="/dashboard/planos" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap underline underline-offset-2">
        Ver planos
      </a>
    </div>
  )
}
