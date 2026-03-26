'use server'

import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function verifyAdmin(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    throw new Error('Acesso não autorizado')
  }
}

export async function updatePlan(
  barbershopId: string,
  plan: string,
  trialEndsAt: string,
  subscriptionEndsAt?: string | null,
  subscriptionPeriod?: string | null,
  gracePeriodDays?: number | null,
): Promise<{ error?: string }> {
  try {
    await verifyAdmin()
    const { error } = await adminClient
      .from('barbershops')
      .update({
        plan,
        trial_ends_at: trialEndsAt,
        subscription_ends_at: subscriptionEndsAt ?? null,
        subscription_period: subscriptionPeriod ?? null,
        grace_period_days: gracePeriodDays ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', barbershopId)
    if (error) return { error: error.message }
    revalidatePath('/admin')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function toggleActive(
  barbershopId: string,
  isActive: boolean,
): Promise<{ error?: string }> {
  try {
    await verifyAdmin()
    const { error } = await adminClient
      .from('barbershops')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', barbershopId)
    if (error) return { error: error.message }
    revalidatePath('/admin')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}
