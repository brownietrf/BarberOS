'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import {
  ChevronLeft, ChevronRight, Plus, Check,
  X, Scissors, Ban, CalendarDays,
  MoreVertical, Phone, AlertCircle, Pencil,
  Calendar, List
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  format, addDays, subDays, isToday, parseISO,
  startOfWeek, endOfWeek, eachDayOfInterval,
  startOfMonth, endOfMonth, addWeeks, subWeeks,
  addMonths, subMonths, isSameDay, isSameMonth,
  addMinutes
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
type ViewMode = 'day' | 'week' | 'month'

interface AppointmentFull {
  id: string
  barbershop_id: string
  customer_id: string | null
  service_id: string | null
  start_time: string
  end_time: string
  status: AppointmentStatus
  source: string
  notes: string | null
  reminder_sent: boolean
  customer_name: string | null
  customer_phone: string | null
  service_name: string | null
  service_duration: number | null
  service_price: number | null
}

interface BlockedSlot {
  id: string
  barbershop_id: string
  start_time: string
  end_time: string
  reason: string | null
}

interface Service { id: string; name: string; duration_min: number; price: number }
interface Customer { id: string; name: string; phone: string }
interface Barbershop {
  id: string
  name: string
  slot_duration: number
  working_hours: Record<string, { open: string; close: string; active: boolean }>
}

interface Props {
  barbershop: Barbershop
  initialAppointments: AppointmentFull[]
  initialBlockedSlots: BlockedSlot[]
  services: Service[]
  customers: Customer[]
  initialDate: string
}

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; bg: string; dot: string; border: string }> = {
  pending:   { label: 'Pendente',   color: 'text-yellow-400', bg: 'bg-yellow-500/10', dot: 'bg-yellow-400', border: 'border-yellow-500/20' },
  confirmed: { label: 'Confirmado', color: 'text-green-400',  bg: 'bg-green-500/10',  dot: 'bg-green-400',  border: 'border-green-500/20' },
  cancelled: { label: 'Cancelado',  color: 'text-red-400',    bg: 'bg-red-500/10',    dot: 'bg-red-400',    border: 'border-red-500/20' },
  completed: { label: 'Concluído',  color: 'text-zinc-400',   bg: 'bg-zinc-500/10',   dot: 'bg-zinc-400',   border: 'border-zinc-700' },
  no_show:   { label: 'Faltou',     color: 'text-orange-400', bg: 'bg-orange-500/10', dot: 'bg-orange-400', border: 'border-orange-500/20' },
}

const DAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
const WEEK_HOURS = Array.from({ length: 13 }, (_, i) => i + 7)

const EMPTY_APPT = { customer_id: '', customer_name: '', customer_phone: '', service_id: '', date: '', time: '', notes: '', is_new_customer: false }
const EMPTY_BLOCK = { date: '', start_time: '', end_time: '', reason: '' }

