import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata, Viewport } from 'next'
import BookClient from './client'
import type { WorkingHours } from '@/types/database'

export const viewport: Viewport = {
  themeColor: '#f59e0b',
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('barbershops')
    .select('name, city, logo_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!data) return { title: 'Barbearia não encontrada' }

  const title       = `Agendar — ${data.name}`
  const description = `Agende seu horário na ${data.name}${data.city ? ` em ${data.city}` : ''}. Rápido, fácil e sem ligação.`
  const url         = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/book/${slug}`
  const images      = data.logo_url
    ? [{ url: data.logo_url, width: 512, height: 512, alt: data.name }]
    : [{ url: '/og-default.png', width: 1200, height: 630, alt: 'BarberOS' }]

  return {
    title,
    description,
    manifest: `/book/${slug}/manifest.webmanifest`,
    appleWebApp: {
      capable:         true,
      title:           data.name,
      statusBarStyle:  'black-translucent',
    },
    openGraph: {
      type:        'website',
      url,
      title,
      description,
      siteName:    data.name,
      images,
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images:      images.map(i => i.url),
    },
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
