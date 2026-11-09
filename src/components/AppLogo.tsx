import React from 'react'

export interface AppLogoProps {
  /**
   * Variante de fundo:
   * - 'dark-bg': para fundos escuros (#111111, gradientes de login, sidebar escuro)
   * - 'light-bg': para fundos claros (#ffffff, #F5F5F5)
   * - 'card-contrast': para contraste médio em cartões
   */
  variant?: 'dark-bg' | 'light-bg' | 'card-contrast'
  /**
   * Tamanho do logo:
   * - 'sm': compacto (ideal para headers e tabelas)
   * - 'md': padrão (sidebar, dialogs)
   * - 'lg': destaque (telas de autenticação / login)
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Layout do logo:
   * - 'full': símbolo + texto completo ("AVALIAÇÃO DE EXPERIÊNCIA" + badge "45 • 90 DIAS")
   * - 'compact': símbolo + nome em linha
   * - 'symbol-only': apenas o emblema/símbolo SVG
   */
  layout?: 'full' | 'compact' | 'symbol-only'
  /**
   * Alinhamento quando layout='full' ou 'compact'
   */
  align?: 'center' | 'left'
  /**
   * Se verdadeiro, inclui "& DESEMPENHO" junto ao módulo de experiência
   */
  withDesempenho?: boolean
  /**
   * Classes extras para o container
   */
  className?: string
  /**
   * Classes extras para o elemento SVG do símbolo
   */
  imgClassName?: string
  /**
   * Texto alternativo para acessibilidade
   */
  alt?: string
}

/**
 * Símbolo vetorial exclusivo do Sistema de Avaliação de Experiência.
 *
 * Conceito visual:
 * 1. Anel orbital de 45° a 90° com dois nós iluminados que simbolizam os marcos
 *    legais de avaliação (45 e 90 dias do período de experiência).
 * 2. Emblema interno em escudo com grid sutil de base/construção sólida.
 * 3. Três barras ascendentes de desenvolvimento do colaborador (evolução progressiva).
 * 4. Checkmark dinâmico de verificação/aprovação que cruza o marco final.
 */
