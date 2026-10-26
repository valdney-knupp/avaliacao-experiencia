import React, { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useNavigate } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AppLogo } from '@/components/AppLogo'

export const ForgotPassword: React.FC = () => {
  const { requestPasswordReset } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email) {
      setErrorMessage('Informe seu e-mail cadastrado.')
      return
    }

    setSubmitting(true)
    try {
      await requestPasswordReset(email)
      setSubmitted(true)
    } catch {
      // Show generic success anyway for security
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#111111] via-[#1a1a1a] to-[#0d1f12] p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#161616]/90 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <AppLogo variant="dark-bg" size="lg" layout="full" align="center" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white mt-4">Recuperação de Senha</h1>
          <p className="mt-1 text-sm text-gray-400">Ciclo de 45 e 90 dias</p>
        </div>

        {submitted ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#54D769]/20 text-[#54D769]">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">Verifique seu e-mail</h2>
              <p className="text-sm text-gray-400">
                Se o e-mail estiver cadastrado, enviaremos um link de recuperação com as instruções
                para redefinir sua senha.
              </p>
            </div>
            <Button
              onClick={() => navigate('/login')}
              className="w-full bg-[#54D769] font-semibold text-[#111111] hover:bg-[#3DBE52]"
            >
              Voltar para o Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <p className="text-sm text-gray-300">
              Digite o e-mail da sua conta para receber o link de redefinição de senha.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                E-mail
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="email"
                  placeholder="seu.email@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-lg border-white/10 bg-black/40 pl-10 text-white placeholder:text-gray-500 focus-visible:border-[#54D769] focus-visible:ring-1 focus-visible:ring-[#54D769]"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="h-11 w-full rounded-lg bg-[#54D769] font-semibold text-[#111111] transition-all hover:bg-[#3DBE52] disabled:opacity-50"
            >
              {submitting ? 'Enviando link...' : 'Enviar link de recuperação'}
            </Button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="flex w-full items-center justify-center gap-2 text-xs font-medium text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
