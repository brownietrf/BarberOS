'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

type Mode = 'login' | 'signup' | 'forgot'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    if (searchParams.get('reset') === 'success') {
      setMessage('Senha redefinida com sucesso! Faça login com sua nova senha.')
    }
  }, [searchParams])

  function reset() {
    setError(null)
    setMessage(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    reset()

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('E-mail ou senha incorretos.')
      else router.push('/dashboard')
    }

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` }
      })
      if (error) setError(error.message)
      else setMessage('Verifique seu e-mail para confirmar o cadastro.')
    }

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        if (error.message.includes('rate limit')) {
          setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.')
        } else {
          setError('Erro inesperado. Tente novamente.')
        }
      } else {
        setMessage('Se esse e-mail estiver cadastrado, você receberá o link em instantes. Verifique também o spam.')
      }
    }

    setLoading(false)
  }

  const titles: Record<Mode, { title: string; btn: string }> = {
    login: { title: 'Acesse seu painel', btn: 'Entrar' },
    signup: { title: 'Crie sua conta grátis', btn: 'Criar conta' },
    forgot: { title: 'Recuperar senha', btn: 'Enviar link de recuperação' },
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1 mb-2">
          <span className="text-3xl font-bold text-white">Barber</span>
          <span className="text-3xl font-bold text-amber-500">OS</span>
        </div>
        <p className="text-zinc-500 text-sm">{titles[mode].title}</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {mode !== 'forgot' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-400">Senha</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); reset() }}
                    className="text-xs text-zinc-500 hover:text-amber-500 transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          )}

          {mode === 'forgot' && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2.5">
              <p className="text-zinc-400 text-xs">
                Enviaremos um link de recuperação para o e-mail informado. Verifique também a pasta de spam.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {message && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2.5">
              <p className="text-green-400 text-sm">{message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors mt-1"
          >
            {loading ? 'Aguarde...' : titles[mode].btn}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-col gap-2 text-center">
          {mode === 'login' && (
            <button
              onClick={() => { setMode('signup'); reset() }}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Não tem conta? <span className="text-amber-500">Criar grátis</span>
            </button>
          )}
          {mode === 'signup' && (
            <button
              onClick={() => { setMode('login'); reset() }}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Já tem conta? <span className="text-amber-500">Entrar</span>
            </button>
          )}
          {mode === 'forgot' && (
            <button
              onClick={() => { setMode('login'); reset() }}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              ← Voltar para o login
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-zinc-700 text-xs mt-6">
        BarberOS · Sistema de Agendamento para Barbearias
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Suspense fallback={<div />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
