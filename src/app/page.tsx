import Link from 'next/link'
import {
  Check, X, CalendarDays, MessageCircle,
  BarChart3, Link2, Scissors, ArrowRight,
  Clock, Users, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PricingSection } from './pricing-section'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between h-16">

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
              <Scissors size={14} className="text-black" />
            </div>
            <span className="text-lg font-bold">
              Barber<span className="text-amber-500">OS</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-7">
            <a href="#recursos" className="text-sm text-zinc-400 hover:text-white transition-colors">Recursos</a>
            <a href="#como-funciona" className="text-sm text-zinc-400 hover:text-white transition-colors">Como funciona</a>
            <a href="#planos" className="text-sm text-zinc-400 hover:text-white transition-colors">Planos</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-flex text-sm text-zinc-400 hover:text-white transition-colors font-medium"
            >
              Entrar
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Começar grátis
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-amber-500/6 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 pt-20 pb-24 text-center">

          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
            <MessageCircle size={12} />
            Novo: Chatbot de agendamento via WhatsApp
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            Sua barbearia no{' '}
            <span className="text-amber-500">piloto automático</span>
          </h1>

          <p className="text-zinc-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Agenda online, gestão de clientes, relatórios e bot de WhatsApp que agenda por você
            — tudo em um só lugar. Menos trabalho, mais clientes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-7 py-3.5 rounded-xl text-base transition-colors shadow-lg shadow-amber-500/20"
            >
              Criar conta grátis
              <ArrowRight size={16} />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-7 py-3.5 rounded-xl text-base transition-colors border border-zinc-700"
            >
              Ver como funciona
            </a>
          </div>

          <p className="text-zinc-600 text-sm">
            Sem cartão de crédito · Configuração em 5 minutos · Cancele quando quiser
          </p>
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="border-y border-zinc-800 bg-zinc-900/40">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '5 min', label: 'para configurar' },
              { value: '24/7', label: 'bot respondendo' },
              { value: '0 ligações', label: 'para agendar' },
              { value: '100%', label: 'online e seguro' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-bold text-amber-500 mb-0.5">{stat.value}</p>
                <p className="text-zinc-500 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recursos ── */}
      <section id="recursos" className="mx-auto max-w-6xl px-4 sm:px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-amber-500 text-sm font-semibold uppercase tracking-widest mb-3">Recursos</p>
          <h2 className="text-3xl sm:text-4xl font-bold">Tudo que sua barbearia precisa</h2>
          <p className="text-zinc-400 mt-3 max-w-xl mx-auto">
            Uma plataforma completa construída especialmente para barbearias — sem burocracia, sem aprendizado longo.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              Icon: CalendarDays,
              color: 'text-amber-500 bg-amber-500/10',
              title: 'Agenda Inteligente',
              desc: 'Visão dia, semana e mês. Crie, edite e cancele agendamentos com facilidade. Bloqueie horários com um clique.',
            },
            {
              Icon: MessageCircle,
              color: 'text-green-400 bg-green-400/10',
              title: 'Chatbot WhatsApp',
              desc: 'Bot que agenda, confirma e cancela horários automaticamente — sem você precisar responder nada.',
            },
            {
              Icon: Link2,
              color: 'text-blue-400 bg-blue-400/10',
              title: 'Book Público',
              desc: 'Link personalizado para seus clientes agendarem sozinhos, direto do celular, a qualquer hora.',
            },
            {
              Icon: Users,
              color: 'text-purple-400 bg-purple-400/10',
              title: 'Gestão de Clientes',
              desc: 'Histórico completo de visitas. Identifique seus clientes VIP e nunca perca um contato.',
            },
            {
              Icon: BarChart3,
              color: 'text-orange-400 bg-orange-400/10',
              title: 'Relatórios & Insights',
              desc: 'Acompanhe faturamento, serviços mais vendidos e crescimento em gráficos simples de entender.',
            },
            {
              Icon: TrendingUp,
              color: 'text-pink-400 bg-pink-400/10',
              title: 'Promoções via Bot',
              desc: 'Envie lembretes e promoções para sua base de clientes pelo WhatsApp. Disponível no Premium.',
            },
          ].map((feat) => (
            <div
              key={feat.title}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-600 transition-colors"
            >
              <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center mb-4', feat.color)}>
                <feat.Icon size={22} />
              </div>
              <h3 className="font-semibold text-white mb-2">{feat.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Problema → Solução ── */}
      <section className="bg-zinc-900/50 border-y border-zinc-800">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">

            <div>
              <p className="text-red-400 text-sm font-semibold uppercase tracking-widest mb-4">O problema</p>
              <h2 className="text-2xl sm:text-3xl font-bold mb-6 leading-snug">
                Gerenciar barbearia do jeito antigo é{' '}
                <span className="text-red-400">caos</span>
              </h2>
              <ul className="space-y-3">
                {[
                  'Clientes ligando e mandando mensagem o tempo todo',
                  'Agenda bagunçada em papel ou caderno',
                  'Horários esquecidos e clientes que não aparecem',
                  'Sem controle de faturamento ou desempenho',
                  'Zero automação — tudo na mão',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-zinc-400 text-sm">
                    <X size={16} className="text-red-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-amber-500 text-sm font-semibold uppercase tracking-widest mb-4">A solução</p>
              <h2 className="text-2xl sm:text-3xl font-bold mb-6 leading-snug">
                Com o BarberOS, sua barbearia{' '}
                <span className="text-amber-500">trabalha por você</span>
              </h2>
              <ul className="space-y-3">
                {[
                  'Bot responde e agenda automaticamente pelo WhatsApp',
                  'Agenda digital organizada, acessível de qualquer lugar',
                  'Lembretes automáticos reduzem faltas',
                  'Relatórios mostram o que está dando lucro',
                  'Link de agendamento para clientes acessarem sozinhos',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-zinc-300 text-sm">
                    <Check size={16} className="text-amber-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section id="como-funciona" className="mx-auto max-w-5xl px-4 sm:px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-amber-500 text-sm font-semibold uppercase tracking-widest mb-3">Como funciona</p>
          <h2 className="text-3xl sm:text-4xl font-bold">Pronto em 3 passos</h2>
          <p className="text-zinc-400 mt-3">Sem técnico, sem complicação. Você mesmo configura em minutos.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: '01',
              Icon: Scissors,
              title: 'Crie sua conta',
              desc: 'Cadastre a barbearia com nome, foto, endereço e horários de funcionamento.',
              highlight: true,
            },
            {
              step: '02',
              Icon: Clock,
              title: 'Configure seus serviços',
              desc: 'Adicione cortes, barbas e combos com preço e duração. Pronto para receber.',
              highlight: false,
            },
            {
              step: '03',
              Icon: Link2,
              title: 'Compartilhe e receba',
              desc: 'Envie seu link e conecte o bot WhatsApp. Clientes agendam sozinhos, 24 horas.',
              highlight: false,
            },
          ].map((item) => (
            <div
              key={item.step}
              className={cn(
                'border rounded-2xl p-6',
                item.highlight
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-zinc-800 bg-zinc-900'
              )}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 bg-zinc-800 rounded-xl flex items-center justify-center text-white">
                  <item.Icon size={20} />
                </div>
                <span className={cn(
                  'text-4xl font-black',
                  item.highlight ? 'text-amber-500/30' : 'text-zinc-700'
                )}>
                  {item.step}
                </span>
              </div>
              <h3 className="font-bold text-white mb-2">{item.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Planos ── */}
      <PricingSection />

      {/* ── FAQ ── */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 py-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold">Perguntas frequentes</h2>
        </div>

        <div className="space-y-3">
          {[
            {
              q: 'Preciso de conhecimento técnico para configurar?',
              a: 'Não. A configuração é feita pelo painel em poucos minutos. Se tiver dúvida, temos suporte via e-mail.',
            },
            {
              q: 'O bot do WhatsApp precisa de alguma conta especial?',
              a: 'Não. O bot funciona com o número normal de WhatsApp que você já usa na barbearia — sem precisar de WhatsApp Business API ou qualquer conta paga.',
            },
            {
              q: 'O que acontece quando o trial acaba?',
              a: 'Você escolhe um plano para continuar. Se não assinar, o acesso é pausado — seus dados ficam salvos por 30 dias.',
            },
            {
              q: 'Posso cancelar a qualquer momento?',
              a: 'Sim, sem multas ou burocracia. O cancelamento é feito direto pelo painel.',
            },
            {
              q: 'O sistema funciona no celular?',
              a: 'Sim. O painel é totalmente responsivo e funciona em qualquer dispositivo. O link de agendamento dos clientes também pode ser adicionado à tela inicial (PWA).',
            },
          ].map((item) => (
            <details
              key={item.q}
              className="group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
            >
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-sm font-medium text-white select-none list-none hover:bg-zinc-800/40 transition-colors">
                {item.q}
                <ArrowRight size={14} className="text-zinc-500 shrink-0 transition-transform duration-200 group-open:rotate-90" />
              </summary>
              <div className="px-5 pb-4 border-t border-zinc-800">
                <p className="text-zinc-400 text-sm leading-relaxed pt-3">{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className="border-t border-zinc-800 bg-zinc-900/30">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-24 text-center">
          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/25">
            <Scissors size={24} className="text-black" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
            Comece hoje. É grátis.
          </h2>
          <p className="text-zinc-400 text-lg mb-8 max-w-md mx-auto">
            Sem cartão de crédito. Sem burocracia.<br />Sua barbearia organizada em minutos.
          </p>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 py-4 rounded-xl text-base transition-colors shadow-lg shadow-amber-500/20"
          >
            Criar minha conta grátis
            <ArrowRight size={16} />
          </Link>

          <p className="text-zinc-600 text-sm mt-5">
            Já tem uma conta?{' '}
            <Link href="/login" className="text-zinc-400 hover:text-white transition-colors underline underline-offset-2">
              Fazer login
            </Link>
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-amber-500 rounded-md flex items-center justify-center">
                <Scissors size={11} className="text-black" />
              </div>
              <span className="font-bold text-sm">
                Barber<span className="text-amber-500">OS</span>
              </span>
            </div>

            <div className="flex items-center gap-6">
              <a href="#recursos" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Recursos</a>
              <a href="#planos" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Planos</a>
              <Link href="/login" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Entrar</Link>
            </div>

            <p className="text-xs text-zinc-700">
              © {new Date().getFullYear()} BarberOS. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}
