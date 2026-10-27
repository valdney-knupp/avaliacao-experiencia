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
  Users,
  ChevronDown,
  Sparkles,
  Lock,
  Zap,
  HelpCircle,
  Clock,
  Briefcase,
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
import { getStripeCheckoutConfig, FALLBACK_CHECKOUT_CONFIG } from '@/lib/stripeCheckout'

export const Sales: React.FC = () => {
  const [checkoutUrl, setCheckoutUrl] = useState<string>(FALLBACK_CHECKOUT_CONFIG.payment_link)
  const [loadingCheckout, setLoadingCheckout] = useState(true)

  useEffect(() => {
    let isMounted = true
    getStripeCheckoutConfig()
      .then((cfg) => {
        if (isMounted && cfg.payment_link) {
          setCheckoutUrl(cfg.payment_link)
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

  const handleCtaClick = () => {
    // Redireciona diretamente para o checkout do Stripe
    window.location.href = checkoutUrl
  }

  return (
    <div className="min-h-screen bg-[#0D0F0E] text-gray-100 selection:bg-[#54D769] selection:text-black">
      {/* Top Notification / Banner */}
      <div className="bg-gradient-to-r from-[#17381F] via-[#102315] to-[#17381F] border-b border-[#54D769]/20 px-4 py-2 text-center text-xs sm:text-sm font-medium text-emerald-300 flex items-center justify-center gap-2">
        <Sparkles className="h-4 w-4 text-[#54D769] shrink-0 animate-pulse" />
        <span>
          <strong>Lançamento Especial:</strong> Assinatura comercial por apenas{' '}
          <strong className="text-white">R$ 297/mês</strong> — Cancele quando quiser, sem
          fidelidade.
        </span>
      </div>

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0D0F0E]/85 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/vendas" className="hover:opacity-90 transition-opacity">
            <AppLogo variant="dark-bg" size="md" layout="compact" />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <a href="#beneficios" className="hover:text-[#54D769] transition-colors">
              Benefícios
            </a>
            <a href="#como-funciona" className="hover:text-[#54D769] transition-colors">
              Como funciona
            </a>
            <a href="#para-quem-e" className="hover:text-[#54D769] transition-colors">
              Público-alvo
            </a>
            <a href="#preco" className="hover:text-[#54D769] transition-colors">
              Plano & Preço
            </a>
            <a href="#faq" className="hover:text-[#54D769] transition-colors">
              Dúvidas
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-xs sm:text-sm text-gray-400 hover:text-white px-3 py-2 rounded-lg transition-colors font-medium"
            >
              Já sou cliente
            </Link>
            <Button
              onClick={handleCtaClick}
              disabled={loadingCheckout}
              className="bg-gradient-to-r from-[#6EE787] to-[#2CA840] hover:from-[#54D769] hover:to-[#259136] text-black font-bold shadow-lg shadow-[#54D769]/20 px-5 py-2.5 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Assinar agora
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
        {/* Glow de fundo */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#54D769]/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#18291C] border border-[#54D769]/30 text-[#6EE787] text-xs font-semibold uppercase tracking-wider mb-8">
            <ShieldCheck className="h-4 w-4" />
            Gestão Jurídica & Operacional de Contratos de Experiência
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Nunca mais perca o prazo de{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6EE787] via-[#54D769] to-[#38B94F]">
              45 e 90 dias
            </span>{' '}
            do contrato de experiência.
          </h1>

          <p className="mt-6 text-base sm:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Elimine riscos trabalhistas, padronize critérios de avaliação por centro de custo e
            setor, e tome decisões embasadas de efetivação ou desligamento com auditoria completa.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={handleCtaClick}
              disabled={loadingCheckout}
              className="w-full sm:w-auto h-14 px-8 text-base font-extrabold bg-gradient-to-r from-[#6EE787] via-[#54D769] to-[#2CA840] hover:from-[#54D769] hover:to-[#228734] text-black rounded-xl shadow-xl shadow-[#54D769]/25 transition-all transform hover:scale-[1.03]"
            >
              Começar agora por R$ 297/mês
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <a
              href="#como-funciona"
              className="w-full sm:w-auto h-14 px-6 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-200 font-semibold transition-colors"
            >
              Ver demonstração
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-gray-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#54D769]" />
              <span>Sem taxa de adesão</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#54D769]" />
              <span>Cancele a qualquer momento</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#54D769]" />
              <span>Pagamento 100% seguro via Stripe</span>
            </div>
          </div>

          {/* Mockup / Dashboard Preview Card */}
          <div className="mt-14 relative rounded-2xl p-1 bg-gradient-to-b from-[#54D769]/30 via-white/5 to-white/0 shadow-2xl">
            <div className="rounded-xl overflow-hidden bg-[#141815] border border-white/10 text-left">
              {/* Fake window top bar */}
              <div className="px-4 py-3 bg-[#0F1210] border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                  <span className="ml-3 text-xs text-gray-400 font-mono">
                    app.avaliacaodeexperiencia.com.br
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#54D769] font-medium bg-[#54D769]/10 px-2.5 py-1 rounded-md">
                  <span className="w-2 h-2 rounded-full bg-[#54D769] animate-ping" />
                  Monitoramento diário ativo
                </div>
              </div>

              {/* Fake dashboard cards inside */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#1B221E] p-4 rounded-lg border border-white/5">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                    <span>1ª Avaliação (45 dias)</span>
                    <Clock className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-white">12 colaboradores</div>
                  <p className="text-xs text-[#54D769] mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> 8 avaliados no prazo legal
                  </p>
                </div>

                <div className="bg-[#1B221E] p-4 rounded-lg border border-white/5">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                    <span>2ª Avaliação (90 dias)</span>
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-black text-white">7 decisões finais</div>
                  <p className="text-xs text-blue-300 mt-1">Efetivação ou término do contrato</p>
                </div>

                <div className="bg-[#1B221E] p-4 rounded-lg border border-white/5">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                    <span>Alertas Preventivos</span>
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-300">5 dias de antecedência</div>
                  <p className="text-xs text-gray-400 mt-1">
                    Disparos por centro de custo e e-mail
                  </p>
                </div>
              </div>

              {/* Fake Table Snapshot */}
              <div className="px-6 pb-6 overflow-x-auto">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
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
                      statusColor: 'text-[#54D769] bg-[#54D769]/10 border-[#54D769]/20',
                    },
                    {
                      nome: 'Mariana Souza Santos',
                      cargo: 'Analista Financeiro Pleno',
                      cc: 'Escritório Central',
                      etapa: '90 dias',
                      status: 'Avaliação Concluída (Efetivada)',
                      statusColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                    },
                    {
                      nome: 'Rafael Nogueira Lima',
                      cargo: 'Assistente Administrativo',
                      cc: 'Unidade Centro',
                      etapa: '45 dias',
                      status: 'Aguardando Avaliador',
                      statusColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                    },
                  ].map((row, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-black/30 border border-white/5 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white text-sm">{row.nome}</div>
                        <div className="text-gray-400 text-xs">
                          {row.cargo} • <span className="text-gray-300">{row.cc}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
                          {row.etapa}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-md border font-medium ${row.statusColor}`}
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
      <section className="py-16 bg-[#121614] border-y border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs uppercase tracking-widest text-[#54D769] font-bold">
              O Risco Invisível do RH
            </h2>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
              Deixar vencer o contrato de experiência custa milhares de reais.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-[#171D19] border border-red-500/20">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4 font-bold text-xl">
                !
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Efetivação Tácita Acidental</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Se o 90º dia passar sem avaliação ou termo assinado, o contrato passa
                automaticamente a ser por prazo indeterminado. O desligamento passa a exigir aviso
                prévio, multa de 40% do FGTS e indenizações.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#171D19] border border-amber-500/20">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 font-bold text-xl">
                ⏱
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Decisões no Improviso</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Gestores avaliam colaboradores em cima da hora, sem critérios claros ou registro
                formal, gerando contratações frustradas e passivo trabalhista por falta de histórico
                documentado.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#171D19] border border-[#54D769]/20">
              <div className="w-12 h-12 rounded-lg bg-[#54D769]/10 border border-[#54D769]/30 flex items-center justify-center text-[#54D769] mb-4 font-bold text-xl">
                ✓
              </div>
              <h3 className="text-lg font-bold text-white mb-2">A Solução Definitiva</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
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
          <div className="inline-flex items-center gap-1.5 text-[#54D769] text-xs font-bold uppercase tracking-wider mb-3">
            <Zap className="h-4 w-4" /> Recursos Completos
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Tudo o que sua empresa precisa para dominar o período de experiência
          </h2>
          <p className="mt-4 text-gray-400 text-sm sm:text-base">
            Projetado para dar autonomia a gestores de obras e departamentos sem abrir mão da
            segurança central do RH.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#151916] border border-white/5 hover:border-[#54D769]/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#54D769]/10 text-[#54D769] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Marcos de 45 e 90 Dias</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Cálculo automático e preciso a partir da data de admissão. Identifique quem está
              próximo do vencimento e evite prorrogações automáticas indesejadas.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#151916] border border-white/5 hover:border-[#54D769]/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#54D769]/10 text-[#54D769] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Building2 className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Centros de Custo & Setores</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Segregação visual por obras, projetos, matriz e filiais. Cada gestor enxerga apenas
              sua equipe ou canteiro de obras, mantendo a privacidade.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#151916] border border-white/5 hover:border-[#54D769]/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#54D769]/10 text-[#54D769] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Importação em Lote & Modelos</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Baixe os modelos Excel prontos, importe centenas de colaboradores e avaliações com
              validação prévia, simulação de erros e substituição segura.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#151916] border border-white/5 hover:border-[#54D769]/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#54D769]/10 text-[#54D769] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <BadgeCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Critérios por Categoria</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Formulários adaptados com critérios distintos para canteiro de obras vs. escritório
              administrativo. Notas padronizadas com justificativa obrigatória para decisões.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#151916] border border-white/5 hover:border-[#54D769]/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#54D769]/10 text-[#54D769] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <BellRing className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Alertas e Notificações</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Disparos automáticos diários de aviso prévio para os e-mails dos responsáveis de cada
              centro de custo. Nenhum prazo passa em branco.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#151916] border border-white/5 hover:border-[#54D769]/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#54D769]/10 text-[#54D769] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Auditoria & LGPD</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              CPFs criptografados em repouso com hash seguro de busca, controle rígido de perfis
              (Admin, RH, Gestores, Visualizadores) e log imutável de ações.
            </p>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA (PASSOS) */}
      <section id="como-funciona" className="py-20 bg-[#121614] border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[#54D769] text-xs font-bold uppercase tracking-wider">
              Fluxo Simplificado
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
              Como funciona na prática em 3 passos
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="relative p-6 rounded-2xl bg-[#171D19] border border-white/5 flex flex-col">
              <div className="w-10 h-10 rounded-full bg-[#54D769] text-black font-extrabold flex items-center justify-center text-lg mb-4">
                1
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Cadastre ou Importe</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Adicione colaboradores individualmente ou suba a planilha do seu ERP (Totvs, Senior,
                Sankhya, etc.). O sistema calcula os marcos de 45 e 90 dias instantaneamente.
              </p>
            </div>

            <div className="relative p-6 rounded-2xl bg-[#171D19] border border-white/5 flex flex-col">
              <div className="w-10 h-10 rounded-full bg-[#54D769] text-black font-extrabold flex items-center justify-center text-lg mb-4">
                2
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Avalie nos Marcos</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                O gestor recebe o alerta 5 dias antes. Ele abre o formulário responsivo no celular
                ou computador, pontua os critérios e assinala prorrogar, efetivar ou rescindir.
              </p>
            </div>

            <div className="relative p-6 rounded-2xl bg-[#171D19] border border-white/5 flex flex-col">
              <div className="w-10 h-10 rounded-full bg-[#54D769] text-black font-extrabold flex items-center justify-center text-lg mb-4">
                3
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Decisão Segura & Histórico</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                O RH visualiza as decisões consolidadas no painel executivo e gera relatórios em
                Excel prontos para auditoria trabalhista e folha de pagamento.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Button
              size="lg"
              onClick={handleCtaClick}
              disabled={loadingCheckout}
              className="bg-[#54D769] hover:bg-[#3ebe52] text-black font-extrabold px-8 py-3 rounded-xl shadow-lg shadow-[#54D769]/20"
            >
              Garantir minha assinatura
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* PÚBLICO-ALVO */}
      <section id="para-quem-e" className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-[#54D769] text-xs font-bold uppercase tracking-wider">
            Para quem é o sistema
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
            Desenvolvido para operações com alta dinâmica de contratações
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#141815] border border-white/5">
            <Building2 className="h-8 w-8 text-[#54D769] mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Construtoras & Engenharia</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Múltiplos canteiros de obras distantes da sede, grande fluxo de admissões operacionais
              (pedreiros, serventes, carpinteiros) e gestores de obra no campo.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#141815] border border-white/5">
            <Briefcase className="h-8 w-8 text-[#54D769] mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Escritórios & Serviços</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Empresas de tecnologia, contabilidade, advocacia e consultoria que exigem critérios
              comportamentais e técnicos detalhados para consolidar contratações estratégicas.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#141815] border border-white/5">
            <Users className="h-8 w-8 text-[#54D769] mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Empresas com CLT em Geral</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Qualquer organização que contrata em regime CLT e deseja blindar o RH contra falhas de
              vencimento do artigo 445 e 451 da CLT.
            </p>
          </div>
        </div>
      </section>

      {/* PLANO & PREÇO (STRIPE CHECKOUT CTA) */}
      <section
        id="preco"
        className="py-20 bg-gradient-to-b from-[#111613] to-[#0A0D0B] border-t border-white/5"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#54D769]/10 border border-[#54D769]/30 text-[#6EE787] text-xs font-semibold uppercase tracking-wider mb-4">
            Plano Único e Transparente
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white">
            Investimento que se paga na primeira rescisão evitada
          </h2>
          <p className="mt-4 text-gray-400 text-sm sm:text-base max-w-xl mx-auto">
            Sem pegadinhas, sem cobrança por colaborador cadastrado, sem contrato de fidelidade.
          </p>

          <div className="mt-12 max-w-md mx-auto rounded-3xl p-1 bg-gradient-to-b from-[#54D769] via-[#38B94F] to-[#17381F] shadow-2xl shadow-[#54D769]/20">
            <div className="bg-[#141815] rounded-[22px] p-8 sm:p-10 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#54D769]">
                    Assinatura Mensal
                  </span>
                  <h3 className="text-2xl font-black text-white mt-1">Plano Comercial</h3>
                </div>
                <div className="px-3 py-1 rounded-full bg-[#54D769]/20 text-[#54D769] text-xs font-bold">
                  Acesso Total
                </div>
              </div>

              <div className="mt-6 flex items-baseline">
                <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                  R$ 297
                </span>
                <span className="text-gray-400 ml-2 font-medium">/mês</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Cobrança recorrente mensal no cartão de crédito.
              </p>

              <div className="my-8 border-t border-white/10" />

              <div className="space-y-3.5 text-sm">
                {[
                  'Colaboradores ilimitados em experiência',
                  'Gestão completa de 45 e 90 dias',
                  'Centros de custo e setores ilimitados',
                  'Critérios personalizáveis (Obra e Escritório)',
                  'Múltiplos perfis (Admin, RH, Gestores, Assistentes)',
                  'Importação e exportação de planilhas Excel',
                  'Notificações e alertas preventivos diários',
                  'Log de auditoria e segurança LGPD',
                  'Suporte prioritário e atualizações contínuas',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-gray-200">
                    <CheckCircle2 className="h-5 w-5 text-[#54D769] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <Button
                size="lg"
                onClick={handleCtaClick}
                disabled={loadingCheckout}
                className="w-full mt-8 h-14 text-base font-extrabold bg-gradient-to-r from-[#6EE787] via-[#54D769] to-[#2CA840] hover:from-[#54D769] hover:to-[#228734] text-black rounded-xl shadow-xl shadow-[#54D769]/30 transition-all transform hover:scale-[1.02]"
              >
                Assinar agora por R$ 297/mês
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                <Lock className="h-3.5 w-3.5 text-gray-400" />
                <span>Processado com segurança pelo Stripe</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 text-[#54D769] text-xs font-bold uppercase tracking-wider mb-2">
            <HelpCircle className="h-4 w-4" /> Perguntas Frequentes
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Tire suas dúvidas sobre o sistema
          </h2>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          <AccordionItem
            value="item-1"
            className="border border-white/10 rounded-xl px-6 bg-[#141815]"
          >
            <AccordionTrigger className="text-left font-bold text-white hover:text-[#54D769] py-5">
              O que acontece ao fim dos 90 dias do contrato de experiência?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-gray-300 leading-relaxed pb-5">
              Pela CLT, se a empresa não comunicar o término até o 90º dia, o contrato torna-se
              automaticamente por prazo indeterminado. O sistema emite alertas diários com 5 dias de
              antecedência para que a decisão de prorrogação ou rescisão seja tomada e assinada
              rigorosamente no prazo.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-2"
            className="border border-white/10 rounded-xl px-6 bg-[#141815]"
          >
            <AccordionTrigger className="text-left font-bold text-white hover:text-[#54D769] py-5">
              Quantos colaboradores posso cadastrar na minha conta?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-gray-300 leading-relaxed pb-5">
              O plano de R$ 297/mês dá acesso ilimitado. Você pode cadastrar quantos colaboradores,
              obras e setores precisar, sem qualquer cobrança adicional por volume de dados.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-3"
            className="border border-white/10 rounded-xl px-6 bg-[#141815]"
          >
            <AccordionTrigger className="text-left font-bold text-white hover:text-[#54D769] py-5">
              Como funciona a importação da base atual de colaboradores?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-gray-300 leading-relaxed pb-5">
              O sistema disponibiliza modelos em formato Excel (.xlsx) prontos para download. Basta
              preencher as colunas (Nome, CPF, Data de Admissão, Centro de Custo, Setor e Cargo) e
              fazer o upload. O sistema valida todos os dados em modo simulação antes de efetivar o
              cadastro.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-4"
            className="border border-white/10 rounded-xl px-6 bg-[#141815]"
          >
            <AccordionTrigger className="text-left font-bold text-white hover:text-[#54D769] py-5">
              Posso cancelar a assinatura quando quiser?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-gray-300 leading-relaxed pb-5">
              Sim, totalmente livre. Não exigimos tempo mínimo de permanência nem multas
              rescisórias. Você gerencia sua assinatura com total autonomia e pode cancelar a
              renovação com um clique.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-5"
            className="border border-white/10 rounded-xl px-6 bg-[#141815]"
          >
            <AccordionTrigger className="text-left font-bold text-white hover:text-[#54D769] py-5">
              Como meus gestores de obra e departamentos acessam o sistema?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-gray-300 leading-relaxed pb-5">
              O administrador cria os usuários com o perfil correspondente (Gestor de Obra ou Gestor
              de Departamento) vinculado ao seu respectivo centro de custo. Cada gestor acessa por
              e-mail e senha e enxerga apenas a sua equipe designada.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* FINAL CTA BANNER */}
      <section className="py-20 bg-gradient-to-r from-[#142618] via-[#103017] to-[#142618] border-t border-[#54D769]/20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Pronto para profissionalizar as avaliações de experiência da sua empresa?
          </h2>
          <p className="mt-4 text-gray-300 text-base max-w-xl mx-auto">
            Comece hoje mesmo por apenas R$ 297/mês. Proteja sua empresa contra passivos
            trabalhistas com o sistema líder em gestão de experiência.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={handleCtaClick}
              disabled={loadingCheckout}
              className="w-full sm:w-auto h-14 px-8 text-base font-extrabold bg-[#54D769] hover:bg-[#3ebe52] text-black rounded-xl shadow-xl shadow-[#54D769]/30"
            >
              Assinar agora via Stripe
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Link
              to="/login"
              className="text-sm text-gray-300 hover:text-white font-medium py-2 px-4 transition-colors"
            >
              Já possuo acesso ao sistema
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER (100% NEUTRO) */}
      <footer className="bg-[#090B0A] border-t border-white/5 py-12 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex flex-col items-center md:items-start gap-2">
            <AppLogo variant="dark-bg" size="sm" layout="compact" />
            <p className="text-gray-400 mt-1 max-w-sm">
              Plataforma especializada na gestão de contratos de experiência de 45 e 90 dias.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-gray-400">
            <a href="#beneficios" className="hover:text-[#54D769] transition-colors">
              Benefícios
            </a>
            <a href="#como-funciona" className="hover:text-[#54D769] transition-colors">
              Como funciona
            </a>
            <a href="#preco" className="hover:text-[#54D769] transition-colors">
              Preço
            </a>
            <a href="#faq" className="hover:text-[#54D769] transition-colors">
              FAQ
            </a>
            <Link to="/login" className="hover:text-[#54D769] transition-colors">
              Área do Cliente
            </Link>
          </div>

          <div className="text-gray-500">
            &copy; {new Date().getFullYear()} Avaliação de Experiência. Todos os direitos
            reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Sales
