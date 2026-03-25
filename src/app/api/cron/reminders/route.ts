import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/bot/evolution'

// Proteção básica do endpoint de cron via secret
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  return token === process.env.CRON_SECRET
}

// Vercel Cron jobs chamam via GET com o header de autorização.
// Schedule: "0 21 * * *" (UTC) = 18h BRT
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: reminders, error } = await adminClient.rpc('get_pending_reminders')

  if (error) {
    console.error('[cron/reminders] Erro ao buscar lembretes:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!reminders || reminders.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0
  let failed = 0

  for (const reminder of reminders as {
    appointment_id: string
    customer_name: string
    customer_phone: string
    start_time: string
    barbershop_name: string
    barbershop_id: string
  }[]) {
    try {
      // Busca a instância WhatsApp conectada desta barbearia
      const { data: instance } = await adminClient
        .from('whatsapp_instances')
        .select('instance_name')
        .eq('barbershop_id', reminder.barbershop_id)
        .eq('status', 'connected')
        .maybeSingle()

      if (!instance) {
        console.warn(
          `[cron/reminders] Sem instância conectada para barbearia ${reminder.barbershop_id}`
        )
        continue
      }

      const hora = reminder.start_time.slice(11, 16)
      const text =
        `Olá *${reminder.customer_name}*! 👋\n\n` +
        `Lembrete: você tem um agendamento *amanhã às ${hora}* na *${reminder.barbershop_name}*.\n\n` +
        `Responda *CONFIRMAR* para confirmar ou *CANCELAR* para cancelar.`

      await sendMessage(instance.instance_name, reminder.customer_phone, text)

      // Marca reminder_sent = true
      await adminClient
        .from('appointments')
        .update({ reminder_sent: true })
        .eq('id', reminder.appointment_id)

      sent++
    } catch (err) {
      console.error(`[cron/reminders] Erro ao enviar lembrete ${reminder.appointment_id}:`, err)
      failed++
    }
  }

  return NextResponse.json({ sent, failed })
}
