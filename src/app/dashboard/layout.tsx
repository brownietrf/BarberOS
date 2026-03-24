import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'

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
    .select('name')
    .eq('owner_id', user.id)
    .single()

  if (!barbershop) redirect('/onboarding')

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Sidebar barbershopName={barbershop.name} />
      <main className="flex-1 flex flex-col min-h-screen md:max-h-screen md:overflow-y-auto overflow-x-hidden">
        <div className="flex-1 p-6 md:p-8 pt-20 md:pt-8">
          {children}
        </div>
      </main>
    </div>
  )
}
