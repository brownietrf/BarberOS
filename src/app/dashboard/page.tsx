import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarDays, Users, Scissors, TrendingUp } from 'lucide-react'

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

  // Trial
  const trialEnds = new Date(barbershop.trial_ends_at)
  const trialDays = Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Olá! 👋
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Aqui está um resumo da {barbershop.name}
        </p>
      </div>

      {/* Trial banner */}
      {barbershop.plan === 'free' && trialDays > 0 && (
        <div className="mb-6 bg-amber-500/5 border border-amber-500/20 rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-amber-400 text-sm font-medium">
              🎉 Período de teste gratuito
            </p>
            <p className="text-zinc-400 text-xs mt-0.5">
              Você tem <strong className="text-amber-400">{trialDays} dias</strong> restantes no plano gratuito.
            </p>
          </div>
          <button className="text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
            Ver planos
          </button>
        </div>
      )}

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
