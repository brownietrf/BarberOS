import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RelatoriosClient } from './client'
import { subDays } from 'date-fns'
import { PLANS } from '@/lib/plans'

export default async function RelatoriosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!barbershop) redirect('/onboarding')

  const defaultPeriod = PLANS[barbershop.plan as 'free' | 'pro' | 'premium'].reportPeriods[0]
  const defaultDays   = defaultPeriod === '7d' ? 7 : defaultPeriod === '30d' ? 30 : defaultPeriod === '90d' ? 90 : 365
  const start         = subDays(new Date(), defaultDays)

  const [{ data: appointments }, { count: newCustomers }] = await Promise.all([
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
  ])

  return (
    <RelatoriosClient
      barbershop={barbershop}
      initialAppointments={(appointments ?? []) as ReportAppt[]}
      initialNewCustomers={newCustomers ?? 0}
      initialPeriod={defaultPeriod}
    />
  )
}

// type shared with client
export interface ReportAppt {
  id: string
  start_time: string
  status: string
  source: string
  customer_name: string | null
  service_name: string | null
  service_price: number | null
}
