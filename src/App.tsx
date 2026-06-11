import React, { useState } from 'react'
import ConnectionLibrary from './components/ConnectionLibrary'
import TerminalSessions from './components/TerminalSessions'
import FileBrowser from './components/FileBrowser'
import CommandSnippets from './components/CommandSnippets'
import SettingsPanel from './components/SettingsPanel'
import { AppProvider } from './context/AppContext'
import './App.css'

type TabType = 'connections' | 'terminal' | 'files' | 'snippets' | 'settings'

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('connections')

  const tabs = [
    { id: 'connections' as const, label: '连接库', icon: '🔗' },
    { id: 'terminal' as const, label: '终端会话', icon: '💻' },
    { id: 'files' as const, label: '文件浏览', icon: '📁' },
    { id: 'snippets' as const, label: '命令片段', icon: '📝' },
    { id: 'settings' as const, label: '偏好设置', icon: '⚙️' }
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'connections':
        return <ConnectionLibrary onSwitchToTerminal={() => setActiveTab('terminal')} />
      case 'terminal':
        return <TerminalSessions />
      case 'files':
        return <FileBrowser />
      case 'snippets':
        return <CommandSnippets />
      case 'settings':
        return <SettingsPanel />
      default:
        return <ConnectionLibrary onSwitchToTerminal={() => setActiveTab('terminal')} />
    }
  }

  return (
    <AppProvider>
      <div className="app-container">
        <div className="sidebar">
          <div className="sidebar-header">
            <h1>SSH Manager</h1>
          </div>
          <nav className="sidebar-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="nav-icon">{tab.icon}</span>
                <span className="nav-label">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="main-content">
          {renderContent()}
        </div>
      </div>
    </AppProvider>
  )
}

export default App
