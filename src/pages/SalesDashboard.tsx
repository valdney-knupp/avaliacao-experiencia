import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  fetchUnifiedSalesData,
  computeSalesMetrics,
  filterSales,
  type UnifiedSaleRecord,
  type ModuleCategory,
  type PeriodFilter,
} from '@/services/salesDashboard'
import { formatDateTimeBR } from '@/lib/dateAndCpfUtils'
import {
  TrendingUp,
  DollarSign,
  Users,
  ShieldAlert,
  Calendar,
  Layers,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const MODULE_COLORS: Record<ModuleCategory, string> = {
  experiencia: '#2CA840', // Verde R. Pontes
  desempenho: '#3B82F6', // Azul
  combo: '#8B5CF6', // Roxo
  outro: '#6B7280', // Cinza
}

export const SalesDashboard: React.FC = () => {
  const { user, canAccessAdmin } = useAuth()

  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<UnifiedSaleRecord[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('all')
  const [selectedModule, setSelectedModule] = useState<ModuleCategory | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await fetchUnifiedSalesData()
      setSales(data)
    } catch (err) {
      console.warn('[SalesDashboard] Erro ao carregar dados:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canAccessAdmin) {
      loadData()
    }
  }, [canAccessAdmin])

  // Filtragem dos registros
  const filteredSales = useMemo(() => {
    const afterFilters = filterSales(sales, selectedPeriod, selectedModule)
    if (!searchTerm.trim()) return afterFilters

    const term = searchTerm.toLowerCase()
    return afterFilters.filter(
      (s) =>
        s.customer_name.toLowerCase().includes(term) ||
        s.customer_email.toLowerCase().includes(term) ||
        s.module_label.toLowerCase().includes(term) ||
        s.plan.toLowerCase().includes(term),
    )
  }, [sales, selectedPeriod, selectedModule, searchTerm])

  // Métricas computadas
  const metrics = useMemo(() => {
    return computeSalesMetrics(filteredSales)
  }, [filteredSales])

  // Se o usuário não tiver acesso, a rota protegida já cuidará, mas garantimos fallback seguro
  if (!canAccessAdmin) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-red-500 mb-3" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Acesso Restrito</h2>
        <p className="text-sm text-slate-500 mt-1">
          Apenas usuários com perfil de Administração possuem permissão para visualizar o Dashboard
          de Vendas.
        </p>
      </div>
    )
  }

  // Dados para o gráfico de pizza por módulo
  const pieData = [
    {
      name: 'Experiência',
      value: metrics.moduleDistribution.experiencia.total,
      color: MODULE_COLORS.experiencia,
    },
    {
      name: 'Desempenho',
      value: metrics.moduleDistribution.desempenho.total,
      color: MODULE_COLORS.desempenho,
    },
    {
      name: 'Combo',
      value: metrics.moduleDistribution.combo.total,
      color: MODULE_COLORS.combo,
    },
  ].filter((item) => item.value > 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#54D769]/15 text-[#2CA840] dark:text-[#54D769]">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Dashboard de Vendas & Assinaturas
            </h1>
            <Badge
              variant="outline"
              className="text-xs bg-[#54D769]/10 text-emerald-700 dark:text-emerald-400 border-emerald-300"
            >
              Administração
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Métricas em tempo real calculadas a partir dos contratos Stripe e liberações de acesso
            por módulo.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="self-start sm:self-auto gap-2 border-slate-200 dark:border-white/10 text-xs shadow-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Dados
        </Button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white dark:bg-[#141815] rounded-2xl border border-slate-200 dark:border-white/10 p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Período */}
          <div className="flex items-center gap-2 min-w-[170px]">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <Select
              value={selectedPeriod}
              onValueChange={(val) => setSelectedPeriod(val as PeriodFilter)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo o período</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="year">Ano atual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Módulo */}
          <div className="flex items-center gap-2 min-w-[190px]">
            <Layers className="h-4 w-4 text-slate-400 shrink-0" />
            <Select
              value={selectedModule}
              onValueChange={(val) => setSelectedModule(val as ModuleCategory | 'all')}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Módulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos</SelectItem>
                <SelectItem value="experiencia">Avaliação de Experiência</SelectItem>
                <SelectItem value="desempenho">Avaliação de Desempenho</SelectItem>
                <SelectItem value="combo">Combo (Exp + Des)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Busca por cliente */}
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, e-mail ou módulo..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total de Vendas */}
        <div className="bg-white dark:bg-[#141815] rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total de Vendas / Assinaturas</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-slate-900 dark:text-white">
            {metrics.totalSalesCount}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Contratos e acessos registrados
          </p>
        </div>

        {/* Receita Total */}
        <div className="bg-white dark:bg-[#141815] rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Receita Acumulada</span>
            <div className="p-2 rounded-lg bg-[#54D769]/15 text-[#2CA840] dark:text-[#54D769]">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-slate-900 dark:text-white">
            R$ {metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
            Assinaturas ativas confirmadas
          </p>
        </div>

        {/* Assinaturas Ativas */}
        <div className="bg-white dark:bg-[#141815] rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Assinaturas Ativas</span>
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-slate-900 dark:text-white">
            {metrics.activeSubscriptionsCount}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Com vigência em dia e acesso liberado
          </p>
        </div>

        {/* Suspensas ou Expiradas */}
        <div className="bg-white dark:bg-[#141815] rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Suspensas / Expiradas</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-slate-900 dark:text-white">
            {metrics.suspendedOrExpiredCount}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Vigência expirada ou bloqueadas
          </p>
        </div>
      </div>

      {/* Cards de Distribuição por Módulo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Avaliação de Experiência */}
        <div className="bg-white dark:bg-[#141815] rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-xs border-l-4 border-l-[#2CA840]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Módulo Experiência
            </span>
            <Badge className="bg-[#54D769]/20 text-[#1B7029] dark:text-[#54D769] hover:bg-[#54D769]/30 text-[10px]">
              R$ 297/mês • R$ 2.899/ano
            </Badge>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {metrics.moduleDistribution.experiencia.total}
            </span>
            <span className="text-xs text-slate-500">vendas</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <span>{metrics.moduleDistribution.experiencia.mensal} mensais</span>
            <span>{metrics.moduleDistribution.experiencia.anual} anuais</span>
            <span className="font-bold text-slate-900 dark:text-white">
              R${' '}
              {metrics.moduleDistribution.experiencia.revenue.toLocaleString('pt-BR', {
                minimumFractionDigits: 0,
              })}
            </span>
          </div>
        </div>

        {/* Avaliação de Desempenho */}
        <div className="bg-white dark:bg-[#141815] rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-xs border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Módulo Desempenho
            </span>
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-200 text-[10px]">
              R$ 150/mês • R$ 1.399/ano
            </Badge>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {metrics.moduleDistribution.desempenho.total}
            </span>
            <span className="text-xs text-slate-500">vendas</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <span>{metrics.moduleDistribution.desempenho.mensal} mensais</span>
            <span>{metrics.moduleDistribution.desempenho.anual} anuais</span>
            <span className="font-bold text-slate-900 dark:text-white">
              R${' '}
              {metrics.moduleDistribution.desempenho.revenue.toLocaleString('pt-BR', {
                minimumFractionDigits: 0,
              })}
            </span>
          </div>
        </div>

        {/* Combo */}
        <div className="bg-white dark:bg-[#141815] rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-xs border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Combo Completo
            </span>
            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 hover:bg-purple-200 text-[10px]">
              R$ 397/mês • R$ 3.897/ano
            </Badge>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {metrics.moduleDistribution.combo.total}
            </span>
            <span className="text-xs text-slate-500">vendas</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <span>{metrics.moduleDistribution.combo.mensal} mensais</span>
            <span>{metrics.moduleDistribution.combo.anual} anuais</span>
            <span className="font-bold text-slate-900 dark:text-white">
              R${' '}
              {metrics.moduleDistribution.combo.revenue.toLocaleString('pt-BR', {
                minimumFractionDigits: 0,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Gráficos: Evolução Mensal e Distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Barras: Evolução Mensal */}
        <div className="lg:col-span-2 bg-white dark:bg-[#141815] rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Evolução Mensal de Vendas & Receita
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quantidade de novas assinaturas e receita confirmada por mês
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            {metrics.monthlyEvolution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado registrado para o período selecionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={metrics.monthlyEvolution}
                  margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    stroke="#2CA840"
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#3B82F6"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val) => `R$${val}`}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      if (name === 'Receita') {
                        return [
                          `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                          'Receita',
                        ]
                      }
                      return [value, 'Novas Vendas']
                    }}
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar
                    yAxisId="left"
                    dataKey="salesCount"
                    name="Novas Vendas"
                    fill="#2CA840"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="revenue"
                    name="Receita"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico de Pizza: Divisão por Módulo */}
        <div className="bg-white dark:bg-[#141815] rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Divisão por Módulo</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Proporção das assinaturas ativas e contratadas
            </p>

            <div className="h-56 w-full mt-2">
              {pieData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Nenhuma venda no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                      paddingAngle={4}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [`${val} assinaturas`, 'Total']}
                      contentStyle={{
                        backgroundColor: '#1E293B',
                        borderRadius: '8px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#2CA840]" />
                <span className="text-slate-600 dark:text-slate-300">Experiência</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">
                {metrics.moduleDistribution.experiencia.total}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-slate-600 dark:text-slate-300">Desempenho</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">
                {metrics.moduleDistribution.desempenho.total}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                <span className="text-slate-600 dark:text-slate-300">Combo</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">
                {metrics.moduleDistribution.combo.total}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Últimas Vendas */}
      <div className="bg-white dark:bg-[#141815] rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="h-4 w-4 text-[#2CA840]" />
              Últimas Vendas & Liberações de Acesso
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Registros detalhados de compradores, vigências por módulo e modalidade
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {filteredSales.length} registro(s) encontrado(s)
          </span>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-slate-50 dark:bg-white/5 text-[11px] md:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-3 py-3">Módulo</th>
                <th className="px-3 py-3">Plano</th>
                <th className="px-3 py-3">Valor</th>
                <th className="px-3 py-3">Data</th>
                <th className="px-3 py-3 text-center">Situação do Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xs text-slate-500">
                    <div className="max-w-md mx-auto flex flex-col items-center">
                      <TrendingUp className="h-8 w-8 text-slate-300 mb-2" />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Nenhum registro encontrado
                      </span>
                      <p className="text-slate-400 text-[11px] mt-1">
                        Assim que clientes realizarem checkouts pela Stripe ou forem ativados pelo
                        painel, os dados aparecerão automaticamente aqui.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSales.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors"
                  >
                    {/* Cliente */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[220px]">
                        {item.customer_name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
                        {item.customer_email}
                      </div>
                    </td>

                    {/* Módulo */}
                    <td className="px-3 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${
                          item.module === 'combo'
                            ? 'border-purple-300 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40'
                            : item.module === 'desempenho'
                              ? 'border-blue-300 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40'
                              : 'border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40'
                        }`}
                      >
                        {item.module_label}
                      </Badge>
                    </td>

                    {/* Modalidade */}
                    <td className="px-3 py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          item.plan === 'ANUAL'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {item.plan}
                      </span>
                    </td>

                    {/* Valor */}
                    <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">
                      {item.amount_label}
                    </td>

                    {/* Data */}
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap font-mono">
                      {item.created ? formatDateTimeBR(item.created) : '-'}
                    </td>

                    {/* Situação */}
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold ${
                          item.status === 'active' || item.status === 'succeeded'
                            ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                            : item.status === 'suspended'
                              ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {item.status === 'active' || item.status === 'succeeded' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : item.status === 'suspended' ? (
                          <XCircle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {item.status_label}
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
export default SalesDashboard
