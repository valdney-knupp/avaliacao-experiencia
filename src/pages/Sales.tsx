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
  MessageCircle,
  Phone,
  Mail,
  Headphones,
  Award,
  Layers,
  Save,
  CheckCheck,
  Search,
  UserCheck,
} from 'lucide-react'
import { SYSTEM_CONTACTS } from '@/lib/contacts'
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
  FALLBACK_MODULE_OFFERS,
  StripeCheckoutConfig,
  ModuleOfferConfig,
  createCheckoutSession,
  buildCheckoutUrl,
} from '@/lib/stripeCheckout'
import { useSearchParams } from 'react-router-dom'
import { initGoogleAds } from '@/lib/googleAds'

export const Sales: React.FC = () => {
  const [config, setConfig] = useState<StripeCheckoutConfig>(FALLBACK_CHECKOUT_CONFIG)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')
  const [searchParams] = useSearchParams()
  const customerEmailParam = searchParams.get('email') || searchParams.get('prefilled_email') || ''
  const [loadingCheckout, setLoadingCheckout] = useState(true)
  const [checkoutOfferId, setCheckoutOfferId] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // Garante que a tag global do Google Ads esteja sempre ativa na página de vendas
  useEffect(() => {
    initGoogleAds()
  }, [])

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

  const offerExperiencia = config.offers?.experiencia || FALLBACK_MODULE_OFFERS.experiencia
  const offerDesempenho = config.offers?.desempenho || FALLBACK_MODULE_OFFERS.desempenho
  const offerCombo = config.offers?.combo || FALLBACK_MODULE_OFFERS.combo

  const offersList: ModuleOfferConfig[] = [offerExperiencia, offerDesempenho, offerCombo]

  const handleCheckoutOffer = async (offer: ModuleOfferConfig) => {
    setCheckoutError(null)
    setCheckoutOfferId(offer.id)

    const planConfig = billingPeriod === 'monthly' ? offer.monthly : offer.annual
    const priceId = planConfig?.price_id
    let paymentLink = planConfig?.payment_link

    // 1. Se existir um link direto oficial (como os de Experiência já existentes)
    if (
      paymentLink &&
      (paymentLink.startsWith('https://buy.stripe.com/') ||
        paymentLink.startsWith('https://pay.stripe.com/'))
    ) {
      if (customerEmailParam) {
        paymentLink = buildCheckoutUrl(paymentLink, { email: customerEmailParam })
      }
      window.location.href = paymentLink
      return
    }

    // 2. Tenta gerar a Checkout Session via endpoint oficial /backend/v1/billing/create-checkout-session
    try {
      const res = await createCheckoutSession({
        price_id: priceId,
        email: customerEmailParam || undefined,
      })
      if (res && res.url) {
        window.location.href = res.url
        return
      }
    } catch (err: any) {
      console.warn('Falha ao chamar create-checkout-session:', err)
    }

    // 3. Fallback se paymentLink tiver URL válida
    if (
      paymentLink &&
      paymentLink.startsWith('http') &&
      !paymentLink.includes('test_avaliacao_experiencia')
    ) {
      window.location.href = paymentLink
      return
    }

    // 4. Mensagem com WhatsApp se a conta Stripe ainda estiver configurando os links
    setCheckoutOfferId(null)
    setCheckoutError(
      `O link de checkout para "${offer.title}" (${billingPeriod === 'monthly' ? 'Mensal' : 'Anual'}) está em sincronização. Finalize agora mesmo com atendimento imediato pelo WhatsApp ou tente novamente em instantes.`,
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 selection:bg-[#54D769]/30 selection:text-slate-900">
      {/* Top Notification / Banner */}
      <div className="bg-emerald-50 border-b border-emerald-100 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-emerald-950">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-2.5 text-center leading-relaxed">
          <div className="inline-flex items-center gap-1.5 shrink-0 font-bold text-emerald-900">
            <Sparkles className="h-4 w-4 text-[#2CA840] shrink-0" />
            <span>Lançamento Especial:</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-slate-800">
            {/* Oferta Experiência */}
            <span className="inline-flex items-center gap-1">
              <strong className="text-emerald-950 font-bold">Experiência:</strong>{' '}
              <span>
                Mensal R$ {offerExperiencia.monthly?.price_label || '297,00'} · Anual com economia
                de R$ 665 (R$ {offerExperiencia.annual?.price_label || '2.899,00'})
              </span>
            </span>

            <span className="hidden md:inline text-emerald-300 font-light select-none">|</span>

            {/* Oferta Desempenho */}
            <span className="inline-flex items-center gap-1">
              <strong className="text-emerald-950 font-bold">Avaliação de Desempenho:</strong>{' '}
              <span>
                Mensal R$ {offerDesempenho.monthly?.price_label || '150,00'} · Anual R${' '}
                {offerDesempenho.annual?.price_label || '1.399,00'}
              </span>
            </span>

            <span className="hidden md:inline text-emerald-300 font-light select-none">|</span>

            {/* Oferta Combo */}
            <span className="inline-flex items-center gap-1 bg-emerald-100/70 border border-emerald-200/80 px-2 py-0.5 rounded-md text-emerald-950">
              <strong className="text-emerald-950 font-extrabold">Combo:</strong>{' '}
              <span>
                Mensal R$ {offerCombo.monthly?.price_label || '397,00'} · Anual R${' '}
                {offerCombo.annual?.price_label || '3.897,00'}
              </span>
              <span className="bg-[#2CA840] text-white text-[10px] sm:text-xs font-bold px-1.5 py-0.2 rounded font-mono ml-0.5 whitespace-nowrap">
                Mais vantajoso
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <AppLogo variant="light-bg" size="md" layout="compact" />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#beneficios" className="hover:text-emerald-700 transition-colors">
              Benefícios
            </a>
            <a
              href="#desempenho"
              className="hover:text-emerald-700 transition-colors font-semibold text-emerald-800"
            >
              Módulo Desempenho
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
            <a href="#contato" className="hover:text-emerald-700 transition-colors">
              Contato
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
            Gestão estratégica de RH:{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2CA840] via-[#54D769] to-[#238734]">
              Experiência de 45 e 90 dias
            </span>{' '}
            e Avaliação de Desempenho contínua.
          </h1>

          <p className="mt-6 text-base sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Elimine riscos trabalhistas no período de experiência, aplique entrevistas de
            desligamento e desenvolva sua equipe com avaliações de desempenho estruturadas em
            competências e níveis.
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

      {/* PLANOS & PREÇOS (3 OFERTAS: EXPERIÊNCIA, DESEMPENHO E COMBO) */}
      <section
        id="precos"
        className="py-20 bg-gradient-to-b from-slate-100/80 via-white to-slate-50 border-t border-slate-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-4 shadow-xs">
            Módulos Independentes & Combo Completo
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-950">
            Escolha o módulo ideal ou leve a solução completa
          </h2>
          <p className="mt-4 text-slate-600 text-sm sm:text-base max-w-2xl mx-auto">
            Sem pegadinhas, sem cobrança por colaborador. Contrate apenas o módulo que a sua empresa
            precisa ou garanta o Combo com desconto especial.
          </p>

          {/* TOGGLE MENSAL / ANUAL */}
          <div className="mt-8 flex items-center justify-center">
            <div className="p-1.5 bg-slate-200/80 rounded-2xl flex items-center gap-1 shadow-inner">
              <button
                type="button"
                onClick={() => setBillingPeriod('monthly')}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Faturamento Mensal
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod('annual')}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                  billingPeriod === 'annual'
                    ? 'bg-gradient-to-r from-[#2CA840] to-emerald-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Faturamento Anual</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950">
                  Desconto
                </span>
              </button>
            </div>
          </div>

          {checkoutError && (
            <div className="max-w-2xl mx-auto mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <span>{checkoutError}</span>
              </div>
              <a
                href={SYSTEM_CONTACTS.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-bold text-emerald-800 hover:text-emerald-950 underline whitespace-nowrap"
              >
                <MessageCircle className="h-4 w-4" />
                Falar no WhatsApp
              </a>
            </div>
          )}

          {/* GRID COM AS 3 OFERTAS */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {offersList.map((offer) => {
              const plan = billingPeriod === 'monthly' ? offer.monthly : offer.annual
              const isCombo = offer.id === 'combo'

              return (
                <div
                  key={offer.id}
                  className={`rounded-3xl p-1 flex flex-col justify-between relative transition-all ${
                    isCombo
                      ? 'bg-gradient-to-b from-emerald-400 via-[#54D769] to-[#2CA840] shadow-xl shadow-emerald-500/20 md:-translate-y-2'
                      : 'bg-white border border-slate-200 shadow-sm hover:shadow-md'
                  }`}
                >
                  {/* Badge de Destaque no Combo */}
                  {isCombo && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-slate-900 text-white font-extrabold text-xs px-4 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1.5 whitespace-nowrap">
                      <Sparkles className="h-3.5 w-3.5 text-[#54D769]" />
                      {offer.tag || 'Mais Vantajoso • Desconto Especial'}
                    </div>
                  )}

                  <div className="bg-white rounded-[22px] p-7 sm:p-8 text-left flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className={`text-xs font-bold uppercase tracking-wider ${
                              isCombo ? 'text-[#2CA840]' : 'text-slate-500'
                            }`}
                          >
                            {offer.id === 'experiencia'
                              ? 'Módulo 1'
                              : offer.id === 'desempenho'
                                ? 'Módulo 2'
                                : 'Solução Completa'}
                          </span>
                          <h3 className="text-xl sm:text-2xl font-black text-slate-950 mt-1 leading-snug">
                            {offer.title}
                          </h3>
                        </div>
                        {isCombo && (
                          <div className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold whitespace-nowrap">
                            Combo 2 em 1
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 mt-2 min-h-[32px]">{offer.subtitle}</p>

                      <div className="mt-6 flex items-baseline">
                        <span className="text-xs text-slate-500 mr-1.5 font-semibold">R$</span>
                        <span className="text-4xl sm:text-5xl font-black text-slate-950 tracking-tight">
                          {plan.price_label}
                        </span>
                        <span className="text-slate-500 ml-2 font-medium">
                          /{billingPeriod === 'monthly' ? 'mês' : 'ano'}
                        </span>
                      </div>

                      {plan.badge && (
                        <p className="text-xs text-[#2CA840] mt-1.5 font-bold">{plan.badge}</p>
                      )}

                      <div className="my-6 border-t border-slate-200" />

                      {/* Lista de Features por Oferta */}
                      <div className="space-y-3 text-xs sm:text-sm">
                        {offer.id === 'experiencia' && (
                          <>
                            <div className="flex items-start gap-2.5 text-slate-900 font-semibold">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>Avaliações de 45 e 90 dias com cálculo automático</span>
                            </div>
                            <div className="flex items-start gap-2.5 text-slate-900 font-semibold">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>
                                Entrevista de Desligamento com envio de link ao colaborador (sem
                                login)
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5 text-slate-800 font-medium">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>Dashboard de acompanhamento em tempo real</span>
                            </div>
                            <div className="flex items-start gap-2.5 text-slate-700">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>
                                Alertas diários com 5 dias de antecedência (art. 445/451 CLT)
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5 text-slate-700">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>
                                Critérios customizados para Canteiro de Obras e Escritório
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5 text-slate-700">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>Importação e exportação em Excel com validação prévia</span>
                            </div>
                          </>
                        )}

                        {offer.id === 'desempenho' && (
                          <>
                            <div className="flex items-start gap-2.5 text-slate-900 font-semibold">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>
                                2 Modelos oficiais: Nível I (Operacional/Tático) e Nível II
                                (Liderança)
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5 text-slate-900 font-semibold">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>
                                Preenchimento com rascunho automático e retomada a qualquer momento
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5 text-slate-800 font-medium">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>
                                Histórico completo com filtros por modelo, período e situação
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5 text-slate-800 font-medium">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>
                                Identificação clara do responsável pelo preenchimento via login
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5 text-slate-700">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>
                                Escala de 4 níveis (Atende, Atende Parcialmente, Não Atende, Supera)
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5 text-slate-700">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>
                                Comentários de pontos fortes, melhorias e plano de desenvolvimento
                              </span>
                            </div>
                          </>
                        )}

                        {offer.id === 'combo' && (
                          <>
                            <div className="flex items-start gap-2.5 text-emerald-950 font-bold bg-emerald-50/90 p-2.5 rounded-xl border border-emerald-200">
                              <Sparkles className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>Acesso completo: Experiência + Desempenho + Desligamento</span>
                            </div>
                            <div className="flex items-start gap-2.5 text-slate-900 font-semibold">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>
                                Tudo do módulo de Experiência (45/90 dias e Entrevistas de
                                Desligamento)
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5 text-slate-900 font-semibold">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>
                                Tudo do módulo de Desempenho (Modelos Nível I e II, Rascunhos e
                                Filtros)
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5 text-emerald-900 font-bold bg-amber-50/70 p-2 rounded-lg border border-amber-200">
                              <Award className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                              <span>
                                {billingPeriod === 'monthly'
                                  ? 'Economia de R$ 50/mês comparado aos módulos separados'
                                  : 'Economia de R$ 401/ano (R$ 3.897 em vez de R$ 4.298)'}
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5 text-slate-700">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>Gestão unificada em um único painel e login por empresa</span>
                            </div>
                            <div className="flex items-start gap-2.5 text-slate-700">
                              <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0 mt-0.5" />
                              <span>Atendimento consultivo e suporte prioritário</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-8 pt-4">
                      <Button
                        size="lg"
                        onClick={() => handleCheckoutOffer(offer)}
                        disabled={loadingCheckout || checkoutOfferId === offer.id}
                        className={`w-full h-13 text-sm sm:text-base font-extrabold rounded-xl transition-all ${
                          isCombo
                            ? 'bg-gradient-to-r from-[#54D769] to-[#2CA840] hover:from-[#43c457] hover:to-[#228734] text-white shadow-md shadow-emerald-500/25 transform hover:scale-[1.02]'
                            : 'border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-900 border'
                        }`}
                      >
                        {checkoutOfferId === offer.id
                          ? 'Iniciando checkout...'
                          : isCombo
                            ? `Garantir Combo (${billingPeriod === 'monthly' ? 'Mensal' : 'Anual'})`
                            : `Assinar ${offer.title.replace('Avaliação de ', '')}`}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                        <Lock className="h-3 w-3 text-slate-400" />
                        <span>Processado com segurança pelo Stripe</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* SEÇÃO COMPLETA: MÓDULO AVALIAÇÃO DE DESEMPENHO */}
      <section id="desempenho" className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-4 shadow-xs">
              <Award className="h-4 w-4 text-[#2CA840]" />
              Novo Módulo Especializado
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-950 leading-tight">
              Avaliação de Desempenho:{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2CA840] via-[#54D769] to-[#238734]">
                Competências, Feedback e Evolução Contínua
              </span>
            </h2>
            <p className="mt-4 text-slate-600 text-base sm:text-lg leading-relaxed">
              Vá além do período de experiência: impulsione o desenvolvimento de toda a equipe com
              modelos estruturados por nível hierárquico, rascunho seguro, auditoria por gestor e
              análise transparente de competências.
            </p>
          </div>

          {/* PARA QUEM É O MÓDULO DESEMPENHO */}
          <div className="bg-gradient-to-br from-emerald-50/60 via-slate-50 to-white rounded-3xl p-8 sm:p-10 border border-emerald-100 shadow-sm mb-14">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5">
                <span className="text-xs font-bold uppercase tracking-wider text-[#2CA840]">
                  Público-alvo & Aplicação
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-950 mt-1 mb-4">
                  Para quem é a Avaliação de Desempenho?
                </h3>
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6">
                  Ideal para empresas, construtoras e escritórios que já superaram o controle básico
                  de admissão e precisam de um processo contínuo de gestão de talentos, alinhamento
                  de expectativas e fundamentação de promoções, bonificações ou planos de
                  desenvolvimento individual (PDI).
                </p>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0" />
                    <span>Líderes de obras, encarregados e gestores operacionais</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0" />
                    <span>Equipes corporativas, técnicas e administrativas</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-[#2CA840] shrink-0" />
                    <span>Diretoria e RH em busca de dados consistentes para PDI</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#2CA840] flex items-center justify-center font-bold mb-3">
                    01
                  </div>
                  <h4 className="font-bold text-slate-900 text-base mb-1">
                    Critérios Objetivos de Meritocracia
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Substitua o "achismo" por notas padronizadas e justificativas reais sobre o dia
                    a dia do colaborador.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#2CA840] flex items-center justify-center font-bold mb-3">
                    02
                  </div>
                  <h4 className="font-bold text-slate-900 text-base mb-1">
                    Cultura de Feedback Estruturado
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Estimule os gestores a registrarem pontos fortes e aspectos a melhorar com
                    espaço dedicado para comentários.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#2CA840] flex items-center justify-center font-bold mb-3">
                    03
                  </div>
                  <h4 className="font-bold text-slate-900 text-base mb-1">
                    Histórico Evolutivo do Colaborador
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Acompanhe o crescimento de cada profissional ao longo dos semestres e anos em um
                    único painel.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#2CA840] flex items-center justify-center font-bold mb-3">
                    04
                  </div>
                  <h4 className="font-bold text-slate-900 text-base mb-1">
                    Segurança e Auditoria por Login
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Cada avaliação registra automaticamente quem a preencheu e quando foi concluída,
                    evitando edições indevidas.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* OS DOIS MODELOS OFICIAIS (NÍVEL I e NÍVEL II) */}
          <div className="mb-14">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-[#2CA840] text-xs font-bold uppercase tracking-wider">
                Modelos Oficiais de Avaliação
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-1">
                Dois instrumentos desenhados para cada maturidade da função
              </h3>
              <p className="text-slate-600 text-sm mt-2">
                O módulo já vem com formulários estruturados e validados para equipes operacionais e
                posições de liderança.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* MODELO NÍVEL I */}
              <div className="bg-white rounded-3xl p-7 sm:p-8 border-2 border-emerald-100 hover:border-emerald-300 shadow-sm transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
                      Modelo Oficial 1
                    </span>
                    <span className="text-xs font-semibold text-slate-500">Escala em 4 Níveis</span>
                  </div>
                  <h4 className="text-xl sm:text-2xl font-black text-slate-950 mb-2">
                    Avaliação de Desempenho — Nível I
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Focado em colaboradores operacionais, técnicos e de execução direta. Avalia a
                    conformidade dos processos, produtividade e integração com o time.
                  </p>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 mb-6">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-[#2CA840]" /> 5 Competências Centrais
                      Avaliadas:
                    </div>
                    <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-xs">
                          1
                        </span>
                        <div>
                          <strong className="text-slate-900">
                            Domínio dos processos de trabalho:
                          </strong>{' '}
                          conhecimento técnico, visão crítica e eficiência.
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-xs">
                          2
                        </span>
                        <div>
                          <strong className="text-slate-900">Qualidade do trabalho:</strong>{' '}
                          organização, planejamento, conformidade com os padrões.
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-xs">
                          3
                        </span>
                        <div>
                          <strong className="text-slate-900">Produtividade de trabalho:</strong>{' '}
                          cumprimento de prazos, otimização de recursos e metas.
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-xs">
                          4
                        </span>
                        <div>
                          <strong className="text-slate-900">Solução de problemas:</strong>{' '}
                          proatividade, mediação de conflitos e adaptação a mudanças.
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-xs">
                          5
                        </span>
                        <div>
                          <strong className="text-slate-900">Colaboração:</strong> relacionamento
                          interpessoal, empatia, integração e espírito de equipe.
                        </div>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                    <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-[#2CA840]" />
                      Escala padronizada de resposta:
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 font-semibold">
                        ATENDE
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 font-semibold">
                        ATENDE PARCIALMENTE
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 font-semibold">
                        NÃO ATENDE
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-200 text-emerald-900 font-bold">
                        SUPERA
                      </span>
                    </div>
                    <p className="pt-2 text-slate-600">
                      Inclui campo de <strong>comentários gerais livres</strong> em cada competência
                      para registrar pontos fortes e oportunidades de melhoria.
                    </p>
                  </div>
                </div>
              </div>

              {/* MODELO NÍVEL II */}
              <div className="bg-white rounded-3xl p-7 sm:p-8 border-2 border-emerald-100 hover:border-emerald-300 shadow-sm transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800">
                      Modelo Oficial 2
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      10 Competências em 3 Seções
                    </span>
                  </div>
                  <h4 className="text-xl sm:text-2xl font-black text-slate-950 mb-2">
                    Avaliação de Desempenho — Nível II
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Estruturado para posições de liderança, coordenação, supervisão e analistas
                    seniores. Divide a análise em três pilares estratégicos da organização:
                  </p>

                  <div className="space-y-3 mb-6">
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Seção 1: Clima Organizacional
                      </div>
                      <p className="text-xs text-slate-600 mb-2">
                        Atitudes, convivência ética e saúde do ambiente corporativo.
                      </p>
                      <div className="text-xs text-slate-700 space-y-1 pl-4 border-l-2 border-emerald-300">
                        <div>• Ética e transparência com pares, clientes e equipe</div>
                        <div>• Relacionamento interpessoal positivo e cooperação</div>
                        <div>• Respeito e manutenção de ambiente de trabalho saudável</div>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Seção 2: Crescimento
                      </div>
                      <p className="text-xs text-slate-600 mb-2">
                        Busca por desenvolvimento contínuo, maturidade e raciocínio crítico.
                      </p>
                      <div className="text-xs text-slate-700 space-y-1 pl-4 border-l-2 border-blue-300">
                        <div>• Autodesenvolvimento e interesse por novos aprendizados</div>
                        <div>• Pensamento crítico e otimização dos processos</div>
                        <div>• Inteligência emocional diante de desafios e conflitos</div>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        Seção 3: Performance e Resultados
                      </div>
                      <p className="text-xs text-slate-600 mb-2">
                        Entrega consistente de metas, segurança operacional e proatividade.
                      </p>
                      <div className="text-xs text-slate-700 space-y-1 pl-4 border-l-2 border-purple-300">
                        <div>• Foco em resultados, planos de ação e prazos</div>
                        <div>• Comprometimento e dedicação acima das expectativas</div>
                        <div>• Qualidade e conformidade com normas e procedimentos</div>
                        <div>• Proatividade e solução ágil de problemas</div>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <span className="font-bold text-blue-950">Comentários por Seção Temática:</span>{' '}
                    O gestor avalia as competências com a escala de 4 níveis (ATENDE, ATENDE
                    PARCIALMENTE, NÃO ATENDE, SUPERA) e redige um parecer consolidado em cada um dos
                    3 pilares.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FLUXO PRÁTICO DO MÓDULO (4 ETAPAS) */}
          <div className="bg-slate-100/70 rounded-3xl p-8 sm:p-12 border border-slate-200">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-[#2CA840] text-xs font-bold uppercase tracking-wider">
                Fluxo de Uso Inteligente
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-1">
                Como funciona a rotina de preenchimento no sistema
              </h3>
              <p className="text-slate-600 text-sm mt-2">
                Simplicidade e segurança do início ao fim, pensadas para o ritmo dinâmico dos
                gestores.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#2CA840] border border-emerald-100 flex items-center justify-center font-black text-lg mb-4">
                    <Layers className="h-6 w-6" />
                  </div>
                  <div className="text-xs font-bold text-[#2CA840] uppercase tracking-wider mb-1">
                    Passo 1
                  </div>
                  <h4 className="font-bold text-slate-900 text-base mb-2">Iniciar & Selecionar</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    O gestor clica em <strong>"Nova Avaliação"</strong>, escolhe o modelo (Nível I
                    ou Nível II), seleciona o colaborador da sua equipe e define o período de
                    referência (ano/semestre).
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                  Sem formulários em papel
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#2CA840] border border-emerald-100 flex items-center justify-center font-black text-lg mb-4">
                    <Save className="h-6 w-6" />
                  </div>
                  <div className="text-xs font-bold text-[#2CA840] uppercase tracking-wider mb-1">
                    Passo 2
                  </div>
                  <h4 className="font-bold text-slate-900 text-base mb-2">Rascunho & Retomada</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Precisa pausar? Sem problemas: o sistema permite{' '}
                    <strong>"Salvar Rascunho"</strong> a qualquer momento. Suas respostas ficam
                    salvas para retomar com calma quando for oportuno.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-emerald-700 font-semibold">
                  Zero risco de perder dados
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#2CA840] border border-emerald-100 flex items-center justify-center font-black text-lg mb-4">
                    <CheckCheck className="h-6 w-6" />
                  </div>
                  <div className="text-xs font-bold text-[#2CA840] uppercase tracking-wider mb-1">
                    Passo 3
                  </div>
                  <h4 className="font-bold text-slate-900 text-base mb-2">
                    Conclusão com Validação
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    O sistema valida se todas as perguntas obrigatórias foram respondidas antes de
                    permitir a conclusão. O responsável pelo preenchimento fica identificado pelo
                    seu login.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                  Auditoria e autoria garantidas
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#2CA840] border border-emerald-100 flex items-center justify-center font-black text-lg mb-4">
                    <Search className="h-6 w-6" />
                  </div>
                  <div className="text-xs font-bold text-[#2CA840] uppercase tracking-wider mb-1">
                    Passo 4
                  </div>
                  <h4 className="font-bold text-slate-900 text-base mb-2">Consulta & Filtros</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Listagem dinâmica com filtros por{' '}
                    <strong>modelo, período e situação (Rascunho ou Concluída)</strong>. Consulta
                    rápida do histórico de qualquer colaborador com modo somente leitura.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                  Visão consolidada para o RH
                </div>
              </div>
            </div>

            <div className="mt-10 text-center">
              <a
                href="#precos"
                className="inline-flex items-center justify-center bg-gradient-to-r from-[#54D769] to-[#2CA840] hover:from-[#43c457] hover:to-[#228734] text-white font-extrabold px-8 py-3.5 rounded-xl shadow-md shadow-emerald-500/20 transition-all"
              >
                Contratar o Módulo de Desempenho
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
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
              Como funcionam os módulos? Posso contratar apenas um ou o Combo?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 leading-relaxed pb-5">
              Total flexibilidade: sua empresa pode contratar apenas a{' '}
              <strong>Avaliação de Experiência</strong> (R$ 297/mês ou R$ 2.899/ano, que inclui as
              avaliações de 45 e 90 dias e a Entrevista de Desligamento), apenas a{' '}
              <strong>Avaliação de Desempenho</strong> (R$ 150/mês ou R$ 1.399/ano, com os modelos
              Nível I e II, rascunhos e filtros), ou o <strong>Combo Completo</strong> (R$ 397/mês
              ou R$ 3.897/ano), que unifica os dois módulos com desconto expressivo em um único
              login.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-2"
            className="border border-slate-200 rounded-xl px-6 bg-white shadow-xs"
          >
            <AccordionTrigger className="text-left font-bold text-slate-900 hover:text-emerald-700 py-5">
              O que está incluído na Avaliação de Desempenho?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 leading-relaxed pb-5">
              O módulo traz os dois modelos oficiais completos: o <strong>Nível I</strong> (5
              competências operacionais: Domínio dos processos, Qualidade, Produtividade, Solução de
              problemas e Colaboração, com escala em 4 níveis e comentários) e o{' '}
              <strong>Nível II</strong> (10 competências distribuídas em 3 seções temáticas: Clima
              Organizacional, Crescimento e Performance & Resultados). Conta com recurso de salvar
              como rascunho e retomar quando quiser, validação de preenchimento, filtros por modelo,
              período e situação, e identificação auditável do gestor responsável pelo
              preenchimento.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-3"
            className="border border-slate-200 rounded-xl px-6 bg-white shadow-xs"
          >
            <AccordionTrigger className="text-left font-bold text-slate-900 hover:text-emerald-700 py-5">
              Como funciona a Entrevista de Desligamento no módulo de Experiência?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 leading-relaxed pb-5">
              A Entrevista de Desligamento faz parte do módulo Avaliação de Experiência. O RH gera o
              convite e envia um link seguro para o colaborador responder no próprio celular ou
              computador, sem necessidade de login. As respostas alimentam gráficos de distribuição,
              médias de escalas e evolução mensal para que a empresa entenda os motivos reais de
              saídas e reduza o turnover.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-4"
            className="border border-slate-200 rounded-xl px-6 bg-white shadow-xs"
          >
            <AccordionTrigger className="text-left font-bold text-slate-900 hover:text-emerald-700 py-5">
              Qual a economia do Plano Anual em comparação ao Mensal?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 leading-relaxed pb-5">
              No módulo de Experiência, a economia é de R$ 665 ao ano (R$ 2.899/ano vs. R$ 3.564 no
              mensal). No módulo de Desempenho, a economia é de R$ 401 ao ano (R$ 1.399/ano vs. R$
              1.800 no mensal). No Combo, a economia anual é de R$ 867 em relação ao parcelamento
              mensal, além do desconto especial já aplicado no pacote.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-5"
            className="border border-slate-200 rounded-xl px-6 bg-white shadow-xs"
          >
            <AccordionTrigger className="text-left font-bold text-slate-900 hover:text-emerald-700 py-5">
              Quantos colaboradores posso cadastrar na minha conta?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 leading-relaxed pb-5">
              Tanto no plano mensal quanto no anual, a capacidade é ilimitada. Você pode cadastrar
              quantos colaboradores, obras, setores e avaliações precisar, sem cobranças adicionais
              por colaborador ou volume de avaliações.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-6"
            className="border border-slate-200 rounded-xl px-6 bg-white shadow-xs"
          >
            <AccordionTrigger className="text-left font-bold text-slate-900 hover:text-emerald-700 py-5">
              Posso cancelar a assinatura quando quiser?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 leading-relaxed pb-5">
              Sim, totalmente transparente. No plano mensal não há fidelidade. Você gerencia sua
              assinatura com total autonomia e pode cancelar ou alterar seu plano quando preferir.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* SEÇÃO DE CONTATO / COMERCIAL & SUPORTE */}
      <section id="contato" className="py-20 bg-slate-100/60 border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 text-[#2CA840] text-xs font-bold uppercase tracking-wider mb-2">
              <Headphones className="h-4 w-4" /> Atendimento & Suporte
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950">
              Fale com a nossa equipe
            </h2>
            <p className="mt-3 text-slate-600 text-sm sm:text-base">
              Precisa de ajuda para escolher o plano, tirar dúvidas contratuais ou solicitar uma
              demonstração guiada? Estamos à disposição por WhatsApp, ligação ou e-mail.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* WHATSAPP */}
            <a
              href={SYSTEM_CONTACTS.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all group flex flex-col items-center text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#2CA840] border border-emerald-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <MessageCircle className="h-7 w-7" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full mb-2">
                Conversa Direta
              </span>
              <h3 className="text-lg font-bold text-slate-900 mb-1">WhatsApp</h3>
              <p className="text-xs text-slate-500 mb-3">
                Atendimento rápido para dúvidas e contratação
              </p>
              <span className="text-base font-extrabold text-slate-950 group-hover:text-[#2CA840] transition-colors">
                WhatsApp: {SYSTEM_CONTACTS.whatsapp}
              </span>
              <span className="mt-3 inline-flex items-center text-xs font-semibold text-[#2CA840]">
                Abrir no WhatsApp{' '}
                <ArrowRight className="ml-1 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </a>

            {/* CELULAR */}
            <a
              href={SYSTEM_CONTACTS.phoneLink}
              className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all group flex flex-col items-center text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#2CA840] border border-emerald-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Phone className="h-7 w-7" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full mb-2">
                Ligação Telefônica
              </span>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Celular</h3>
              <p className="text-xs text-slate-500 mb-3">
                Contato direto por voz em horário comercial
              </p>
              <span className="text-base font-extrabold text-slate-950 group-hover:text-[#2CA840] transition-colors">
                Celular: {SYSTEM_CONTACTS.phone}
              </span>
              <span className="mt-3 inline-flex items-center text-xs font-semibold text-slate-700">
                Ligar agora{' '}
                <ArrowRight className="ml-1 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </a>

            {/* E-MAIL */}
            <a
              href={SYSTEM_CONTACTS.emailLink}
              className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all group flex flex-col items-center text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#2CA840] border border-emerald-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Mail className="h-7 w-7" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full mb-2">
                Mensagem Formal
              </span>
              <h3 className="text-lg font-bold text-slate-900 mb-1">E-mail</h3>
              <p className="text-xs text-slate-500 mb-3">Envio de dúvidas, propostas e suporte</p>
              <span className="text-base font-extrabold text-slate-950 group-hover:text-[#2CA840] transition-colors break-all">
                E-mail: {SYSTEM_CONTACTS.email}
              </span>
              <span className="mt-3 inline-flex items-center text-xs font-semibold text-[#2CA840]">
                Enviar e-mail{' '}
                <ArrowRight className="ml-1 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* FINAL CTA BANNER */}
      <section className="py-20 bg-gradient-to-r from-emerald-600 via-[#2CA840] to-emerald-700 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Pronto para profissionalizar as avaliações de experiência da sua empresa?
          </h2>
          <p className="mt-4 text-emerald-100 text-base max-w-xl mx-auto">
            Comece hoje mesmo com o plano Mensal ou garanta o plano Anual com R$ 665 de economia.
            Proteja sua empresa contra passivos trabalhistas.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#precos"
              className="w-full sm:w-auto h-14 px-8 inline-flex items-center justify-center text-base font-extrabold bg-white hover:bg-slate-100 text-slate-950 rounded-xl shadow-lg transition-all"
            >
              Assinar agora!
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
            <a href="#desempenho" className="hover:text-emerald-700 transition-colors">
              Avaliação de Desempenho
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
            <a href="#contato" className="hover:text-emerald-700 transition-colors">
              Contato
            </a>
            <Link to="/login" className="hover:text-emerald-700 transition-colors">
              Área do Cliente
            </Link>
          </div>

          <div className="flex flex-col items-center md:items-end gap-1 text-slate-500">
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 text-slate-600 font-medium">
              <a
                href={SYSTEM_CONTACTS.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#2CA840] transition-colors inline-flex items-center gap-1"
              >
                <MessageCircle className="h-3.5 w-3.5 text-[#2CA840]" /> WhatsApp:{' '}
                {SYSTEM_CONTACTS.whatsapp}
              </a>
              <span>•</span>
              <a
                href={SYSTEM_CONTACTS.phoneLink}
                className="hover:text-[#2CA840] transition-colors inline-flex items-center gap-1"
              >
                <Phone className="h-3.5 w-3.5 text-[#2CA840]" /> Celular: {SYSTEM_CONTACTS.phone}
              </a>
              <span>•</span>
              <a
                href={SYSTEM_CONTACTS.emailLink}
                className="hover:text-[#2CA840] transition-colors inline-flex items-center gap-1"
              >
                <Mail className="h-3.5 w-3.5 text-[#2CA840]" /> E-mail: {SYSTEM_CONTACTS.email}
              </a>
            </div>
            <div>
              &copy; {new Date().getFullYear()} Avaliação de Experiência. Todos os direitos
              reservados.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Sales
