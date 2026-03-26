'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import {
  Scissors, Plus, Pencil, Trash2, Clock,
  DollarSign, ToggleLeft, ToggleRight, GripVertical,
  AlertTriangle, Tag, ChevronDown, ChevronRight,
  Sparkles, Check, Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Service, ServiceCategory } from '@/types/database'

const EMPTY_FORM = {
  name: '',
  description: '',
  duration_min: 30,
  price: 0,
  is_active: true,
  category: [] as ServiceCategory[],
}

const CATEGORIES: ServiceCategory[] = ['Cabelo', 'Barba', 'Combo', 'Químicas', 'Extra']

const CATEGORY_COLORS: Record<ServiceCategory, string> = {
  Cabelo:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Barba:    'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Combo:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Químicas: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  Extra:    'bg-green-500/10 text-green-400 border-green-500/20',
}

const CATEGORY_ICONS: Record<ServiceCategory, string> = {
  Cabelo:   '✂️',
  Barba:    '🪒',
  Combo:    '💈',
  Químicas: '🧪',
  Extra:    '✨',
}

// ─── Templates de serviços sugeridos ──────────────────────────────────────────

interface ServiceTemplate {
  name: string
  description?: string
  category: ServiceCategory[]
  duration_min: number
  price: number
}

const SERVICE_TEMPLATES: ServiceTemplate[] = [
  // Cabelo
  { name: 'Corte Simples',        category: ['Cabelo'],    duration_min: 30,  price: 25  },
  { name: 'Corte Degradê',        category: ['Cabelo'],    duration_min: 45,  price: 40  },
  { name: 'Corte na Tesoura',     category: ['Cabelo'],    duration_min: 45,  price: 45  },
  { name: 'Corte Infantil',       category: ['Cabelo'],    duration_min: 30,  price: 25  },
  // Barba
  { name: 'Barba Simples',        category: ['Barba'],     duration_min: 20,  price: 20  },
  { name: 'Barba Completa',       category: ['Barba'],     duration_min: 30,  price: 35  },
  { name: 'Barba Terapia',        category: ['Barba'],     duration_min: 40,  price: 50, description: 'Toalha quente, navalha e hidratante' },
  // Combo
  { name: 'Combo Corte + Barba',  category: ['Combo'],     duration_min: 60,  price: 55  },
  { name: 'Combo Premium',        category: ['Combo'],     duration_min: 75,  price: 75, description: 'Corte + barba completa com toalha quente' },
  // Químicas
  { name: 'Relaxamento',          category: ['Químicas'],  duration_min: 90,  price: 80  },
  { name: 'Progressiva',          category: ['Químicas'],  duration_min: 120, price: 120 },
  // Extra
  { name: 'Hidratação Capilar',   category: ['Extra'],     duration_min: 30,  price: 40  },
  { name: 'Sobrancelha',          category: ['Extra'],     duration_min: 15,  price: 15  },
]

