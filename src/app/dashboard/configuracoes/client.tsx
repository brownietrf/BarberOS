'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Barbershop, WorkingHours, DaySchedule } from '@/types/database'
import {
  Store, Clock, Bot, User,
  Save, CheckCircle, AlertTriangle,
  Link2, Copy, Check, ExternalLink
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
  const [copied, setCopied] = useState(false)

  const bookingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/book/${barbershop.slug}`
    : `/book/${barbershop.slug}`

  function copyLink() {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function shareWhatsApp() {
    const text = `Olá! Agende seu horário na *${barbershop.name}* pelo link:\n${bookingUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

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

      {/* ── Seção: Link de agendamento ── */}
      <Section icon={<Link2 size={16} />} title="Link de agendamento" subtitle="Compartilhe com seus clientes para receberem agendamentos online">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5">
            <span className="text-zinc-400 text-sm flex-1 truncate">{bookingUrl}</span>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-zinc-500 hover:text-white transition-colors"
              title="Abrir página"
            >
              <ExternalLink size={15} />
            </a>
          </div>

          <div className="flex gap-2">
            <button
              onClick={copyLink}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-medium text-white px-4 py-2.5 rounded-lg transition-colors"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              {copied ? 'Copiado!' : 'Copiar link'}
            </button>

            <button
              onClick={shareWhatsApp}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-sm font-medium text-white px-4 py-2.5 rounded-lg transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Compartilhar no WhatsApp
            </button>
          </div>

          <p className="text-xs text-zinc-500">
            Clientes acessam este link sem precisar criar conta. O agendamento aparece automaticamente na sua agenda.
          </p>
        </div>
      </Section>

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
