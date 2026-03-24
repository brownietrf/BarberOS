'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Barbershop } from '@/types/database'
import { subDays, subMonths } from 'date-fns'
import {
  TrendingUp,
  Users,
  CalendarDays,
  DollarSign,
  BarChart2,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLANS } from '@/lib/plans'
import type { LucideIcon } from 'lucide-react'
import type { ReportAppt } from './page'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d' | '12m'

interface Props {
  barbershop: Barbershop
  initialAppointments: ReportAppt[]
  initialNewCustomers: number
  initialPeriod: Period
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  '12m': '12 meses',
}

const DAY_LABELS      = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DAY_LABELS_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

const BUSINESS_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

const STATUS_LABELS: Record<string, string> = {
  pending:   'Pendente',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show:   'Faltou',
}

const STATUS_BAR_COLOR: Record<string, string> = {
  completed: 'bg-green-400',
  confirmed: 'bg-blue-400',
  pending:   'bg-yellow-400',
  cancelled: 'bg-red-400',
  no_show:   'bg-zinc-500',
}

const STATUS_BADGE_COLOR: Record<string, string> = {
  completed: 'bg-green-500/10 text-green-400 border-green-500/20',
  confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  no_show:   'bg-zinc-500/10 text-zinc-400 border-zinc-600/20',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStartDate(period: Period): Date {
  const now = new Date()
  switch (period) {
    case '7d':  return subDays(now, 7)
    case '30d': return subDays(now, 30)
    case '90d': return subDays(now, 90)
    case '12m': return subMonths(now, 12)
  }
}

const fmtCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── Main component ───────────────────────────────────────────────────────────

export function RelatoriosClient({ barbershop, initialAppointments, initialNewCustomers, initialPeriod }: Props) {
  const supabase = createClient()

  const [period, setPeriod]           = useState<Period>(initialPeriod)
  const [appointments, setAppointments] = useState(initialAppointments)
  const [newCustomers, setNewCustomers] = useState(initialNewCustomers)
  const [loading, setLoading]         = useState(false)

  async function handlePeriodChange(p: Period) {
    if (p === period) return
    setPeriod(p)
    setLoading(true)
    const start = getStartDate(p)
    const [{ data: appts }, { count }] = await Promise.all([
      supabase
        .from('appointments_full')
        .select('id, start_time, status, source, customer_name, service_name, service_price')
        .eq('barbershop_id', barbershop.id)
        .gte('start_time', start.toISOString())
        .order('start_time', { ascending: true }),
      supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('barbershop_id', barbershop.id)
        .gte('created_at', start.toISOString()),
    ])
    setAppointments((appts as ReportAppt[]) ?? [])
    setNewCustomers(count ?? 0)
    setLoading(false)
  }

  // ── Computed metrics ──────────────────────────────────────────────────────

  const active    = appointments.filter(a => a.status !== 'cancelled')
  const cancelled = appointments.filter(a => a.status === 'cancelled')
  const completed = appointments.filter(a => a.status === 'completed')

  const totalRevenue     = completed.reduce((s, a) => s + (a.service_price ?? 0), 0)
  const cancellationRate = appointments.length > 0
    ? Math.round((cancelled.length / appointments.length) * 100)
    : 0

  // By day of week
  const byDay = Array.from({ length: 7 }, (_, i) => ({
    label:     DAY_LABELS[i],
    labelFull: DAY_LABELS_FULL[i],
    count: active.filter(a => new Date(a.start_time).getDay() === i).length,
  }))
  const maxByDay = Math.max(...byDay.map(d => d.count), 1)

  // By hour (business hours)
  const byHour = BUSINESS_HOURS.map(h => ({
    label: `${h}h`,
    count: active.filter(a => new Date(a.start_time).getHours() === h).length,
  }))
  const maxByHour = Math.max(...byHour.map(h => h.count), 1)

  // Top services
  const serviceMap = new Map<string, { count: number; revenue: number }>()
  active.forEach(a => {
    if (!a.service_name) return
    const curr = serviceMap.get(a.service_name) ?? { count: 0, revenue: 0 }
    serviceMap.set(a.service_name, {
      count:   curr.count + 1,
      revenue: curr.revenue + (a.service_price ?? 0),
    })
  })
  const topServices = Array.from(serviceMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
  const maxService = Math.max(...topServices.map(s => s.count), 1)

  // Status breakdown (sorted by count desc)
  const statusBreakdown = Object.entries(
    appointments.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])

  // Source breakdown
  const sourceMap = appointments.reduce((acc, a) => {
    acc[a.source] = (acc[a.source] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  // ── Auto-insights ─────────────────────────────────────────────────────────

  const busiestDay  = byDay.reduce((max, d) => d.count > max.count ? d : max, byDay[0])
  const slowestDays = byDay.filter(d => d.count > 0)
  const slowestDay  = slowestDays.length > 0
    ? slowestDays.reduce((min, d) => d.count < min.count ? d : min)
    : null
  const busiestHour = byHour.reduce((max, h) => h.count > max.count ? h : max, byHour[0])
  const topService  = topServices[0]

  const insights: string[] = []
  if (busiestDay.count > 0)
    insights.push(`${busiestDay.labelFull} é o dia mais movimentado com ${busiestDay.count} agendamento${busiestDay.count > 1 ? 's' : ''}`)
  if (slowestDay && slowestDay.label !== busiestDay.label)
    insights.push(`${slowestDay.labelFull} é o dia mais tranquilo (${slowestDay.count} agendamento${slowestDay.count > 1 ? 's' : ''})`)
  if (busiestHour.count > 0)
    insights.push(`${busiestHour.label} é o horário mais disputado (${busiestHour.count} agendamento${busiestHour.count > 1 ? 's' : ''})`)
  if (topService)
    insights.push(`"${topService.name}" é o serviço mais solicitado (${topService.count}x — ${fmtCurrency(topService.revenue)})`)
  if (cancellationRate > 20)
    insights.push(`Taxa de cancelamento em ${cancellationRate}% — considere enviar lembretes pelo WhatsApp`)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header + period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Relatórios</h1>
          <p className="text-zinc-400 text-sm mt-1">Análise de desempenho da {barbershop.name}</p>
        </div>
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-1 self-start sm:self-auto">
          {(['7d', '30d', '90d', '12m'] as Period[]).map(p => {
            const allowed = PLANS[barbershop.plan].reportPeriods.includes(p)
            return (
              <button
                key={p}
                onClick={() => allowed && handlePeriodChange(p)}
                disabled={loading || !allowed}
                title={!allowed ? `Disponível no plano ${p === '12m' ? 'Premium' : 'Pro'}` : undefined}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-lg transition-all',
                  period === p
                    ? 'bg-amber-500 text-black font-semibold'
                    : allowed
                      ? 'text-zinc-400 hover:text-zinc-200'
                      : 'text-zinc-700 cursor-not-allowed'
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            )
          })}
        </div>
      </div>

      {loading && (
        <p className="text-center text-zinc-500 text-sm mb-4 animate-pulse">Carregando dados…</p>
      )}

      {/* Overview cards */}
      <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6', loading && 'opacity-50 pointer-events-none')}>
        <StatCard icon={CalendarDays} iconColor="text-amber-500"  iconBg="bg-amber-500/10"  label="Agendamentos"          value={active.length} />
        <StatCard icon={DollarSign}   iconColor="text-green-400"  iconBg="bg-green-500/10"  label="Receita realizada"     value={fmtCurrency(totalRevenue)} small />
        <StatCard icon={Users}        iconColor="text-blue-400"   iconBg="bg-blue-500/10"   label="Clientes novos"        value={newCustomers} />
        <StatCard icon={TrendingUp}   iconColor="text-red-400"    iconBg="bg-red-500/10"    label="Taxa cancelamento"     value={`${cancellationRate}%`} />
      </div>

      {/* Bloco premium — insights + gráficos */}
      <div className={cn('relative', loading && 'opacity-50 pointer-events-none')}>

        {/* Overlay blur para plano Pro */}
        {barbershop.plan === 'pro' && (
          <div className="absolute inset-0 z-10 rounded-2xl backdrop-blur-sm bg-zinc-950/60 flex flex-col items-center justify-center gap-4 pointer-events-auto">
            <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl text-center max-w-xs mx-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Zap size={20} className="text-amber-500" />
              </div>
              <p className="text-white font-semibold text-sm">Recurso Premium</p>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Insights automáticos e gráficos detalhados estão disponíveis no plano Premium.
              </p>
              <a
                href="/dashboard/planos"
                className="mt-1 w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors text-center"
              >
                Ver Premium
              </a>
            </div>
          </div>
        )}

        {/* Insights */}
        {insights.length > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-amber-500" />
              <span className="text-sm font-medium text-amber-400">Insights do período</span>
            </div>
            <ul className="space-y-1.5">
              {insights.map((insight, i) => (
                <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                  <span className="text-amber-500 shrink-0 mt-0.5">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Row 1 — days + services */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

          {/* Agendamentos por dia da semana */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-0.5">Por dia da semana</h2>
            <p className="text-xs text-zinc-500 mb-5">Agendamentos não cancelados</p>
            {active.length === 0 ? <EmptyChart /> : (
              <div className="flex items-end gap-2" style={{ height: 96 }}>
                {byDay.map(d => {
                  const barH = Math.max(Math.round((d.count / maxByDay) * 80), d.count > 0 ? 4 : 0)
                  const isBest = d.count > 0 && d.count === maxByDay
                  return (
                    <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-[10px] text-zinc-600 leading-none">{d.count > 0 ? d.count : ''}</span>
                      <div className="w-full flex flex-col justify-end" style={{ height: 80 }}>
                        <div
                          className={cn('w-full rounded-sm transition-all duration-300', isBest ? 'bg-amber-500' : 'bg-amber-500/25')}
                          style={{ height: barH }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-500 leading-none">{d.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Top serviços */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-0.5">Serviços mais solicitados</h2>
            <p className="text-xs text-zinc-500 mb-5">Quantidade e receita gerada</p>
            {topServices.length === 0 ? <EmptyChart /> : (
              <div className="space-y-3.5">
                {topServices.map((s, i) => (
                  <div key={s.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-zinc-300 truncate max-w-[55%]">{s.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500">{s.count}×</span>
                        <span className="text-xs text-green-400 font-medium">{fmtCurrency(s.revenue)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5">
                      <div
                        className={cn('h-1.5 rounded-full transition-all duration-300', i === 0 ? 'bg-amber-500' : 'bg-amber-500/35')}
                        style={{ width: `${(s.count / maxService) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 2 — hours + status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Horários mais movimentados */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-0.5">Horários mais movimentados</h2>
            <p className="text-xs text-zinc-500 mb-5">Das 7h às 21h</p>
            {active.length === 0 ? <EmptyChart /> : (
              <div className="flex items-end gap-1" style={{ height: 96 }}>
                {byHour.map(h => {
                  const barH = Math.max(Math.round((h.count / maxByHour) * 80), h.count > 0 ? 4 : 0)
                  const isBest = h.count > 0 && h.count === maxByHour
                return (
                  <div key={h.label} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col justify-end" style={{ height: 80 }}>
                      <div
                        className={cn('w-full rounded-sm transition-all duration-300', isBest ? 'bg-blue-400' : 'bg-blue-400/20')}
                        style={{ height: barH }}
                      />
                    </div>
                    <span className="text-[9px] text-zinc-600 leading-none">{h.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Status + origem */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-white mb-0.5">Status dos agendamentos</h2>
          <p className="text-xs text-zinc-500 mb-5">Distribuição no período</p>
          {appointments.length === 0 ? <EmptyChart /> : (
            <div className="space-y-2.5">
              {statusBreakdown.map(([status, count]) => {
                const pct = Math.round((count / appointments.length) * 100)
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full border font-medium w-24 text-center shrink-0',
                      STATUS_BADGE_COLOR[status] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    )}>
                      {STATUS_LABELS[status] ?? status}
                    </span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                      <div
                        className={cn('h-1.5 rounded-full transition-all duration-300', STATUS_BAR_COLOR[status] ?? 'bg-zinc-500')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 w-16 text-right shrink-0">{count} ({pct}%)</span>
                  </div>
                )
              })}

              {/* Origem */}
              {Object.keys(sourceMap).length > 0 && (
                <div className="border-t border-zinc-800 pt-3 mt-1">
                  <p className="text-xs text-zinc-500 mb-2">Origem</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(sourceMap).map(([source, count]) => (
                      <span key={source} className="text-xs bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded-lg">
                        {source === 'web' ? '🌐 Book' : source === 'whatsapp' ? '💬 WhatsApp' : '✏️ Manual'} · {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Empty state global */}
      {appointments.length === 0 && !loading && (
        <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-xl p-10 text-center mt-4">
          <BarChart2 size={32} className="text-zinc-700 mx-auto mb-3" />
          <h3 className="text-white font-medium mb-1">Sem dados para o período</h3>
          <p className="text-zinc-500 text-sm">Não há agendamentos nos últimos {PERIOD_LABELS[period]}.</p>
        </div>
      )}

    </div>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  small,
}: {
  icon: LucideIcon
  iconColor: string
  iconBg: string
  label: string
  value: string | number
  small?: boolean
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-4', iconBg)}>
        <Icon size={18} className={iconColor} />
      </div>
      <div className={cn('font-bold text-white mb-1', small ? 'text-lg' : 'text-2xl')}>{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center" style={{ height: 96 }}>
      <p className="text-xs text-zinc-600">Sem dados para o período</p>
    </div>
  )
}
