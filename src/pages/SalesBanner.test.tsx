import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sales } from './Sales'

// Mock de syncManualAssetToBackend para evitar chamadas de rede no teste
vi.mock('@/lib/manualService', () => ({
  downloadManualPdf: vi.fn(),
  syncManualAssetToBackend: vi.fn().mockResolvedValue(true),
}))

// Mock de stripeCheckout para carregar rápido com as 3 ofertas
vi.mock('@/lib/stripeCheckout', () => {
  const FALLBACK_MODULE_OFFERS = {
    experiencia: {
      id: 'experiencia',
      title: 'Avaliação de Experiência',
      subtitle: 'Gestão de 45/90 dias',
      monthly: { price_label: '297,00' },
      annual: { price_label: '2.899,00' },
    },
    desempenho: {
      id: 'desempenho',
      title: 'Avaliação de Desempenho',
      subtitle: 'Avaliação contínua por competências',
      monthly: { price_label: '150,00' },
      annual: { price_label: '1.399,00' },
    },
    combo: {
      id: 'combo',
      title: 'Combo Experiência + Desempenho',
      subtitle: 'Solução completa',
      monthly: { price_label: '397,00' },
      annual: { price_label: '3.897,00' },
    },
  }

  return {
    FALLBACK_MODULE_OFFERS,
    FALLBACK_CHECKOUT_CONFIG: {
      stripe_connected: true,
      monthly: FALLBACK_MODULE_OFFERS.experiencia.monthly,
      annual: FALLBACK_MODULE_OFFERS.experiencia.annual,
      offers: FALLBACK_MODULE_OFFERS,
    },
    getStripeCheckoutConfig: vi.fn().mockResolvedValue({
      stripe_connected: true,
      monthly: FALLBACK_MODULE_OFFERS.experiencia.monthly,
      annual: FALLBACK_MODULE_OFFERS.experiencia.annual,
      offers: FALLBACK_MODULE_OFFERS,
    }),
    buildCheckoutUrl: vi.fn((url: string) => url),
    createCheckoutSession: vi.fn(),
  }
})

describe('Sales page - Faixa de Lançamento Especial', () => {
  it('exibe as três ofertas (Experiência, Avaliação de Desempenho e Combo) com mensal, anual e destaques de economia', () => {
    render(
      <MemoryRouter>
        <Sales />
      </MemoryRouter>,
    )

    // Verifica a presença do título da faixa
    expect(screen.getByText(/Lançamento Especial:/i)).toBeDefined()

    // Verifica menção ao módulo de Experiência e valores
    expect(screen.getByText(/Experiência:/i)).toBeDefined()
    expect(screen.getByText(/Mensal R\$ 297,00/i)).toBeDefined()
    expect(screen.getByText(/Anual com economia de R\$ 665/i)).toBeDefined()
    expect(screen.getByText(/2\.899,00/i)).toBeDefined()

    // Verifica menção à Avaliação de Desempenho e valores
    expect(screen.getByText(/Avaliação de Desempenho:/i)).toBeDefined()
    expect(screen.getByText(/Mensal R\$ 150,00/i)).toBeDefined()
    expect(screen.getByText(/1\.399,00/i)).toBeDefined()

    // Verifica menção ao Combo e valores
    expect(screen.getByText(/Combo:/i)).toBeDefined()
    expect(screen.getByText(/Mensal R\$ 397,00/i)).toBeDefined()
    expect(screen.getByText(/3\.897,00/i)).toBeDefined()
    expect(screen.getByText(/Mais vantajoso/i)).toBeDefined()
  })

  it('exibe o logo atualizado com "& DESEMPENHO" e itens de navegação legíveis e estruturados', () => {
    render(
      <MemoryRouter>
        <Sales />
      </MemoryRouter>,
    )

    // Verifica que o logo exibe AVALIAÇÃO e DE EXPERIÊNCIA & DESEMPENHO
    expect(screen.getAllByText(/AVALIAÇÃO/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/DE EXPERIÊNCIA/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/& DESEMPENHO/i).length).toBeGreaterThanOrEqual(1)

    // Links de navegação principais presentes
    expect(screen.getAllByRole('link', { name: /Benefícios/i }).length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByRole('link', { name: /Módulo Desempenho/i }).length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('link', { name: /Como funciona/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('link', { name: /Planos & Preços/i }).length).toBeGreaterThanOrEqual(
      1,
    )
    expect(screen.getAllByRole('link', { name: /Dúvidas/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('link', { name: /Contato/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('link', { name: /Já sou cliente/i }).length).toBeGreaterThanOrEqual(
      1,
    )
    expect(screen.getAllByRole('link', { name: /Ver Planos/i }).length).toBeGreaterThanOrEqual(1)
  })
})
