'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Barbershop } from '@/types/database'
import { subDays, subMonths, format, parseISO, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  TrendingUp, TrendingDown,
  Users, CalendarDays, DollarSign, BarChart2, Zap,
  Download, FileText, Receipt, RefreshCcw, Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLANS, isSubscriptionExpired, gracePeriodDaysLeft, GRACE_PERIOD_DAYS } from '@/lib/plans'
import type { LucideIcon } from 'lucide-react'
import type { ReportAppt, PrevAppt } from './page'
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d' | '12m'

interface Props {
  barbershop: Barbershop
  initialAppointments: ReportAppt[]
  initialNewCustomers: number
  initialPeriod: Period
  initialPrevAppointments: PrevAppt[]
  returningCustomers: number
  totalCustomers: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<Period, string> = {
  '7d':  '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  '12m': '12 meses',
}

const DAY_LABELS      = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DAY_LABELS_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const BUSINESS_HOURS  = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

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

function buildTimeline(appts: ReportAppt[], period: Period) {
  const groups = new Map<string, { agendamentos: number; receita: number }>()
  appts.filter(a => a.status !== 'cancelled').forEach(a => {
    const date = parseISO(a.start_time)
    let key: string
    if (period === '7d' || period === '30d') {
      key = format(date, 'dd/MM')
    } else if (period === '90d') {
      key = format(startOfWeek(date, { weekStartsOn: 1 }), 'dd/MM')
    } else {
      key = format(date, 'MMM/yy', { locale: ptBR })
    }
    const curr = groups.get(key) ?? { agendamentos: 0, receita: 0 }
    groups.set(key, {
      agendamentos: curr.agendamentos + 1,
      receita: curr.receita + (a.service_price ?? 0),
    })
  })
  return Array.from(groups.entries()).map(([label, data]) => ({ label, ...data }))
}

function calcDelta(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RelatoriosClient({
  barbershop,
  initialAppointments,
  initialNewCustomers,
  initialPeriod,
  initialPrevAppointments,
  returningCustomers,
  totalCustomers,
}: Props) {
  const supabase = createClient()

  const [period, setPeriod]             = useState<Period>(initialPeriod)
  const [appointments, setAppointments] = useState(initialAppointments)
  const [prevAppts, setPrevAppts]       = useState(initialPrevAppointments)
  const [newCustomers, setNewCustomers] = useState(initialNewCustomers)
  const [loading, setLoading]           = useState(false)
  const [pdfLoading, setPdfLoading]     = useState(false)

  async function handlePeriodChange(p: Period) {
    if (p === period) return
    setPeriod(p)
    setLoading(true)
    const start     = getStartDate(p)
    const duration  = new Date().getTime() - start.getTime()
    const prevStart = new Date(start.getTime() - duration)

    const [{ data: appts }, { count }, { data: prev }] = await Promise.all([
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
      supabase
        .from('appointments_full')
        .select('id, status, service_price')
        .eq('barbershop_id', barbershop.id)
        .gte('start_time', prevStart.toISOString())
        .lt('start_time', start.toISOString()),
    ])
    setAppointments((appts as ReportAppt[]) ?? [])
    setNewCustomers(count ?? 0)
    setPrevAppts((prev as PrevAppt[]) ?? [])
    setLoading(false)
  }

  // ── Computed metrics ──────────────────────────────────────────────────────

  const active    = appointments.filter(a => a.status !== 'cancelled')
  const cancelled = appointments.filter(a => a.status === 'cancelled')
  const completed = appointments.filter(a => a.status === 'completed')

  const totalRevenue     = completed.reduce((s, a) => s + (a.service_price ?? 0), 0)
  const avgTicket        = completed.length > 0 ? totalRevenue / completed.length : 0
  const cancellationRate = appointments.length > 0
    ? Math.round((cancelled.length / appointments.length) * 100)
    : 0
  const returnRate = totalCustomers > 0
    ? Math.round((returningCustomers / totalCustomers) * 100)
    : 0

  // Prev period
  const prevActive    = prevAppts.filter(a => a.status !== 'cancelled')
  const prevCompleted = prevAppts.filter(a => a.status === 'completed')
  const prevRevenue   = prevCompleted.reduce((s, a) => s + (a.service_price ?? 0), 0)
  const prevAvgTicket = prevCompleted.length > 0 ? prevRevenue / prevCompleted.length : 0

  const deltaAppts   = calcDelta(active.length, prevActive.length)
  const deltaRevenue = calcDelta(totalRevenue, prevRevenue)
  const deltaTicket  = calcDelta(avgTicket, prevAvgTicket)

  // By day of week
  const byDay = Array.from({ length: 7 }, (_, i) => ({
    label:     DAY_LABELS[i],
    labelFull: DAY_LABELS_FULL[i],
    count: active.filter(a => new Date(a.start_time).getDay() === i).length,
  }))
  const maxByDay = Math.max(...byDay.map(d => d.count), 1)

  // By hour
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

  // Status breakdown
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

  // Timeline
  const timelineData = buildTimeline(appointments, period)

  // ── Insights ──────────────────────────────────────────────────────────────

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

  // ── Export CSV ────────────────────────────────────────────────────────────

  function exportCSV() {
    const headers = ['Data', 'Horário', 'Cliente', 'Serviço', 'Valor (R$)', 'Status', 'Origem']
    const rows = appointments.map(a => [
      format(parseISO(a.start_time), 'dd/MM/yyyy'),
      format(parseISO(a.start_time), 'HH:mm'),
      a.customer_name ?? '—',
      a.service_name  ?? '—',
      (a.service_price ?? 0).toFixed(2).replace('.', ','),
      STATUS_LABELS[a.status] ?? a.status,
      a.source === 'web' ? 'Book' : a.source === 'whatsapp' ? 'WhatsApp' : 'Manual',
    ])
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `relatorio-${barbershop.name}-${PERIOD_LABELS[period]}.csv`.replace(/\s/g, '-')
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Export PDF ────────────────────────────────────────────────────────────

  async function exportPDF() {
    setPdfLoading(true)
    const { default: jsPDF }     = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc       = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Header
    doc.setFillColor(24, 24, 27)
    doc.rect(0, 0, pageWidth, 42, 'F')
    doc.setTextColor(245, 158, 11)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('BarberOS', 14, 16)
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.text(barbershop.name, 14, 27)
    doc.setTextColor(161, 161, 170)
    doc.setFontSize(8)
    doc.text(
      `Relatório de ${PERIOD_LABELS[period]}  ·  Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`,
      14, 36
    )

    // KPI boxes
    const kpis = [
      { label: 'Agendamentos',         value: String(active.length) },
      { label: 'Receita realizada',    value: fmtCurrency(totalRevenue) },
      { label: 'Ticket médio',         value: avgTicket > 0 ? fmtCurrency(avgTicket) : '—' },
      { label: 'Taxa cancelamento',    value: `${cancellationRate}%` },
    ]
    let y = 52
    const boxW = (pageWidth - 28 - 9) / 4
    kpis.forEach((kpi, i) => {
      const x = 14 + i * (boxW + 3)
      doc.setFillColor(249, 250, 251)
      doc.setDrawColor(228, 228, 231)
      doc.roundedRect(x, y, boxW, 24, 2, 2, 'FD')
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(113, 113, 122)
      doc.setFontSize(7)
      doc.text(kpi.label, x + 3, y + 9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(24, 24, 27)
      doc.setFontSize(10)
      doc.text(kpi.value, x + 3, y + 19)
    })
    y += 34

    // Top services table
    if (topServices.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(24, 24, 27)
      doc.text('Serviços mais solicitados', 14, y)
      y += 2
      autoTable(doc, {
        startY: y,
        head: [['Serviço', 'Quantidade', 'Receita gerada']],
        body: topServices.map(s => [s.name, `${s.count}×`, fmtCurrency(s.revenue)]),
        headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: [39, 39, 42] },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
        margin: { left: 14, right: 14 },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    }

    // Appointments detail table
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(24, 24, 27)
    doc.text('Detalhamento de agendamentos', 14, y)
    y += 2
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Horário', 'Cliente', 'Serviço', 'Valor', 'Status']],
      body: appointments.map(a => [
        format(parseISO(a.start_time), 'dd/MM/yyyy'),
        format(parseISO(a.start_time), 'HH:mm'),
        a.customer_name ?? '—',
        a.service_name  ?? '—',
        a.service_price != null ? fmtCurrency(a.service_price) : '—',
        STATUS_LABELS[a.status] ?? a.status,
      ]),
      headStyles: { fillColor: [39, 39, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [39, 39, 42] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: { 4: { halign: 'right' } },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        const ph = doc.internal.pageSize.getHeight()
        doc.setFontSize(7)
        doc.setTextColor(161, 161, 170)
        doc.text('Gerado por BarberOS', 14, ph - 8)
        doc.text(
          `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`,
          pageWidth - 14, ph - 8, { align: 'right' }
        )
      },
    })

    doc.save(`relatorio-${barbershop.name}-${PERIOD_LABELS[period]}.pdf`.replace(/\s/g, '-'))
    setPdfLoading(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const subExpired = isSubscriptionExpired(barbershop)
  const graceDays  = gracePeriodDaysLeft(barbershop)

  if (subExpired) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Relatórios</h1>
          <p className="text-zinc-400 text-sm mt-1">Análise de desempenho da {barbershop.name}</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-5 bg-zinc-900 border border-zinc-800 rounded-2xl py-20 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center">
            <Lock size={24} className="text-zinc-500" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg mb-1">Relatórios suspensos</p>
            {graceDays > 0 ? (
              <p className="text-orange-400 text-sm max-w-sm">
                Você tem <strong>{graceDays} dia{graceDays !== 1 ? 's' : ''}</strong> para regularizar antes de perder acesso completo à plataforma.
              </p>
            ) : (
              <p className="text-zinc-500 text-sm max-w-sm">
                Sua assinatura expirou e o período de carência de {GRACE_PERIOD_DAYS} dias foi encerrado.
              </p>
            )}
          </div>
          <a
            href="/dashboard/planos"
            className="text-sm bg-amber-500 hover:bg-amber-400 text-black font-semibold px-6 py-2.5 rounded-xl transition-colors"
          >
            Renovar assinatura
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Relatórios</h1>
          <p className="text-zinc-400 text-sm mt-1">Análise de desempenho da {barbershop.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-1">
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
          {/* Export buttons */}
          <button
            onClick={exportCSV}
            disabled={loading || appointments.length === 0}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-sm font-medium px-3 py-2 rounded-xl transition-colors"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={exportPDF}
            disabled={loading || pdfLoading || appointments.length === 0}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-sm font-medium px-3 py-2 rounded-xl transition-colors"
          >
            <FileText size={14} /> {pdfLoading ? 'Gerando…' : 'PDF'}
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-center text-zinc-500 text-sm mb-4 animate-pulse">Carregando dados…</p>
      )}

      {/* 6 KPI cards — 3 por linha */}
      <div className={cn('grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6', loading && 'opacity-50 pointer-events-none')}>
        <StatCard icon={CalendarDays} iconColor="text-amber-500"  iconBg="bg-amber-500/10"
          label="Agendamentos"       value={active.length}                              delta={deltaAppts} />
        <StatCard icon={DollarSign}   iconColor="text-green-400"  iconBg="bg-green-500/10"
          label="Receita realizada"  value={fmtCurrency(totalRevenue)}    small          delta={deltaRevenue} />
        <StatCard icon={Receipt}      iconColor="text-blue-400"   iconBg="bg-blue-500/10"
          label="Ticket médio"       value={avgTicket > 0 ? fmtCurrency(avgTicket) : '—'} small delta={deltaTicket} />
        <StatCard icon={Users}        iconColor="text-purple-400" iconBg="bg-purple-500/10"
          label="Clientes novos"     value={newCustomers} />
        <StatCard icon={TrendingUp}   iconColor="text-red-400"    iconBg="bg-red-500/10"
          label="Taxa cancelamento"  value={`${cancellationRate}%`} />
        <StatCard icon={RefreshCcw}   iconColor="text-teal-400"   iconBg="bg-teal-500/10"
          label="Clientes recorrentes" value={`${returnRate}%`} />
      </div>

      {/* Premium block — insights + charts */}
      <div className={cn('relative', loading && 'opacity-50 pointer-events-none')}>

        {/* Pro overlay */}
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

        {/* Timeline chart */}
        {timelineData.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
            <h2 className="text-sm font-medium text-white mb-0.5">Evolução no período</h2>
            <p className="text-xs text-zinc-500 mb-5">
              {period === '90d' ? 'Por semana' : period === '12m' ? 'Por mês' : 'Por dia'}
              {' · '}agendamentos (barras) e receita realizada (linha)
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={timelineData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip content={<TimelineTooltip />} />
                <Bar
                  yAxisId="left"
                  dataKey="agendamentos"
                  name="Agendamentos"
                  fill="#f59e0b"
                  fillOpacity={0.8}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="receita"
                  name="Receita"
                  stroke="#4ade80"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3 justify-end">
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="inline-block w-3 h-3 rounded-sm bg-amber-500/80" /> Agendamentos
              </span>
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="inline-block w-4 h-0.5 bg-green-400" /> Receita
              </span>
            </div>
          </div>
        )}

        {/* Row 1 — days + services */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-0.5">Por dia da semana</h2>
            <p className="text-xs text-zinc-500 mb-5">Agendamentos não cancelados</p>
            {active.length === 0 ? <EmptyChart /> : (
              <div className="flex items-end gap-2" style={{ height: 96 }}>
                {byDay.map(d => {
                  const barH  = Math.max(Math.round((d.count / maxByDay) * 80), d.count > 0 ? 4 : 0)
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

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-0.5">Horários mais movimentados</h2>
            <p className="text-xs text-zinc-500 mb-5">Das 7h às 21h</p>
            {active.length === 0 ? <EmptyChart /> : (
              <div className="flex items-end gap-1" style={{ height: 96 }}>
                {byHour.map(h => {
                  const barH  = Math.max(Math.round((h.count / maxByHour) * 80), h.count > 0 ? 4 : 0)
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

      {/* Empty state */}
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
  icon: Icon, iconColor, iconBg, label, value, small, delta,
}: {
  icon: LucideIcon
  iconColor: string
  iconBg: string
  label: string
  value: string | number
  small?: boolean
  delta?: number | null
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', iconBg)}>
        <Icon size={18} className={iconColor} />
      </div>
      <div className={cn('font-bold text-white mb-1', small ? 'text-lg' : 'text-2xl')}>{value}</div>
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      {delta !== null && delta !== undefined && (
        <div className={cn('flex items-center gap-1 text-xs', delta >= 0 ? 'text-green-400' : 'text-red-400')}>
          {delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {delta >= 0 ? '+' : ''}{delta}% vs período anterior
        </div>
      )}
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

function TimelineTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-zinc-400 text-xs mb-1.5 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-medium" style={{ color: p.color }}>
          {p.name}: {p.name === 'Receita'
            ? p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : p.value}
        </p>
      ))}
    </div>
  )
}
