'use client'

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import {
  Users, Plus, Pencil, Trash2, Search,
  Phone, Star, StickyNote, ChevronUp, ChevronDown, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Customer } from '@/types/database'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type SortField = 'name' | 'total_visits' | 'last_visit_at' | 'created_at'
type SortDir = 'asc' | 'desc'

const EMPTY_FORM = { name: '', phone: '', notes: '' }

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return phone
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

function maskPhone(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function isValidPhone(phone: string) {
  const d = normalizePhone(phone)
  return d.length === 10 || d.length === 11
}

interface SortIconProps {
  field: SortField
  sortField: SortField
  sortDir: SortDir
}

function SortIcon({ field, sortField, sortDir }: SortIconProps) {
  if (sortField !== field) return <ChevronUp size={12} className="text-zinc-700" />
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="text-amber-500" />
    : <ChevronDown size={12} className="text-amber-500" />
}

interface Props {
  barbershopId: string
  initialCustomers: Customer[]
}

export function ClientesClient({ barbershopId, initialCustomers }: Props) {
  const supabase = createClient()
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState<Customer | null>(null)
  const [detailModal, setDetailModal] = useState<Customer | null>(null)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('last_visit_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchCustomers = useCallback(async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .order('last_visit_at', { ascending: false, nullsFirst: false })
    setCustomers(data ?? [])
  }, [supabase, barbershopId])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError(null)
    setModalOpen(true)
  }

  function openEdit(customer: Customer) {
    setEditing(customer)
    setForm({
      name: customer.name,
      phone: customer.phone,
      notes: customer.notes ?? '',
    })
    setError(null)
    setModalOpen(true)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: name === 'phone' ? maskPhone(value) : value
    }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nome é obrigatório.'); return }
    if (!form.phone.trim()) { setError('Telefone é obrigatório.'); return }
    const phone = normalizePhone(form.phone)
    if (phone.length < 10) { setError('Telefone inválido.'); return }
    if (!editing) {
      const exists = customers.find(c => normalizePhone(c.phone) === phone)
      if (exists) { setError(`Telefone já cadastrado para: ${exists.name}`); return }
    }
    setSaving(true)
    setError(null)
    if (editing) {
      const { error } = await supabase
        .from('customers')
        .update({ name: form.name.trim(), phone, notes: form.notes.trim() || null })
        .eq('id', editing.id)
      if (error) { setError('Erro ao salvar.'); setSaving(false); return }
    } else {
      const { error } = await supabase
        .from('customers')
        .insert({ barbershop_id: barbershopId, name: form.name.trim(), phone, notes: form.notes.trim() || null })
      if (error) { setError('Erro ao criar cliente.'); setSaving(false); return }
    }
    await fetchCustomers()
    setModalOpen(false)
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteModal) return
    setCustomers(prev => prev.filter(c => c.id !== deleteModal.id))
    await supabase.from('customers').delete().eq('id', deleteModal.id)
    setDeleteModal(null)
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return customers
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q))
      .sort((a, b) => {
        let cmp = 0
        if (sortField === 'name') cmp = a.name.localeCompare(b.name)
        else if (sortField === 'total_visits') cmp = (a.total_visits ?? 0) - (b.total_visits ?? 0)
        else if (sortField === 'last_visit_at') {
          const da = a.last_visit_at ? new Date(a.last_visit_at).getTime() : 0
          const db = b.last_visit_at ? new Date(b.last_visit_at).getTime() : 0
          cmp = da - db
        } else {
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [customers, search, sortField, sortDir])

  const vipCount = customers.filter(c => (c.total_visits ?? 0) >= 10).length
  const newCount = customers.filter(c => {
    const days = (Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)
    return days <= 30
  }).length

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {customers.length} cadastrados · {vipCount} VIP · {newCount} novos este mês
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
        >
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      {/* Busca */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-9 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Lista vazia */}
      {customers.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={20} className="text-zinc-600" />
          </div>
          <h3 className="text-white font-medium mb-1">Nenhum cliente cadastrado</h3>
          <p className="text-zinc-500 text-sm mb-5">
            Clientes são criados automaticamente quando agendam pelo WhatsApp, ou você pode adicionar manualmente.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
          >
            <Plus size={16} /> Adicionar cliente
          </button>
        </div>
      )}

      {/* Tabela */}
      {customers.length > 0 && (
        <div>
          {filtered.length === 0 && search && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center mb-4">
              <p className="text-zinc-400 text-sm">Nenhum cliente encontrado para &quot;{search}&quot;</p>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              {/* Header tabela */}
              <div className="grid grid-cols-[1fr_140px_100px_110px_80px] gap-4 px-5 py-3 border-b border-zinc-800 bg-zinc-800/30">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 text-left"
                >
                  Cliente <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                </button>
                <button
                  onClick={() => handleSort('last_visit_at')}
                  className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300"
                >
                  Última visita <SortIcon field="last_visit_at" sortField={sortField} sortDir={sortDir} />
                </button>
                <button
                  onClick={() => handleSort('total_visits')}
                  className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300"
                >
                  Visitas <SortIcon field="total_visits" sortField={sortField} sortDir={sortDir} />
                </button>
                <span className="text-xs font-medium text-zinc-500">Telefone</span>
                <span className="text-xs font-medium text-zinc-500">Ações</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-zinc-800">
                {filtered.map(customer => {
                  const isVip = (customer.total_visits ?? 0) >= 10
                  return (
                    <div
                      key={customer.id}
                      className="grid grid-cols-[1fr_140px_100px_110px_80px] gap-4 px-5 py-3.5 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                      onClick={() => setDetailModal(customer)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 text-sm font-medium text-zinc-300">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-white font-medium truncate">{customer.name}</span>
                            {isVip && <Star size={11} className="text-amber-500 shrink-0" fill="currentColor" />}
                          </div>
                          {customer.notes && (
                            <p className="text-xs text-zinc-600 truncate flex items-center gap-1">
                              <StickyNote size={10} />{customer.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        {customer.last_visit_at
                          ? <span className="text-xs text-zinc-400">{formatDistanceToNow(new Date(customer.last_visit_at), { locale: ptBR, addSuffix: true })}</span>
                          : <span className="text-xs text-zinc-600">Nunca</span>
                        }
                      </div>
                      <div className="flex items-center">
                        <span className={cn('text-sm font-medium', isVip ? 'text-amber-500' : 'text-zinc-300')}>
                          {customer.total_visits ?? 0}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs text-zinc-400 font-mono">{formatPhone(customer.phone)}</span>
                      </div>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openEdit(customer)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteModal(customer)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-800/20">
                <p className="text-xs text-zinc-600">
                  {filtered.length === customers.length
                    ? `${customers.length} clientes`
                    : `${filtered.length} de ${customers.length} clientes`
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal criar/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar cliente' : 'Novo cliente'}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Nome *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Ex: João Silva"
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">WhatsApp / Telefone *</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="(11) 99999-9999"
              maxLength={15}
              className={cn(
                'bg-zinc-800 border rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none transition-colors',
                form.phone && !isValidPhone(form.phone)
                  ? 'border-red-500/50 focus:border-red-500'
                  : form.phone && isValidPhone(form.phone)
                    ? 'border-green-500/50 focus:border-green-500'
                    : 'border-zinc-700 focus:border-amber-500'
              )}
            />
            <p className="text-xs">
              {form.phone && !isValidPhone(form.phone)
                ? <span className="text-red-400">Telefone incompleto — DDD + 8 ou 9 dígitos</span>
                : form.phone && isValidPhone(form.phone)
                  ? <span className="text-green-500">✓ Telefone válido</span>
                  : <span className="text-zinc-600">Ex: (11) 99999-9999</span>
              }
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Observações <span className="text-zinc-600">(opcional)</span></label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Ex: Prefere tesoura, alérgico a produto X..."
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setModalOpen(false)}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar cliente'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal detalhe */}
      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title="Perfil do cliente">
        {detailModal && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl font-bold text-zinc-300">
                {detailModal.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-semibold text-lg">{detailModal.name}</h3>
                  {(detailModal.total_visits ?? 0) >= 10 && (
                    <span className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      <Star size={10} fill="currentColor" /> VIP
                    </span>
                  )}
                </div>
                <p className="text-zinc-500 text-sm">{formatPhone(detailModal.phone)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-white">{detailModal.total_visits ?? 0}</div>
                <div className="text-xs text-zinc-500 mt-0.5">Visitas</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <div className="text-sm font-bold text-white">
                  {detailModal.last_visit_at
                    ? format(new Date(detailModal.last_visit_at), 'dd/MM/yy')
                    : '—'
                  }
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">Última visita</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <div className="text-sm font-bold text-white">
                  {format(new Date(detailModal.created_at), 'dd/MM/yy')}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">Cliente desde</div>
              </div>
            </div>

            {detailModal.notes && (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                  <StickyNote size={11} /> Observações
                </p>
                <p className="text-sm text-zinc-300">{detailModal.notes}</p>
              </div>
            )}

            <div className="flex gap-2">
              <a
                href={`https://wa.me/55${detailModal.phone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                <Phone size={14} /> WhatsApp
              </a>
              <button
                onClick={() => { setDetailModal(null); openEdit(detailModal) }}
                className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                <Pencil size={14} /> Editar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal delete */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Excluir cliente" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-zinc-400 text-sm leading-relaxed">
            Tem certeza que deseja excluir <strong className="text-white">{deleteModal?.name}</strong>? O histórico de agendamentos não será afetado.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteModal(null)}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              Excluir
            </button>
          </div>
        </div>
      </Modal>

    </div>
  )
}