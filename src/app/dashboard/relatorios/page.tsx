import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RelatoriosClient } from './client'
import { subDays, subMonths } from 'date-fns'
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
  const prevStart     = subDays(new Date(), defaultDays * 2)

  const [
    { data: appointments },
    { count: newCustomers },
    { data: prevAppointments },
    { count: returningCustomers },
    { count: totalCustomers },
  ] = await Promise.all([
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
    supabase
      .from('appointments_full')
      .select('id, status, service_price')
      .eq('barbershop_id', barbershop.id)
      .gte('start_time', prevStart.toISOString())
      .lt('start_time', start.toISOString()),
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('barbershop_id', barbershop.id)
      .gt('total_visits', 1),
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('barbershop_id', barbershop.id),
  ])

  return (
    <RelatoriosClient
      barbershop={barbershop}
      initialAppointments={(appointments ?? []) as ReportAppt[]}
      initialNewCustomers={newCustomers ?? 0}
      initialPeriod={defaultPeriod}
      initialPrevAppointments={(prevAppointments ?? []) as PrevAppt[]}
      returningCustomers={returningCustomers ?? 0}
      totalCustomers={totalCustomers ?? 0}
    />
  )
}

// types shared with client
export interface ReportAppt {
  id: string
  start_time: string
  status: string
  source: string
  customer_name: string | null
  service_name: string | null
  service_price: number | null
}

export interface PrevAppt {
  id: string
  status: string
  service_price: number | null
}
