'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { format, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Search,
  Scissors,
  Users,
  Shield,
  LayoutDashboard,
  LogOut,
  Pencil,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  X,
  TrendingUp,
  Download,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PLANS, trialDaysLeft, isTrialExpired } from '@/lib/plans'
import { updatePlan, toggleActive } from './actions'
import type { AdminBarbershop } from './page'
import type { Plan } from '@/types/database'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  barbershops: AdminBarbershop[]
  adminEmail: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_BADGE: Record<Plan, string> = {
  free:    'bg-zinc-700/50 text-zinc-300 border-zinc-600',
  pro:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  premium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

const MRR_PRO     = 49.9
const MRR_PREMIUM = 89.9

const PIE_COLORS = {
  free:    '#71717a',
  pro:     '#60a5fa',
  premium: '#f59e0b',
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminClient({ barbershops: initial, adminEmail }: Props) {
  const supabase = createClient()
  const router   = useRouter()

  const [barbershops, setBarbershops] = useState(initial)
  const [search, setSearch]           = useState('')
  const [planFilter, setPlanFilter]   = useState<Plan | 'all'>('all')
  const [editTarget, setEditTarget]   = useState<AdminBarbershop | null>(null)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState('')

  // Edit form state
  const [editPlan, setEditPlan]               = useState<Plan>('free')
  const [editTrialEndsAt, setEditTrialEndsAt] = useState('')
  const [editActive, setEditActive]           = useState(true)

  // ── Computed stats ──────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total          = barbershops.length
    const trials         = barbershops.filter(b => b.plan === 'free' && !isTrialExpired(b)).length
    const expired        = barbershops.filter(b => isTrialExpired(b)).length
    const paid           = barbershops.filter(b => b.plan !== 'free').length
    const proCount       = barbershops.filter(b => b.plan === 'pro').length
    const premiumCount   = barbershops.filter(b => b.plan === 'premium').length
    const mrr            = proCount * MRR_PRO + premiumCount * MRR_PREMIUM
    const arr            = mrr * 12
    const expiringTrials = barbershops.filter(b => {
      if (b.plan !== 'free' || isTrialExpired(b)) return false
      return trialDaysLeft(b) <= 7
    }).length
    return { total, trials, expired, paid, mrr, arr, expiringTrials }
  }, [barbershops])

  // ── Growth chart data (last 12 months) ──────────────────────────────────

  const growthData = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(now, 11 - i)
      return {
        month: format(d, 'MMM', { locale: ptBR }),
        key:   format(d, 'yyyy-MM'),
        count: 0,
      }
    })
    barbershops.forEach(b => {
      const key = b.created_at.slice(0, 7)
      const m = months.find(m => m.key === key)
      if (m) m.count++
    })
    return months
  }, [barbershops])

  // ── Plan mix chart data ──────────────────────────────────────────────────

  const planMixData = useMemo(() => {
    const counts = { free: 0, pro: 0, premium: 0 }
    barbershops.forEach(b => { counts[b.plan]++ })
    return [
      { name: 'Free',    value: counts.free,    color: PIE_COLORS.free },
      { name: 'Pro',     value: counts.pro,     color: PIE_COLORS.pro },
      { name: 'Premium', value: counts.premium, color: PIE_COLORS.premium },
    ].filter(d => d.value > 0)
  }, [barbershops])

  // ── Filtered list ───────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return barbershops.filter(b => {
      const matchSearch =
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.owner_email.toLowerCase().includes(search.toLowerCase()) ||
        b.slug.toLowerCase().includes(search.toLowerCase())
      const matchPlan = planFilter === 'all' || b.plan === planFilter
      return matchSearch && matchPlan
    })
  }, [barbershops, search, planFilter])

  // ── Handlers ────────────────────────────────────────────────────────────

  function openEdit(b: AdminBarbershop) {
    setEditTarget(b)
    setEditPlan(b.plan)
    setEditTrialEndsAt(b.trial_ends_at.slice(0, 10))
    setEditActive(b.is_active)
    setSaveError('')
  }

  async function handleSave() {
    if (!editTarget) return
    setSaving(true)
    setSaveError('')

    const trialIso = new Date(editTrialEndsAt + 'T23:59:59').toISOString()
    const { error } = await updatePlan(editTarget.id, editPlan, trialIso)
    if (error) { setSaveError(error); setSaving(false); return }

    if (editActive !== editTarget.is_active) {
      const { error: e2 } = await toggleActive(editTarget.id, editActive)
      if (e2) { setSaveError(e2); setSaving(false); return }
    }

    setBarbershops(prev => prev.map(b =>
      b.id === editTarget.id
        ? { ...b, plan: editPlan, trial_ends_at: trialIso, is_active: editActive }
        : b
    ))
    setEditTarget(null)
    setSaving(false)
  }

  async function handleToggleActive(b: AdminBarbershop) {
    const next = !b.is_active
    setBarbershops(prev => prev.map(x => x.id === b.id ? { ...x, is_active: next } : x))
    const { error } = await toggleActive(b.id, next)
    if (error) {
      setBarbershops(prev => prev.map(x => x.id === b.id ? { ...x, is_active: b.is_active } : x))
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function exportCSV() {
    const bom    = '\ufeff'
    const header = 'Nome;Slug;Email;Plano;Trial até;Ativa;Criada em'
    const rows   = filtered.map(b => [
      b.name,
      b.slug,
      b.owner_email,
      PLANS[b.plan].label,
      b.trial_ends_at.slice(0, 10),
      b.is_active ? 'Sim' : 'Não',
      b.created_at.slice(0, 10),
    ].join(';'))
    const csv  = bom + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `barberos_${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950">

      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-zinc-900 border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <Scissors size={15} className="text-black" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white">BarberOS</span>
              <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                <Shield size={10} /> Admin
              </span>
            </div>
            <p className="text-xs text-zinc-500 leading-none">{adminEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <LayoutDashboard size={13} /> Dashboard
          </a>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 bg-zinc-800 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
          >
            <LogOut size={13} /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Gestão de usuários</h1>
          <p className="text-zinc-400 text-sm mt-1">Gerenciamento de planos e acessos da plataforma</p>
        </div>

        {/* Stats — 6 cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <StatCard icon={Scissors}      iconBg="bg-zinc-700/50"    iconColor="text-zinc-300"
            label="Total de barbearias"   value={stats.total} />
          <StatCard icon={Clock}         iconBg="bg-yellow-500/10"  iconColor="text-yellow-400"
            label="Em período de teste"   value={stats.trials} />
          <StatCard icon={AlertTriangle} iconBg="bg-red-500/10"     iconColor="text-red-400"
            label="Teste expirado"        value={stats.expired} />
          <StatCard icon={Users}         iconBg="bg-green-500/10"   iconColor="text-green-400"
            label="Planos pagos"          value={stats.paid} />
          <StatCard icon={TrendingUp}    iconBg="bg-blue-500/10"    iconColor="text-blue-400"
            label="MRR"                   value={stats.mrr}
            displayValue={`R$ ${stats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
          <StatCard icon={TrendingUp}    iconBg="bg-purple-500/10"  iconColor="text-purple-400"
            label="ARR"                   value={stats.arr}
            displayValue={`R$ ${stats.arr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
        </div>

        {/* Expiring trials alert */}
        {stats.expiringTrials > 0 && (
          <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 mb-6 text-sm text-orange-300">
            <AlertTriangle size={15} className="shrink-0" />
            <span>
              <strong>{stats.expiringTrials}</strong> barbearia{stats.expiringTrials !== 1 ? 's' : ''} com trial expirando em até 7 dias
            </span>
          </div>
        )}

        {/* Charts section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">

          {/* Growth by month */}
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Novas barbearias por mês</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={growthData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <Tooltip content={<GrowthTooltip />} />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Plan mix */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Distribuição de planos</h2>
            {planMixData.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-zinc-600 text-sm">Sem dados</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={planMixData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {planMixData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                      labelStyle={{ color: '#fff' }}
                      itemStyle={{ color: '#a1a1aa' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {planMixData.map(d => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Filters + CSV export */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou slug…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-1">
              {(['all', 'free', 'pro', 'premium'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPlanFilter(p)}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-lg transition-all capitalize',
                    planFilter === p ? 'bg-amber-500 text-black font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  {p === 'all' ? 'Todos' : PLANS[p as Plan].label}
                </button>
              ))}
            </div>
            <button
              onClick={exportCSV}
              title="Exportar CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl transition-colors"
            >
              <Download size={13} /> CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">

              {/* Header */}
              <div className="grid grid-cols-[1fr_180px_100px_130px_70px_60px] gap-3 px-5 py-3 border-b border-zinc-800 bg-zinc-800/30">
                <span className="text-xs font-medium text-zinc-500">Barbearia</span>
                <span className="text-xs font-medium text-zinc-500">E-mail do dono</span>
                <span className="text-xs font-medium text-zinc-500">Plano</span>
                <span className="text-xs font-medium text-zinc-500">Status trial</span>
                <span className="text-xs font-medium text-zinc-500 text-center">Ativa</span>
                <span className="text-xs font-medium text-zinc-500 text-center">Ação</span>
              </div>

              {/* Rows */}
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center text-zinc-500 text-sm">Nenhuma barbearia encontrada.</div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {filtered.map(b => {
                    const expired  = isTrialExpired(b)
                    const daysLeft = b.plan === 'free' && !expired ? trialDaysLeft(b) : null

                    return (
                      <div key={b.id} className="grid grid-cols-[1fr_180px_100px_130px_70px_60px] gap-3 px-5 py-3.5 hover:bg-zinc-800/20 transition-colors items-center">

                        {/* Nome + slug */}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{b.name}</p>
                          <p className="text-xs text-zinc-600 truncate">/book/{b.slug}</p>
                        </div>

                        {/* E-mail */}
                        <p className="text-xs text-zinc-400 truncate">{b.owner_email}</p>

                        {/* Plano */}
                        <span className={cn(
                          'text-xs px-2.5 py-1 rounded-full border font-medium w-fit',
                          PLAN_BADGE[b.plan]
                        )}>
                          {PLANS[b.plan].label}
                        </span>

                        {/* Trial status */}
                        <div>
                          {b.plan !== 'free' ? (
                            <span className="text-xs text-zinc-600">—</span>
                          ) : expired ? (
                            <span className="flex items-center gap-1 text-xs text-red-400">
                              <XCircle size={12} /> Expirado
                            </span>
                          ) : daysLeft !== null ? (
                            <span className={cn(
                              'flex items-center gap-1 text-xs',
                              daysLeft <= 7 ? 'text-orange-400' : 'text-yellow-400'
                            )}>
                              <Clock size={12} />
                              {daysLeft} dia{daysLeft !== 1 ? 's' : ''} restante{daysLeft !== 1 ? 's' : ''}
                            </span>
                          ) : null}
                        </div>

                        {/* Toggle ativa */}
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleToggleActive(b)}
                            title={b.is_active ? 'Desativar' : 'Ativar'}
                            className="transition-colors"
                          >
                            {b.is_active
                              ? <CheckCircle2 size={18} className="text-green-400 hover:text-green-300" />
                              : <XCircle size={18} className="text-red-400 hover:text-red-300" />
                            }
                          </button>
                        </div>

                        {/* Editar */}
                        <div className="flex justify-center">
                          <button
                            onClick={() => openEdit(b)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Footer count */}
              <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-800/20">
                <p className="text-xs text-zinc-600">
                  {filtered.length === barbershops.length
                    ? `${barbershops.length} barbearia${barbershops.length !== 1 ? 's' : ''}`
                    : `${filtered.length} de ${barbershops.length} barbearias`
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditTarget(null)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">

            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-white">{editTarget.name}</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{editTarget.owner_email}</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="text-zinc-500 hover:text-zinc-200 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">

              {/* Plano */}
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-2">Plano</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['free', 'pro', 'premium'] as Plan[]).map(p => (
                    <button
                      key={p}
                      onClick={() => setEditPlan(p)}
                      className={cn(
                        'py-2.5 rounded-xl border text-xs font-medium transition-all',
                        editPlan === p
                          ? 'bg-amber-500 border-amber-500 text-black'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                      )}
                    >
                      <div>{PLANS[p].label}</div>
                      <div className="text-[10px] opacity-70 mt-0.5">{PLANS[p].price}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Trial ends at */}
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-2">
                  Fim do período de teste
                  {editPlan !== 'free' && <span className="text-zinc-600 ml-1">(irrelevante para planos pagos)</span>}
                </label>
                <input
                  type="date"
                  value={editTrialEndsAt}
                  onChange={e => setEditTrialEndsAt(e.target.value)}
                  disabled={editPlan !== 'free'}
                  className={cn(
                    'input-base text-sm',
                    editPlan !== 'free' && 'opacity-40 cursor-not-allowed'
                  )}
                />
              </div>

              {/* Ativa */}
              <div className="flex items-center justify-between py-3 border-t border-zinc-800">
                <div>
                  <p className="text-sm text-white font-medium">Barbearia ativa</p>
                  <p className="text-xs text-zinc-500">Inativa bloqueia acesso ao sistema</p>
                </div>
                <button
                  onClick={() => setEditActive(!editActive)}
                  className={cn(
                    'w-11 h-6 rounded-full transition-colors relative',
                    editActive ? 'bg-amber-500' : 'bg-zinc-700'
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                    editActive ? 'translate-x-5' : 'translate-x-0'
                  )} />
                </button>
              </div>

              {saveError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{saveError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

import type { LucideIcon } from 'lucide-react'

function StatCard({ icon: Icon, iconBg, iconColor, label, value, displayValue }: {
  icon: LucideIcon
  iconBg: string
  iconColor: string
  label: string
  value: number
  displayValue?: string
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-4', iconBg)}>
        <Icon size={18} className={iconColor} />
      </div>
      <div className="text-2xl font-bold text-white mb-1">{displayValue ?? value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  )
}

// ─── GrowthTooltip ────────────────────────────────────────────────────────────

function GrowthTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-zinc-400 mb-0.5">{label}</p>
      <p className="text-white font-semibold">{payload[0].value} barbearia{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}
