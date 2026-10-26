import React from 'react'
import logoSrc from '@/assets/marca-original-2018-851de.png'

interface RPontesLogoProps {
  /**
   * 'dark-bg': inverte a cor para branco/claro mantendo fidelidade para fundos escuros (#111111, sidebar, etc.)
   * 'light-bg': mantém o tom original escuro para fundos claros (fundo branco, cartões claros)
   * 'card-contrast': logotipo original sobre cartão de contraste branco com cantos arredondados
   */
  variant?: 'dark-bg' | 'light-bg' | 'card-contrast'
  className?: string
  imgClassName?: string
  alt?: string
}

export const RPontesLogo: React.FC<RPontesLogoProps> = ({
  variant = 'light-bg',
  className = '',
  imgClassName = 'h-12 w-auto object-contain',
  alt = 'Construtora R. Pontes',
}) => {
  if (variant === 'card-contrast') {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl bg-white p-2.5 shadow-xs ${className}`}
      >
        <img src={logoSrc} alt={alt} className={`${imgClassName} block`} loading="eager" />
      </div>
    )
  }

  const filterClass = variant === 'dark-bg' ? 'brightness-0 invert' : ''

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <img
        src={logoSrc}
        alt={alt}
        className={`${imgClassName} ${filterClass} block transition-all`}
        loading="eager"
      />
    </div>
  )
}

export default RPontesLogo
