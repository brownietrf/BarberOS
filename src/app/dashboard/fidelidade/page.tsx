import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FidelidadeClient } from './client'
import type { LoyaltyProgram, LoyaltyReward } from '@/types/database'

export default async function FidelidadePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()

  if (!barbershop) redirect('/onboarding')

  const [{ data: program }, { data: rewards }, { data: customers }] = await Promise.all([
    supabase
      .from('loyalty_programs')
      .select('*')
      .eq('barbershop_id', barbershop.id)
      .maybeSingle(),
    supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('barbershop_id', barbershop.id)
      .order('redeemed_at', { ascending: false }),
    supabase
      .from('customers')
      .select('id, name, phone, total_visits')
      .eq('barbershop_id', barbershop.id)
      .order('total_visits', { ascending: false }),
  ])

  return (
    <FidelidadeClient
      barbershopId={barbershop.id}
      initialProgram={program as LoyaltyProgram | null}
      initialRewards={(rewards ?? []) as LoyaltyReward[]}
      initialCustomers={customers ?? []}
    />
  )
}
