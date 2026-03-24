import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AgendaClient } from './client'

export default async function AgendaPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, name, slot_duration, working_hours')
    .eq('owner_id', user.id)
    .single()

  if (!barbershop) redirect('/onboarding')

  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_min, price')
    .eq('barbershop_id', barbershop.id)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone')
    .eq('barbershop_id', barbershop.id)
    .order('name', { ascending: true })

  // Agendamentos de hoje
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data: appointments } = await supabase
    .from('appointments_full')
    .select('*')
    .eq('barbershop_id', barbershop.id)
    .gte('start_time', today.toISOString())
    .lt('start_time', tomorrow.toISOString())
    .order('start_time', { ascending: true })

  const { data: blockedSlots } = await supabase
    .from('blocked_slots')
    .select('*')
    .eq('barbershop_id', barbershop.id)
    .gte('start_time', today.toISOString())
    .lt('start_time', tomorrow.toISOString())

  return (
    <AgendaClient
      barbershop={barbershop}
      initialAppointments={appointments ?? []}
      initialBlockedSlots={blockedSlots ?? []}
      services={services ?? []}
      customers={customers ?? []}
      initialDate={today.toISOString()}
    />
  )
}
