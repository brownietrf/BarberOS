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

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (user.email !== process.env.ADMIN_EMAIL) redirect('/dashboard')

  const [{ data: barbershops }, { data: usersData }] = await Promise.all([
    adminClient
      .from('barbershops')
      .select('id, name, slug, owner_id, plan, trial_ends_at, subscription_ends_at, subscription_period, grace_period_days, is_active, created_at')
      .order('created_at', { ascending: false }),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const emailMap = new Map(
    (usersData?.users ?? []).map(u => [u.id, u.email ?? '—'])
  )

  const enriched: AdminBarbershop[] = (barbershops ?? []).map(b => ({
    ...b,
    owner_email: emailMap.get(b.owner_id) ?? '—',
  }))

  return <AdminClient barbershops={enriched} adminEmail={user.email!} />
}
