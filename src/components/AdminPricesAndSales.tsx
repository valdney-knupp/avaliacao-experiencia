import React, { useState, useEffect } from 'react'
import {
  DollarSign,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CreditCard,
  Building,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { formatDateTimeBR } from '@/lib/dateAndCpfUtils'
import {
  getStripeCheckoutConfig,
  getSalesList,
  syncStripeBilling,
  SaleRecord,
  StripeCheckoutConfig,
  FALLBACK_CHECKOUT_CONFIG,
} from '@/lib/stripeCheckout'
import { useAuth } from '@/hooks/use-auth'

interface AdminPricesAndSalesProps {
  settings: Record<string, string>
  onSaveSetting: (key: string, value: string) => Promise<void>
  isSuperAdmin: boolean
}

export const AdminPricesAndSales: React.FC<AdminPricesAndSalesProps> = ({
  settings,
  onSaveSetting,
  isSuperAdmin,
}) => {
  const { isMasterUser } = useAuth()

  // Estado das configurações de preços
  const [monthlyPrice, setMonthlyPrice] = useState(
    settings.stripe_monthly_price_label || settings.stripe_plan_price_label || '297,00',
  )
  const [monthlyLink, setMonthlyLink] = useState(
    settings.stripe_monthly_payment_link || settings.stripe_payment_link || '',
  )
  const [monthlyActive, setMonthlyActive] = useState(settings.stripe_monthly_active !== 'false')

  const [annualPrice, setAnnualPrice] = useState(settings.stripe_annual_price_label || '2.899,00')
  const [annualLink, setAnnualLink] = useState(settings.stripe_annual_payment_link || '')
  const [annualActive, setAnnualActive] = useState(settings.stripe_annual_active !== 'false')

  const [savingPlan, setSavingPlan] = useState<'monthly' | 'annual' | null>(null)
  const [syncingStripe, setSyncingStripe] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )

  // Estado das vendas
  const [salesList, setSalesList] = useState<SaleRecord[]>([])
  const [stripeConnected, setStripeConnected] = useState<boolean>(false)
  const [loadingSales, setLoadingSales] = useState<boolean>(true)

  // Sincronizar estado local quando settings pai forem atualizadas
  useEffect(() => {
    if (settings.stripe_monthly_price_label || settings.stripe_plan_price_label) {
      setMonthlyPrice(
        settings.stripe_monthly_price_label || settings.stripe_plan_price_label || '297,00',
      )
    }
    if (settings.stripe_monthly_payment_link || settings.stripe_payment_link) {
      setMonthlyLink(settings.stripe_monthly_payment_link || settings.stripe_payment_link || '')
    }
    if (typeof settings.stripe_monthly_active !== 'undefined') {
      setMonthlyActive(settings.stripe_monthly_active !== 'false')
    }

    if (settings.stripe_annual_price_label) {
      setAnnualPrice(settings.stripe_annual_price_label)
    }
    if (settings.stripe_annual_payment_link) {
      setAnnualLink(settings.stripe_annual_payment_link)
    }
    if (typeof settings.stripe_annual_active !== 'undefined') {
      setAnnualActive(settings.stripe_annual_active !== 'false')
    }
  }, [settings])

  // Carregar lista de vendas e status do Stripe
  const loadSales = async () => {
    setLoadingSales(true)
    try {
      const [salesData, checkoutCfg] = await Promise.all([
        getSalesList(),
        getStripeCheckoutConfig(),
      ])
      setSalesList(salesData.sales || [])
      setStripeConnected(salesData.stripe_connected || Boolean(checkoutCfg.stripe_connected))
      if (checkoutCfg.monthly?.payment_link) {
        setMonthlyLink(checkoutCfg.monthly.payment_link)
      }
      if (checkoutCfg.annual?.payment_link) {
        setAnnualLink(checkoutCfg.annual.payment_link)
      }
    } catch (err) {
      console.warn('Erro ao carregar vendas/checkout:', err)
    } finally {
      setLoadingSales(false)
    }
  }

  useEffect(() => {
    if (isMasterUser) {
      loadSales()
    }
  }, [isMasterUser])

  // Se o usuário não for o master, não renderiza nada
  if (!isMasterUser) {
    return null
  }

  // Salvar plano mensal
  const handleSaveMonthly = async () => {
    setSavingPlan('monthly')
    setFeedback(null)
    try {
      await onSaveSetting('stripe_monthly_price_label', monthlyPrice.trim())
      await onSaveSetting('stripe_plan_price_label', monthlyPrice.trim())
      await onSaveSetting('stripe_monthly_active', monthlyActive ? 'true' : 'false')
      if (monthlyLink.trim()) {
        await onSaveSetting('stripe_monthly_payment_link', monthlyLink.trim())
        await onSaveSetting('stripe_payment_link', monthlyLink.trim())
      }
      setFeedback({ type: 'success', message: 'Plano Mensal atualizado com sucesso!' })
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Erro ao salvar Plano Mensal: ' + (err?.message || 'Falha na gravação'),
      })
    } finally {
      setSavingPlan(null)
    }
  }

  // Salvar plano anual
  const handleSaveAnnual = async () => {
    setSavingPlan('annual')
    setFeedback(null)
    try {
      await onSaveSetting('stripe_annual_price_label', annualPrice.trim())
      await onSaveSetting('stripe_annual_active', annualActive ? 'true' : 'false')
      if (annualLink.trim()) {
        await onSaveSetting('stripe_annual_payment_link', annualLink.trim())
      }
      setFeedback({ type: 'success', message: 'Plano Anual atualizado com sucesso!' })
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Erro ao salvar Plano Anual: ' + (err?.message || 'Falha na gravação'),
      })
    } finally {
      setSavingPlan(null)
    }
  }

  // Sincronizar com Stripe
  const handleSyncStripe = async () => {
    setSyncingStripe(true)
    setFeedback(null)
    try {
      const res = await syncStripeBilling()
      if (res.success) {
        setFeedback({ type: 'success', message: res.message })
        await loadSales()
      } else {
        setFeedback({
          type: 'error',
          message:
            res.message ||
            'Não foi possível sincronizar com o Stripe. Verifique a conexão no painel Conectores.',
        })
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Falha ao sincronizar com Stripe.',
      })
    } finally {
      setSyncingStripe(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`rounded-xl border p-4 text-xs flex items-center justify-between shadow-xs ${
            feedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-gray-400 hover:text-black font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* PAINEL DE CONEXÃO STRIPE */}
      <div className="rounded-2xl border border-[#E8E8E8] bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                stripeConnected ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">Integração Stripe Connect</h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    stripeConnected ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {stripeConnected ? 'Conectado' : 'Aguardando Conexão'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 max-w-xl">
                {stripeConnected
                  ? 'A conta Stripe está conectada via Conectores do Skip Cloud. Os preços e payment links são criados e consultados automaticamente em tempo real.'
                  : 'A conta Stripe aguarda ativação na aba Conectores do painel Skip Cloud (autorização do conector). Enquanto isso, você pode cadastrar e salvar os payment links oficiais da Stripe manualmente nos campos abaixo ou sincronizar via conector.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncStripe}
              disabled={syncingStripe}
              className="text-xs border-[#E8E8E8] text-gray-700 hover:text-black"
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${syncingStripe ? 'animate-spin text-[#54D769]' : ''}`}
              />
              {syncingStripe ? 'Sincronizando...' : 'Gerar / Sincronizar na Stripe'}
            </Button>
          </div>
        </div>
      </div>

      {/* GESTÃO DOS PLANOS: MENSAL E ANUAL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD PLANO MENSAL */}
        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E8]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#54D769]/15 text-[#111111] flex items-center justify-center font-black text-xs">
                  M
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Plano Mensal</h3>
                  <p className="text-[11px] text-gray-500">Cobrança recorrente mensal</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 font-medium">Ativo na Página</span>
                <Switch checked={monthlyActive} onCheckedChange={setMonthlyActive} />
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">
                  Preço Exibido (R$ por mês)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-bold">
                    R$
                  </span>
                  <Input
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(e.target.value)}
                    placeholder="297,00"
                    className="h-10 pl-9 text-xs border-[#E8E8E8]"
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  Valor exibido no card da página pública /vendas.
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">
                  Payment Link do Stripe (URL de Checkout)
                </Label>
                <Input
                  value={monthlyLink}
                  onChange={(e) => setMonthlyLink(e.target.value)}
                  placeholder="https://buy.stripe.com/..."
                  className="h-10 text-xs border-[#E8E8E8] font-mono"
                />
                <p className="text-[11px] text-gray-400">
                  Link oficial ou de teste onde o cliente conclui o pagamento do plano mensal.
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-3 text-[11px] text-gray-600 space-y-1 border border-gray-100">
                <div className="flex justify-between">
                  <span className="text-gray-500">Price ID no Stripe:</span>
                  <span className="font-mono text-gray-800">
                    {settings.stripe_monthly_price_id ||
                      settings.stripe_price_id ||
                      'price_avaliacao_experiencia_297'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Visibilidade em /vendas:</span>
                  <span
                    className={
                      monthlyActive ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'
                    }
                  >
                    {monthlyActive ? 'Exibido publicamente' : 'Oculto (Inativo)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-[#E8E8E8] flex items-center justify-between">
            {monthlyLink && (
              <a
                href={monthlyLink}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-gray-600 hover:text-black flex items-center gap-1 font-medium"
              >
                Testar Link <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <Button
              onClick={handleSaveMonthly}
              disabled={savingPlan === 'monthly'}
              className="ml-auto bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-xs"
            >
              {savingPlan === 'monthly' ? 'Salvando...' : 'Salvar Plano Mensal'}
            </Button>
          </div>
        </div>

        {/* CARD PLANO ANUAL */}
        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E8]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                  A
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-gray-900">Plano Anual</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      Economia de R$ 665
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Cobrança recorrente anual com desconto (R$ 2.899/ano)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 font-medium">Ativo na Página</span>
                <Switch checked={annualActive} onCheckedChange={setAnnualActive} />
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">
                  Preço Exibido (R$ por ano)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-bold">
                    R$
                  </span>
                  <Input
                    value={annualPrice}
                    onChange={(e) => setAnnualPrice(e.target.value)}
                    placeholder="2.899,00"
                    className="h-10 pl-9 text-xs border-[#E8E8E8]"
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  Economia de R$ 665 vs 12× o plano mensal (12 × R$ 297 = R$ 3.564).
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">
                  Payment Link do Stripe (URL de Checkout)
                </Label>
                <Input
                  value={annualLink}
                  onChange={(e) => setAnnualLink(e.target.value)}
                  placeholder="https://buy.stripe.com/..."
                  className="h-10 text-xs border-[#E8E8E8] font-mono"
                />
                <p className="text-[11px] text-gray-400">
                  Link oficial ou de teste para pagamento com periodicidade anual.
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-3 text-[11px] text-gray-600 space-y-1 border border-gray-100">
                <div className="flex justify-between">
                  <span className="text-gray-500">Price ID no Stripe:</span>
                  <span className="font-mono text-gray-800">
                    {settings.stripe_annual_price_id || 'price_1UW0OhLpoAima4qdRW4Xmqs0'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Visibilidade em /vendas:</span>
                  <span
                    className={
                      annualActive ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'
                    }
                  >
                    {annualActive ? 'Exibido publicamente' : 'Oculto (Inativo)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-[#E8E8E8] flex items-center justify-between">
            {annualLink && (
              <a
                href={annualLink}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-gray-600 hover:text-black flex items-center gap-1 font-medium"
              >
                Testar Link <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <Button
              onClick={handleSaveAnnual}
              disabled={savingPlan === 'annual'}
              className="ml-auto bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-xs"
            >
              {savingPlan === 'annual' ? 'Salvando...' : 'Salvar Plano Anual'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface AdminSalesTrackingProps {
  isSuperAdmin: boolean
}

export const AdminSalesTracking: React.FC<AdminSalesTrackingProps> = ({ isSuperAdmin }) => {
  const { isMasterUser } = useAuth()

  const [salesList, setSalesList] = useState<SaleRecord[]>([])
  const [stripeConnected, setStripeConnected] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getSalesList()
      setSalesList(data.sales || [])
      setStripeConnected(data.stripe_connected)
    } catch (err) {
      console.warn('Erro ao carregar vendas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isMasterUser) {
      loadData()
    }
  }, [isMasterUser])

  // Se o usuário não for o master, não renderiza nada
  if (!isMasterUser) {
    return null
  }

  // Métricas agregadas
  const totalCount = salesList.length
  const totalRevenue = salesList
    .filter((s) => s.status === 'succeeded' || s.status === 'active')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)

  const monthlyCount = salesList.filter((s) => s.plan === 'MENSAL').length
  const annualCount = salesList.filter((s) => s.plan === 'ANUAL').length

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Total de Assinaturas</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-gray-900">{totalCount}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">Eventos e contratos registrados</p>
        </div>

        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Receita Confirmada</span>
            <DollarSign className="h-4 w-4 text-[#54D769]" />
          </div>
          <div className="mt-2 text-2xl font-black text-gray-900">
            R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-green-700 font-medium mt-0.5">Assinaturas ativas</p>
        </div>

        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Plano Mensal</span>
            <span className="text-[11px] font-bold text-gray-400">R$ 297/mês</span>
          </div>
          <div className="mt-2 text-2xl font-black text-gray-900">{monthlyCount}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">Assinaturas mensais</p>
        </div>

        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Plano Anual</span>
            <span className="text-[11px] font-bold text-emerald-600">R$ 2.899/ano</span>
          </div>
          <div className="mt-2 text-2xl font-black text-gray-900">{annualCount}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">Assinaturas anuais</p>
        </div>
      </div>

      {/* Tabela de Vendas */}
      <div className="rounded-2xl border border-[#E8E8E8] bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E8E8E8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Histórico de Vendas e Assinaturas</h3>
            <p className="text-xs text-gray-500">
              {stripeConnected
                ? 'Conectado à API do Stripe: exibindo dados em tempo real.'
                : 'Registros armazenados na base do sistema (coleção sales) aguardando ativação do conector Stripe.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-xs border-[#E8E8E8] text-gray-700 hover:text-black self-start sm:self-auto"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs md:text-sm table-fixed">
            <thead className="bg-[#F9FAFB] text-[11px] md:text-xs font-semibold text-gray-600 uppercase border-b border-[#E8E8E8]">
              <tr>
                <th className="w-[18%] px-3 md:px-4 py-2.5">Data / Hora</th>
                <th className="w-[14%] px-2 md:px-3 py-2.5">Plano</th>
                <th className="w-[16%] px-2 md:px-3 py-2.5">Valor</th>
                <th className="w-[26%] px-2 md:px-3 py-2.5">Cliente</th>
                <th className="w-[14%] px-2 md:px-3 py-2.5 text-center">Status</th>
                <th className="w-[12%] px-2 md:px-3 py-2.5 text-right">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8E8]">
              {salesList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="max-w-md mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
                        <TrendingUp className="h-6 w-6" />
                      </div>
                      <h4 className="text-sm font-bold text-gray-800">
                        Nenhuma venda registrada ainda
                      </h4>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Assim que um visitante assinar o Plano Mensal ou Anual pela página pública
                        (/vendas), a transação aparecerá listada aqui com data, plano contratado,
                        valor e status.
                      </p>
                      {!stripeConnected && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-left text-[11px] text-amber-800 flex items-start gap-2">
                          <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                          <span>
                            Dica: conecte sua conta Stripe na aba <strong>Conectores</strong> para
                            sincronizar automaticamente todas as assinaturas reais da sua conta.
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                salesList.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50/80">
                    <td className="px-3 md:px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap font-mono">
                      {sale.created ? formatDateTimeBR(sale.created) : '-'}
                    </td>
                    <td className="px-2 md:px-3 py-2.5">
                      <span
                        className={`text-[10px] md:text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                          sale.plan === 'ANUAL'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {sale.plan}
                      </span>
                    </td>
                    <td className="px-2 md:px-3 py-2.5 font-bold text-gray-900">
                      {sale.amount_label ||
                        (sale.amount
                          ? `R$ ${sale.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : '-')}
                    </td>
                    <td className="px-2 md:px-3 py-2.5 truncate" title={sale.customer_email}>
                      <div className="font-semibold text-gray-900 truncate">
                        {sale.customer_name}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {sale.customer_email}
                      </div>
                    </td>
                    <td className="px-2 md:px-3 py-2.5 text-center">
                      <span
                        className={`text-[10px] md:text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
                          sale.status === 'succeeded' || sale.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : sale.status === 'pending' || sale.status === 'checkout_started'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {sale.status === 'succeeded' || sale.status === 'active'
                          ? 'Confirmada'
                          : sale.status === 'checkout_started'
                            ? 'Iniciada'
                            : sale.status === 'pending'
                              ? 'Pendente'
                              : sale.status}
                      </span>
                    </td>
                    <td className="px-2 md:px-3 py-2.5 text-right">
                      <span className="text-[11px] font-mono text-gray-400">
                        {sale.source === 'stripe' ? 'Stripe API' : 'Base Local'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
