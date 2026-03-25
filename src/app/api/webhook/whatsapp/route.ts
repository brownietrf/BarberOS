import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/bot/normalizers'
import { processMessage } from '@/lib/bot/state-machine'
import { sendMessage } from '@/lib/bot/evolution'
import type { Barbershop, BotSession, Service } from '@/types/database'

// Evolution API envia POST para este endpoint a cada mensagem recebida.
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const payload = body as {
    event?: string
    instance?: string
    data?: {
      // messages.upsert
      key?: { remoteJid?: string; fromMe?: boolean }
      message?: { conversation?: string; extendedTextMessage?: { text?: string } }
      // connection.update
      state?: string
      // QRCODE_UPDATED
      qrcode?: { base64?: string; code?: string }
      instance?: string
    }
  }

  const instanceName = payload.instance ?? ''

  // ── Evento: atualização de QR Code ──────────────────────────────────────────
  if (payload.event === 'QRCODE_UPDATED') {
    const qrCode = payload.data?.qrcode?.base64 ?? payload.data?.qrcode?.code ?? null
    if (qrCode && instanceName) {
      await adminClient
        .from('whatsapp_instances')
        .update({ qr_code: qrCode, status: 'connecting' })
        .eq('instance_name', instanceName)
    }
    return NextResponse.json({ ok: true })
  }

  // ── Evento: atualização de conexão ───────────────────────────────────────────
  if (payload.event === 'connection.update') {
    const state = payload.data?.state
    if (instanceName && state) {
      const statusMap: Record<string, string> = {
        open: 'connected',
        close: 'disconnected',
        connecting: 'connecting',
      }
      const newStatus = statusMap[state] ?? 'disconnected'

      const updatePayload: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'connected') {
        updatePayload.connected_at = new Date().toISOString()
        updatePayload.qr_code = null
      }
      if (newStatus === 'disconnected') {
        updatePayload.qr_code = null
        updatePayload.phone_number = null
      }

      await adminClient
        .from('whatsapp_instances')
        .update(updatePayload)
        .eq('instance_name', instanceName)
    }
    return NextResponse.json({ ok: true })
  }

  // 1. Apenas eventos de mensagem
  if (payload.event !== 'messages.upsert') {
    return NextResponse.json({ ok: true })
  }

  // 2. Ignorar mensagens enviadas pelo próprio bot
  if (payload.data?.key?.fromMe) {
    return NextResponse.json({ ok: true })
  }

  const remoteJid = payload.data?.key?.remoteJid ?? ''

  // Extrai texto (conversation ou extendedTextMessage)
  const rawText =
    payload.data?.message?.conversation ??
    payload.data?.message?.extendedTextMessage?.text ??
    ''

  if (!rawText.trim()) {
    return NextResponse.json({ ok: true })
  }

  // 3. Normaliza o telefone do cliente
  const phone = normalizePhone(remoteJid)

  // 4. Descobre qual barbearia corresponde a esta instância
  const { data: instance } = await adminClient
    .from('whatsapp_instances')
    .select('barbershop_id')
    .eq('instance_name', instanceName)
    .eq('status', 'connected')
    .maybeSingle()

  if (!instance) {
    console.warn(`[webhook] Instância não encontrada ou desconectada: ${instanceName}`)
    return NextResponse.json({ ok: true })
  }

  const { barbershop_id } = instance

  // 5. Verifica se a barbearia está ativa
  const { data: barbershop } = await adminClient
    .from('barbershops')
    .select('*')
    .eq('id', barbershop_id)
    .eq('is_active', true)
    .maybeSingle()

  if (!barbershop) {
    return NextResponse.json({ ok: true })
  }

  // 6. Carrega ou cria a sessão do bot
  const { data: existingSession } = await adminClient
    .from('bot_sessions')
    .select('*')
    .eq('barbershop_id', barbershop_id)
    .eq('phone', phone)
    .maybeSingle()

  const session: BotSession = existingSession ?? {
    id: crypto.randomUUID(),
    barbershop_id,
    phone,
    state: 'IDLE',
    context: {},
    last_message_at: new Date(0).toISOString(),
    created_at: new Date().toISOString(),
  }

  // 7. Busca serviços ativos da barbearia
  const { data: services } = await adminClient
    .from('services')
    .select('*')
    .eq('barbershop_id', barbershop_id)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  // 8. Processa na máquina de estados
  let result
  try {
    result = await processMessage(
      session,
      rawText,
      barbershop as Barbershop,
      (services ?? []) as Service[]
    )
  } catch (err) {
    console.error('[webhook] Erro na máquina de estados:', err)
    return NextResponse.json({ ok: true })
  }

  // 9. Envia resposta ao cliente via Evolution API
  if (result.reply) {
    try {
      await sendMessage(instanceName, phone, result.reply)
    } catch (err) {
      console.error('[webhook] Erro ao enviar mensagem:', err)
    }
  }

  // 10. Persiste o novo estado da sessão
  await adminClient.from('bot_sessions').upsert(
    {
      barbershop_id,
      phone,
      state: result.newState,
      context: result.newContext,
      last_message_at: new Date().toISOString(),
    },
    { onConflict: 'barbershop_id,phone' }
  )

  return NextResponse.json({ ok: true })
}
