import React from 'react'
import { AppLogo, AppLogoProps } from './AppLogo'

export interface RPontesLogoProps extends AppLogoProps {}

/**
 * Componente legado mantido para retrocompatibilidade com telas ou testes existentes.
 * Renderiza o novo AppLogo neutro oficial do sistema.
 */
export const RPontesLogo: React.FC<RPontesLogoProps> = (props) => {
  return <AppLogo {...props} />
}

export default RPontesLogo
