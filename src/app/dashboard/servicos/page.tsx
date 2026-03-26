import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ServicosClient } from './client'
import { isSubscriptionExpired, gracePeriodDaysLeft } from '@/lib/plans'

export default async function ServicosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, plan, subscription_ends_at, grace_period_days')
    .eq('owner_id', user.id)
    .single()

  if (!barbershop) redirect('/onboarding')

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('barbershop_id', barbershop.id)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  return (
    <ServicosClient
      barbershopId={barbershop.id}
      initialServices={services ?? []}
      subscriptionExpired={isSubscriptionExpired(barbershop)}
      graceDays={gracePeriodDaysLeft(barbershop)}
    />
  )
}
