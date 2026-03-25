import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase  = await createClient()

  const { data } = await supabase
    .from('barbershops')
    .select('name, logo_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!data) return new NextResponse(null, { status: 404 })

  const icons = data.logo_url
    ? [{ src: data.logo_url,         sizes: 'any',    type: 'image/png', purpose: 'any maskable' }]
    : [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ]

  const manifest = {
    name:             data.name,
    short_name:       data.name,
    description:      `Agende seu horário na ${data.name}`,
    start_url:        `/book/${slug}`,
    scope:            `/book/${slug}`,
    display:          'standalone',
    orientation:      'portrait',
    background_color: '#09090b',
    theme_color:      '#f59e0b',
    icons,
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type':  'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