function fmtTime(iso: string) { return format(parseISO(iso), 'HH:mm') }
function fmtPhone(p: string) {
  const d = p.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return p
}
function fmtPrice(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function genSlots(open: string, close: string, dur: number) {
  const slots: string[] = []
  const [oh, om] = open.split(':').map(Number)
  const [ch, cm] = close.split(':').map(Number)
  let cur = oh * 60 + om
  const end = ch * 60 + cm
  while (cur + dur <= end) {
    slots.push(`${Math.floor(cur/60).toString().padStart(2,'0')}:${(cur%60).toString().padStart(2,'0')}`)
    cur += dur
  }
  return slots
}

export function AgendaClient({ barbershop, initialAppointments, initialBlockedSlots, services, customers, initialDate }: Props) {
  const supabase = createClient()
  const [view, setView] = useState<ViewMode>('day')
  const [currentDate, setCurrentDate] = useState(new Date(initialDate))
  const [appointments, setAppointments] = useState<AppointmentFull[]>(initialAppointments)
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>(initialBlockedSlots)
  const [allAppointments, setAllAppointments] = useState<AppointmentFull[]>([])
  const [loading, setLoading] = useState(false)
  const [actionModal, setActionModal] = useState<AppointmentFull | null>(null)
  const [editModal, setEditModal] = useState<AppointmentFull | null>(null)
  const [editBlockModal, setEditBlockModal] = useState<BlockedSlot | null>(null)
  const [appointmentModal, setAppointmentModal] = useState(false)
  const [blockModal, setBlockModal] = useState(false)
  const [cancelModal, setCancelModal] = useState<AppointmentFull | null>(null)
  const [apptForm, setApptForm] = useState(EMPTY_APPT)
  const [editForm, setEditForm] = useState({ ...EMPTY_APPT, status: 'confirmed' as AppointmentStatus })
  const [blockForm, setBlockForm] = useState(EMPTY_BLOCK)
  const [editBlockForm, setEditBlockForm] = useState(EMPTY_BLOCK)
  const [cancelReason, setCancelReason] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [editCustomerSearch, setEditCustomerSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDay = useCallback(async (date: Date) => {
    setLoading(true)
    const start = new Date(date); start.setHours(0,0,0,0)
    const end = new Date(date); end.setHours(23,59,59,999)
    const [{ data: appts }, { data: blocks }] = await Promise.all([
      supabase.from('appointments_full').select('*').eq('barbershop_id', barbershop.id)
        .gte('start_time', start.toISOString()).lte('start_time', end.toISOString())
        .order('start_time', { ascending: true }),
      supabase.from('blocked_slots').select('*').eq('barbershop_id', barbershop.id)
        .gte('start_time', start.toISOString()).lte('start_time', end.toISOString()),
    ])
    setAppointments(appts ?? [])
    setBlockedSlots(blocks ?? [])
    setLoading(false)
  }, [supabase, barbershop.id])

  const fetchRange = useCallback(async (start: Date, end: Date) => {
    setLoading(true)
    const { data } = await supabase.from('appointments_full').select('*')
      .eq('barbershop_id', barbershop.id)
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString())
      .order('start_time', { ascending: true })
    setAllAppointments(data ?? [])
    setLoading(false)
  }, [supabase, barbershop.id])

  useEffect(() => {
    if (view === 'week') fetchRange(startOfWeek(currentDate, { weekStartsOn: 1 }), endOfWeek(currentDate, { weekStartsOn: 1 }))
    else if (view === 'month') fetchRange(startOfMonth(currentDate), endOfMonth(currentDate))
  }, [view, currentDate, fetchRange])

  async function navigate(dir: 'prev' | 'next') {
    let d: Date
    if (view === 'day') d = dir === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1)
    else if (view === 'week') d = dir === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1)
    else d = dir === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1)
    setCurrentDate(d)
    if (view === 'day') await fetchDay(d)
  }

  async function goToday() {
    const t = new Date(); setCurrentDate(t)
    if (view === 'day') await fetchDay(t)
  }

  async function updateStatus(appt: AppointmentFull, status: AppointmentStatus) {
    setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status } : a))
    setAllAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status } : a))
    const updates: Record<string, unknown> = { status }
    if (status === 'confirmed') updates.confirmed_at = new Date().toISOString()
    if (status === 'cancelled') updates.cancelled_at = new Date().toISOString()
    await supabase.from('appointments').update(updates).eq('id', appt.id)
    setActionModal(null)
  }

  async function handleCancel() {
    if (!cancelModal) return
    setAppointments(prev => prev.map(a => a.id === cancelModal.id ? { ...a, status: 'cancelled' as AppointmentStatus } : a))
    await supabase.from('appointments').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: cancelReason.trim() || null }).eq('id', cancelModal.id)
    setCancelModal(null); setCancelReason(''); setActionModal(null)
  }

  async function handleCreateAppointment() {
    setError(null)
    const { customer_id, customer_name, customer_phone, service_id, date, time, is_new_customer } = apptForm
    if (!service_id) { setError('Selecione um serviço.'); return }
    if (!date || !time) { setError('Selecione data e horário.'); return }
    if (is_new_customer && !customer_name.trim()) { setError('Informe o nome do cliente.'); return }
    if (is_new_customer && customer_phone.replace(/\D/g,'').length < 10) { setError('Telefone inválido.'); return }
    if (!is_new_customer && !customer_id) { setError('Selecione um cliente.'); return }
    setSaving(true)
    const svc = services.find(s => s.id === service_id)!
    const startTime = new Date(`${date}T${time}:00`)
    const endTime = addMinutes(startTime, svc.duration_min)
    let custId = customer_id
    if (is_new_customer) {
      const phone = customer_phone.replace(/\D/g,'')
      const { data: ex } = await supabase.from('customers').select('id').eq('barbershop_id', barbershop.id).eq('phone', phone).single()
      if (ex) { custId = ex.id } else {
        const { data: nc } = await supabase.from('customers').insert({ barbershop_id: barbershop.id, name: customer_name.trim(), phone }).select('id').single()
        custId = nc?.id ?? ''
      }
    }
    const { error: err } = await supabase.from('appointments').insert({ barbershop_id: barbershop.id, customer_id: custId || null, service_id, start_time: startTime.toISOString(), end_time: endTime.toISOString(), status: 'confirmed', source: 'manual', notes: apptForm.notes.trim() || null })
    if (err) { setError('Erro ao criar agendamento.'); setSaving(false); return }
    await fetchDay(currentDate)
    setAppointmentModal(false); setApptForm(EMPTY_APPT); setSaving(false)
  }

  function openEdit(appt: AppointmentFull) {
    const d = parseISO(appt.start_time)
    setEditForm({ customer_id: appt.customer_id ?? '', customer_name: appt.customer_name ?? '', customer_phone: appt.customer_phone ?? '', service_id: appt.service_id ?? '', date: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm'), notes: appt.notes ?? '', status: appt.status, is_new_customer: false })
    setEditCustomerSearch(appt.customer_name ?? '')
    setEditModal(appt); setActionModal(null); setError(null)
  }

  async function handleEditAppointment() {
    if (!editModal) return
    setError(null)
    const { service_id, date, time, notes, status, customer_id, is_new_customer, customer_name, customer_phone } = editForm
    if (!service_id) { setError('Selecione um serviço.'); return }
    if (!date || !time) { setError('Selecione data e horário.'); return }
    if (is_new_customer && !customer_name.trim()) { setError('Informe o nome do cliente.'); return }
    if (!is_new_customer && !customer_id) { setError('Selecione um cliente.'); return }
    setSaving(true)
    const svc = services.find(s => s.id === service_id)!
    const startTime = new Date(`${date}T${time}:00`)
    const endTime = addMinutes(startTime, svc.duration_min)
    let custId = customer_id
    if (is_new_customer) {
      const phone = customer_phone.replace(/\D/g,'')
      const { data: ex } = await supabase.from('customers').select('id').eq('barbershop_id', barbershop.id).eq('phone', phone).single()
      if (ex) { custId = ex.id } else {
        const { data: nc } = await supabase.from('customers').insert({ barbershop_id: barbershop.id, name: customer_name.trim(), phone }).select('id').single()
        custId = nc?.id ?? ''
      }
    }
    const updates: Record<string, unknown> = { customer_id: custId || null, service_id, start_time: startTime.toISOString(), end_time: endTime.toISOString(), notes: notes.trim() || null, status }
    if (status === 'confirmed' && editModal.status !== 'confirmed') updates.confirmed_at = new Date().toISOString()
    if (status === 'cancelled' && editModal.status !== 'cancelled') updates.cancelled_at = new Date().toISOString()
    const { error: err } = await supabase.from('appointments').update(updates).eq('id', editModal.id)
    if (err) { setError('Erro ao salvar.'); setSaving(false); return }
    await fetchDay(new Date(`${date}T00:00:00`))
    setCurrentDate(new Date(`${date}T00:00:00`))
    setView('day')
    setEditModal(null); setSaving(false)
  }

  async function handleCreateBlock() {
    setError(null)
    const { date, start_time, end_time, reason } = blockForm
    if (!date || !start_time || !end_time) { setError('Preencha data e horários.'); return }
    if (start_time >= end_time) { setError('Horário final deve ser maior que o inicial.'); return }
    setSaving(true)
    const { error: err } = await supabase.from('blocked_slots').insert({ barbershop_id: barbershop.id, start_time: new Date(`${date}T${start_time}:00`).toISOString(), end_time: new Date(`${date}T${end_time}:00`).toISOString(), reason: reason.trim() || null })
    if (err) { setError('Erro ao bloquear horário.'); setSaving(false); return }
    await fetchDay(currentDate)
    setBlockModal(false); setBlockForm(EMPTY_BLOCK); setSaving(false)
  }

  async function handleEditBlock() {
    if (!editBlockModal) return
    setError(null)
    const { date, start_time, end_time, reason } = editBlockForm
    if (!date || !start_time || !end_time) { setError('Preencha data e horários.'); return }
    if (start_time >= end_time) { setError('Horário final deve ser maior que o inicial.'); return }
    setSaving(true)
    await supabase.from('blocked_slots').update({ start_time: new Date(`${date}T${start_time}:00`).toISOString(), end_time: new Date(`${date}T${end_time}:00`).toISOString(), reason: reason.trim() || null }).eq('id', editBlockModal.id)
    await fetchDay(currentDate)
    setEditBlockModal(null); setSaving(false)
  }

  async function handleDeleteBlock(id: string) {
    setBlockedSlots(prev => prev.filter(b => b.id !== id))
    await supabase.from('blocked_slots').delete().eq('id', id)
  }

  const dayKey = DAY_KEYS[currentDate.getDay()]
  const daySchedule = barbershop.working_hours[dayKey]
  const isOpen = daySchedule?.active ?? false
  const dateStr = format(currentDate, 'yyyy-MM-dd')
  const selSvc = services.find(s => s.id === apptForm.service_id)
  const timeSlots = isOpen && apptForm.date ? genSlots(daySchedule.open, daySchedule.close, selSvc?.duration_min ?? barbershop.slot_duration) : []
  const editDayKey = editForm.date ? DAY_KEYS[new Date(editForm.date + 'T12:00:00').getDay()] : dayKey
  const editDaySched = barbershop.working_hours[editDayKey]
  const editSelSvc = services.find(s => s.id === editForm.service_id)
  const editTimeSlots = editForm.date && editDaySched?.active ? genSlots(editDaySched.open, editDaySched.close, editSelSvc?.duration_min ?? barbershop.slot_duration) : []
  const filtCust = customers.filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch))
  const editFiltCust = customers.filter(c => !editCustomerSearch || c.name.toLowerCase().includes(editCustomerSearch.toLowerCase()) || c.phone.includes(editCustomerSearch))
  const active = appointments.filter(a => a.status !== 'cancelled')
  const pending = appointments.filter(a => a.status === 'pending').length
  const completed = appointments.filter(a => a.status === 'completed').length
  const weekDays = eachDayOfInterval({ start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) })
  const calDays = eachDayOfInterval({ start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }) })

  function getAppts(day: Date) {
    return (view === 'day' ? appointments : allAppointments).filter(a => isSameDay(parseISO(a.start_time), day) && a.status !== 'cancelled')
  }

  return (
    <div className="max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Agenda</h1>
          {view === 'day' && <p className="text-zinc-400 text-sm mt-1">{active.length} agendamento{active.length !== 1 ? 's' : ''} · {pending} pendente{pending !== 1 ? 's' : ''} · {completed} concluído{completed !== 1 ? 's' : ''}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setBlockForm({ ...EMPTY_BLOCK, date: dateStr }); setError(null); setBlockModal(true) }} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-3 py-2.5 rounded-lg text-sm transition-colors">
            <Ban size={15} /> Bloquear
          </button>
          <button onClick={() => { setApptForm({ ...EMPTY_APPT, date: dateStr }); setError(null); setAppointmentModal(true) }} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
            <Plus size={16} /> Agendar
          </button>
        </div>
      </div>

      {/* View switcher + nav */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
          {([{ v: 'day' as ViewMode, icon: <List size={14} />, label: 'Dia' }, { v: 'week' as ViewMode, icon: <CalendarDays size={14} />, label: 'Semana' }, { v: 'month' as ViewMode, icon: <Calendar size={14} />, label: 'Mês' }]).map(opt => (
            <button key={opt.v} onClick={() => setView(opt.v)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all', view === opt.v ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
              {opt.icon}{opt.label}
            </button>
          ))}
        </div>
        <button onClick={() => navigate('prev')} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all"><ChevronLeft size={16} /></button>
        <div className="flex-1 text-center">
          <p className="text-white font-semibold text-sm capitalize">
            {isToday(currentDate) && view === 'day' && <span className="text-amber-500 text-xs font-mono mr-2">HOJE</span>}
            {view === 'day' && format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            {view === 'week' && `${format(weekDays[0], "dd 'de' MMM", { locale: ptBR })} – ${format(weekDays[6], "dd 'de' MMM 'de' yyyy", { locale: ptBR })}`}
            {view === 'month' && format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <button onClick={() => navigate('next')} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all"><ChevronRight size={16} /></button>
        {!isToday(currentDate) && <button onClick={goToday} className="text-xs text-amber-500 hover:text-amber-400 transition-colors whitespace-nowrap">Hoje</button>}
      </div>

      {/* DAY VIEW */}
      {view === 'day' && (
        <div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
              {blockedSlots.map(block => (
                <div key={block.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 flex items-center gap-4">
                  <div className="w-1 self-stretch bg-zinc-700 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><Ban size={14} className="text-zinc-600" /><span className="text-sm text-zinc-500 font-medium">Horário bloqueado</span></div>
                    <p className="text-xs text-zinc-600 mt-0.5">{fmtTime(block.start_time)} – {fmtTime(block.end_time)}{block.reason && ` · ${block.reason}`}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditBlockForm({ date: format(parseISO(block.start_time),'yyyy-MM-dd'), start_time: fmtTime(block.start_time), end_time: fmtTime(block.end_time), reason: block.reason ?? '' }); setEditBlockModal(block); setError(null) }} className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => handleDeleteBlock(block.id)} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"><X size={14} /></button>
                  </div>
                </div>
              ))}

              {appointments.length === 0 && blockedSlots.length === 0 && (
                <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-xl p-12 text-center">
                  <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4"><CalendarDays size={20} className="text-zinc-600" /></div>
                  <h3 className="text-white font-medium mb-1">{isOpen ? 'Nenhum agendamento para hoje' : 'Barbearia fechada neste dia'}</h3>
                  <p className="text-zinc-500 text-sm mb-5">{isOpen ? 'Adicione um agendamento manual ou aguarde os clientes agendarem pelo WhatsApp.' : 'Este dia está marcado como fechado nas configurações.'}</p>
                  {isOpen && <button onClick={() => { setApptForm({ ...EMPTY_APPT, date: dateStr }); setAppointmentModal(true) }} className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"><Plus size={16} /> Adicionar agendamento</button>}
                </div>
              )}

              {appointments.map(appt => {
                const cfg = STATUS_CONFIG[appt.status]
                const isCancelled = appt.status === 'cancelled'
                return (
                  <div key={appt.id} className={cn('bg-zinc-900 border rounded-xl px-5 py-4 flex items-center gap-4 transition-all', isCancelled ? 'border-zinc-800/50 opacity-50' : 'border-zinc-800 hover:border-zinc-700')}>
                    <div className={cn('w-1 self-stretch rounded-full shrink-0', cfg.dot)} />
                    <div className="text-center shrink-0 w-14">
                      <p className="text-white font-bold text-sm">{fmtTime(appt.start_time)}</p>
                      <p className="text-zinc-600 text-xs">{fmtTime(appt.end_time)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium text-sm">{appt.customer_name ?? 'Cliente não identificado'}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full border', cfg.bg, cfg.color, cfg.border)}>{cfg.label}</span>
                        {appt.source === 'whatsapp' && <span className="text-xs text-zinc-600">via WhatsApp</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {appt.service_name && <span className="flex items-center gap-1 text-xs text-zinc-400"><Scissors size={11} />{appt.service_name}</span>}
                        {appt.service_price != null && <span className="text-xs text-amber-500 font-medium">{fmtPrice(appt.service_price)}</span>}
                        {appt.customer_phone && <span className="flex items-center gap-1 text-xs text-zinc-600"><Phone size={10} />{fmtPhone(appt.customer_phone)}</span>}
                      </div>
                      {appt.notes && <p className="text-xs text-zinc-600 mt-1 italic">{appt.notes}</p>}
                    </div>
                    {!isCancelled && (
                      <div className="flex items-center gap-1 shrink-0">
                        {appt.status === 'pending' && <button onClick={() => updateStatus(appt, 'confirmed')} title="Confirmar" className="p-2 rounded-lg text-zinc-500 hover:text-green-400 hover:bg-green-500/10 transition-colors"><Check size={16} /></button>}
                        {appt.status === 'confirmed' && <button onClick={() => updateStatus(appt, 'completed')} title="Concluir" className="p-2 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"><Check size={16} /></button>}
                        <button onClick={() => openEdit(appt)} title="Editar" className="p-2 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"><Pencil size={15} /></button>
                        <button onClick={() => setActionModal(appt)} className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"><MoreVertical size={16} /></button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* WEEK VIEW */}
      {view === 'week' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zinc-800">
            <div className="p-2" />
            {weekDays.map(day => (
              <div key={day.toISOString()} className={cn('p-2 text-center border-l border-zinc-800', isToday(day) && 'bg-amber-500/5')}>
                <p className="text-xs text-zinc-500 uppercase">{format(day, 'EEE', { locale: ptBR })}</p>
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center mx-auto mt-1 text-sm font-semibold', isToday(day) ? 'bg-amber-500 text-black' : 'text-zinc-300')}>{format(day, 'd')}</div>
              </div>
            ))}
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            {WEEK_HOURS.map(hour => (
              <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zinc-800/50 min-h-[64px]">
                <div className="p-2 text-right pr-3"><span className="text-xs text-zinc-600">{hour}:00</span></div>
                {weekDays.map(day => {
                  const dayAppts = getAppts(day).filter(a => parseISO(a.start_time).getHours() === hour)
                  return (
                    <div key={day.toISOString()} className={cn('border-l border-zinc-800/50 p-1', isToday(day) && 'bg-amber-500/3')}>
                      {dayAppts.map(appt => {
                        const cfg = STATUS_CONFIG[appt.status]
                        return (
                          <button key={appt.id} onClick={() => {
                            const d = parseISO(appt.start_time)
                            setCurrentDate(d)
                            setView('day')
                            fetchDay(d)
                          }}
                            className={cn('w-full text-left rounded-md px-2 py-1 mb-1 border text-xs transition-all hover:opacity-80', cfg.bg, cfg.border)}>
                            <p className={cn('font-medium truncate', cfg.color)}>{fmtTime(appt.start_time)} {appt.customer_name?.split(' ')[0]}</p>
                            {appt.service_name && <p className="text-zinc-500 truncate">{appt.service_name}</p>}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MONTH VIEW */}
      {view === 'month' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-zinc-800">
            {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => <div key={d} className="p-3 text-center text-xs font-medium text-zinc-500">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {calDays.map((day, i) => {
              const dayAppts = getAppts(day)
              const isCurrentMonth = isSameMonth(day, currentDate)
              const isCurrentDay = isToday(day)
              return (
                <button key={day.toISOString()} onClick={() => {
                  setCurrentDate(day)
                  setView('day')
                  fetchDay(day)
                }}
                  className={cn('min-h-[100px] p-2 border-b border-r border-zinc-800 text-left hover:bg-zinc-800/30 transition-colors', !isCurrentMonth && 'opacity-30', isCurrentDay && 'bg-amber-500/5', i % 7 === 6 && 'border-r-0')}>
                  <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-2', isCurrentDay ? 'bg-amber-500 text-black' : 'text-zinc-400')}>{format(day, 'd')}</div>
                  {dayAppts.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex gap-1 flex-wrap">
                        {(['pending','confirmed','completed'] as AppointmentStatus[]).map(s => {
                          const count = dayAppts.filter(a => a.status === s).length
                          return count > 0 ? <span key={s} className="flex items-center gap-1 text-xs" style={{}}><span className={cn('w-1.5 h-1.5 rounded-full inline-block', STATUS_CONFIG[s].dot)} /><span className={STATUS_CONFIG[s].color}>{count}</span></span> : null
                        })}
                      </div>
                      {dayAppts.slice(0, 2).map(a => (
                        <div key={a.id} className={cn('text-xs px-1.5 py-0.5 rounded truncate', STATUS_CONFIG[a.status].bg, STATUS_CONFIG[a.status].color)}>
                          {fmtTime(a.start_time)} {a.customer_name?.split(' ')[0]}
                        </div>
                      ))}
                      {dayAppts.length > 2 && <p className="text-xs text-zinc-600">+{dayAppts.length - 2} mais</p>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal ações */}
      <Modal open={!!actionModal} onClose={() => setActionModal(null)} title="Ações do agendamento" size="sm">
        {actionModal && (
          <div className="flex flex-col gap-2">
            <div className="bg-zinc-800 rounded-lg p-3 mb-2">
              <p className="text-white text-sm font-medium">{actionModal.customer_name ?? 'Cliente não identificado'}</p>
              <p className="text-zinc-400 text-xs mt-0.5">{fmtTime(actionModal.start_time)} · {actionModal.service_name}</p>
            </div>
            <ActionBtn icon={<Pencil size={15} className="text-amber-400" />} label="Editar agendamento" onClick={() => openEdit(actionModal)} />
            {actionModal.status === 'pending' && <ActionBtn icon={<Check size={15} className="text-green-400" />} label="Confirmar" onClick={() => updateStatus(actionModal, 'confirmed')} />}
            {(actionModal.status === 'pending' || actionModal.status === 'confirmed') && <ActionBtn icon={<Check size={15} className="text-blue-400" />} label="Marcar como concluído" onClick={() => updateStatus(actionModal, 'completed')} />}
            {actionModal.status === 'confirmed' && <ActionBtn icon={<AlertCircle size={15} className="text-orange-400" />} label="Marcar como faltou" onClick={() => updateStatus(actionModal, 'no_show')} />}
            {actionModal.customer_phone && (
              <a href={`https://wa.me/55${actionModal.customer_phone}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
                <Phone size={15} className="text-green-400" /><span className="text-sm text-zinc-300">Abrir WhatsApp</span>
              </a>
            )}
            <div className="border-t border-zinc-800 pt-2 mt-1">
              <ActionBtn icon={<X size={15} className="text-red-400" />} label="Cancelar agendamento" onClick={() => { setCancelModal(actionModal); setActionModal(null) }} danger />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal editar agendamento */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Editar agendamento">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Status</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_CONFIG) as AppointmentStatus[]).map(s => (
                <button key={s} onClick={() => setEditForm(prev => ({ ...prev, status: s }))}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all', editForm.status === s ? cn(STATUS_CONFIG[s].bg, STATUS_CONFIG[s].color, STATUS_CONFIG[s].border) : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500')}>
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex bg-zinc-800 rounded-lg p-0.5">
            <button onClick={() => setEditForm(prev => ({ ...prev, is_new_customer: false }))} className={cn('flex-1 py-2 rounded-md text-xs font-medium transition-all', !editForm.is_new_customer ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300')}>Cliente existente</button>
            <button onClick={() => setEditForm(prev => ({ ...prev, is_new_customer: true, customer_id: '' }))} className={cn('flex-1 py-2 rounded-md text-xs font-medium transition-all', editForm.is_new_customer ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300')}>Novo cliente</button>
          </div>

          {!editForm.is_new_customer ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Cliente</label>
              <input value={editCustomerSearch} onChange={e => setEditCustomerSearch(e.target.value)} placeholder="Buscar cliente..." className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
              {editCustomerSearch && editFiltCust.length > 0 && (
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                  {editFiltCust.slice(0,6).map(c => (
                    <button key={c.id} onClick={() => { setEditForm(prev => ({ ...prev, customer_id: c.id })); setEditCustomerSearch(c.name) }} className={cn('w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-700 transition-colors text-left', editForm.customer_id === c.id && 'bg-zinc-700')}>
                      <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-300 shrink-0">{c.name.charAt(0)}</div>
                      <div><p className="text-sm text-white">{c.name}</p><p className="text-xs text-zinc-500">{fmtPhone(c.phone)}</p></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-zinc-400">Nome *</label>
                <input value={editForm.customer_name} onChange={e => setEditForm(prev => ({ ...prev, customer_name: e.target.value }))} placeholder="Nome do cliente" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-zinc-400">Telefone *</label>
                <input value={editForm.customer_phone} onChange={e => setEditForm(prev => ({ ...prev, customer_phone: e.target.value.replace(/\D/g,'').slice(0,11) }))} placeholder="11999999999" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Serviço</label>
            <select value={editForm.service_id} onChange={e => setEditForm(prev => ({ ...prev, service_id: e.target.value, time: '' }))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors">
              <option value="">Selecionar serviço...</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration_min}min · {fmtPrice(s.price)})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Data</label>
              <input type="date" value={editForm.date} onChange={e => setEditForm(prev => ({ ...prev, date: e.target.value, time: '' }))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Horário</label>
              <select value={editForm.time} onChange={e => setEditForm(prev => ({ ...prev, time: e.target.value }))} disabled={!editForm.service_id || !editForm.date} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50">
                <option value="">Selecionar horário...</option>
                {editTimeSlots.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Observações <span className="text-zinc-600">(opcional)</span></label>
            <input value={editForm.notes} onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Ex: Cliente prefere tesoura..." className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5"><p className="text-red-400 text-sm">{error}</p></div>}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditModal(null)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg py-2.5 text-sm transition-colors">Cancelar</button>
            <button onClick={handleEditAppointment} disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors">{saving ? 'Salvando...' : 'Salvar alterações'}</button>
          </div>
        </div>
      </Modal>

      {/* Modal cancelamento */}
      <Modal open={!!cancelModal} onClose={() => setCancelModal(null)} title="Cancelar agendamento" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-zinc-400 text-sm">Cancelar o agendamento de <strong className="text-white">{cancelModal?.customer_name}</strong> às <strong className="text-white">{cancelModal ? fmtTime(cancelModal.start_time) : ''}</strong>?</p>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Motivo <span className="text-zinc-600">(opcional)</span></label>
            <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Ex: Cliente solicitou..." className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setCancelModal(null)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg py-2.5 text-sm transition-colors">Voltar</button>
            <button onClick={handleCancel} className="flex-1 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">Confirmar cancelamento</button>
          </div>
        </div>
      </Modal>

      {/* Modal novo agendamento */}
      <Modal open={appointmentModal} onClose={() => setAppointmentModal(false)} title="Novo agendamento">
        <div className="flex flex-col gap-4">
          <div className="flex bg-zinc-800 rounded-lg p-0.5">
            <button onClick={() => setApptForm(prev => ({ ...prev, is_new_customer: false, customer_id: '', customer_name: '', customer_phone: '' }))} className={cn('flex-1 py-2 rounded-md text-xs font-medium transition-all', !apptForm.is_new_customer ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300')}>Cliente existente</button>
            <button onClick={() => setApptForm(prev => ({ ...prev, is_new_customer: true, customer_id: '' }))} className={cn('flex-1 py-2 rounded-md text-xs font-medium transition-all', apptForm.is_new_customer ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300')}>Novo cliente</button>
          </div>

          {!apptForm.is_new_customer ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Cliente *</label>
              <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Buscar por nome ou telefone..." className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
              {customerSearch && (
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                  {filtCust.length === 0 ? <p className="text-xs text-zinc-500 p-3">Nenhum cliente encontrado</p> : filtCust.slice(0,8).map(c => (
                    <button key={c.id} onClick={() => { setApptForm(prev => ({ ...prev, customer_id: c.id })); setCustomerSearch(c.name) }} className={cn('w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-700 transition-colors text-left', apptForm.customer_id === c.id && 'bg-zinc-700')}>
                      <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-300 shrink-0">{c.name.charAt(0).toUpperCase()}</div>
                      <div><p className="text-sm text-white">{c.name}</p><p className="text-xs text-zinc-500">{fmtPhone(c.phone)}</p></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-zinc-400">Nome *</label>
                <input value={apptForm.customer_name} onChange={e => setApptForm(prev => ({ ...prev, customer_name: e.target.value }))} placeholder="Nome do cliente" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-zinc-400">Telefone *</label>
                <input value={apptForm.customer_phone} onChange={e => setApptForm(prev => ({ ...prev, customer_phone: e.target.value.replace(/\D/g,'').slice(0,11) }))} placeholder="11999999999" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Serviço *</label>
            <select value={apptForm.service_id} onChange={e => setApptForm(prev => ({ ...prev, service_id: e.target.value, time: '' }))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors">
              <option value="">Selecionar serviço...</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration_min}min · {fmtPrice(s.price)})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Data *</label>
              <input type="date" value={apptForm.date} onChange={e => setApptForm(prev => ({ ...prev, date: e.target.value, time: '' }))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Horário *</label>
              <select value={apptForm.time} onChange={e => setApptForm(prev => ({ ...prev, time: e.target.value }))} disabled={!apptForm.service_id || !apptForm.date} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50">
                <option value="">Selecionar horário...</option>
                {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Observações <span className="text-zinc-600">(opcional)</span></label>
            <input value={apptForm.notes} onChange={e => setApptForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Ex: Cliente prefere tesoura..." className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5"><p className="text-red-400 text-sm">{error}</p></div>}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setAppointmentModal(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg py-2.5 text-sm transition-colors">Cancelar</button>
            <button onClick={handleCreateAppointment} disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors">{saving ? 'Salvando...' : 'Criar agendamento'}</button>
          </div>
        </div>
      </Modal>

      {/* Modal bloquear */}
      <Modal open={blockModal} onClose={() => setBlockModal(false)} title="Bloquear horário" size="sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Data *</label>
            <input type="date" value={blockForm.date} onChange={e => setBlockForm(prev => ({ ...prev, date: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Início *</label>
              <input type="time" value={blockForm.start_time} onChange={e => setBlockForm(prev => ({ ...prev, start_time: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Fim *</label>
              <input type="time" value={blockForm.end_time} onChange={e => setBlockForm(prev => ({ ...prev, end_time: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Motivo <span className="text-zinc-600">(opcional)</span></label>
            <input value={blockForm.reason} onChange={e => setBlockForm(prev => ({ ...prev, reason: e.target.value }))} placeholder="Ex: Almoço, compromisso pessoal..." className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5"><p className="text-red-400 text-sm">{error}</p></div>}
          <div className="flex gap-3">
            <button onClick={() => setBlockModal(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg py-2.5 text-sm transition-colors">Cancelar</button>
            <button onClick={handleCreateBlock} disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors">{saving ? 'Salvando...' : 'Bloquear horário'}</button>
          </div>
        </div>
      </Modal>

      {/* Modal editar bloqueio */}
      <Modal open={!!editBlockModal} onClose={() => setEditBlockModal(null)} title="Editar bloqueio" size="sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Data *</label>
            <input type="date" value={editBlockForm.date} onChange={e => setEditBlockForm(prev => ({ ...prev, date: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Início *</label>
              <input type="time" value={editBlockForm.start_time} onChange={e => setEditBlockForm(prev => ({ ...prev, start_time: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400">Fim *</label>
              <input type="time" value={editBlockForm.end_time} onChange={e => setEditBlockForm(prev => ({ ...prev, end_time: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Motivo <span className="text-zinc-600">(opcional)</span></label>
            <input value={editBlockForm.reason} onChange={e => setEditBlockForm(prev => ({ ...prev, reason: e.target.value }))} placeholder="Ex: Almoço..." className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5"><p className="text-red-400 text-sm">{error}</p></div>}
          <div className="flex gap-3">
            <button onClick={() => setEditBlockModal(null)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg py-2.5 text-sm transition-colors">Cancelar</button>
            <button onClick={handleEditBlock} disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors">{saving ? 'Salvando...' : 'Salvar alterações'}</button>
          </div>
        </div>
      </Modal>

    </div>
  )
}

function ActionBtn({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-left', danger ? 'bg-zinc-800 hover:bg-red-500/10 text-zinc-400 hover:text-red-400' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300')}>
      {icon}<span className="text-sm">{label}</span>
    </button>
  )
}