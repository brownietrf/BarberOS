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

    // Quando o plano muda para pago, qualifica a indicação pendente (se houver)
    if (plan === 'pro' || plan === 'premium') {
      await adminClient
        .from('referrals')
        .update({ status: 'qualified' })
        .eq('referred_barbershop_id', barbershopId)
        .eq('status', 'pending')
    }

    revalidatePath('/admin')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function grantReferralBonus(
  referralId: string,
  referrerBarbershopId: string,
  bonusType: 'free_month' | 'plan_upgrade',
  upgradePlan?: 'pro' | 'premium',
): Promise<{ error?: string }> {
  try {
    await verifyAdmin()

    // Fetch current referrer data
    const { data: shop, error: fetchErr } = await adminClient
      .from('barbershops')
      .select('plan, subscription_ends_at')
      .eq('id', referrerBarbershopId)
      .single()
    if (fetchErr || !shop) return { error: fetchErr?.message ?? 'Barbearia não encontrada' }

    const now = new Date()
    const bonusEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Extend subscription_ends_at by 30 days (from current end or from now, whichever is later)
    const currentSubEnds = shop.subscription_ends_at ? new Date(shop.subscription_ends_at) : now
    const baseDate = currentSubEnds > now ? currentSubEnds : now
    const newSubEndsAt = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

    let shopUpdate: Record<string, unknown> = {
      subscription_ends_at: newSubEndsAt,
      updated_at: now.toISOString(),
    }

    if (bonusType === 'plan_upgrade' && upgradePlan) {
      shopUpdate = {
        ...shopUpdate,
        plan: upgradePlan,
        referral_bonus_ends_at: bonusEndsAt,
      }
    } else {
      // free_month: keep plan, just extend sub
      shopUpdate.referral_bonus_ends_at = bonusEndsAt
    }

    const { error: shopErr } = await adminClient
      .from('barbershops')
      .update(shopUpdate)
      .eq('id', referrerBarbershopId)
    if (shopErr) return { error: shopErr.message }

    const { error: refErr } = await adminClient
      .from('referrals')
      .update({ status: 'rewarded', reward_granted_at: now.toISOString() })
      .eq('id', referralId)
    if (refErr) return { error: refErr.message }

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