export const AppLogoSymbol: React.FC<{
  className?: string
  size?: number | string
  isDark?: boolean
}> = ({ className = 'h-10 w-10', size, isDark = false }) => {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      role="img"
      aria-label="Símbolo Avaliação de Experiência"
    >
      <defs>
        {/* Gradiente principal verde vibrante da identidade */}
        <linearGradient id="ael-green-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6EE787" />
          <stop offset="60%" stopColor="#54D769" />
          <stop offset="100%" stopColor="#2CA840" />
        </linearGradient>

        {/* Gradiente de arco do ciclo 45-90 dias */}
        <linearGradient id="ael-arc-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#54D769" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#54D769" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#A3F3B1" />
        </linearGradient>

        {/* Gradiente sutil do fundo do escudo */}
        <linearGradient id="ael-shield-fill" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop
            offset="0%"
            stopColor={isDark ? '#232824' : '#EDF8EE'}
            stopOpacity={isDark ? '0.9' : '0.95'}
          />
          <stop
            offset="100%"
            stopColor={isDark ? '#141715' : '#DDF0E1'}
            stopOpacity={isDark ? '0.95' : '1'}
          />
        </linearGradient>

        {/* Brilho suave */}
        <filter id="ael-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="glow" />
          <feComposite in="SourceGraphic" in2="glow" operator="over" />
        </filter>
      </defs>

      {/* Halo de fundo sutil */}
      <circle cx="32" cy="32" r="30" fill="url(#ael-shield-fill)" />

      {/* Arco externo parcial: representa a jornada/ciclo de 45 a 90 dias */}
      <path
        d="M 12 36 A 23 23 0 1 1 52 38"
        stroke="url(#ael-arc-grad)"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Pista guia de fundo do ciclo */}
      <path
        d="M 12 36 A 23 23 0 0 0 52 38"
        stroke={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 4"
        fill="none"
      />

      {/* Marco 45 dias: nó na posição superior esquerda do ciclo */}
      <g>
        <circle
          cx="17"
          cy="20"
          r="3"
          fill="#54D769"
          stroke={isDark ? '#141715' : '#FFFFFF'}
          strokeWidth="1.5"
        />
        <circle cx="17" cy="20" r="1.2" fill="#FFFFFF" />
      </g>

      {/* Marco 90 dias: nó na posição superior direita do ciclo */}
      <g>
        <circle
          cx="47"
          cy="20"
          r="3.5"
          fill="#54D769"
          stroke={isDark ? '#141715' : '#FFFFFF'}
          strokeWidth="1.5"
          filter="url(#ael-glow)"
        />
        <circle cx="47" cy="20" r="1.4" fill="#FFFFFF" />
      </g>

      {/* Escudo/Base geométrica central (representa estabilidade da organização) */}
      <path
        d="M 32 15 L 43 21 V 34 C 43 41.5 38 46.5 32 49 C 26 46.5 21 41.5 21 34 V 21 Z"
        fill={isDark ? '#111512' : '#FFFFFF'}
        stroke={isDark ? 'rgba(84,215,105,0.45)' : 'rgba(44,168,64,0.35)'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Gráfico ascendente: 3 colunas de evolução do colaborador no período */}
      {/* Coluna 1 - Entrada / Adaptação */}
      <rect
        x="25.5"
        y="32"
        width="3.2"
        height="7.5"
        rx="1.2"
        fill="url(#ael-green-grad)"
        fillOpacity="0.55"
      />
      {/* Coluna 2 - 45 Dias / Desenvolvimento */}
      <rect
        x="30.4"
        y="28"
        width="3.2"
        height="11.5"
        rx="1.2"
        fill="url(#ael-green-grad)"
        fillOpacity="0.85"
      />
      {/* Coluna 3 - 90 Dias / Consolidação */}
      <rect x="35.3" y="23.5" width="3.2" height="16" rx="1.2" fill="url(#ael-green-grad)" />

      {/* Checkmark dinâmico de aprovação/efetivação sobreposto ao escudo */}
      <path
        d="M 26 31 L 31.5 36.5 L 44 24"
        stroke="#FFFFFF"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 26 31 L 31.5 36.5 L 44 24"
        stroke="#54D769"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Componente principal de identidade visual do aplicativo.
 * Totalmente neutro, sem referências a marcas passadas.
 */
export const AppLogo: React.FC<AppLogoProps> = ({
  variant = 'light-bg',
  size = 'md',
  layout = 'full',
  align = 'center',
  withDesempenho = false,
  className = '',
  imgClassName = '',
}) => {
  const isDark = variant === 'dark-bg'

  // Configurações de dimensão baseadas na prop `size`
  const symbolDimensions = {
    sm: 'h-8 w-8',
    md: 'h-11 w-11',
    lg: 'h-14 w-14',
  }[size]

  const titleSizes = {
    sm: 'text-sm font-extrabold tracking-tight',
    md: 'text-lg sm:text-xl font-black tracking-tight',
    lg: 'text-2xl sm:text-3xl font-black tracking-tight',
  }[size]

  const subtitleSizes = {
    sm: 'text-[9px] tracking-[0.22em]',
    md: 'text-[10px] sm:text-[11px] tracking-[0.26em]',
    lg: 'text-xs sm:text-sm tracking-[0.3em]',
  }[size]

  const badgeSizes = {
    sm: 'text-[8px] px-1.5 py-0.2',
    md: 'text-[9px] px-2 py-0.5',
    lg: 'text-[10px] px-2.5 py-0.5',
  }[size]

  // Se apenas o símbolo foi solicitado
  if (layout === 'symbol-only') {
    return (
      <div
        className={`inline-flex items-center justify-center select-none ${className}`}
        role="banner"
      >
        <AppLogoSymbol className={`${symbolDimensions} ${imgClassName}`} isDark={isDark} />
      </div>
    )
  }

  // Layout compacto horizontal (símbolo à esquerda + textos à direita)
  if (layout === 'compact') {
    return (
      <div
        className={`inline-flex items-center gap-2.5 sm:gap-3 select-none text-left ${className}`}
        role="banner"
      >
        <div className="shrink-0 transition-transform hover:scale-105">
          <AppLogoSymbol className={`${symbolDimensions} ${imgClassName}`} isDark={isDark} />
        </div>
        <div className="flex flex-col justify-center">
          <span
            className={`${titleSizes} leading-none tracking-tight font-black ${
              isDark ? 'text-white' : 'text-slate-900 dark:text-white'
            }`}
          >
            AVALIAÇÃO
          </span>
          <span
            className={`${subtitleSizes} font-bold uppercase text-[#2CA840] dark:text-[#54D769] leading-tight mt-1 flex flex-wrap items-center gap-x-1`}
          >
            <span>DE EXPERIÊNCIA</span>
            {withDesempenho && (
              <span className="font-extrabold text-emerald-800 dark:text-emerald-300 tracking-wider">
                &amp; DESEMPENHO
              </span>
            )}
          </span>
        </div>
      </div>
    )
  }

  // Layout completo (padrão)
  const isCentered = align === 'center'

  return (
    <div
      className={`inline-flex ${
        isCentered ? 'flex-col items-center text-center' : 'items-center gap-3.5 text-left'
      } select-none ${className}`}
      role="banner"
    >
      {/* Símbolo com badge flutuante/integrado */}
      <div className={`relative ${isCentered ? 'mb-2.5' : 'shrink-0'} group`}>
        <div className="transition-transform duration-200 group-hover:scale-105">
          <AppLogoSymbol className={`${symbolDimensions} ${imgClassName}`} isDark={isDark} />
        </div>
      </div>

      {/* Bloco tipográfico */}
      <div className={`flex flex-col ${isCentered ? 'items-center' : 'items-start'}`}>
        <div className="flex items-center gap-1.5">
          <span
            className={`${titleSizes} leading-none ${isDark ? 'text-white' : 'text-slate-900 dark:text-white'}`}
          >
            AVALIAÇÃO
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span
            className={`${subtitleSizes} font-bold uppercase text-[#2CA840] dark:text-[#54D769] leading-tight flex items-center gap-1`}
          >
            <span>DE EXPERIÊNCIA</span>
            {withDesempenho && (
              <span className="font-extrabold text-emerald-800 dark:text-emerald-300 tracking-wider">
                &amp; DESEMPENHO
              </span>
            )}
          </span>
          <span
            className={`${badgeSizes} font-semibold uppercase rounded-full ${
              isDark
                ? 'bg-white/10 text-gray-300 border border-white/10'
                : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-gray-300 border border-black/10 dark:border-white/10'
            } leading-none`}
            title="Ciclos de 45 e 90 dias"
          >
            45 • 90 dias
          </span>
        </div>
      </div>
    </div>
  )
}

export default AppLogo
