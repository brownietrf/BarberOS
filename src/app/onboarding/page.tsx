'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    bot_name: '',
    phone: '',
    address: '',
    city: '',
    slot_duration: '30',
    referred_by: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const slug = slugify(form.name)
    // Gera um código de indicação único para esta barbearia
    const referralCode = `${slug.slice(0, 8)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    // Verifica se slug já existe e adiciona sufixo aleatório se necessário
    const { data: existing } = await supabase
      .from('barbershops')
      .select('id')
      .eq('slug', slug)
      .single()

    const finalSlug = existing
      ? `${slug}-${Math.random().toString(36).slice(2, 6)}`
      : slug

    // Valida código de indicação (se informado)
    let validReferredBy: string | null = null
    if (form.referred_by.trim()) {
      const { data: referrer } = await supabase
        .from('barbershops')
        .select('id, referral_code')
        .eq('referral_code', form.referred_by.trim().toUpperCase())
        .single()
      if (referrer) {
        validReferredBy = form.referred_by.trim().toUpperCase()
      } else {
        setError('Código de indicação inválido. Verifique e tente novamente.')
        setLoading(false)
        return
      }
    }

    const { data: newBarbershop, error: insertError } = await supabase
      .from('barbershops')
      .insert({
        owner_id: user.id,
        name: form.name,
        slug: finalSlug,
        bot_name: form.bot_name || `${form.name} Bot`,
        phone: form.phone || null,
        whatsapp: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        slot_duration: parseInt(form.slot_duration),
        referral_code: referralCode,
        referred_by: validReferredBy,
      })
      .select('id')
      .single()

    if (insertError || !newBarbershop) {
      setError('Erro ao salvar. Tente novamente.')
      setLoading(false)
      return
    }

    // Se veio por indicação, registra o referral
    if (validReferredBy) {
      const { data: referrer } = await supabase
        .from('barbershops')
        .select('id')
        .eq('referral_code', validReferredBy)
        .single()
      if (referrer) {
        await supabase.from('referrals').insert({
          referrer_barbershop_id: referrer.id,
          referred_barbershop_id: newBarbershop.id,
          status: 'pending',
        })
      }
    }

    router.push('/dashboard')
  }

  const steps = [
    { num: 1, label: 'Sua barbearia' },
    { num: 2, label: 'Personalização' },
    { num: 3, label: 'Funcionamento' },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1 mb-3">
            <span className="text-2xl font-bold text-white">Barber</span>
            <span className="text-2xl font-bold text-amber-500">OS</span>
          </div>
          <h1 className="text-xl font-semibold text-white">Vamos configurar sua barbearia</h1>
          <p className="text-zinc-500 text-sm mt-1">Leva menos de 2 minutos ✂️</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 ${step === s.num ? 'opacity-100' : step > s.num ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${step > s.num ? 'bg-green-500 text-black' : step === s.num ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className={`text-xs hidden sm:block ${step === s.num ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-px mx-1 ${step > s.num ? 'bg-green-500' : 'bg-zinc-800'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">

          {/* Step 1 */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-white font-semibold mb-1">Nome da barbearia</h2>
                <p className="text-zinc-500 text-sm">Como sua barbearia é conhecida pelos clientes?</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-zinc-400">Nome *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Ex: El Patrón Barbearia"
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-zinc-400">Cidade</label>
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="Ex: São Paulo - SP"
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-zinc-400">Endereço</label>
                <input
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Ex: Rua das Flores, 123"
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!form.name.trim()}
                className="bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/30 disabled:cursor-not-allowed text-black font-semibold rounded-lg py-2.5 text-sm transition-colors mt-2"
              >
                Continuar →
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-white font-semibold mb-1">Personalize seu bot</h2>
                <p className="text-zinc-500 text-sm">Como o assistente vai se apresentar para seus clientes no WhatsApp?</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-zinc-400">Nome do bot</label>
                <input
                  name="bot_name"
                  value={form.bot_name}
                  onChange={handleChange}
                  placeholder={`Ex: ${form.name || 'El Patrón'} Bot`}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <p className="text-zinc-600 text-xs">Se deixar vazio, usará &quot;{form.name || 'Sua Barbearia'} Bot&quot;</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-zinc-400">WhatsApp / Telefone</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Ex: 11999999999"
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <p className="text-zinc-600 text-xs">Número que será conectado ao bot (com DDD, sem +55)</p>
              </div>

              {/* Preview */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-2">Preview da primeira mensagem:</p>
                <div className="bg-zinc-700 rounded-lg rounded-tl-none px-3 py-2 text-sm text-zinc-200 max-w-xs">
                  Oi! 👋 Aqui é o <span className="text-amber-400 font-medium">{form.bot_name || `${form.name} Bot` || 'Seu Bot'}</span>
                  <br />da <span className="text-amber-400 font-medium">{form.name || 'Sua Barbearia'}</span>!
                  <br />Como posso te ajudar?
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
                >
                  ← Voltar
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors"
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-white font-semibold mb-1">Tempo de atendimento</h2>
                <p className="text-zinc-500 text-sm">Quanto tempo em média dura cada atendimento?</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-zinc-400">Duração padrão do slot</label>
                <select
                  name="slot_duration"
                  value={form.slot_duration}
                  onChange={handleChange}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="20">20 minutos (só corte rápido)</option>
                  <option value="30">30 minutos (corte padrão)</option>
                  <option value="45">45 minutos (corte + barba)</option>
                  <option value="60">60 minutos (serviço completo)</option>
                </select>
                <p className="text-zinc-600 text-xs">Você pode definir durações diferentes por serviço depois</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-zinc-400">Código de indicação <span className="text-zinc-600">(opcional)</span></label>
                <input
                  name="referred_by"
                  value={form.referred_by}
                  onChange={handleChange}
                  placeholder="Ex: JOAO-A1B2"
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <p className="text-zinc-600 text-xs">Se outro barbeiro te indicou o BarberOS, insira o código dele</p>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                <p className="text-amber-400 text-xs font-medium mb-1">✅ Resumo da configuração</p>
                <p className="text-zinc-400 text-xs">🏠 {form.name}</p>
                {form.city && <p className="text-zinc-400 text-xs">📍 {form.city}</p>}
                <p className="text-zinc-400 text-xs">🤖 Bot: {form.bot_name || `${form.name} Bot`}</p>
                <p className="text-zinc-400 text-xs">⏱️ Slots de {form.slot_duration} minutos</p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
                >
                  ← Voltar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors"
                >
                  {loading ? 'Salvando...' : 'Criar barbearia 🚀'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
