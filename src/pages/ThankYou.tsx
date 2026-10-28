import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ArrowRight, Sparkles, HelpCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLogo } from '@/components/AppLogo'

export const ThankYou: React.FC = () => {
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
        <Link to="/vendas" className="hover:opacity-90 transition-opacity">
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

          {/* Orientações Próximos Passos */}
          <div className="text-left space-y-4">
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
                    Ativação & Instruções por E-mail
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Você receberá um e-mail com as credenciais iniciais e orientações de primeiro
                    acesso. Verifique também a caixa de spam ou lixo eletrônico.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Dúvidas / Suporte */}
          <div className="mt-8 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-slate-700 flex items-center gap-3 text-left">
            <HelpCircle className="h-5 w-5 text-[#2CA840] shrink-0" />
            <div>
              <span className="font-bold text-slate-900">
                Precisa de suporte imediato ou tem alguma dúvida?
              </span>
              <p className="text-slate-600 mt-0.5">
                Entre em contato com nossa equipe através do e-mail do sistema ou fale com o
                administrador da sua conta.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto h-12 px-8 font-bold bg-[#54D769] hover:bg-[#43c457] text-white rounded-xl shadow-md">
                Acessar Área do Cliente
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/vendas" className="w-full sm:w-auto">
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
