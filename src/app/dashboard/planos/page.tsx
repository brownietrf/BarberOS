import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlanosClient } from './client'

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

  return <PlanosClient barbershop={barbershop} />
}
