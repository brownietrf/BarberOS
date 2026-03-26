import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AdminClient } from './client'
import type { Plan, SubscriptionPeriod } from '@/types/database'

export interface AdminBarbershop {
  id: string
  name: string
  slug: string
  owner_id: string
  owner_email: string
  plan: Plan
  trial_ends_at: string
  subscription_ends_at: string | null
  subscription_period: SubscriptionPeriod | null
  grace_period_days: number | null
  is_active: boolean
  created_at: string
}

export interface AdminReferral {
  id: string
  referrer_barbershop_id: string | null
  referrer_name: string
  referred_barbershop_id: string | null
  referred_name: string
  referred_plan: Plan
  status: 'pending' | 'qualified' | 'rewarded'
  reward_granted_at: string | null
  created_at: string
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (user.email !== process.env.ADMIN_EMAIL) redirect('/dashboard')

  const [{ data: barbershops }, { data: usersData }, { data: referralsRaw }] = await Promise.all([
    adminClient
      .from('barbershops')
      .select('id, name, slug, owner_id, plan, trial_ends_at, subscription_ends_at, subscription_period, grace_period_days, is_active, created_at')
      .order('created_at', { ascending: false }),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
    adminClient
      .from('referrals')
      .select('id, referrer_barbershop_id, referred_barbershop_id, status, reward_granted_at, created_at')
      .order('created_at', { ascending: false }),
  ])

  const emailMap = new Map(
    (usersData?.users ?? []).map(u => [u.id, u.email ?? '—'])
  )

  const enriched: AdminBarbershop[] = (barbershops ?? []).map(b => ({
    ...b,
    owner_email: emailMap.get(b.owner_id) ?? '—',
  }))

  const shopMap = new Map((barbershops ?? []).map(b => [b.id, b]))

  const adminReferrals: AdminReferral[] = (referralsRaw ?? []).map(r => {
    const referrer = r.referrer_barbershop_id ? shopMap.get(r.referrer_barbershop_id) : null
    const referred = r.referred_barbershop_id ? shopMap.get(r.referred_barbershop_id) : null
    return {
      id: r.id,
      referrer_barbershop_id: r.referrer_barbershop_id,
      referrer_name: referrer?.name ?? '—',
      referred_barbershop_id: r.referred_barbershop_id,
      referred_name: referred?.name ?? '—',
      referred_plan: (referred?.plan ?? 'free') as Plan,
      status: r.status as AdminReferral['status'],
      reward_granted_at: r.reward_granted_at,
      created_at: r.created_at,
    }
  })

  return <AdminClient barbershops={enriched} adminEmail={user.email!} referrals={adminReferrals} />
}
