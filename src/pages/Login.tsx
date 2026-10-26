import React, { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AppLogo } from '@/components/AppLogo'

export const Login: React.FC = () => {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    try {
      const stored = sessionStorage.getItem('auth_expired_message')
      if (stored) {
        sessionStorage.removeItem('auth_expired_message')
        return stored
      }
    } catch {
      // sessionStorage indisponível
    }
    return null
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email || !password) {
      setErrorMessage('Por favor, preencha todos os campos.')
      return
    }

    if (password.length < 8) {
      setErrorMessage('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await signIn(email, password)
      if (error) {
        if (error.message.includes('inativo')) {
          setErrorMessage('Usuário inativo. Contate o administrador.')
        } else {
          setErrorMessage('E-mail ou senha inválidos.')
        }
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch {
      setErrorMessage('Falha ao autenticar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#111111] via-[#1a1a1a] to-[#0d1f12] p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#161616]/90 p-8 shadow-2xl backdrop-blur-md">
        {/* Logo & Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex w-full justify-center">
            <AppLogo variant="dark-bg" size="lg" layout="full" align="center" />
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Acesso restrito para colaboradores e gestores autorizados
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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                Senha
              </Label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-xs text-[#54D769] transition-colors hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
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
            className="h-11 w-full rounded-lg bg-[#54D769] font-semibold text-[#111111] transition-all hover:bg-[#3DBE52] hover:shadow-lg disabled:opacity-50"
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#111111] border-t-transparent" />
                <span>Entrando...</span>
              </div>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
