import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ConfiguracoesClient } from './client'
import type { WhatsappInstance } from '@/types/database'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!barbershop) redirect('/onboarding')

  const { data: whatsappInstance } = await adminClient
    .from('whatsapp_instances')
    .select('*')
    .eq('barbershop_id', barbershop.id)
    .maybeSingle()

  return (
    <ConfiguracoesClient
      barbershop={barbershop}
      userEmail={user.email ?? ''}
      whatsappInstance={(whatsappInstance as WhatsappInstance) ?? null}
    />
  )
}
