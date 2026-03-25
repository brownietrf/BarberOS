import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!

async function getAuthenticatedBarbershop(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, slug, name')
    .eq('owner_id', user.id)
    .single()

  return barbershop ?? null
}

function instanceNameFor(slug: string): string {
  return `barberos-${slug}`
}

// POST /api/bot/instance — cria instância na Evolution API e registra no banco
export async function POST(request: NextRequest) {
  const barbershop = await getAuthenticatedBarbershop(request)
  if (!barbershop) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const instanceName = instanceNameFor(barbershop.slug)

  // Cria instância na Evolution API
  const res = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EVOLUTION_API_KEY}`,
    },
    body: JSON.stringify({
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[bot/instance] Erro ao criar instância:', body)
    return NextResponse.json({ error: 'Erro ao criar instância na Evolution API' }, { status: 500 })
  }

  const data = await res.json()

  // Extrai QR code da resposta (pode estar em diferentes campos dependendo da versão)
  const qrCode: string | null =
    data?.qrcode?.base64 ??
    data?.qrcode?.code ??
    null

  // Upsert em whatsapp_instances
  const { error: dbErr } = await adminClient
    .from('whatsapp_instances')
    .upsert(
      {
        barbershop_id: barbershop.id,
        instance_name: instanceName,
        status: 'connecting',
        qr_code: qrCode,
        phone_number: null,
        connected_at: null,
      },
      { onConflict: 'barbershop_id' }
    )

  if (dbErr) {
    console.error('[bot/instance] Erro ao salvar instância:', dbErr)
    return NextResponse.json({ error: 'Erro ao salvar instância' }, { status: 500 })
  }

  return NextResponse.json({ instance_name: instanceName, qr_code: qrCode })
}

// DELETE /api/bot/instance — desconecta e remove instância
export async function DELETE(request: NextRequest) {
  const barbershop = await getAuthenticatedBarbershop(request)
  if (!barbershop) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const instanceName = instanceNameFor(barbershop.slug)

  // Logout na Evolution API
  await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${EVOLUTION_API_KEY}` },
  })

  // Atualiza status no banco
  await adminClient
    .from('whatsapp_instances')
    .update({ status: 'disconnected', phone_number: null, qr_code: null, connected_at: null })
    .eq('barbershop_id', barbershop.id)
    .eq('instance_name', instanceName)

  return NextResponse.json({ ok: true })
}
