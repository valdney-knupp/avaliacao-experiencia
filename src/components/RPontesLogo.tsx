import React from 'react'

interface RPontesLogoProps {
  variant?: 'dark-bg' | 'light-bg' | 'card-contrast'
  className?: string
  imgClassName?: string
  alt?: string
}

/**
 * Componente de identidade visual neutra do sistema.
 * Os logotipos de marca foram removidos conforme solicitação,
 * mantendo uma apresentação elegante e limpa do nome do sistema.
 */
export const RPontesLogo: React.FC<RPontesLogoProps> = ({
  variant = 'light-bg',
  className = '',
}) => {
  const isDark = variant === 'dark-bg'

  return (
    <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
      <span
        className={`text-xl sm:text-2xl font-black tracking-tight leading-none ${
          isDark ? 'text-white' : 'text-[#111111]'
        }`}
      >
        AVALIAÇÃO
      </span>
      <span className="text-[10px] sm:text-xs font-bold tracking-[0.25em] uppercase text-[#54D769] leading-tight mt-0.5">
        DE EXPERIÊNCIA
      </span>
    </div>
  )
}

export default RPontesLogo