function fmt_price(price: number) {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmt_duration(min: number) {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${m}min` : `${h}h`
}

function normalize(s: Service): Service {
  return { ...s, category: s.category ?? [] }
}

interface DuplicateWarning {
  type: 'exact' | 'similar'
  service: Service
}

interface Props {
  barbershopId: string
  initialServices: Service[]
  subscriptionExpired?: boolean
  graceDays?: number
}

export function ServicosClient({ barbershopId, initialServices, subscriptionExpired = false, graceDays = 0 }: Props) {
  const supabase = createClient()
  const [services, setServices] = useState<Service[]>(initialServices.map(normalize))
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState<Service | null>(null)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateWarning | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [showTemplates, setShowTemplates]         = useState(initialServices.length <= 5)
  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(new Set())
  const [addingTemplates, setAddingTemplates]     = useState(false)

  // Templates disponíveis: exclui serviços já cadastrados pelo nome
  const availableTemplates = useMemo(
    () => SERVICE_TEMPLATES.filter(t =>
      !services.some(s => s.name.toLowerCase() === t.name.toLowerCase())
    ),
    [services]
  )
  const [filterCat, setFilterCat] = useState<ServiceCategory | 'Todos' | 'Sem categoria'>('Todos')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [sortBy, setSortBy] = useState<'ordem' | 'nome' | 'preco_asc' | 'preco_desc' | 'duracao'>('ordem')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchServices = useCallback(async () => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
    setServices((data ?? []).map(normalize))
  }, [supabase, barbershopId])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!form.name.trim() || form.name.trim().length < 3) { setDuplicate(null); return }
    debounceRef.current = setTimeout(() => {
      const q = form.name.trim().toLowerCase()
      const others = services.filter(s => s.id !== editing?.id)
      const exact = others.find(s => s.name.toLowerCase() === q)
      if (exact) { setDuplicate({ type: 'exact', service: exact }); return }
      const similar = others.find(s =>
        s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase())
      )
      setDuplicate(similar ? { type: 'similar', service: similar } : null)
    }, 400)
  }, [form.name, services, editing])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError(null)
    setDuplicate(null)
    setModalOpen(true)
  }

  function openEdit(service: Service) {
    setEditing(service)
    setForm({
      name: service.name,
      description: service.description ?? '',
      duration_min: service.duration_min,
      price: service.price,
      is_active: service.is_active,
      category: service.category ?? [],
    })
    setError(null)
    setDuplicate(null)
    setModalOpen(true)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }))
  }

  function toggleCat(cat: ServiceCategory) {
    setForm(prev => {
      const cats = prev.category ?? []
      return {
        ...prev,
        category: cats.includes(cat) ? cats.filter(c => c !== cat) : [...cats, cat]
      }
    })
  }

  function applyField(field: 'price' | 'duration_min') {
    if (!duplicate) return
    setForm(prev => ({ ...prev, [field]: duplicate.service[field] }))
  }

  async function handleSave(force = false) {
    if (!form.name.trim()) { setError('Nome do serviço é obrigatório.'); return }
    if (form.price < 0) { setError('Preço não pode ser negativo.'); return }
    if (form.duration_min < 5) { setError('Duração mínima é 5 minutos.'); return }
    if (duplicate?.type === 'exact' && !force) {
      setError('Já existe um serviço com esse nome. Confirme abaixo para salvar mesmo assim.')
      return
    }
    setSaving(true)
    setError(null)

    if (editing) {
      const { error } = await supabase.from('services').update({
        name: form.name.trim(),
        description: form.description.trim() || null,
        duration_min: form.duration_min,
        price: form.price,
        is_active: form.is_active,
        category: form.category,
      }).eq('id', editing.id)
      if (error) { setError('Erro ao salvar.'); setSaving(false); return }
    } else {
      const { error } = await supabase.from('services').insert({
        barbershop_id: barbershopId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        duration_min: form.duration_min,
        price: form.price,
        is_active: form.is_active,
        category: form.category,
        display_order: services.length,
      })
      if (error) { setError('Erro ao criar serviço.'); setSaving(false); return }
    }

    await fetchServices()
    setModalOpen(false)
    setSaving(false)
  }

  async function handleToggle(service: Service) {
    setServices(prev => prev.map(s => s.id === service.id ? { ...s, is_active: !s.is_active } : s))
    await supabase.from('services').update({ is_active: !service.is_active }).eq('id', service.id)
  }

  async function handleDelete() {
    if (!deleteModal) return
    setServices(prev => prev.filter(s => s.id !== deleteModal.id))
    await supabase.from('services').delete().eq('id', deleteModal.id)
    setDeleteModal(null)
  }

  // ── Handlers templates ───────────────────────────────────────────────────

  function toggleTemplate(idx: number) {
    setSelectedTemplates(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function toggleAllTemplates() {
    setSelectedTemplates(prev =>
      prev.size === availableTemplates.length
        ? new Set()
        : new Set(availableTemplates.map((_, i) => i))
    )
  }

  async function handleAddTemplates() {
    if (selectedTemplates.size === 0) return
    setAddingTemplates(true)

    const toInsert = Array.from(selectedTemplates).map((idx, order) => ({
      barbershop_id: barbershopId,
      name:         availableTemplates[idx].name,
      description:  availableTemplates[idx].description ?? null,
      duration_min: availableTemplates[idx].duration_min,
      price:        availableTemplates[idx].price,
      is_active:    true,
      category:     availableTemplates[idx].category,
      display_order: services.length + order,
    }))

    await supabase.from('services').insert(toInsert)
    await fetchServices()
    setShowTemplates(false)
    setAddingTemplates(false)
  }

  function toggleGroup(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Filtragem
  const filteredServices = services
    .filter(s => {
      if (filterStatus === 'ativo') return s.is_active
      if (filterStatus === 'inativo') return !s.is_active
      return true
    })
    .filter(s => {
      if (filterCat === 'Todos') return true
      if (filterCat === 'Sem categoria') return (s.category ?? []).length === 0
      return (s.category ?? []).includes(filterCat as ServiceCategory)
    })
    .sort((a, b) => {
      if (sortBy === 'nome') return a.name.localeCompare(b.name)
      if (sortBy === 'preco_asc') return a.price - b.price
      if (sortBy === 'preco_desc') return b.price - a.price
      if (sortBy === 'duracao') return a.duration_min - b.duration_min
      return a.display_order - b.display_order
    })

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filteredServices.filter(s => (s.category ?? []).includes(cat))
    if (items.length > 0) acc[cat] = items
    return acc
  }, {} as Record<string, Service[]>)

  const uncategorized = filteredServices.filter(s => (s.category ?? []).length === 0)
  const activeCount = services.filter(s => s.is_active).length
  const formCats = form.category ?? []

  return (
    <div className="max-w-3xl mx-auto">

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Serviços</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {services.length} cadastrados · {activeCount} ativos
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Botão sutil de sugestões para quem já tem serviços suficientes */}
          {!subscriptionExpired && services.length > 5 && availableTemplates.length > 0 && (
            <button
              onClick={() => { setShowTemplates(v => !v); setSelectedTemplates(new Set()) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all',
                showTemplates
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200'
              )}
            >
              <Sparkles size={12} />
              Sugestões
            </button>
          )}
          <button
            onClick={subscriptionExpired ? undefined : openCreate}
            disabled={subscriptionExpired}
            title={subscriptionExpired ? 'Renove sua assinatura para adicionar serviços' : undefined}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors',
              subscriptionExpired
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-400 text-black'
            )}
          >
            {subscriptionExpired ? <Lock size={14} /> : <Plus size={16} />}
            Novo serviço
          </button>
        </div>
      </div>

      {/* Subscription expired banner */}
      {subscriptionExpired && (
        <div className={`flex items-start gap-3 border rounded-xl px-4 py-3 mb-6 text-sm ${graceDays > 0 ? 'bg-orange-500/5 border-orange-500/20 text-orange-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
          <Lock size={14} className="shrink-0 mt-0.5" />
          <span>
            {graceDays > 0
              ? <>Assinatura expirada — edição de serviços suspensa. Você tem <strong>{graceDays} dia{graceDays !== 1 ? 's' : ''}</strong> para regularizar antes de perder acesso completo à plataforma. </>
              : 'Assinatura expirada — edição de serviços suspensa. '
            }
            <a href="/dashboard/planos" className="underline underline-offset-2 hover:opacity-80">Renovar agora</a>
          </span>
        </div>
      )}

      {/* ── Painel de templates ── */}
      {showTemplates && availableTemplates.length > 0 && (
        <div className="mb-8 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">

          {/* Header do painel */}
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <Sparkles size={14} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Serviços sugeridos</p>
                <p className="text-xs text-zinc-500">Selecione os que fazem sentido para sua barbearia e adicione com um clique</p>
              </div>
            </div>
            <button
              onClick={() => setShowTemplates(false)}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
            >
              Pular
            </button>
          </div>

          {/* Cards por categoria */}
          <div className="p-5 space-y-5">
            {CATEGORIES.map(cat => {
              const items = availableTemplates
                .map((t, i) => ({ t, i }))
                .filter(({ t }) => t.category.includes(cat))
              if (items.length === 0) return null
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', CATEGORY_COLORS[cat])}>
                      {CATEGORY_ICONS[cat]} {cat}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map(({ t, i }) => {
                      const selected = selectedTemplates.has(i)
                      return (
                        <button
                          key={i}
                          onClick={() => toggleTemplate(i)}
                          className={cn(
                            'flex items-start gap-3 text-left px-4 py-3 rounded-xl border transition-all',
                            selected
                              ? 'bg-amber-500/10 border-amber-500/40'
                              : 'bg-zinc-800/40 border-zinc-800 hover:border-zinc-600'
                          )}
                        >
                          <div className={cn(
                            'mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all',
                            selected ? 'bg-amber-500 border-amber-500' : 'border-zinc-600'
                          )}>
                            {selected && <Check size={10} className="text-black" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white leading-snug">{t.name}</p>
                            {t.description && (
                              <p className="text-xs text-zinc-500 mt-0.5 truncate">{t.description}</p>
                            )}
                            <p className="text-xs text-zinc-400 mt-1">
                              <span className="text-amber-500 font-medium">{fmt_price(t.price)}</span>
                              <span className="text-zinc-600 mx-1">·</span>
                              {fmt_duration(t.duration_min)}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer de ações */}
          <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={toggleAllTemplates}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {selectedTemplates.size === availableTemplates.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
            <div className="flex items-center gap-3">
              {selectedTemplates.size > 0 && (
                <span className="text-xs text-zinc-500">
                  {selectedTemplates.size} selecionado{selectedTemplates.size !== 1 ? 's' : ''}
                </span>
              )}
              <button
                onClick={handleAddTemplates}
                disabled={selectedTemplates.size === 0 || addingTemplates}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <Plus size={14} />
                {addingTemplates
                  ? 'Adicionando…'
                  : selectedTemplates.size === 0
                    ? 'Selecione ao menos um'
                    : `Adicionar ${selectedTemplates.size} serviço${selectedTemplates.size !== 1 ? 's' : ''}`
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state quando templates foram pulados e não há serviços */}
      {!showTemplates && services.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-xl p-10 text-center">
          <p className="text-zinc-400 text-sm mb-3">Nenhum serviço cadastrado ainda.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={openCreate}
              className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              Criar manualmente
            </button>
            <span className="text-zinc-700">·</span>
            <button
              onClick={() => setShowTemplates(true)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Ver sugestões
            </button>
          </div>
        </div>
      )}

      {/* Barra de filtros */}
      {services.length > 0 && (
        <div className="flex flex-col gap-3 mb-6">

          {/* Filtro por categoria */}
          <div className="flex items-center gap-2 flex-wrap">
            {(['Todos', ...CATEGORIES, 'Sem categoria'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  filterCat === cat
                    ? cat === 'Todos'
                      ? 'bg-white/10 text-white border-white/20'
                      : cat === 'Sem categoria'
                        ? 'bg-zinc-700 text-zinc-300 border-zinc-600'
                        : CATEGORY_COLORS[cat as ServiceCategory]
                    : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                )}
              >
                {cat === 'Todos' ? '✦ Todos' : cat === 'Sem categoria' ? '— Sem categoria' : `${CATEGORY_ICONS[cat as ServiceCategory]} ${cat}`}
              </button>
            ))}
          </div>

          {/* Filtro status + ordenação */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status */}
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              {([
                { value: 'todos', label: 'Todos' },
                { value: 'ativo', label: 'Ativos' },
                { value: 'inativo', label: 'Inativos' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilterStatus(opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    filterStatus === opt.value
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Ordenação */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-400 focus:outline-none focus:border-zinc-600 transition-colors"
            >
              <option value="ordem">Ordenar: Padrão</option>
              <option value="nome">Ordenar: Nome A→Z</option>
              <option value="preco_asc">Ordenar: Menor preço</option>
              <option value="preco_desc">Ordenar: Maior preço</option>
              <option value="duracao">Ordenar: Duração</option>
            </select>

            {/* Contador de resultados */}
            {(filterCat !== 'Todos' || filterStatus !== 'todos') && (
              <span className="text-xs text-zinc-500">
                {filteredServices.length} resultado{filteredServices.length !== 1 ? 's' : ''}
                {' '}
                <button
                  onClick={() => { setFilterCat('Todos'); setFilterStatus('todos') }}
                  className="text-amber-500 hover:text-amber-400 transition-colors"
                >
                  limpar filtros
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Lista vazia por filtro */}
      {services.length > 0 && filteredServices.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-xl p-10 text-center">
          <p className="text-zinc-400 text-sm mb-2">Nenhum serviço encontrado com esse filtro.</p>
          <button
            onClick={() => { setFilterCat('Todos'); setFilterStatus('todos') }}
            className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {services.length > 0 && filteredServices.length > 0 && (
        <div className="space-y-5">
          {CATEGORIES.map(cat => {
            const items = grouped[cat]
            if (!items) return null
            const isCollapsed = collapsed.has(cat)
            return (
              <div key={cat}>
                <button onClick={() => toggleGroup(cat)} className="w-full flex items-center gap-3 mb-2 px-1 group">
                  <div className={cn('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', CATEGORY_COLORS[cat])}>
                    <span>{CATEGORY_ICONS[cat]}</span>
                    <span>{cat}</span>
                  </div>
                  <span className="text-xs text-zinc-600">{items.filter(s => s.is_active).length}/{items.length} ativos</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-2">
                    {items.map(s => (
                      <ServiceCard key={s.id} service={s} onEdit={openEdit} onToggle={handleToggle} onDelete={setDeleteModal} locked={subscriptionExpired} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {uncategorized.length > 0 && (
            <div>
              <button onClick={() => toggleGroup('_none')} className="w-full flex items-center gap-3 mb-2 px-1 group">
                <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-zinc-800/50 text-zinc-500 border-zinc-700">
                  <Tag size={11} /><span>Sem categoria</span>
                </div>
                <span className="text-xs text-zinc-600">{uncategorized.length} serviços</span>
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
                  {collapsed.has('_none') ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>
              {!collapsed.has('_none') && (
                <div className="space-y-2">
                  {uncategorized.map(s => (
                    <ServiceCard key={s.id} service={s} onEdit={openEdit} onToggle={handleToggle} onDelete={setDeleteModal} locked={subscriptionExpired} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {services.length > 0 && (
        <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-3">
          <div className="text-amber-500 mt-0.5">💡</div>
          <div>
            <p className="text-sm text-zinc-300 font-medium">Como funciona no WhatsApp</p>
            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
              No bot, os clientes escolhem a categoria primeiro e veem apenas os serviços daquela categoria. Um serviço pode aparecer em múltiplas categorias.
            </p>
          </div>
        </div>
      )}

      {/* Modal criar/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar serviço' : 'Novo serviço'}>
        <div className="flex flex-col gap-4">

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Nome do serviço *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Ex: Corte Degradê"
              className={cn(
                'bg-zinc-800 border rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none transition-colors',
                duplicate?.type === 'exact' ? 'border-red-500/50 focus:border-red-500' :
                duplicate?.type === 'similar' ? 'border-yellow-500/50 focus:border-yellow-500' :
                'border-zinc-700 focus:border-amber-500'
              )}
            />
            {duplicate?.type === 'exact' && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-red-400 text-xs font-medium">Serviço com esse nome já existe</p>
                    <p className="text-zinc-400 text-xs mt-1">
                      <strong className="text-zinc-300">{duplicate.service.name}</strong> · {fmt_price(duplicate.service.price)} · {fmt_duration(duplicate.service.duration_min)}
                    </p>
                    <button onClick={() => { setModalOpen(false); openEdit(duplicate.service) }} className="text-xs text-amber-500 hover:text-amber-400 mt-1.5 transition-colors">
                      → Editar o serviço existente
                    </button>
                  </div>
                </div>
              </div>
            )}
            {duplicate?.type === 'similar' && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-yellow-400 text-xs font-medium">Serviço similar encontrado</p>
                    <p className="text-zinc-400 text-xs mt-1">
                      <strong className="text-zinc-300">{duplicate.service.name}</strong> · {fmt_price(duplicate.service.price)} · {fmt_duration(duplicate.service.duration_min)}
                    </p>
                    <div className="flex gap-3 mt-2">
                      {duplicate.service.price !== form.price && (
                        <button onClick={() => applyField('price')} className="text-xs text-amber-500 hover:text-amber-400 transition-colors">
                          Usar preço ({fmt_price(duplicate.service.price)})
                        </button>
                      )}
                      {duplicate.service.duration_min !== form.duration_min && (
                        <button onClick={() => applyField('duration_min')} className="text-xs text-amber-500 hover:text-amber-400 transition-colors">
                          Usar duração ({fmt_duration(duplicate.service.duration_min)})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400">Descrição <span className="text-zinc-600">(opcional)</span></label>
            <input
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Ex: Corte na tesoura com acabamento na navalha"
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400"><Clock size={12} className="inline mr-1" />Duração (min)</label>
              <select name="duration_min" value={form.duration_min} onChange={handleChange} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors">
                {[15,20,25,30,35,40,45,50,55,60,75,90,120].map(m => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-400"><DollarSign size={12} className="inline mr-1" />Preço (R$)</label>
              <input name="price" type="number" min="0" step="0.50" value={form.price} onChange={handleChange} placeholder="0,00"
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-400"><Tag size={12} className="inline mr-1" />Categorias</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat} type="button" onClick={() => toggleCat(cat)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    formCats.includes(cat) ? CATEGORY_COLORS[cat] : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500'
                  )}>
                  {CATEGORY_ICONS[cat]} {cat}
                </button>
              ))}
            </div>
            <p className="text-zinc-600 text-xs">
              {formCats.length === 0
                ? 'Selecione uma ou mais categorias'
                : `${formCats.length} categoria${formCats.length > 1 ? 's' : ''} selecionada${formCats.length > 1 ? 's' : ''}`
              }
            </p>
          </div>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
            <p className="text-zinc-500 text-xs mb-2">Preview no bot:</p>
            <p className="text-zinc-200 text-sm">
              {formCats.length > 0 ? CATEGORY_ICONS[formCats[0]] : '💈'}{' '}
              {form.name || 'Nome do serviço'}{' '}
              <span className="text-zinc-400">({fmt_duration(form.duration_min)} · {fmt_price(form.price)})</span>
            </p>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm text-zinc-300">Serviço ativo</p>
              <p className="text-xs text-zinc-600">Disponível para agendamento</p>
            </div>
            <button type="button" onClick={() => setForm(prev => ({ ...prev, is_active: !prev.is_active }))}
              className={cn('transition-colors', form.is_active ? 'text-amber-500' : 'text-zinc-600')}>
              {form.is_active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalOpen(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg py-2.5 text-sm transition-colors">
              Cancelar
            </button>
            {duplicate?.type === 'exact' && error ? (
              <button onClick={() => handleSave(true)} disabled={saving} className="flex-1 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">
                Salvar mesmo assim
              </button>
            ) : (
              <button onClick={() => handleSave(false)} disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors">
                {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar serviço'}
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal delete */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Excluir serviço" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-zinc-400 text-sm leading-relaxed">
            Tem certeza que deseja excluir <strong className="text-white">{deleteModal?.name}</strong>? Agendamentos existentes não serão afetados.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteModal(null)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg py-2.5 text-sm transition-colors">Cancelar</button>
            <button onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">Excluir</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

interface ServiceCardProps {
  service: Service
  onEdit: (s: Service) => void
  onToggle: (s: Service) => void
  onDelete: (s: Service) => void
  locked?: boolean
}

function ServiceCard({ service, onEdit, onToggle, onDelete, locked = false }: ServiceCardProps) {
  return (
    <div className={cn(
      'bg-zinc-900 border rounded-xl px-5 py-4 flex items-center gap-4 transition-all',
      service.is_active ? 'border-zinc-800' : 'border-zinc-800/50 opacity-60'
    )}>
      <div className="text-zinc-700 cursor-grab hidden sm:block">
        <GripVertical size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-medium text-sm">{service.name}</span>
          {!service.is_active && (
            <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">inativo</span>
          )}
        </div>
        {service.description && (
          <p className="text-zinc-500 text-xs mt-0.5 truncate">{service.description}</p>
        )}
        {(service.category ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(service.category ?? []).map(cat => (
              <span key={cat} className={cn('text-xs px-2 py-0.5 rounded-full border', CATEGORY_COLORS[cat])}>
                {CATEGORY_ICONS[cat]} {cat}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 mt-2">
          <span className="flex items-center gap-1 text-xs text-zinc-400">
            <Clock size={11} />{fmt_duration(service.duration_min)}
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-xs text-amber-500 font-medium">{fmt_price(service.price)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(service) }}
          className={cn('p-2 rounded-lg transition-colors',
            service.is_active ? 'text-amber-500 hover:bg-amber-500/10' : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'
          )}
        >
          {service.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (!locked) onEdit(service) }}
          disabled={locked}
          title={locked ? 'Renove sua assinatura para editar' : undefined}
          className={cn('p-2 rounded-lg transition-colors', locked ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800')}
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (!locked) onDelete(service) }}
          disabled={locked}
          title={locked ? 'Renove sua assinatura para excluir' : undefined}
          className={cn('p-2 rounded-lg transition-colors', locked ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10')}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
