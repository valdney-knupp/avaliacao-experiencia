import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Clock,
  MessageCircle,
  Phone,
  Mail,
  Headphones,
  FileDown,
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLogo } from '@/components/AppLogo'
import { SYSTEM_CONTACTS } from '@/lib/contacts'
import { downloadManualPdf, syncManualAssetToBackend } from '@/lib/manualService'

import { trackPurchaseConversion } from '@/lib/googleAds'

export const ThankYou: React.FC = () => {
  // Dispara o evento oficial de conversão de compra no Google Ads uma única vez ao montar
  useEffect(() => {
    trackPurchaseConversion()
  }, [])

  useEffect(() => {
    syncManualAssetToBackend().catch(() => {})
  }, [])
  // Mantém a página de agradecimento sempre clara para coerência com a de vendas
  useEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    root.classList.remove('dark')
    return () => {
      const stored = localStorage.getItem('ae_app_theme')
      if (stored === 'dark' || (hadDark && stored !== 'light')) {
        root.classList.add('dark')
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100 text-slate-900 flex flex-col justify-between p-4 sm:p-8">
      {/* Top Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4">
        <Link to="/" className="hover:opacity-90 transition-opacity">
          <AppLogo variant="light-bg" size="sm" layout="compact" />
        </Link>
        <Link
          to="/login"
          className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-[#2CA840] transition-colors"
        >
          Ir para Login
        </Link>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto w-full my-8">
        <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 sm:p-10 shadow-xl backdrop-blur-md text-center">
          {/* Success Badge */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 border border-emerald-200 text-[#2CA840] mb-6 animate-in zoom-in-50 duration-300">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="h-3.5 w-3.5 text-[#2CA840]" /> Assinatura Confirmada
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
            Obrigado por assinar o Avaliação de Experiência!
          </h1>

          <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
            Seu pagamento foi processado com segurança via Stripe. Estamos felizes em ter sua
            empresa conosco para profissionalizar a gestão dos contratos de 45 e 90 dias.
          </p>

          <div className="my-8 border-t border-slate-200" />

          {/* Caixa de Destaque para Download do Manual do Usuário */}
          <div className="text-left rounded-2xl border-2 border-emerald-400 bg-emerald-50/70 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[#2CA840]" />
                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                    Manual do Usuário em PDF Liberado
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed max-w-xl">
                  Acesse o passo a passo oficial com a ordem correta dos cadastros (Centros de Custo
                  → Setores → Critérios por Setor → Colaboradores → Avaliações de 45 e 90 dias) e os
                  5 modelos de planilhas para importação.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
                <Button
                  onClick={downloadManualPdf}
                  className="gap-2 bg-[#54D769] hover:bg-[#43c457] text-white font-bold text-xs sm:text-sm h-11 px-5 shadow-sm"
                >
                  <FileDown className="h-4 w-4" />
                  Baixar Manual (PDF)
                </Button>
                <a
                  href="/manual-usuario.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center text-xs text-slate-600 hover:text-slate-900 underline underline-offset-4 px-2 py-1 text-center"
                >
                  Abrir no navegador
                </a>
              </div>
            </div>
          </div>

          {/* Orientações Próximos Passos */}
          <div className="text-left space-y-4 mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#2CA840] flex items-center gap-2">
              <Clock className="h-4 w-4" /> Próximos Passos para Acesso
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#2CA840] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Comprovante de pagamento</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    O Stripe enviou a confirmação e o recibo detalhado para o e-mail cadastrado na
                    hora da compra.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#2CA840] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Liberação do Acesso Administrador
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Nossa equipe técnica providencia a criação e o provisionamento do perfil
                    Administrador da sua empresa para que você possa cadastrar sua equipe e importar
                    seus colaboradores.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#2CA840] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    E-mail de Boas-Vindas com Manual Anexo
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Você receberá um e-mail com seu usuário, senha inicial gerada e o{' '}
                    <strong>Manual do Usuário em PDF anexado</strong>. O sistema já está ativo e
                    liberado para uso imediato.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Dúvidas / Suporte - Fale Conosco */}
          <div className="mt-8 p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-slate-700 text-left">
            <div className="flex items-center gap-2 mb-3">
              <Headphones className="h-4 w-4 text-[#2CA840] shrink-0" />
              <span className="font-bold text-sm text-slate-900">
                Precisa de ajuda? Fale conosco
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Nossa equipe de suporte e atendimento está à disposição para auxiliá-lo na ativação da
              conta, dúvidas sobre a nota fiscal ou suporte técnico inicial.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <a
                href={SYSTEM_CONTACTS.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-emerald-200 hover:border-emerald-400 hover:shadow-sm transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#2CA840] flex items-center justify-center shrink-0">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    WhatsApp
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 truncate group-hover:text-[#2CA840]">
                    {SYSTEM_CONTACTS.whatsapp}
                  </div>
                </div>
              </a>

              <a
                href={SYSTEM_CONTACTS.phoneLink}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-emerald-200 hover:border-emerald-400 hover:shadow-sm transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#2CA840] flex items-center justify-center shrink-0">
                  <Phone className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Celular
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 truncate group-hover:text-[#2CA840]">
                    {SYSTEM_CONTACTS.phone}
                  </div>
                </div>
              </a>

              <a
                href={SYSTEM_CONTACTS.emailLink}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-emerald-200 hover:border-emerald-400 hover:shadow-sm transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#2CA840] flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    E-mail
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 truncate group-hover:text-[#2CA840]">
                    {SYSTEM_CONTACTS.email}
                  </div>
                </div>
              </a>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto h-12 px-8 font-bold bg-[#54D769] hover:bg-[#43c457] text-white rounded-xl shadow-md">
                Acessar Área do Cliente
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto h-12 px-6 border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl"
              >
                Voltar à Página Inicial
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 py-4">
        &copy; {new Date().getFullYear()} Avaliação de Experiência. Todos os direitos reservados.
      </footer>
    </div>
  )
}

export default ThankYou
