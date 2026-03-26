import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Sidebar } from '@/components/layout/sidebar'
import { isFullyLocked, GRACE_PERIOD_DAYS } from '@/lib/plans'
import { Lock, AlertTriangle } from 'lucide-react'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('name, plan, subscription_ends_at, grace_period_days')
    .eq('owner_id', user.id)
    .single()

  if (!barbershop) redirect('/onboarding')

  const fullyLocked = isFullyLocked(barbershop)

  // Allow the plans page through so the user can renew even when fully locked
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? headersList.get('next-url') ?? ''
  const onPlansPage = pathname.includes('/dashboard/planos')

  const graceDaysLabel = barbershop.grace_period_days ?? GRACE_PERIOD_DAYS

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Sidebar barbershopName={barbershop.name} />
      <main className="flex-1 flex flex-col min-h-screen md:max-h-screen md:overflow-y-auto overflow-x-hidden">
        <div className="flex-1 p-6 md:p-8 pt-20 md:pt-8">
          {fullyLocked && !onPlansPage ? (
            <FullLockScreen planName={barbershop.name} graceDays={graceDaysLabel} />
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  )
}

function FullLockScreen({ planName, graceDays }: { planName: string; graceDays: number }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
        <Lock size={28} className="text-red-400" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Acesso suspenso</h1>
      <p className="text-zinc-400 text-sm max-w-sm mb-1">
        A assinatura de <strong className="text-white">{planName}</strong> expirou e o período de carência de {graceDays} dias foi encerrado.
      </p>
      <p className="text-zinc-500 text-xs max-w-xs mb-8">
        Todos os seus dados estão preservados. Renove para reativar o acesso completo à plataforma.
      </p>
      <a
        href="/dashboard/planos"
        className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 py-3 rounded-xl text-sm transition-colors"
      >
        Renovar assinatura
      </a>
      <div className="mt-6 flex items-center gap-2 text-xs text-zinc-600">
        <AlertTriangle size={12} />
        <span>Agendamentos existentes não foram afetados</span>
      </div>
    </div>
  )
}
