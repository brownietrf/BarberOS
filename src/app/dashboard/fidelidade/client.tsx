'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import {
  Gift, Star, Trophy, Users, ToggleLeft, ToggleRight,
  Pencil, CheckCircle, Clock, ChevronRight, Sparkles,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { LoyaltyProgram, LoyaltyReward } from '@/types/database'

interface CustomerRow {
  id: string
  name: string
  phone: string
  total_visits: number
}

interface Props {
  barbershopId: string
  initialProgram: LoyaltyProgram | null
  initialRewards: LoyaltyReward[]
  initialCustomers: CustomerRow[]
}

export function FidelidadeClient({
  barbershopId,
  initialProgram,
  initialRewards,
  initialCustomers,
}: Props) {
  const supabase = createClient()

  const [program, setProgram] = useState<LoyaltyProgram | null>(initialProgram)
  const [rewards, setRewards] = useState<LoyaltyReward[]>(initialRewards)
  const [customers] = useState<CustomerRow[]>(initialCustomers)

  const [saving, setSaving] = useState(false)
  const [configModal, setConfigModal] = useState(false)
  const [redeemModal, setRedeemModal] = useState<CustomerRow | null>(null)
  const [redeemNotes, setRedeemNotes] = useState('')

  const [form, setForm] = useState({
    visits_required: program?.visits_required ?? 10,
    reward_description: program?.reward_description ?? '',
  })

  // Calcular progresso de cada cliente (visitas desde o último resgate)
  function getProgress(customer: CustomerRow) {
    const required = program?.visits_required ?? 10
    const lastRedemptions = rewards
      .filter(r => r.customer_id === customer.id)
      .sort((a, b) => new Date(b.redeemed_at).getTime() - new Date(a.redeemed_at).getTime())
    const lastVisitsAt = lastRedemptions[0]?.visits_at_redemption ?? 0
    const progress = customer.total_visits - lastVisitsAt
    return {
      current: Math.min(progress, required),
      required,
      eligible: progress >= required,
      timesRedeemed: lastRedemptions.length,
    }
  }

  async function handleToggle() {
    if (!program) return
    setSaving(true)
    const next = !program.is_active
    const { error } = await supabase
      .from('loyalty_programs')
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq('id', program.id)
    if (!error) setProgram(p => p ? { ...p, is_active: next } : p)
    setSaving(false)
  }

  async function handleSaveConfig() {
    if (!form.reward_description.trim()) return
    setSaving(true)
    if (program) {
      const { data, error } = await supabase
        .from('loyalty_programs')
        .update({
          visits_required: form.visits_required,
          reward_description: form.reward_description.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', program.id)
        .select()
        .single()
      if (!error && data) setProgram(data as LoyaltyProgram)
    } else {
      const { data, error } = await supabase
        .from('loyalty_programs')
        .insert({
          barbershop_id: barbershopId,
          visits_required: form.visits_required,
          reward_description: form.reward_description.trim(),
          is_active: true,
        })
        .select()
        .single()
      if (!error && data) setProgram(data as LoyaltyProgram)
    }
    setSaving(false)
    setConfigModal(false)
  }

  async function handleRedeem() {
    if (!redeemModal || !program) return
    setSaving(true)
    const { data, error } = await supabase
      .from('loyalty_rewards')
      .insert({
        barbershop_id: barbershopId,
        customer_id: redeemModal.id,
        visits_at_redemption: redeemModal.total_visits,
        notes: redeemNotes.trim() || null,
      })
      .select()
      .single()
    if (!error && data) {
      setRewards(prev => [data as LoyaltyReward, ...prev])
    }
    setSaving(false)
    setRedeemModal(null)
    setRedeemNotes('')
  }

  const eligibleCustomers = customers.filter(c => program && getProgress(c).eligible)
  const totalRedeemed = rewards.length

  return (
    <div className="max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gift size={22} className="text-amber-500" />
            Fidelidade
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Recompense seus clientes mais fiéis automaticamente
          </p>
        </div>
        <button
          onClick={() => {
            setForm({
              visits_required: program?.visits_required ?? 10,
              reward_description: program?.reward_description ?? '',
            })
            setConfigModal(true)
          }}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
        >
          <Pencil size={15} />
          {program ? 'Configurar' : 'Ativar programa'}
        </button>
      </div>

      {/* Sem programa configurado */}
      {!program && (
        <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-xl p-12 text-center mb-6">
          <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy size={24} className="text-amber-500" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Programa de Fidelidade</h3>
          <p className="text-zinc-400 text-sm max-w-sm mx-auto mb-6 leading-relaxed">
            Configure quantas visitas são necessárias para um cliente ganhar a recompensa.
            Você controla tudo — do número de visitas ao prêmio oferecido.
          </p>
          <button
            onClick={() => setConfigModal(true)}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            <Sparkles size={15} /> Configurar agora
          </button>
        </div>
      )}

      {/* Programa ativo */}
      {program && (
        <>
          {/* Status card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  program.is_active ? 'bg-green-500/10' : 'bg-zinc-800'
                )}>
                  <Gift size={18} className={program.is_active ? 'text-green-400' : 'text-zinc-500'} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">Programa de Fidelidade</span>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full border',
                      program.is_active
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-zinc-700/50 text-zinc-400 border-zinc-600'
                    )}>
                      {program.is_active ? 'Ativo' : 'Pausado'}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-sm mt-0.5">
                    A cada <strong className="text-zinc-300">{program.visits_required}</strong> visitas → <strong className="text-amber-400">{program.reward_description}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggle}
                disabled={saving}
                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
              >
                {program.is_active
                  ? <ToggleRight size={16} className="text-green-400" />
                  : <ToggleLeft size={16} className="text-zinc-500" />
                }
                {program.is_active ? 'Pausar' : 'Ativar'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{eligibleCustomers.length}</div>
              <div className="text-zinc-500 text-xs mt-0.5 flex items-center gap-1">
                <Star size={11} className="text-amber-500" /> Aptos ao resgate
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{totalRedeemed}</div>
              <div className="text-zinc-500 text-xs mt-0.5 flex items-center gap-1">
                <CheckCircle size={11} className="text-green-400" /> Resgates realizados
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{customers.length}</div>
              <div className="text-zinc-500 text-xs mt-0.5 flex items-center gap-1">
                <Users size={11} className="text-zinc-400" /> Clientes no programa
              </div>
            </div>
          </div>

          {/* Lista de clientes com progresso */}
          {customers.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6">
              <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-800/30 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500">Cliente</span>
                <span className="text-xs font-medium text-zinc-500">Progresso</span>
              </div>
              <div className="divide-y divide-zinc-800">
                {customers.map(customer => {
                  const prog = getProgress(customer)
                  const pct = Math.min((prog.current / prog.required) * 100, 100)
                  return (
                    <div key={customer.id} className="px-5 py-3.5 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-300 shrink-0">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-white font-medium truncate">{customer.name}</span>
                          {prog.timesRedeemed > 0 && (
                            <span className="text-xs text-amber-500 shrink-0">
                              {prog.timesRedeemed}x resgatado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                prog.eligible ? 'bg-amber-500' : 'bg-zinc-600'
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={cn(
                            'text-xs shrink-0 tabular-nums',
                            prog.eligible ? 'text-amber-500 font-medium' : 'text-zinc-500'
                          )}>
                            {prog.current}/{prog.required}
                          </span>
                        </div>
                      </div>
                      {prog.eligible && program.is_active && (
                        <button
                          onClick={() => { setRedeemModal(customer); setRedeemNotes('') }}
                          className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
                        >
                          <Gift size={12} /> Resgatar
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Histórico de resgates */}
          {rewards.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-800/30">
                <span className="text-xs font-medium text-zinc-500">Histórico de resgates</span>
              </div>
              <div className="divide-y divide-zinc-800">
                {rewards.slice(0, 20).map(reward => {
                  const customer = customers.find(c => c.id === reward.customer_id)
                  return (
                    <div key={reward.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                        <CheckCircle size={13} className="text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white">{customer?.name ?? 'Cliente'}</span>
                        {reward.notes && (
                          <p className="text-xs text-zinc-500 truncate">{reward.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-zinc-500 shrink-0">
                        <Clock size={11} />
                        {format(new Date(reward.redeemed_at), 'dd/MM/yy', { locale: ptBR })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal configuração */}
      <Modal
        open={configModal}
        onClose={() => setConfigModal(false)}
        title={program ? 'Configurar programa' : 'Ativar programa de fidelidade'}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Visitas para ganhar a recompensa *</label>
            <input
              type="number"
              min={1}
              max={100}
              value={form.visits_required}
              onChange={e => setForm(p => ({ ...p, visits_required: Math.max(1, parseInt(e.target.value) || 1) }))}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
            <p className="text-xs text-zinc-600">Ex: 10 significa que a cada 10 visitas o cliente ganha a recompensa</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Recompensa *</label>
            <input
              type="text"
              value={form.reward_description}
              onChange={e => setForm(p => ({ ...p, reward_description: e.target.value }))}
              placeholder="Ex: 1 corte grátis, 30% de desconto, barba grátis..."
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {form.visits_required > 0 && form.reward_description.trim() && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs text-amber-400">
                A cada <strong>{form.visits_required}</strong> visitas, o cliente ganha: <strong>{form.reward_description}</strong>
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setConfigModal(false)}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={saving || !form.reward_description.trim()}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/30 disabled:cursor-not-allowed text-black font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal resgatar */}
      <Modal
        open={!!redeemModal}
        onClose={() => setRedeemModal(null)}
        title="Confirmar resgate"
        size="sm"
      >
        {redeemModal && program && (
          <div className="flex flex-col gap-4">
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 text-center">
              <Gift size={24} className="text-amber-500 mx-auto mb-2" />
              <p className="text-white font-medium">{redeemModal.name}</p>
              <p className="text-amber-400 text-sm mt-1">{program.reward_description}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Observação <span className="text-zinc-600">(opcional)</span></label>
              <input
                value={redeemNotes}
                onChange={e => setRedeemNotes(e.target.value)}
                placeholder="Ex: Resgate realizado em 26/03"
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setRedeemModal(null)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRedeem}
                disabled={saving}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                {saving ? 'Registrando...' : 'Confirmar resgate'}
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  )
}
