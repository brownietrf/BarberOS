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
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Timer,
  Lock,
  Gift,
  ArrowRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  PLANS, BILLING_PERIODS, trialDaysLeft, isTrialExpired,
  isSubscriptionExpired, subscriptionDaysLeft, isGracePeriod,
  isFullyLocked, gracePeriodDaysLeft, GRACE_PERIOD_DAYS,
} from '@/lib/plans'
import type { SubscriptionPeriod } from '@/types/database'
import { updatePlan, toggleActive, grantReferralBonus } from './actions'
import type { AdminBarbershop, AdminReferral } from './page'
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
  referrals: AdminReferral[]
}

type SortKey = 'name' | 'plan' | 'subscription' | 'created_at'
type SortDir = 'asc' | 'desc'
type SubFilter = 'all' | 'active' | 'expiring' | 'grace' | 'locked' | 'expired'

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

export function AdminClient({ barbershops: initial, adminEmail, referrals: initialReferrals }: Props) {
  const supabase = createClient()
  const router   = useRouter()

  const [barbershops, setBarbershops] = useState(initial)
  const [search, setSearch]           = useState('')
  const [planFilter, setPlanFilter]   = useState<Plan | 'all'>('all')
  const [subFilter, setSubFilter]     = useState<SubFilter>('all')
  const [editTarget, setEditTarget]   = useState<AdminBarbershop | null>(null)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState('')
  const [sortKey, setSortKey]         = useState<SortKey>('created_at')
  const [sortDir, setSortDir]         = useState<SortDir>('desc')

  // Edit form state
  const [editPlan, setEditPlan]                         = useState<Plan>('free')
  const [editTrialEndsAt, setEditTrialEndsAt]           = useState('')
  const [editActive, setEditActive]                     = useState(true)
  const [editSubEndsAt, setEditSubEndsAt]               = useState('')
  const [editSubPeriod, setEditSubPeriod]               = useState<SubscriptionPeriod | ''>('')
  const [editGraceDays, setEditGraceDays]               = useState<string>('')

  // Referrals state
  const [referrals, setReferrals]                       = useState(initialReferrals)
  const [bonusTarget, setBonusTarget]                   = useState<AdminReferral | null>(null)
  const [bonusType, setBonusType]                       = useState<'free_month' | 'plan_upgrade'>('free_month')
  const [bonusUpgradePlan, setBonusUpgradePlan]         = useState<'pro' | 'premium'>('pro')
  const [bonusSaving, setBonusSaving]                   = useState(false)
  const [bonusError, setBonusError]                     = useState('')

  // ── Computed stats ──────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total            = barbershops.length
    const trials           = barbershops.filter(b => b.plan === 'free' && !isTrialExpired(b)).length
    const expired          = barbershops.filter(b => isTrialExpired(b)).length
    const paid             = barbershops.filter(b => b.plan !== 'free').length
    const proCount         = barbershops.filter(b => b.plan === 'pro').length
    const premiumCount     = barbershops.filter(b => b.plan === 'premium').length
    const mrr              = proCount * MRR_PRO + premiumCount * MRR_PREMIUM
    const arr              = mrr * 12
    const expiringTrials   = barbershops.filter(b => b.plan === 'free' && !isTrialExpired(b) && trialDaysLeft(b) <= 7).length
    const expiringSub      = barbershops.filter(b => {
      if (b.plan === 'free' || !b.subscription_ends_at) return false
      const d = subscriptionDaysLeft(b)
      return d > 0 && d <= 7
    }).length
    const inGrace          = barbershops.filter(b => isGracePeriod(b)).length
    const fullyLocked      = barbershops.filter(b => isFullyLocked(b)).length
    return { total, trials, expired, paid, mrr, arr, expiringTrials, expiringSub, inGrace, fullyLocked }
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

  // ── Filtered + sorted list ───────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = barbershops.filter(b => {
      const matchSearch =
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.owner_email.toLowerCase().includes(search.toLowerCase()) ||
        b.slug.toLowerCase().includes(search.toLowerCase())
      const matchPlan = planFilter === 'all' || b.plan === planFilter

      let matchSub = true
      if (subFilter !== 'all') {
        if (subFilter === 'active') {
          matchSub = b.plan !== 'free' && !isSubscriptionExpired(b)
        } else if (subFilter === 'expiring') {
          const d = b.plan !== 'free' ? subscriptionDaysLeft(b) : -1
          matchSub = d > 0 && d <= 7
        } else if (subFilter === 'grace') {
          matchSub = isGracePeriod(b)
        } else if (subFilter === 'locked') {
          matchSub = isFullyLocked(b)
        } else if (subFilter === 'expired') {
          matchSub = isSubscriptionExpired(b)
        }
      }

      return matchSearch && matchPlan && matchSub
    })

    list = [...list].sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''

      if (sortKey === 'name') {
        va = a.name.toLowerCase()
        vb = b.name.toLowerCase()
      } else if (sortKey === 'plan') {
        const order: Record<Plan, number> = { free: 0, pro: 1, premium: 2 }
        va = order[a.plan]
        vb = order[b.plan]
      } else if (sortKey === 'subscription') {
        va = a.subscription_ends_at ?? ''
        vb = b.subscription_ends_at ?? ''
      } else if (sortKey === 'created_at') {
        va = a.created_at
        vb = b.created_at
      }

      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [barbershops, search, planFilter, subFilter, sortKey, sortDir])

  // ── Handlers ────────────────────────────────────────────────────────────

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function openEdit(b: AdminBarbershop) {
    setEditTarget(b)
    setEditPlan(b.plan)
    setEditTrialEndsAt(b.trial_ends_at.slice(0, 10))
    setEditActive(b.is_active)
    setEditSubEndsAt(b.subscription_ends_at ? b.subscription_ends_at.slice(0, 10) : '')
    setEditSubPeriod((b.subscription_period as SubscriptionPeriod | '') ?? '')
    setEditGraceDays(b.grace_period_days != null ? String(b.grace_period_days) : '')
    setSaveError('')
  }

  async function handleSave() {
    if (!editTarget) return
    setSaving(true)
    setSaveError('')

    const trialIso    = new Date(editTrialEndsAt + 'T23:59:59').toISOString()
    const subEndIso   = editSubEndsAt ? new Date(editSubEndsAt + 'T23:59:59').toISOString() : null
    const graceDaysN  = editGraceDays !== '' ? Number(editGraceDays) : null
    if (graceDaysN !== null && (isNaN(graceDaysN) || graceDaysN < 0 || graceDaysN > 365)) {
      setSaveError('Carência deve ser entre 0 e 365 dias.')
      setSaving(false)
      return
    }

    const { error } = await updatePlan(
      editTarget.id, editPlan, trialIso,
      subEndIso,
      editSubPeriod || null,
      graceDaysN,
    )
    if (error) { setSaveError(error); setSaving(false); return }

    if (editActive !== editTarget.is_active) {
      const { error: e2 } = await toggleActive(editTarget.id, editActive)
      if (e2) { setSaveError(e2); setSaving(false); return }
    }

    setBarbershops(prev => prev.map(b =>
      b.id === editTarget.id
        ? {
            ...b,
            plan: editPlan,
            trial_ends_at: trialIso,
            is_active: editActive,
            subscription_ends_at: subEndIso,
            subscription_period: (editSubPeriod || null) as SubscriptionPeriod | null,
            grace_period_days: graceDaysN,
          }
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

  async function handleGrantBonus() {
    if (!bonusTarget) return
    setBonusSaving(true)
    setBonusError('')
    const { error } = await grantReferralBonus(
      bonusTarget.id,
      bonusTarget.referrer_barbershop_id!,
      bonusType,
      bonusType === 'plan_upgrade' ? bonusUpgradePlan : undefined,
    )
    if (error) { setBonusError(error); setBonusSaving(false); return }
    setReferrals(prev => prev.map(r =>
      r.id === bonusTarget.id
        ? { ...r, status: 'rewarded', reward_granted_at: new Date().toISOString() }
        : r
    ))
    setBonusTarget(null)
    setBonusSaving(false)
  }

  function exportCSV() {
    const bom    = '\ufeff'
    const header = 'Nome;Slug;Email;Plano;Trial até;Assinatura até;Período;Carência (dias);Ativa;Criada em'
    const rows   = filtered.map(b => [
      b.name,
      b.slug,
      b.owner_email,
      PLANS[b.plan].label,
      b.trial_ends_at.slice(0, 10),
      b.subscription_ends_at ? b.subscription_ends_at.slice(0, 10) : '',
      b.subscription_period ? BILLING_PERIODS[b.subscription_period as SubscriptionPeriod].label : '',
      b.grace_period_days != null ? String(b.grace_period_days) : String(GRACE_PERIOD_DAYS),
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

        {/* Stats — 8 cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard icon={Scissors}      iconBg="bg-zinc-700/50"    iconColor="text-zinc-300"
            label="Total de barbearias" value={stats.total} />
          <StatCard icon={Clock}         iconBg="bg-yellow-500/10"  iconColor="text-yellow-400"
            label="Em trial"            value={stats.trials} />
          <StatCard icon={Users}         iconBg="bg-green-500/10"   iconColor="text-green-400"
            label="Planos pagos"        value={stats.paid} />
          <StatCard icon={AlertTriangle} iconBg="bg-red-500/10"     iconColor="text-red-400"
            label="Trial expirado"      value={stats.expired} />
          <StatCard icon={TrendingUp}    iconBg="bg-blue-500/10"    iconColor="text-blue-400"
            label="MRR"                 value={stats.mrr}
            displayValue={`R$ ${stats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
          <StatCard icon={TrendingUp}    iconBg="bg-purple-500/10"  iconColor="text-purple-400"
            label="ARR"                 value={stats.arr}
            displayValue={`R$ ${stats.arr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
          <StatCard icon={Timer}         iconBg="bg-orange-500/10"  iconColor="text-orange-400"
            label="Em carência"         value={stats.inGrace} />
          <StatCard icon={Lock}          iconBg="bg-red-500/10"     iconColor="text-red-400"
            label="Bloqueados"          value={stats.fullyLocked} />
        </div>

        {/* Alert banners */}
        <div className="space-y-2 mb-6">
          {stats.expiringTrials > 0 && (
            <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 text-sm text-orange-300">
              <AlertTriangle size={15} className="shrink-0" />
              <span>
                <strong>{stats.expiringTrials}</strong> barbearia{stats.expiringTrials !== 1 ? 's' : ''} com trial expirando em até 7 dias
              </span>
            </div>
          )}
          {stats.expiringSub > 0 && (
            <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm text-yellow-300">
              <Clock size={15} className="shrink-0" />
              <span>
                <strong>{stats.expiringSub}</strong> assinatura{stats.expiringSub !== 1 ? 's' : ''} expirando em até 7 dias
              </span>
            </div>
          )}
          {stats.inGrace > 0 && (
            <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 text-sm text-orange-300">
              <Timer size={15} className="shrink-0" />
              <span>
                <strong>{stats.inGrace}</strong> barbearia{stats.inGrace !== 1 ? 's' : ''} em período de carência — acesso parcial ativo
              </span>
            </div>
          )}
          {stats.fullyLocked > 0 && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
              <Lock size={15} className="shrink-0" />
              <span>
                <strong>{stats.fullyLocked}</strong> barbearia{stats.fullyLocked !== 1 ? 's' : ''} com acesso <strong>completamente bloqueado</strong>
              </span>
            </div>
          )}
        </div>

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

        {/* Referrals section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Gift size={16} className="text-amber-400" /> Indicações
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {referrals.length} indicaç{referrals.length !== 1 ? 'ões' : 'ão'} registrada{referrals.length !== 1 ? 's' : ''} —&nbsp;
                {referrals.filter(r => r.status === 'qualified').length} qualificada{referrals.filter(r => r.status === 'qualified').length !== 1 ? 's' : ''} aguardando bônus
              </p>
            </div>
          </div>

          {referrals.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-8 text-center text-zinc-500 text-sm">
              Nenhuma indicação registrada ainda.
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  {/* Header */}
                  <div className="grid grid-cols-[1fr_1fr_90px_110px_110px_80px] gap-3 px-5 py-3 border-b border-zinc-800 bg-zinc-800/30">
                    <span className="text-xs font-medium text-zinc-500">Indicador</span>
                    <span className="text-xs font-medium text-zinc-500">Indicado</span>
                    <span className="text-xs font-medium text-zinc-500">Plano</span>
                    <span className="text-xs font-medium text-zinc-500">Status</span>
                    <span className="text-xs font-medium text-zinc-500">Data</span>
                    <span className="text-xs font-medium text-zinc-500 text-center">Bônus</span>
                  </div>
                  {/* Rows */}
                  <div className="divide-y divide-zinc-800">
                    {referrals.map(r => (
                      <div key={r.id} className="grid grid-cols-[1fr_1fr_90px_110px_110px_80px] gap-3 px-5 py-3.5 hover:bg-zinc-800/20 transition-colors items-center">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm text-white truncate">{r.referrer_name}</p>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <ArrowRight size={12} className="text-zinc-600 shrink-0" />
                          <p className="text-sm text-zinc-300 truncate">{r.referred_name}</p>
                        </div>
                        <span className={cn(
                          'text-xs px-2 py-1 rounded-full border font-medium w-fit',
                          PLAN_BADGE[r.referred_plan]
                        )}>
                          {PLANS[r.referred_plan].label}
                        </span>
                        <div>
                          {r.status === 'pending' && (
                            <span className="flex items-center gap-1 text-xs text-yellow-400">
                              <Clock size={11} /> Pendente
                            </span>
                          )}
                          {r.status === 'qualified' && (
                            <span className="flex items-center gap-1 text-xs text-blue-400">
                              <CheckCircle2 size={11} /> Qualificada
                            </span>
                          )}
                          {r.status === 'rewarded' && (
                            <span className="flex items-center gap-1 text-xs text-green-400">
                              <Gift size={11} /> Bonificada
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500">
                          {new Date(r.created_at).toLocaleDateString('pt-BR')}
                        </p>
                        <div className="flex justify-center">
                          {r.status === 'qualified' ? (
                            <button
                              onClick={() => {
                                setBonusTarget(r)
                                setBonusType('free_month')
                                setBonusUpgradePlan(r.referred_plan === 'premium' ? 'premium' : 'pro')
                                setBonusError('')
                              }}
                              className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              <Gift size={11} /> Dar
                            </button>
                          ) : r.status === 'rewarded' ? (
                            <span className="text-xs text-zinc-600" title={r.reward_granted_at ? new Date(r.reward_granted_at).toLocaleDateString('pt-BR') : ''}>
                              ✓
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-700">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
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
          <div className="flex flex-wrap gap-2">
            {/* Plan filter */}
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
            {/* Sub status filter */}
            <select
              value={subFilter}
              onChange={e => setSubFilter(e.target.value as SubFilter)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:border-amber-500 focus:outline-none"
            >
              <option value="all">Todos os status</option>
              <option value="active">Assinatura ativa</option>
              <option value="expiring">Expirando (7 dias)</option>
              <option value="grace">Em carência</option>
              <option value="locked">Bloqueados</option>
              <option value="expired">Expirado</option>
            </select>
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
            <div className="min-w-[760px]">

              {/* Header */}
              <div className="grid grid-cols-[1fr_160px_100px_140px_160px_70px_60px] gap-3 px-5 py-3 border-b border-zinc-800 bg-zinc-800/30">
                <SortHeader label="Barbearia"   sortKey="name"         current={sortKey} dir={sortDir} onSort={toggleSort} />
                <span className="text-xs font-medium text-zinc-500">E-mail do dono</span>
                <SortHeader label="Plano"       sortKey="plan"         current={sortKey} dir={sortDir} onSort={toggleSort} />
                <span className="text-xs font-medium text-zinc-500">Status trial</span>
                <SortHeader label="Assinatura"  sortKey="subscription" current={sortKey} dir={sortDir} onSort={toggleSort} />
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
                    const inGrace  = isGracePeriod(b)
                    const locked   = isFullyLocked(b)
                    const graceDays = gracePeriodDaysLeft(b)

                    return (
                      <div key={b.id} className="grid grid-cols-[1fr_160px_100px_140px_160px_70px_60px] gap-3 px-5 py-3.5 hover:bg-zinc-800/20 transition-colors items-center">

                        {/* Nome + slug */}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{b.name}</p>
                          <a
                            href={`/book/${b.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-zinc-600 hover:text-zinc-400 truncate transition-colors"
                          >
                            /book/{b.slug}
                          </a>
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
                              {daysLeft} dia{daysLeft !== 1 ? 's' : ''}
                            </span>
                          ) : null}
                        </div>

                        {/* Subscription status */}
                        <div>
                          {b.plan === 'free' ? (
                            <span className="text-xs text-zinc-600">—</span>
                          ) : locked ? (
                            <span className="flex items-center gap-1 text-xs text-red-400">
                              <Lock size={12} /> Bloqueado
                            </span>
                          ) : inGrace ? (
                            <span className="flex items-center gap-1 text-xs text-orange-400">
                              <Timer size={12} /> Carência ({graceDays}d)
                            </span>
                          ) : !b.subscription_ends_at ? (
                            <span className="text-xs text-zinc-600">Sem data</span>
                          ) : isSubscriptionExpired(b) ? (
                            <span className="flex items-center gap-1 text-xs text-red-400">
                              <XCircle size={12} /> Expirada
                            </span>
                          ) : (() => {
                            const d = subscriptionDaysLeft(b)
                            return (
                              <div>
                                <span className={cn('flex items-center gap-1 text-xs', d <= 7 ? 'text-orange-400' : 'text-green-400')}>
                                  <Clock size={12} />
                                  {d} dia{d !== 1 ? 's' : ''}
                                </span>
                                <p className="text-[10px] text-zinc-600 mt-0.5">
                                  {new Date(b.subscription_ends_at!).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                            )
                          })()}
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
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl overflow-y-auto max-h-[90vh]">

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

              {/* Subscription period + end date */}
              {editPlan !== 'free' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-zinc-400 block mb-2">Período de assinatura</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(BILLING_PERIODS) as SubscriptionPeriod[]).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setEditSubPeriod(p)}
                          className={cn(
                            'py-2 px-3 rounded-xl border text-xs font-medium transition-all text-left',
                            editSubPeriod === p
                              ? 'bg-amber-500 border-amber-500 text-black'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                          )}
                        >
                          <div>{BILLING_PERIODS[p].label}</div>
                          {BILLING_PERIODS[p].discount > 0 && (
                            <div className="text-[10px] opacity-70 mt-0.5">{BILLING_PERIODS[p].discount}% off</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400 block mb-2">Assinatura válida até</label>
                    <input
                      type="date"
                      value={editSubEndsAt}
                      onChange={e => setEditSubEndsAt(e.target.value)}
                      className="input-base text-sm"
                    />
                    <p className="text-xs text-zinc-600 mt-1">Deixe vazio se não tiver data definida.</p>
                  </div>
                </>
              )}

              {/* Grace period */}
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-2">
                  Carência após vencimento (dias)
                  <span className="text-zinc-600 ml-1">— padrão: {GRACE_PERIOD_DAYS} dias</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={editGraceDays}
                  onChange={e => setEditGraceDays(e.target.value)}
                  placeholder={String(GRACE_PERIOD_DAYS)}
                  className="input-base text-sm"
                />
                <p className="text-xs text-zinc-600 mt-1">
                  Deixe em branco para usar o padrão global ({GRACE_PERIOD_DAYS} dias).
                </p>
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

      {/* Bonus grant modal */}
      {bonusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setBonusTarget(null)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">

            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Gift size={16} className="text-amber-400" /> Conceder bônus
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Para <span className="text-white">{bonusTarget.referrer_name}</span> por indicar {bonusTarget.referred_name}
                </p>
              </div>
              <button onClick={() => setBonusTarget(null)} className="text-zinc-500 hover:text-zinc-200 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Bonus type */}
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-2">Tipo de bônus</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setBonusType('free_month')}
                    className={cn(
                      'py-3 px-3 rounded-xl border text-xs font-medium transition-all text-left',
                      bonusType === 'free_month'
                        ? 'bg-amber-500 border-amber-500 text-black'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    )}
                  >
                    <div className="font-semibold">Mês grátis</div>
                    <div className="text-[10px] opacity-70 mt-0.5">+30 dias na assinatura atual</div>
                  </button>
                  <button
                    onClick={() => setBonusType('plan_upgrade')}
                    className={cn(
                      'py-3 px-3 rounded-xl border text-xs font-medium transition-all text-left',
                      bonusType === 'plan_upgrade'
                        ? 'bg-amber-500 border-amber-500 text-black'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    )}
                  >
                    <div className="font-semibold">Upgrade de plano</div>
                    <div className="text-[10px] opacity-70 mt-0.5">Sobe de plano por 30 dias</div>
                  </button>
                </div>
              </div>

              {/* Upgrade plan selector */}
              {bonusType === 'plan_upgrade' && (
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-2">Plano de destino</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['pro', 'premium'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setBonusUpgradePlan(p)}
                        className={cn(
                          'py-2.5 rounded-xl border text-xs font-medium transition-all',
                          bonusUpgradePlan === p
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
              )}

              {bonusError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{bonusError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setBonusTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGrantBonus}
                  disabled={bonusSaving || !bonusTarget.referrer_barbershop_id}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  {bonusSaving ? 'Salvando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SortHeader ───────────────────────────────────────────────────────────────

function SortHeader({ label, sortKey, current, dir, onSort }: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors w-fit"
    >
      {label}
      {active
        ? dir === 'asc'
          ? <ChevronUp size={11} className="text-amber-500" />
          : <ChevronDown size={11} className="text-amber-500" />
        : <ChevronsUpDown size={11} className="opacity-40" />
      }
    </button>
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
