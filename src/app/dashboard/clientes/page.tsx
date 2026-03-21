import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClientesClient } from './client'

export default async function ClientesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!barbershop) redirect('/onboarding')

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .eq('barbershop_id', barbershop.id)
    .order('last_visit_at', { ascending: false, nullsFirst: false })

  return (
    <ClientesClient
      barbershopId={barbershop.id}
      initialCustomers={customers ?? []}
    />
  )
}
