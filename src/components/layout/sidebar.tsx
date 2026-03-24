'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  CalendarDays,
  Users,
  Scissors,
  Settings,
  LogOut,
  LayoutDashboard,
  Menu,
  X,
  BarChart2,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  {
    label: 'Visão Geral',
    href: '/dashboard',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: 'Agenda',
    href: '/dashboard/agenda',
    icon: CalendarDays,
  },
  {
    label: 'Clientes',
    href: '/dashboard/clientes',
    icon: Users,
  },
  {
    label: 'Serviços',
    href: '/dashboard/servicos',
    icon: Scissors,
  },
  {
    label: 'Relatórios',
    href: '/dashboard/relatorios',
    icon: BarChart2,
  },
  {
    label: 'Configurações',
    href: '/dashboard/configuracoes',
    icon: Settings,
  },
]

interface SidebarProps {
  barbershopName: string
}

export function Sidebar({ barbershopName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-800">
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <Scissors size={16} className="text-black" />
          </div>
          <div>
            <div className="flex items-center gap-0.5">
              <span className="text-sm font-bold text-white">Barber</span>
              <span className="text-sm font-bold text-amber-500">OS</span>
            </div>
            <p className="text-xs text-zinc-500 leading-none">{barbershopName}</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {navItems.map(item => {
          const Icon = item.icon
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                active
                  ? 'bg-amber-500/10 text-amber-500 font-medium'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              )}
            >
              <Icon size={17} />
              {item.label}
              {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-4 border-t border-zinc-800 pt-3">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
        >
          <LogOut size={17} />
          Sair da conta
        </button>
      </div>

    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-zinc-900 border-r border-zinc-800 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
            <Scissors size={14} className="text-black" />
          </div>
          <div className="flex items-center gap-0.5">
            <span className="text-sm font-bold text-white">Barber</span>
            <span className="text-sm font-bold text-amber-500">OS</span>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-zinc-900 border-r border-zinc-800">
            <div className="pt-16">
              <SidebarContent />
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
