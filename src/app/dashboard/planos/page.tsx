import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlanosClient } from './client'
import type { Referral } from '@/types/database'

export default async function PlanosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!barbershop) redirect('/onboarding')

  const { data: referrals } = await supabase
    .from('referrals')
    .select('id, referred_barbershop_id, status, reward_granted_at, created_at')
    .eq('referrer_barbershop_id', barbershop.id)
    .order('created_at', { ascending: false })

  return <PlanosClient barbershop={barbershop} referrals={(referrals ?? []) as Referral[]} />
}
