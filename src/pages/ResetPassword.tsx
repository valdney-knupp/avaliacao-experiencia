import React, { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RPontesLogo } from '@/components/RPontesLogo'

export const ResetPassword: React.FC = () => {
  const { confirmPasswordReset } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!token) {
      setErrorMessage('Token de recuperação inválido ou ausente.')
      return
    }

    if (password.length < 8) {
      setErrorMessage('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== passwordConfirm) {
      setErrorMessage('As senhas informadas não coincidem.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await confirmPasswordReset(token, password)
      if (error) {
        setErrorMessage('Não foi possível redefinir a senha. O link pode ter expirado.')
      } else {
        setSuccess(true)
      }
    } catch {
      setErrorMessage('Erro ao redefinir senha.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#111111] via-[#1a1a1a] to-[#0d1f12] p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#161616]/90 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <RPontesLogo variant="dark-bg" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white mt-4">Redefinição de Senha</h1>
          <p className="mt-1 text-sm text-gray-400">Avaliação de Experiência</p>
        </div>

        {success ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#54D769]/20 text-[#54D769]">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">Senha alterada com sucesso!</h2>
              <p className="text-sm text-gray-400">
                Você já pode acessar o sistema com sua nova senha.
              </p>
            </div>
            <Button
              onClick={() => navigate('/login')}
              className="w-full bg-[#54D769] font-semibold text-[#111111] hover:bg-[#3DBE52]"
            >
              Ir para o Login
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

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                Nova Senha (mínimo 8 caracteres)
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-lg border-white/10 bg-black/40 pl-10 pr-10 text-white placeholder:text-gray-500 focus-visible:border-[#54D769] focus-visible:ring-1 focus-visible:ring-[#54D769]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                Confirmar Nova Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
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
              {submitting ? 'Salvando...' : 'Salvar Nova Senha'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
