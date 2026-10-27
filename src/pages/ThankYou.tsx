import React from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Mail,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  Clock,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLogo } from '@/components/AppLogo'

export const ThankYou: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#111111] via-[#1a1a1a] to-[#0d1f12] text-gray-100 flex flex-col justify-between p-4 sm:p-8">
      {/* Top Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4">
        <Link to="/vendas" className="hover:opacity-90 transition-opacity">
          <AppLogo variant="dark-bg" size="sm" layout="compact" />
        </Link>
        <Link
          to="/login"
          className="text-xs sm:text-sm font-medium text-gray-400 hover:text-[#54D769] transition-colors"
        >
          Ir para Login
        </Link>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto w-full my-8">
        <div className="rounded-3xl border border-white/10 bg-[#161616]/90 p-6 sm:p-10 shadow-2xl backdrop-blur-md text-center">
          {/* Success Badge */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#54D769]/15 border border-[#54D769]/30 text-[#54D769] mb-6 animate-in zoom-in-50 duration-300">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#54D769]/10 text-[#6EE787] text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="h-3.5 w-3.5" /> Assinatura Confirmada
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Obrigado por assinar o Avaliação de Experiência!
          </h1>

          <p className="mt-4 text-sm sm:text-base text-gray-300 leading-relaxed">
            Seu pagamento foi processado com segurança via Stripe. Estamos felizes em ter sua
            empresa conosco para profissionalizar a gestão dos contratos de 45 e 90 dias.
          </p>

          <div className="my-8 border-t border-white/10" />

          {/* Orientações Próximos Passos */}
          <div className="text-left space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#54D769] flex items-center gap-2">
              <Clock className="h-4 w-4" /> Próximos Passos para Acesso
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-black/40 border border-white/5">
                <div className="w-7 h-7 rounded-lg bg-[#54D769]/20 text-[#54D769] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Comprovante de pagamento</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    O Stripe enviou a confirmação e o recibo detalhado para o e-mail cadastrado na
                    hora da compra.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-black/40 border border-white/5">
                <div className="w-7 h-7 rounded-lg bg-[#54D769]/20 text-[#54D769] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Liberação do Acesso Administrador
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Nossa equipe técnica providencia a criação e o provisionamento do perfil
                    Administrador da sua empresa para que você possa cadastrar sua equipe e importar
                    seus colaboradores.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-black/40 border border-white/5">
                <div className="w-7 h-7 rounded-lg bg-[#54D769]/20 text-[#54D769] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Ativação & Instruções por E-mail</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Você receberá um e-mail com as credenciais iniciais e orientações de primeiro
                    acesso. Verifique também a caixa de spam ou lixo eletrônico.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Dúvidas / Suporte */}
          <div className="mt-8 p-4 rounded-xl bg-[#1A231C] border border-[#54D769]/20 text-xs text-gray-300 flex items-center gap-3 text-left">
            <HelpCircle className="h-5 w-5 text-[#54D769] shrink-0" />
            <div>
              <span className="font-bold text-white">
                Precisa de suporte imediato ou tem alguma dúvida?
              </span>
              <p className="text-gray-400 mt-0.5">
                Entre em contato com nossa equipe através do e-mail do sistema ou fale com o
                administrador da sua conta.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto h-12 px-8 font-bold bg-[#54D769] hover:bg-[#3ebe52] text-black rounded-xl">
                Acessar Área do Cliente
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/vendas" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto h-12 px-6 border-white/10 hover:bg-white/5 text-gray-300 rounded-xl"
              >
                Voltar à Página Inicial
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-500 py-4">
        &copy; {new Date().getFullYear()} Avaliação de Experiência. Todos os direitos reservados.
      </footer>
    </div>
  )
}

export default ThankYou
