import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import BookClient from './client'
import type { WorkingHours } from '@/types/database'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('barbershops')
    .select('name, city')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!data) return { title: 'Barbearia não encontrada' }
  return {
    title: `Agendar — ${data.name}`,
    description: `Agende seu horário na ${data.name}${data.city ? ` em ${data.city}` : ''}`,
  }
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, name, slug, phone, whatsapp, working_hours, slot_duration, bot_name, logo_url, city, address')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!barbershop) notFound()

  const { data: services } = await supabase
    .from('services')
    .select('id, name, description, duration_min, price, category')
    .eq('barbershop_id', barbershop.id)
    .eq('is_active', true)
    .order('display_order')
    .order('created_at')

  return (
    <BookClient
      barbershop={barbershop as typeof barbershop & { working_hours: WorkingHours }}
      services={services ?? []}
    />
  )
}
