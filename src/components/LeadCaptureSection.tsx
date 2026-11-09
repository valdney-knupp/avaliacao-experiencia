import React, { useState } from 'react'
import { Mail, User, CheckCircle2, AlertCircle, Loader2, Sparkles, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { captureLead } from '@/services/leadCapture'

interface LeadCaptureSectionProps {
  id?: string
  className?: string
  source?: string
}

export const LeadCaptureSection: React.FC<LeadCaptureSectionProps> = ({
  id = 'materiais-gratuitos',
  className = '',
  source = 'sales_page',
}) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName) {
      setErrorMessage('Por favor, informe seu nome completo.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setErrorMessage('Por favor, informe um e-mail corporativo ou pessoal válido.')
      return
    }

    setLoading(true)
    try {
      const result = await captureLead({
        name: trimmedName,
        email: trimmedEmail,
        source,
      })

      setSuccessMessage(result.message || 'Cadastro realizado com sucesso!')
      // Limpa os campos apenas após sucesso confirmado
      setName('')
      setEmail('')
    } catch (err: unknown) {
      // IMPORTANTE: Em caso de falha, mantém os campos preenchidos intactos para o usuário não perder o que digitou
      const msg =
        err instanceof Error
          ? err.message
          : 'Ocorreu um erro ao enviar. Tente novamente em instantes.'
      setErrorMessage(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      id={id}
      className={`py-16 sm:py-20 bg-slate-900 text-white relative overflow-hidden ${className}`}
    >
      {/* Elementos visuais de fundo */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-emerald-500 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-emerald-400 blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-8 sm:p-12 shadow-2xl backdrop-blur-sm">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[#2CA840] text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              Receba Materiais & Atualizações
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              Quer receber novidades, modelos de avaliação e materiais de RH?
            </h2>
            <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
              Cadastre seu nome e e-mail para receber conteúdos práticos sobre gestão de contratos
              de experiência, avaliação por competências e boas práticas de retenção de talentos.
            </p>
          </div>

          {/* Feedback de Sucesso */}
          {successMessage && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-6 p-4 sm:p-5 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 flex items-start gap-3.5 animate-in fade-in slide-in-from-top-2"
            >
              <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-sm leading-relaxed">
                <strong className="block font-bold text-white text-base">
                  Cadastro realizado com sucesso!
                </strong>
                <p className="text-emerald-200/90 mt-0.5">{successMessage}</p>
                <p className="text-xs text-emerald-300/70 mt-2">
                  Você já foi incluído na nossa lista exclusiva de comunicações e novidades.
                </p>
              </div>
            </div>
          )}

          {/* Feedback de Erro (preserva os dados digitados) */}
          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-6 p-4 sm:p-5 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 flex items-start gap-3.5 animate-in fade-in slide-in-from-top-2"
            >
              <AlertCircle className="h-6 w-6 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-sm leading-relaxed">
                <strong className="block font-bold text-white text-base">
                  Não foi possível concluir o envio
                </strong>
                <p className="text-rose-200/90 mt-0.5">{errorMessage}</p>
                <p className="text-xs text-rose-300/70 mt-1">
                  Seus dados continuam preenchidos abaixo. Por favor, confira as informações e
                  clique em enviar novamente.
                </p>
              </div>
            </div>
          )}

          {/* Formulário de captura */}
          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl mx-auto" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Campo Nome */}
              <div>
                <label
                  htmlFor="lead-name"
                  className="block text-xs font-semibold text-slate-300 mb-1.5 text-left"
                >
                  Nome completo *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="lead-name"
                    name="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Campo E-mail */}
              <div>
                <label
                  htmlFor="lead-email"
                  className="block text-xs font-semibold text-slate-300 mb-1.5 text-left"
                >
                  E-mail corporativo ou pessoal *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="lead-email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@empresa.com"
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* Botão de envio */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#2CA840] hover:bg-[#258d36] text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Enviando cadastro...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Quero receber novidades e materiais
                  </>
                )}
              </Button>
            </div>

            <p className="text-[11px] text-slate-400 text-center pt-1">
              🔒 Respeitamos sua privacidade. Você receberá apenas comunicados úteis e poderá
              cancelar a inscrição a qualquer momento.
            </p>
          </form>
        </div>
      </div>
    </section>
  )
}

export default LeadCaptureSection
