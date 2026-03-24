'use client'

import { useState, useEffect } from 'react'
import { format, parseISO, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Scissors, ChevronLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { WorkingHours, ServiceCategory } from '@/types/database'

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4

interface BookingService {
  id: string
  name: string
  description: string | null
  duration_min: number
  price: number
  category: ServiceCategory[]
}

interface BarbershopPublic {
  id: string
  name: string
  slug: string
  phone: string | null
  whatsapp: string | null
  working_hours: WorkingHours
  slot_duration: number
  bot_name: string | null
  logo_url: string | null
  city: string | null
  address: string | null
}

interface BookClientProps {
  barbershop: BarbershopPublic
  services: BookingService[]
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function fmtPrice(price: number) {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDuration(min: number) {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h${m}min` : `${h}h`
}

function normalizePhone(v: string) {
  return v.replace(/\D/g, '')
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, '($1')
  if (d.length <= 7) return d.replace(/^(\d{2})(\d{0,5})/, '($1) $2')
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

const DAY_KEYS: (keyof WorkingHours)[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

// ─── Component ───────────────────────────────────────────────────────────────

export default function BookClient({ barbershop, services }: BookClientProps) {
  const [step, setStep] = useState<Step>(1)

  // Step 1
  const [selectedService, setSelectedService] = useState<BookingService | null>(null)

  // Step 2
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Step 3
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const today = format(new Date(), 'yyyy-MM-dd')
  const maxDate = format(addMonths(new Date(), 2), 'yyyy-MM-dd')

  function isWorkingDay(dateStr: string): boolean {
    const date = new Date(dateStr + 'T12:00:00')
    const dayKey = DAY_KEYS[date.getDay()]
    return barbershop.working_hours?.[dayKey]?.active ?? true
  }

  async function loadSlots(date: string) {
    if (!selectedService || !date) return
    if (!isWorkingDay(date)) { setSlots([]); return }

    setLoadingSlots(true)
    setSlots([])
    setSelectedSlot('')

    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_available_slots', {
        p_barbershop_id: barbershop.id,
        p_date: date,
        p_duration_min: selectedService.duration_min,
      })
      if (error) throw error
      // função retorna { slot_time, available } — filtrar apenas os disponíveis
      type SlotRow = { slot_time: string; available: boolean }
      const normalized = ((data ?? []) as SlotRow[])
        .filter((r) => r.available === true)
        .map((r) => r.slot_time)
        .filter(Boolean)
      setSlots(normalized)
    } catch {
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  useEffect(() => {
    if (selectedDate) loadSlots(selectedDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedService])

  async function handleBook() {
    if (!selectedService || !selectedDate || !selectedSlot || !name.trim()) return
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const rawPhone = normalizePhone(phone)

      // Upsert customer: find by phone or insert
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('barbershop_id', barbershop.id)
        .eq('phone', rawPhone)
        .maybeSingle()

      let customerId: string
      if (existing) {
        customerId = existing.id
      } else {
        const { data: newCus, error: cusErr } = await supabase
          .from('customers')
          .insert({ barbershop_id: barbershop.id, name: name.trim(), phone: rawPhone })
          .select('id')
          .single()
        if (cusErr) throw cusErr
        customerId = newCus.id
      }

      // Create appointment
      const startTime = new Date(selectedSlot)
      const endTime = new Date(startTime.getTime() + selectedService.duration_min * 60_000)

      const { error: apptErr } = await supabase.from('appointments').insert({
        barbershop_id: barbershop.id,
        customer_id: customerId,
        service_id: selectedService.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'pending',
        source: 'web',
        notes: notes.trim() || null,
      })
      if (apptErr) throw apptErr

      setStep(4)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao criar agendamento. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setStep(1)
    setSelectedService(null)
    setSelectedDate('')
    setSlots([])
    setSelectedSlot('')
    setName('')
    setPhone('')
    setNotes('')
    setError('')
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
          {barbershop.logo_url ? (
            <img
              src={barbershop.logo_url}
              alt={barbershop.name}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
              <Scissors className="h-5 w-5 text-amber-500" />
            </div>
          )}
          <div>
            <p className="font-semibold text-white">{barbershop.name}</p>
            {barbershop.city && (
              <p className="text-xs text-zinc-400">{barbershop.city}</p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Step progress bar */}
        {step < 4 && (
          <div className="mb-6 flex gap-1.5">
            {([1, 2, 3] as const).map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? 'bg-amber-500' : 'bg-zinc-800'}`}
              />
            ))}
          </div>
        )}

        {/* ── Step 1: Select service ──────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 className="mb-1 text-lg font-semibold">Escolha o serviço</h2>
            <p className="mb-4 text-sm text-zinc-400">Selecione o que você deseja fazer</p>

            {services.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-500">
                Nenhum serviço disponível no momento.
              </p>
            ) : (
              <div className="space-y-2">
                {services.map((svc) => (
                  <button
                    key={svc.id}
                    onClick={() => { setSelectedService(svc); setStep(2) }}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left transition-colors hover:border-zinc-700"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-white">{svc.name}</p>
                        {svc.description && (
                          <p className="mt-0.5 truncate text-xs text-zinc-400">{svc.description}</p>
                        )}
                        <p className="mt-1 text-xs text-zinc-500">{fmtDuration(svc.duration_min)}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-amber-400">
                        {fmtPrice(svc.price)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Select date + time ──────────────────────────────────── */}
        {step === 2 && (
          <div>
            <button
              onClick={() => setStep(1)}
              className="mb-4 flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>

            <h2 className="mb-1 text-lg font-semibold">Escolha data e horário</h2>
            <p className="mb-5 text-sm text-zinc-400">
              {selectedService?.name} · {fmtPrice(selectedService?.price ?? 0)} ·{' '}
              {fmtDuration(selectedService?.duration_min ?? 0)}
            </p>

            {/* Date input */}
            <div className="mb-5">
              <label className="mb-1.5 block text-xs uppercase tracking-wide text-zinc-400">
                Data
              </label>
              <input
                type="date"
                min={today}
                max={maxDate}
                value={selectedDate}
                onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot('') }}
                className="w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Slots */}
            {selectedDate && (
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wide text-zinc-400">
                  Horário
                </label>

                {loadingSlots ? (
                  <p className="py-8 text-center text-sm text-zinc-400">Carregando horários…</p>
                ) : !isWorkingDay(selectedDate) ? (
                  <p className="py-8 text-center text-sm text-zinc-500">
                    Não atendemos neste dia.
                  </p>
                ) : slots.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-500">
                    Sem horários disponíveis para esta data.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded-lg py-2.5 text-sm font-medium transition-colors ${
                          selectedSlot === slot
                            ? 'bg-amber-500 text-black'
                            : 'border border-zinc-800 bg-zinc-900 text-white hover:border-zinc-600'
                        }`}
                      >
                        {format(new Date(slot), 'HH:mm')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedSlot && (
              <button
                onClick={() => setStep(3)}
                className="mt-6 w-full rounded-xl bg-amber-500 py-3 font-semibold text-black transition-colors hover:bg-amber-400"
              >
                Continuar
              </button>
            )}
          </div>
        )}

        {/* ── Step 3: Customer info ───────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <button
              onClick={() => setStep(2)}
              className="mb-4 flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>

            <h2 className="mb-1 text-lg font-semibold">Seus dados</h2>
            <p className="mb-5 text-sm text-zinc-400">Para confirmar o agendamento</p>

            {/* Booking summary */}
            <div className="mb-5 space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
              <SummaryRow label="Serviço" value={selectedService?.name ?? ''} />
              <SummaryRow
                label="Data"
                value={
                  selectedDate
                    ? format(parseISO(selectedDate), "dd 'de' MMMM", { locale: ptBR })
                    : ''
                }
              />
              <SummaryRow
                label="Horário"
                value={selectedSlot ? format(new Date(selectedSlot), 'HH:mm') : ''}
              />
              <SummaryRow
                label="Valor"
                value={fmtPrice(selectedService?.price ?? 0)}
                highlight
              />
            </div>

            {/* Form */}
            <div className="space-y-3">
              <Field label="Nome completo">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="input-base"
                  autoComplete="name"
                />
              </Field>

              <Field label="WhatsApp">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  className="input-base"
                  autoComplete="tel"
                />
              </Field>

              <Field label="Observações (opcional)">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Alguma observação para o barbeiro?"
                  rows={2}
                  className="input-base resize-none"
                />
              </Field>
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleBook}
              disabled={loading || !name.trim() || normalizePhone(phone).length < 10}
              className="mt-5 w-full rounded-xl bg-amber-500 py-3 font-semibold text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Agendando…' : 'Confirmar agendamento'}
            </button>
          </div>
        )}

        {/* ── Step 4: Success ─────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">Agendamento realizado!</h2>
            <p className="mb-6 text-sm text-zinc-400">
              Seu horário foi reservado. Aguarde a confirmação da barbearia.
            </p>

            <div className="mb-6 space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left text-sm">
              <SummaryRow label="Barbearia" value={barbershop.name} />
              <SummaryRow label="Serviço" value={selectedService?.name ?? ''} />
              <SummaryRow
                label="Data"
                value={
                  selectedDate
                    ? format(parseISO(selectedDate), "dd 'de' MMMM", { locale: ptBR })
                    : ''
                }
              />
              <SummaryRow
                label="Horário"
                value={selectedSlot ? format(new Date(selectedSlot), 'HH:mm') : ''}
              />
              <SummaryRow label="Nome" value={name} />
            </div>

            <button
              onClick={reset}
              className="w-full rounded-xl border border-zinc-700 py-3 font-medium text-zinc-300 transition-colors hover:border-zinc-500"
            >
              Fazer novo agendamento
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-400">{label}</span>
      <span className={highlight ? 'font-semibold text-amber-400' : 'text-white'}>{value}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-zinc-400">{label}</label>
      {children}
    </div>
  )
}
