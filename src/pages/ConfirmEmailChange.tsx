import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RPontesLogo } from '@/components/RPontesLogo'

export const ConfirmEmailChange: React.FC = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { confirmEmailChange } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!token) {
      setErrorMessage('Token de confirmação inválido ou expirado.')
      return
    }

    if (password.length < 8) {
      setErrorMessage('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await confirmEmailChange(token, password)
      if (error) {
        setErrorMessage('Senha incorreta ou link expirado.')
      } else {
        navigate('/login?changed=true')
      }
    } catch {
      setErrorMessage('Erro ao confirmar novo e-mail.')
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
          <h1 className="text-xl font-bold tracking-tight text-white mt-4">
            Confirmar Alteração de E-mail
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Digite sua senha atual para validar a troca de e-mail
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-gray-300">
              Sua Senha Atual
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

          <Button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-lg bg-[#54D769] font-semibold text-[#111111] transition-all hover:bg-[#3DBE52] disabled:opacity-50"
          >
            {submitting ? 'Confirmando...' : 'Confirmar e Trocar E-mail'}
          </Button>
        </form>
      </div>
    </div>
  )
}
