import React, { createContext, useContext, useState, ReactNode } from 'react'
import { SSHConnection } from './types'

interface BatchConnectionEvent {
  connections: SSHConnection[]
}

interface AppState {
  batchConnectionEvent: BatchConnectionEvent | null
  triggerTerminalJump: number
}

interface AppContextType {
  state: AppState
  triggerBatchConnection: (connections: SSHConnection[]) => void
  clearBatchConnection: () => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    batchConnectionEvent: null,
    triggerTerminalJump: 0
  })

  const triggerBatchConnection = (connections: SSHConnection[]) => {
    setState(prev => ({
      ...prev,
      batchConnectionEvent: { connections },
      triggerTerminalJump: prev.triggerTerminalJump + 1
    }))
  }

  const clearBatchConnection = () => {
    setState(prev => ({
      ...prev,
      batchConnectionEvent: null
    }))
  }

  return (
    <AppContext.Provider value={{ state, triggerBatchConnection, clearBatchConnection }}>
      {children}
    </AppContext.Provider>
  )
}

export const useAppState = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppState must be used within AppProvider')
  }
  return context
}
