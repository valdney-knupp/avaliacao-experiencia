import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RPontesLogo } from '@/components/RPontesLogo'

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [message, setMessage] = useState('Confirmando seu endereço de e-mail...')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Token de confirmação não fornecido.')
      return
    }

    const verify = async () => {
      try {
        await pb.collection('users').confirmVerification(token)
        setStatus('success')
        setMessage('E-mail verificado com sucesso! Agora sua conta está totalmente ativa.')
      } catch (err: unknown) {
        setStatus('error')
        setMessage(
          'Falha ao confirmar o e-mail ou o link expirou: ' +
            (err instanceof Error ? err.message : ''),
        )
      }
    }

    verify()
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#111111] via-[#1a1a1a] to-[#0d1f12] p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#161616]/90 p-8 shadow-2xl backdrop-blur-md text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <RPontesLogo variant="dark-bg" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white mb-2 mt-4">
          Verificação de E-mail
        </h1>

        <div className="my-6">
          {status === 'verifying' && (
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#54D769] border-t-transparent" />
              <p className="text-sm text-gray-300">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#54D769]/20 text-[#54D769]">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="text-sm text-gray-300">{message}</p>
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-[#54D769] font-semibold text-[#111111] hover:bg-[#3DBE52]"
              >
                Acessar o Sistema
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                <AlertCircle className="h-8 w-8" />
              </div>
              <p className="text-sm text-red-400">{message}</p>
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-white/10 text-white hover:bg-white/20"
              >
                Voltar para o Login
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
