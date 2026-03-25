import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'

// GET /api/bot/instance/status — retorna status e QR code atual do banco
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!barbershop) return NextResponse.json({ error: 'Barbearia não encontrada' }, { status: 404 })

  const { data: instance } = await adminClient
    .from('whatsapp_instances')
    .select('status, qr_code, phone_number, connected_at, instance_name')
    .eq('barbershop_id', barbershop.id)
    .maybeSingle()

  if (!instance) return NextResponse.json({ status: null })

  return NextResponse.json(instance)
}
