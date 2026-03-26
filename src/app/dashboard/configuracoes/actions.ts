'use server'

import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export async function deleteAccount(): Promise<{ error: string } | never> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Faz logout antes de deletar para invalidar os tokens ativos
  await supabase.auth.signOut()

  // Deleta o usuário via service role (cascades no banco cuidam dos dados relacionados)
  const { error } = await adminClient.auth.admin.deleteUser(user.id)

  if (error) {
    return { error: 'Não foi possível apagar a conta. Tente novamente ou entre em contato com o suporte.' }
  }

  redirect('/login')
}
