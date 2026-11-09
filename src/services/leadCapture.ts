import pb from '@/lib/pocketbase/client'

export interface CaptureLeadPayload {
  name: string
  email: string
  source?: string
}

export interface CaptureLeadResult {
  success: boolean
  message: string
  data?: {
    email: string
    status: string
  }
}

/**
 * Envia o lead para o endpoint de backend `/backend/v1/leads/capture`.
 * O endpoint persiste na base de leads e sincroniza com a audiência 'Knupp Dados' (7b27bed6cc) no Mailchimp.
 * Trata idempotência (contato existente) como sucesso amigável.
 */
export async function captureLead(payload: CaptureLeadPayload): Promise<CaptureLeadResult> {
  const name = payload.name?.trim() || ''
  const email = payload.email?.trim().toLowerCase() || ''

  if (!name) {
    throw new Error('Por favor, informe seu nome completo.')
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email)) {
    throw new Error('Por favor, informe um e-mail válido.')
  }

  const baseUrl = (pb.baseUrl || '').replace(/\/$/, '')
  const endpoint = `${baseUrl}/backend/v1/leads/capture`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        email,
        source: payload.source || 'sales_page',
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || data.success === false) {
      const errorMsg =
        data.error ||
        data.message ||
        'Falha ao registrar contato. Verifique sua conexão e tente novamente.'
      throw new Error(errorMsg)
    }

    return {
      success: true,
      message:
        data.message ||
        'Cadastro realizado com sucesso! Você receberá nossos materiais e novidades.',
      data: data.data,
    }
  } catch (err: unknown) {
    // Se o endpoint customizado não puder ser alcançado por problema transitório, tenta criar diretamente via SDK
    if (err instanceof Error && !err.message.includes('informe')) {
      try {
        await pb.collection('leads').create({
          name,
          email,
          source: payload.source || 'sales_page',
          status: 'pending',
          notes: 'Capturado via fallback SDK de leads',
        })
        return {
          success: true,
          message: 'Cadastro realizado com sucesso! Seus dados foram salvos com segurança.',
        }
      } catch (_) {
        // Mantém erro original se falhar ambos
      }
    }

    const message =
      err instanceof Error
        ? err.message
        : 'Não foi possível enviar agora. Tente novamente em instantes.'
    throw new Error(message)
  }
}
