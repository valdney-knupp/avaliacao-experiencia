/* Main entry point for the application - renders the root React component */

// DOM SafeGuard: Protege o commit/unmount do React contra manipulações externas do DOM
// (extensões de tradução do navegador como Google Tradutor que fragmentam nós de texto em <font>).
if (typeof window !== 'undefined' && typeof Node !== 'undefined') {
  const originalRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child && child.parentNode && child.parentNode !== this) {
      // O nó foi reparentado por extensão/tradutor. Delegar para o parentNode real
      return originalRemoveChild.call(child.parentNode, child) as T
    }
    try {
      return originalRemoveChild.call(this, child) as T
    } catch (err) {
      // Se ainda assim o nó não for filho ou já foi desmontado, evitar quebrar o unmount do React
      if (child && child.parentNode) {
        try {
          return originalRemoveChild.call(child.parentNode, child) as T
        } catch {
          // silencioso
        }
      }
      return child
    }
  }

  const originalInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode && referenceNode.parentNode !== this) {
      // O nó de referência foi reparentado pelo tradutor/extensão
      if (newNode.parentNode === this) {
        return originalInsertBefore.call(this, newNode, null) as T
      }
      return originalInsertBefore.call(referenceNode.parentNode, newNode, referenceNode) as T
    }
    try {
      return originalInsertBefore.call(this, newNode, referenceNode) as T
    } catch {
      // Se o insertBefore falhar por desalinhamento externo do DOM, tentar append simples no container
      try {
        return originalInsertBefore.call(this, newNode, null) as T
      } catch {
        return newNode
      }
    }
  }
}

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'

// Tratamento global para falhas de carregamento de chunks dinâmicos (deploy / atualização de versão)
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const errorMsg = event.reason?.message || String(event.reason || '')
    const isChunkFailure =
      errorMsg.includes('dynamically imported module') ||
      errorMsg.includes('Failed to fetch dynamically imported module') ||
      errorMsg.includes('Loading chunk')

    if (isChunkFailure) {
      console.warn('Detectada falha ao carregar módulo dinâmico da aplicação:', errorMsg)
      // Se ainda não tentou recarregar na sessão atual, recarrega suavemente
      const reloadKey = 'skip_chunk_reload_attempted'
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, 'true')
        window.location.reload()
      }
    }
  })
}

// @skip-protected: Do not remove. Required for React rendering.
createRoot(document.getElementById('root')!).render(<App />)
