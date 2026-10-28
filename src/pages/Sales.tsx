import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Calendar,
  Building2,
  FileSpreadsheet,
  ShieldCheck,
  BellRing,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Lock,
  Zap,
  HelpCircle,
  Clock,
  Briefcase,
  Users,
  AlertTriangle,
  BadgeCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLogo } from '@/components/AppLogo'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  getStripeCheckoutConfig,
  FALLBACK_CHECKOUT_CONFIG,
  StripeCheckoutConfig,
} from '@/lib/stripeCheckout'

export const Sales: React.FC = () => {
  const [config, setConfig] = useState<StripeCheckoutConfig>(FALLBACK_CHECKOUT_CONFIG)
  const [loadingCheckout, setLoadingCheckout] = useState(true)

  // Garante que a página de vendas pública se apresente sempre em tema claro
  useEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    root.classList.remove('dark')
    return () => {
      // Restaura caso o usuário estivesse com tema escuro selecionado no app interno
      const stored = localStorage.getItem('ae_app_theme')
      if (stored === 'dark' || (hadDark && stored !== 'light')) {
        root.classList.add('dark')
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    getStripeCheckoutConfig()
      .then((cfg) => {
        if (isMounted && cfg) {
          setConfig(cfg)
        }
      })
      .catch((err) => {
        console.warn('Erro ao carregar checkout Stripe:', err)
      })
      .finally(() => {
        if (isMounted) setLoadingCheckout(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  const handleCheckout = (url: string) => {
    if (url) {
      window.location.href = url
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 selection:bg-[#54D769]/30 selection:text-slate-900">
      {/* Top Notification / Banner */}
      <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 text-center text-xs sm:text-sm font-medium text-emerald-900 flex items-center justify-center gap-2">
        <Sparkles className="h-4 w-4 text-[#2CA840] shrink-0" />
        <span>
          <strong>Lançamento Especial:</strong> Escolha entre os planos{' '}
          <strong className="text-emerald-950 font-bold">Mensal</strong> (R${' '}
          {config.monthly?.price_label || '297,00'}) e{' '}
          <strong className="text-emerald-950 font-bold">Anual com 2 meses grátis</strong> (R${' '}
          {config.annual?.price_label || '2.970,00'}).
        </span>
      </div>

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/vendas" className="hover:opacity-90 transition-opacity">
            <AppLogo variant="light-bg" size="md" layout="compact" />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#beneficios" className="hover:text-emerald-700 transition-colors">
              Benefícios
            </a>
            <a href="#como-funciona" className="hover:text-emerald-700 transition-colors">
              Como funciona
            </a>
            <a href="#para-quem-e" className="hover:text-emerald-700 transition-colors">
              Público-alvo
            </a>
            <a href="#precos" className="hover:text-emerald-700 transition-colors">
              Planos & Preços
            </a>
            <a href="#faq" className="hover:text-emerald-700 transition-colors">
              Dúvidas
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-xs sm:text-sm text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg transition-colors font-medium hover:bg-slate-100"
            >
              Já sou cliente
            </Link>
            <a
              href="#precos"
              className="inline-flex items-center justify-center bg-gradient-to-r from-[#54D769] to-[#2CA840] hover:from-[#43c457] hover:to-[#228734] text-white font-bold shadow-sm shadow-emerald-500/20 px-5 py-2.5 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] text-sm"
            >
              Ver Planos
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 bg-gradient-to-b from-white via-slate-50/50 to-slate-50/80">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-emerald-100/40 blur-[130px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-8 shadow-xs">
            <ShieldCheck className="h-4 w-4 text-[#2CA840]" />
            Gestão Jurídica & Operacional de Contratos de Experiência
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 leading-tight">
            Nunca mais perca o prazo de{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2CA840] via-[#54D769] to-[#238734]">
              45 e 90 dias
            </span>{' '}
            do contrato de experiência.
          </h1>

          <p className="mt-6 text-base sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Elimine riscos trabalhistas, padronize critérios de avaliação por centro de custo e
            setor, e tome decisões embasadas de efetivação ou desligamento com auditoria completa.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#precos"
              className="w-full sm:w-auto h-14 px-8 inline-flex items-center justify-center text-base font-extrabold bg-gradient-to-r from-[#54D769] to-[#2CA840] hover:from-[#43c457] hover:to-[#228734] text-white rounded-xl shadow-md shadow-emerald-500/25 transition-all transform hover:scale-[1.03]"
            >
              Escolher plano & assinar
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
            <a
              href="#como-funciona"
              className="w-full sm:w-auto h-14 px-6 inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold shadow-xs transition-colors"
            >
              Ver demonstração
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-slate-500">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#2CA840]" />
              <span>Sem taxa de adesão</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#2CA840]" />
              <span>Cancele a qualquer momento</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#2CA840]" />
              <span>Pagamento 100% seguro via Stripe</span>
            </div>
          </div>

          {/* Mockup / Dashboard Preview Card */}
          <div className="mt-14 relative rounded-2xl p-2 bg-gradient-to-b from-emerald-200/60 via-slate-200/40 to-slate-200/20 shadow-xl border border-slate-200/80">
            <div className="rounded-xl overflow-hidden bg-white border border-slate-200 text-left">
              <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="ml-3 text-xs text-slate-500 font-mono">
                    app.avaliacaodeexperiencia.com.br
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-md">
                  <span className="w-2 h-2 rounded-full bg-[#2CA840] animate-ping" />
                  Monitoramento diário ativo
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
                    <span>1ª Avaliação (45 dias)</span>
                    <Clock className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">12 colaboradores</div>
                  <p className="text-xs text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 8 avaliados no prazo legal
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
                    <span>2ª Avaliação (90 dias)</span>
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">7 decisões finais</div>
                  <p className="text-xs text-blue-700 font-medium mt-1">
                    Efetivação ou término do contrato
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
                    <span>Alertas Preventivos</span>
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-amber-700">5 dias de antecedência</div>
                  <p className="text-xs text-slate-500 mt-1">
                    Disparos por centro de custo e e-mail
                  </p>
                </div>
              </div>

              <div className="px-6 pb-6 overflow-x-auto">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Colaboradores em Acompanhamento Ativo
                </div>
                <div className="space-y-2">
                  {[
                    {
                      nome: 'Carlos Eduardo Mendes',
                      cargo: 'Encarregado de Obras',
                      cc: 'Obra Residencial Jardim',
                      etapa: '45 dias',
                      status: 'Em prazo (faltam 4 dias)',
                      statusColor: 'text-emerald-800 bg-emerald-50 border-emerald-200',
                    },
                    {
                      nome: 'Mariana Souza Santos',
                      cargo: 'Analista Financeiro Pleno',
                      cc: 'Escritório Central',
                      etapa: '90 dias',
                      status: 'Avaliação Concluída (Efetivada)',
                      statusColor: 'text-blue-800 bg-blue-50 border-blue-200',
                    },
                    {
                      nome: 'Rafael Nogueira Lima',
                      cargo: 'Assistente Administrativo',
                      cc: 'Unidade Centro',
                      etapa: '45 dias',
                      status: 'Aguardando Avaliador',
                      statusColor: 'text-amber-800 bg-amber-50 border-amber-200',
                    },
                  ].map((row, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50/70 border border-slate-200 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{row.nome}</div>
                        <div className="text-slate-500 text-xs">
                          {row.cargo} • <span className="text-slate-700 font-medium">{row.cc}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono font-medium">
                          {row.etapa}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-md border font-semibold ${row.statusColor}`}
                        >
                          {row.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* O PROBLEMA / RISCOS CLT */}
      <section className="py-16 bg-white border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs uppercase tracking-widest text-[#2CA840] font-bold">
              O Risco Invisível do RH
            </h2>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-950">
              Deixar vencer o contrato de experiência custa milhares de reais.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-rose-50/50 border border-rose-200 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 mb-4 font-black text-xl">
                !
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Efetivação Tácita Acidental</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Se o 90º dia passar sem avaliação ou termo assinado, o contrato passa
                automaticamente a ser por prazo indeterminado. O desligamento passa a exigir aviso
                prévio, multa de 40% do FGTS e indenizações.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-amber-50/50 border border-amber-200 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 mb-4 font-black text-xl">
                ⏱
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Decisões no Improviso</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Gestores avaliam colaboradores em cima da hora, sem critérios claros ou registro
                formal, gerando contratações frustradas e passivo trabalhista por falta de histórico
                documentado.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-200 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[#2CA840] mb-4 font-black text-xl">
                ✓
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">A Solução Definitiva</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Um sistema desenhado exclusivamente para isso: alerta gestores com 5 dias de
                antecedência, divide critérios por escritório ou obra e gera auditoria com um
                clique.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS DO SISTEMA */}
      <section id="beneficios" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 text-[#2CA840] text-xs font-bold uppercase tracking-wider mb-3">
            <Zap className="h-4 w-4" /> Recursos Completos
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950">
            Tudo o que sua empresa precisa para dominar o período de experiência
          </h2>
          <p className="mt-4 text-slate-600 text-sm sm:text-base">
            Projetado para dar autonomia a gestores de obras e departamentos sem abrir mão da
            segurança central do RH.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#2CA840] border border-emerald-100 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Marcos de 45 e 90 Dias</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Cálculo automático e preciso a partir da data de admissão. Identifique quem está
              próximo do vencimento e evite prorrogações automáticas indesejadas.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#2CA840] border border-emerald-100 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <Building2 className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Centros de Custo & Setores</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Segregação visual por obras, projetos, matriz e filiais. Cada gestor enxerga apenas
              sua equipe ou canteiro de obras, mantendo a privacidade.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#2CA840] border border-emerald-100 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Importação em Lote & Modelos</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Baixe os modelos Excel prontos, importe centenas de colaboradores e avaliações com
              validação prévia, simulação de erros e substituição segura.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#2CA840] border border-emerald-100 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <BadgeCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Critérios por Categoria</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Formulários adaptados com critérios distintos para canteiro de obras vs. escritório
              administrativo. Notas padronizadas com justificativa obrigatória para decisões.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#2CA840] border border-emerald-100 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <BellRing className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Alertas e Notificações</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Disparos automáticos diários de aviso prévio para os e-mails dos responsáveis de cada
              centro de custo. Nenhum prazo passa em branco.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#2CA840] border border-emerald-100 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Auditoria & LGPD</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              CPFs criptografados em repouso com hash seguro de busca, controle rígido de perfis
              (Admin, RH, Gestores, Visualizadores) e log imutável de ações.
            </p>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA (PASSOS) */}
      <section id="como-funciona" className="py-20 bg-slate-100/70 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[#2CA840] text-xs font-bold uppercase tracking-wider">
              Fluxo Simplificado
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 mt-2">
              Como funciona na prática em 3 passos
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="relative p-7 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col">
              <div className="w-10 h-10 rounded-full bg-[#54D769] text-slate-950 font-extrabold flex items-center justify-center text-lg mb-4 shadow-xs">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Cadastre ou Importe</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Adicione colaboradores individualmente ou suba a planilha do seu ERP (Totvs, Senior,
                Sankhya, etc.). O sistema calcula os marcos de 45 e 90 dias instantaneamente.
              </p>
            </div>

            <div className="relative p-7 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col">
              <div className="w-10 h-10 rounded-full bg-[#54D769] text-slate-950 font-extrabold flex items-center justify-center text-lg mb-4 shadow-xs">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Avalie nos Marcos</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                O gestor recebe o alerta 5 dias antes. Ele abre o formulário responsivo no celular
                ou computador, pontua os critérios e assinala prorrogar, efetivar ou rescindir.
              </p>
            </div>

            <div className="relative p-7 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col">
              <div className="w-10 h-10 rounded-full bg-[#54D769] text-slate-950 font-extrabold flex items-center justify-center text-lg mb-4 shadow-xs">
                3
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Decisão Segura & Histórico</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                O RH visualiza as decisões consolidadas no painel executivo e gera relatórios em
                Excel prontos para auditoria trabalhista e folha de pagamento.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <a
              href="#precos"
              className="inline-flex items-center justify-center bg-[#54D769] hover:bg-[#43c457] text-white font-extrabold px-8 py-3.5 rounded-xl shadow-md shadow-emerald-500/20 transition-all"
            >
              Garantir minha assinatura
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* PÚBLICO-ALVO */}
      <section id="para-quem-e" className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-[#2CA840] text-xs font-bold uppercase tracking-wider">
            Para quem é o sistema
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 mt-2">
            Desenvolvido para operações com alta dinâmica de contratações
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-7 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <Building2 className="h-8 w-8 text-[#2CA840] mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Construtoras & Engenharia</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Múltiplos canteiros de obras distantes da sede, grande fluxo de admissões operacionais
              (pedreiros, serventes, carpinteiros) e gestores de obra no campo.
            </p>
          </div>

          <div className="p-7 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <Briefcase className="h-8 w-8 text-[#2CA840] mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Escritórios & Serviços</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Empresas de tecnologia, contabilidade, advocacia e consultoria que exigem critérios
              comportamentais e técnicos detalhados para consolidar contratações estratégicas.
            </p>
          </div>

          <div className="p-7 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <Users className="h-8 w-8 text-[#2CA840] mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Empresas com CLT em Geral</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Qualquer organização que contrata em regime CLT e deseja blindar o RH contra falhas de
              vencimento do artigo 445 e 451 da CLT.
            </p>
          </div>
        </div>
      </section>

      {/* PLANOS & PREÇOS (MENSAL E ANUAL) */}
      <section
        id="precos"
        className="py-20 bg-gradient-to-b from-slate-100/80 via-white to-slate-50 border-t border-slate-200"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-4 shadow-xs">
            Planos Transparentes & Flexíveis
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-950">
            Investimento que se paga na primeira rescisão evitada
          </h2>
          <p className="mt-4 text-slate-600 text-sm sm:text-base max-w-xl mx-auto">
            Sem pegadinhas, sem cobrança por colaborador cadastrado. Escolha a periodicidade ideal
            para a sua empresa.
          </p>

          <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
            {/* CARD 1: PLANO MENSAL */}
            {config.monthly?.active !== false && (
              <div className="rounded-3xl p-1 bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="bg-white rounded-[22px] p-8 sm:p-9 text-left flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Assinatura Flexível
                        </span>
                        <h3 className="text-2xl font-black text-slate-900 mt-1">Plano Mensal</h3>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                        Sem Fidelidade
                      </div>
                    </div>

                    <div className="mt-6 flex items-baseline">
                      <span className="text-xs text-slate-500 mr-1.5 font-semibold">R$</span>
                      <span className="text-4xl sm:text-5xl font-black text-slate-950 tracking-tight">
                        {config.monthly?.price_label || '297,00'}
                      </span>
                      <span className="text-slate-500 ml-2 font-medium">/mês</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Cobrança mensal recorrente com cancelamento livre a qualquer momento.
                    </p>

                    <div className="my-7 border-t border-slate-200" />

                    <div className="space-y-3 text-sm">
                      {[
                        'Colaboradores ilimitados em experiência',
                        'Gestão completa de 45 e 90 dias',
                        'Centros de custo e setores ilimitados',
                        'Critérios personalizáveis (Obra e Escritório)',
                        'Múltiplos perfis (Admin, RH, Gestores, Assistentes)',
                        'Importação e exportação de planilhas Excel',
                        'Notificações e alertas preventivos diários',
                        'Log de auditoria e segurança LGPD',
                        'Suporte e atualizações inclusas',
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-slate-700">
                          <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                          <span className="text-xs sm:text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 pt-4">
                    <Button
                      size="lg"
                      onClick={() => handleCheckout(config.monthly.payment_link)}
                      disabled={loadingCheckout}
                      variant="outline"
                      className="w-full h-13 text-sm sm:text-base font-bold border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100 text-emerald-800 rounded-xl transition-all"
                    >
                      Assinar Plano Mensal
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                      <Lock className="h-3 w-3 text-slate-400" />
                      <span>Processado com segurança pelo Stripe</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CARD 2: PLANO ANUAL (DESTAQUE / MELHOR VALOR) */}
            {config.annual?.active !== false && (
              <div className="rounded-3xl p-1 bg-gradient-to-b from-emerald-400 via-[#54D769] to-[#2CA840] shadow-xl shadow-emerald-500/20 flex flex-col justify-between relative">
                {/* Badge Destaque */}
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-slate-900 text-white font-extrabold text-xs px-4 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#54D769]" />
                  {config.annual?.badge || '2 meses grátis • Melhor valor'}
                </div>

                <div className="bg-white rounded-[22px] p-8 sm:p-9 text-left flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#2CA840]">
                          Economia Máxima
                        </span>
                        <h3 className="text-2xl font-black text-slate-950 mt-1">Plano Anual</h3>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                        12 meses pelo preço de 10
                      </div>
                    </div>

                    <div className="mt-6 flex items-baseline">
                      <span className="text-xs text-slate-500 mr-1.5 font-semibold">R$</span>
                      <span className="text-4xl sm:text-5xl font-black text-slate-950 tracking-tight">
                        {config.annual?.price_label || '2.970,00'}
                      </span>
                      <span className="text-slate-500 ml-2 font-medium">/ano</span>
                    </div>
                    <p className="text-xs text-[#2CA840] mt-1 font-semibold">
                      Equivalente a apenas R$ 247,50/mês (2 meses 100% grátis).
                    </p>

                    <div className="my-7 border-t border-slate-200" />

                    <div className="space-y-3 text-sm">
                      {[
                        'Tudo incluído no Plano Mensal',
                        '2 meses inteiros gratuitos (economia de R$ 594)',
                        'Colaboradores e avaliações ilimitadas',
                        'Atendimento e onboarding prioritário',
                        'Garantia de preço congelado por 12 meses',
                        'Relatórios consolidados anuais para auditoria',
                        'Notificações automáticas ativas o ano todo',
                        'Faturamento unificado e nota fiscal anual',
                        'Acesso prioritário a novos módulos do sistema',
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-slate-800">
                          <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                          <span className="text-xs sm:text-sm font-medium">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 pt-4">
                    <Button
                      size="lg"
                      onClick={() => handleCheckout(config.annual.payment_link)}
                      disabled={loadingCheckout}
                      className="w-full h-14 text-base font-extrabold bg-gradient-to-r from-[#54D769] to-[#2CA840] hover:from-[#43c457] hover:to-[#228734] text-white rounded-xl shadow-md shadow-emerald-500/25 transition-all transform hover:scale-[1.02]"
                    >
                      Assinar Plano Anual (Melhor Valor)
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                    <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                      <Lock className="h-3 w-3 text-slate-400" />
                      <span>Processado com segurança pelo Stripe</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 text-[#2CA840] text-xs font-bold uppercase tracking-wider mb-2">
            <HelpCircle className="h-4 w-4" /> Perguntas Frequentes
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950">
            Tire suas dúvidas sobre o sistema e planos
          </h2>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          <AccordionItem
            value="item-1"
            className="border border-slate-200 rounded-xl px-6 bg-white shadow-xs"
          >
            <AccordionTrigger className="text-left font-bold text-slate-900 hover:text-emerald-700 py-5">
              Qual a diferença entre o Plano Mensal e o Plano Anual?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 leading-relaxed pb-5">
              Ambos dão acesso irrestrito e idêntico a todas as funcionalidades do sistema,
              colaboradores e obras ilimitadas. A vantagem do Plano Anual é a economia direta: você
              paga por 10 meses e ganha 2 meses grátis (R${' '}
              {config.annual?.price_label || '2.970,00'}/ano em vez de R$ 3.564,00).
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-2"
            className="border border-slate-200 rounded-xl px-6 bg-white shadow-xs"
          >
            <AccordionTrigger className="text-left font-bold text-slate-900 hover:text-emerald-700 py-5">
              O que acontece ao fim dos 90 dias do contrato de experiência?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 leading-relaxed pb-5">
              Pela CLT, se a empresa não comunicar o término até o 90º dia, o contrato torna-se
              automaticamente por prazo indeterminado. O sistema emite alertas diários com 5 dias de
              antecedência para que a decisão de prorrogação ou rescisão seja tomada e assinada
              rigorosamente no prazo.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-3"
            className="border border-slate-200 rounded-xl px-6 bg-white shadow-xs"
          >
            <AccordionTrigger className="text-left font-bold text-slate-900 hover:text-emerald-700 py-5">
              Quantos colaboradores posso cadastrar na minha conta?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 leading-relaxed pb-5">
              Tanto o plano mensal quanto o anual oferecem capacidade ilimitada. Você pode cadastrar
              quantos colaboradores, obras e setores precisar, sem qualquer cobrança adicional por
              volume de dados.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-4"
            className="border border-slate-200 rounded-xl px-6 bg-white shadow-xs"
          >
            <AccordionTrigger className="text-left font-bold text-slate-900 hover:text-emerald-700 py-5">
              Como funciona a importação da base atual de colaboradores?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 leading-relaxed pb-5">
              O sistema disponibiliza modelos em formato Excel (.xlsx) prontos para download. Basta
              preencher as colunas (Nome, CPF, Data de Admissão, Centro de Custo, Setor e Cargo) e
              fazer o upload. O sistema valida todos os dados em modo simulação antes de efetivar o
              cadastro.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-5"
            className="border border-slate-200 rounded-xl px-6 bg-white shadow-xs"
          >
            <AccordionTrigger className="text-left font-bold text-slate-900 hover:text-emerald-700 py-5">
              Posso cancelar a assinatura quando quiser?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 leading-relaxed pb-5">
              Sim, totalmente livre. No plano mensal não há fidelidade. Você gerencia sua assinatura
              com total autonomia e pode desativar a renovação quando preferir.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* FINAL CTA BANNER */}
      <section className="py-20 bg-gradient-to-r from-emerald-600 via-[#2CA840] to-emerald-700 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Pronto para profissionalizar as avaliações de experiência da sua empresa?
          </h2>
          <p className="mt-4 text-emerald-100 text-base max-w-xl mx-auto">
            Comece hoje mesmo com o plano Mensal ou garanta 2 meses grátis no plano Anual. Proteja
            sua empresa contra passivos trabalhistas.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#precos"
              className="w-full sm:w-auto h-14 px-8 inline-flex items-center justify-center text-base font-extrabold bg-white hover:bg-slate-100 text-slate-950 rounded-xl shadow-lg transition-all"
            >
              Assinar agora via Stripe
              <ArrowRight className="ml-2 h-5 w-5 text-emerald-700" />
            </a>
            <Link
              to="/login"
              className="text-sm text-emerald-100 hover:text-white font-semibold py-2 px-4 transition-colors"
            >
              Já possuo acesso ao sistema
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER (100% NEUTRO) */}
      <footer className="bg-white border-t border-slate-200 py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex flex-col items-center md:items-start gap-2">
            <AppLogo variant="light-bg" size="sm" layout="compact" />
            <p className="text-slate-500 mt-1 max-w-sm">
              Plataforma especializada na gestão de contratos de experiência de 45 e 90 dias.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-slate-600">
            <a href="#beneficios" className="hover:text-emerald-700 transition-colors">
              Benefícios
            </a>
            <a href="#como-funciona" className="hover:text-emerald-700 transition-colors">
              Como funciona
            </a>
            <a href="#precos" className="hover:text-emerald-700 transition-colors">
              Preços & Planos
            </a>
            <a href="#faq" className="hover:text-emerald-700 transition-colors">
              FAQ
            </a>
            <Link to="/login" className="hover:text-emerald-700 transition-colors">
              Área do Cliente
            </Link>
          </div>

          <div className="text-slate-500">
            &copy; {new Date().getFullYear()} Avaliação de Experiência. Todos os direitos
            reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Sales
