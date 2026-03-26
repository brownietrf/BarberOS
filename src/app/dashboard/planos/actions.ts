'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SubscriptionPeriod } from '@/types/database'

/** Barber updates their subscription period preference (takes effect at next renewal) */
export async function updateSubscriptionPeriod(
  period: SubscriptionPeriod,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado' }

    const { error } = await supabase
      .from('barbershops')
      .update({ subscription_period: period })
      .eq('owner_id', user.id)

    if (error) return { error: error.message }
    revalidatePath('/dashboard/planos')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}
