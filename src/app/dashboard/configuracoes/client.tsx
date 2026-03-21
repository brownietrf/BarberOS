'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Barbershop, WorkingHours, DaySchedule } from '@/types/database'
import {
  Store, Clock, Bot, User,
  Save, CheckCircle, AlertTriangle
} from 'lucide-react'

const DAY_LABELS: Record<string, string> = {
  seg: 'Segunda-feira',
  ter: 'Terça-feira',
  qua: 'Quarta-feira',
  qui: 'Quinta-feira',
  sex: 'Sexta-feira',
  sab: 'Sábado',
  dom: 'Domingo',
}

const DAY_ORDER = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']

const TIME_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0')
  const m = (totalMinutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
})

interface Props {
  barbershop: Barbershop
  userEmail: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function ConfiguracoesClient({ barbershop, userEmail }: Props) {
  const supabase = createClient()

  // Dados gerais
  const [general, setGeneral] = useState({
    name: barbershop.name,
    bot_name: barbershop.bot_name,
    phone: barbershop.phone ?? '',
    address: barbershop.address ?? '',
    city: barbershop.city ?? '',
    slot_duration: barbershop.slot_duration,
  })

  // Horários
  const [workingHours, setWorkingHours] = useState<WorkingHours>(
    barbershop.working_hours
  )

  const [generalStatus, setGeneralStatus] = useState<SaveStatus>('idle')
  const [hoursStatus, setHoursStatus] = useState<SaveStatus>('idle')

  // ── Handlers gerais ──────────────────────────────────────
  function handleGeneralChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    setGeneral(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }))
  }

  async function saveGeneral() {
    if (!general.name.trim()) return
    setGeneralStatus('saving')

    const { error } = await supabase
      .from('barbershops')
      .update({
        name: general.name.trim(),
        bot_name: general.bot_name.trim() || `${general.name} Bot`,
        phone: general.phone.trim() || null,
        whatsapp: general.phone.trim() || null,
        address: general.address.trim() || null,
        city: general.city.trim() || null,
        slot_duration: general.slot_duration,
      })
      .eq('id', barbershop.id)

    setGeneralStatus(error ? 'error' : 'saved')
    if (!error) setTimeout(() => setGeneralStatus('idle'), 3000)
  }

  // ── Handlers horários ────────────────────────────────────
  function toggleDay(day: string) {
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...prev[day as keyof WorkingHours], active: !prev[day as keyof WorkingHours].active }
    }))
  }

  function updateDayTime(day: string, field: 'open' | 'close', value: string) {
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...prev[day as keyof WorkingHours], [field]: value }
    }))
  }

  function applyToAll(sourceDay: string) {
    const source = workingHours[sourceDay as keyof WorkingHours]
    const updated = { ...workingHours }
    DAY_ORDER.forEach(day => {
      if (updated[day as keyof WorkingHours].active) {
        updated[day as keyof WorkingHours] = {
          ...updated[day as keyof WorkingHours],
          open: source.open,
          close: source.close,
        }
      }
    })
    setWorkingHours(updated)
  }

  async function saveHours() {
    setHoursStatus('saving')

    const { error } = await supabase
      .from('barbershops')
      .update({ working_hours: workingHours })
      .eq('id', barbershop.id)

    setHoursStatus(error ? 'error' : 'saved')
    if (!error) setTimeout(() => setHoursStatus('idle'), 3000)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Gerencie os dados e preferências da barbearia
        </p>
      </div>

      {/* ── Seção: Dados da conta ── */}
      <Section icon={<User size={16} />} title="Conta" subtitle="Informações de acesso">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">E-mail</label>
            <input
              value={userEmail}
              disabled
              className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-zinc-500 text-sm cursor-not-allowed"
            />
            <p className="text-xs text-zinc-600">Para alterar o e-mail, entre em contato com o suporte.</p>
          </div>
        </div>
      </Section>

      {/* ── Seção: Dados gerais ── */}
      <Section icon={<Store size={16} />} title="Barbearia" subtitle="Informações públicas da barbearia">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Nome da barbearia *</label>
              <input
                name="name"
                value={general.name}
                onChange={handleGeneralChange}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">WhatsApp / Telefone</label>
              <input
                name="phone"
                value={general.phone}
                onChange={handleGeneralChange}
                placeholder="11999999999"
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Cidade</label>
              <input
                name="city"
                value={general.city}
                onChange={handleGeneralChange}
                placeholder="São Paulo - SP"
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Endereço</label>
              <input
                name="address"
                value={general.address}
                onChange={handleGeneralChange}
                placeholder="Rua das Flores, 123"
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <SaveButton status={generalStatus} onClick={saveGeneral} />
        </div>
      </Section>

      {/* ── Seção: Bot ── */}
      <Section icon={<Bot size={16} />} title="WhatsApp Bot" subtitle="Como o assistente se apresenta aos clientes">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Nome do bot</label>
              <input
                name="bot_name"
                value={general.bot_name}
                onChange={handleGeneralChange}
                placeholder={`${general.name} Bot`}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Duração padrão do slot</label>
              <select
                name="slot_duration"
                value={general.slot_duration}
                onChange={handleGeneralChange}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              >
                {[15,20,25,30,35,40,45,50,55,60,75,90].map(m => (
                  <option key={m} value={m}>{m} minutos</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview da saudação */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <p className="text-zinc-500 text-xs mb-3">Preview da mensagem de boas-vindas:</p>
            <div className="flex flex-col gap-2">
              <div className="bg-zinc-700 rounded-lg rounded-tl-none px-3 py-2 text-sm text-zinc-200 max-w-xs">
                Oi! 👋 Aqui é o{' '}
                <span className="text-amber-400 font-medium">
                  {general.bot_name || `${general.name} Bot`}
                </span>{' '}
                da{' '}
                <span className="text-amber-400 font-medium">
                  {general.name}
                </span>!
                <br />Como posso te ajudar?
                <br /><br />
                1️⃣ Agendar horário<br />
                2️⃣ Ver meu agendamento<br />
                3️⃣ Cancelar agendamento
              </div>
            </div>
          </div>

          <SaveButton status={generalStatus} onClick={saveGeneral} />
        </div>
      </Section>

      {/* ── Seção: Horários ── */}
      <Section icon={<Clock size={16} />} title="Horários de funcionamento" subtitle="Define quando os clientes podem agendar">
        <div className="flex flex-col gap-3">
          {DAY_ORDER.map(day => {
            const schedule = workingHours[day as keyof WorkingHours]
            return (
              <DayRow
                key={day}
                day={day}
                label={DAY_LABELS[day]}
                schedule={schedule}
                timeOptions={TIME_OPTIONS}
                onToggle={() => toggleDay(day)}
                onTimeChange={(field, value) => updateDayTime(day, field, value)}
                onApplyToAll={() => applyToAll(day)}
              />
            )
          })}

          <div className="mt-2 bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
            <p className="text-xs text-zinc-500 leading-relaxed">
              💡 Clique em <strong className="text-zinc-400">"Aplicar a todos"</strong> em qualquer dia para copiar o horário para todos os dias ativos.
            </p>
          </div>

          <SaveButton status={hoursStatus} onClick={saveHours} label="Salvar horários" />
        </div>
      </Section>

    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────

function Section({
  icon, title, subtitle, children
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
        <div className="w-7 h-7 bg-zinc-800 rounded-lg flex items-center justify-center text-amber-500">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
      </div>
      <div className="px-6 py-5">
        {children}
      </div>
    </div>
  )
}

function SaveButton({
  status,
  onClick,
  label = 'Salvar alterações'
}: {
  status: SaveStatus
  onClick: () => void
  label?: string
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      {status === 'saved' && (
        <span className="flex items-center gap-1.5 text-green-400 text-sm">
          <CheckCircle size={14} /> Salvo com sucesso
        </span>
      )}
      {status === 'error' && (
        <span className="flex items-center gap-1.5 text-red-400 text-sm">
          <AlertTriangle size={14} /> Erro ao salvar
        </span>
      )}
      {(status === 'idle' || status === 'saving') && <span />}

      <button
        onClick={onClick}
        disabled={status === 'saving'}
        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors ml-auto"
      >
        <Save size={14} />
        {status === 'saving' ? 'Salvando...' : label}
      </button>
    </div>
  )
}

function DayRow({
  day, label, schedule, timeOptions,
  onToggle, onTimeChange, onApplyToAll
}: {
  day: string
  label: string
  schedule: DaySchedule
  timeOptions: string[]
  onToggle: () => void
  onTimeChange: (field: 'open' | 'close', value: string) => void
  onApplyToAll: () => void
}) {
  return (
    <div className={cn(
      'border rounded-lg transition-all',
      schedule.active ? 'border-zinc-700 bg-zinc-800/30' : 'border-zinc-800 bg-zinc-800/10 opacity-60'
    )}>
      <div className="flex items-center gap-3 px-4 py-3">

        {/* Toggle */}
        <button
          onClick={onToggle}
          className={cn(
            'w-10 h-6 rounded-full relative transition-colors shrink-0',
            schedule.active ? 'bg-amber-500' : 'bg-zinc-700'
          )}
        >
          <span className={cn(
            'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all',
            schedule.active ? 'left-5' : 'left-1'
          )} />
        </button>

        {/* Label */}
        <span className={cn(
          'text-sm font-medium w-32 shrink-0',
          schedule.active ? 'text-white' : 'text-zinc-500'
        )}>
          {label}
        </span>

        {/* Horários */}
        {schedule.active ? (
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <select
              value={schedule.open}
              onChange={e => onTimeChange('open', e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
            >
              {timeOptions.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span className="text-zinc-500 text-xs">até</span>
            <select
              value={schedule.close}
              onChange={e => onTimeChange('close', e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
            >
              {timeOptions.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              onClick={onApplyToAll}
              className="text-xs text-zinc-500 hover:text-amber-500 transition-colors ml-1 whitespace-nowrap"
            >
              Aplicar a todos
            </button>
          </div>
        ) : (
          <span className="text-xs text-zinc-600 flex-1">Fechado</span>
        )}
      </div>
    </div>
  )
}
