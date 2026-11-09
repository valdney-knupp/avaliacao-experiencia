import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LeadCaptureSection } from './LeadCaptureSection'
import * as leadService from '@/services/leadCapture'

describe('LeadCaptureSection component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renderiza os campos de nome, e-mail e botão de envio com chamada sugestiva em pt-BR', () => {
    render(<LeadCaptureSection />)

    expect(screen.getByLabelText(/Nome completo/i)).toBeDefined()
    expect(screen.getByLabelText(/E-mail corporativo ou pessoal/i)).toBeDefined()
    expect(
      screen.getByRole('button', { name: /Quero receber novidades e materiais/i }),
    ).toBeDefined()
    expect(
      screen.getByText(/Quer receber novidades, modelos de avaliação e materiais de RH\?/i),
    ).toBeDefined()
  })

  it('valida campos obrigatórios antes do envio', async () => {
    render(<LeadCaptureSection />)

    const submitBtn = screen.getByRole('button', { name: /Quero receber novidades e materiais/i })
    fireEvent.click(submitBtn)

    expect(await screen.findByText(/Por favor, informe seu nome completo/i)).toBeDefined()

    const nameInput = screen.getByLabelText(/Nome completo/i)
    fireEvent.change(nameInput, { target: { value: 'João da Silva' } })
    fireEvent.click(submitBtn)

    expect(
      await screen.findByText(/Por favor, informe um e-mail corporativo ou pessoal válido/i),
    ).toBeDefined()
  })

  it('exibe mensagem de confirmação ao cadastrar lead com sucesso e limpa os campos', async () => {
    const captureLeadSpy = vi.spyOn(leadService, 'captureLead').mockResolvedValue({
      success: true,
      message:
        'Cadastro realizado com sucesso! Você receberá nossos materiais e novidades em breve.',
      data: {
        email: 'joao.silva@exemplo.com',
        status: 'subscribed',
      },
    })

    render(<LeadCaptureSection />)

    const nameInput = screen.getByLabelText(/Nome completo/i) as HTMLInputElement
    const emailInput = screen.getByLabelText(/E-mail corporativo ou pessoal/i) as HTMLInputElement
    const submitBtn = screen.getByRole('button', { name: /Quero receber novidades e materiais/i })

    fireEvent.change(nameInput, { target: { value: 'João da Silva' } })
    fireEvent.change(emailInput, { target: { value: 'joao.silva@exemplo.com' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(captureLeadSpy).toHaveBeenCalledWith({
        name: 'João da Silva',
        email: 'joao.silva@exemplo.com',
        source: 'sales_page',
      })
    })

    expect(await screen.findByText(/Cadastro realizado com sucesso!/i)).toBeDefined()
    expect(
      screen.getByText(
        /Você já foi incluído na nossa lista exclusiva de comunicações e novidades/i,
      ),
    ).toBeDefined()

    // Campos limpos após sucesso
    expect(nameInput.value).toBe('')
    expect(emailInput.value).toBe('')
  })

  it('exibe mensagem de erro clara em caso de falha e PRESERVA os dados digitados', async () => {
    const captureLeadSpy = vi
      .spyOn(leadService, 'captureLead')
      .mockRejectedValue(new Error('Servidor temporariamente indisponível. Tente novamente.'))

    render(<LeadCaptureSection />)

    const nameInput = screen.getByLabelText(/Nome completo/i) as HTMLInputElement
    const emailInput = screen.getByLabelText(/E-mail corporativo ou pessoal/i) as HTMLInputElement
    const submitBtn = screen.getByRole('button', { name: /Quero receber novidades e materiais/i })

    fireEvent.change(nameInput, { target: { value: 'Maria Gestora' } })
    fireEvent.change(emailInput, { target: { value: 'maria@empresa.com' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(captureLeadSpy).toHaveBeenCalled()
    })

    expect(await screen.findByText(/Não foi possível concluir o envio/i)).toBeDefined()
    expect(
      screen.getByText(/Servidor temporariamente indisponível\. Tente novamente\./i),
    ).toBeDefined()

    // DADOS DEVEM SER PRESERVADOS (não apagados) para o usuário não perder o que digitou
    expect(nameInput.value).toBe('Maria Gestora')
    expect(emailInput.value).toBe('maria@empresa.com')
  })
})
