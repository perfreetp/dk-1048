import React, { useState, useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { SSHConnection, Settings } from '../types'
import 'xterm/css/xterm.css'
import './TerminalSessions.css'

interface TerminalInstance {
  id: string
  name: string
  connectionId: string
  terminal: Terminal | null
  fitAddon: FitAddon | null
  connection: SSHConnection
}

interface SplitPane {
  id: string
  direction: 'horizontal' | 'vertical'
  children: SplitPaneItem[]
}

interface SplitPaneItem {
  id: string
  sessionId?: string
  children?: SplitPane[]
}

const TerminalSessions: React.FC = () => {
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [terminalInstances, setTerminalInstances] = useState<TerminalInstance[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [showQuickCommands, setShowQuickCommands] = useState(false)
  const [highlightKeywords, setHighlightKeywords] = useState<string[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [splitPanes, setSplitPanes] = useState<SplitPane[]>([])
  const [activePaneId, setActivePaneId] = useState<string | null>(null)
  const terminalRefs = useRef<{ [key: string]: HTMLDivElement }>({})

  const quickCommands = [
    { name: '查看系统信息', command: 'uname -a && cat /etc/os-release' },
    { name: '查看磁盘使用', command: 'df -h' },
    { name: '查看内存使用', command: 'free -m' },
    { name: '查看进程', command: 'ps aux | head -20' },
    { name: '网络状态', command: 'netstat -tuln' },
    { name: '查看日志', command: 'tail -50 /var/log/syslog' }
  ]

  useEffect(() => {
    loadConnections()
    loadSettings()
    setupShellListeners()

    return () => {
      terminalInstances.forEach(instance => {
        if (instance.terminal) {
          instance.terminal.dispose()
        }
      })
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      terminalInstances.forEach(instance => {
        if (instance.terminal && instance.fitAddon) {
          instance.fitAddon.fit()
          window.electronAPI.sshResize(
            instance.connectionId,
            instance.terminal.cols,
            instance.terminal.rows
          )
        }
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [terminalInstances])

  const setupShellListeners = () => {
    window.electronAPI.onShellData(({ id, data }) => {
      const instance = terminalInstances.find(inst => inst.connectionId === id)
      if (instance?.terminal) {
        instance.terminal.write(data)
      }
    })

    window.electronAPI.onShellClose(({ id }) => {
      const instance = terminalInstances.find(inst => inst.connectionId === id)
      if (instance?.terminal) {
        instance.terminal.write('\r\n\x1b[33m[Connection closed]\x1b[0m\r\n')
      }
    })
  }

  const loadConnections = async () => {
    try {
      const data = await window.electronAPI.getConnections()
      setConnections(data.connections || [])
    } catch (error) {
      console.error('Failed to load connections:', error)
    }
  }

  const loadSettings = async () => {
    try {
      const data = await window.electronAPI.getSettings()
      setSettings(data)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const createTerminalInstance = async (connection: SSHConnection): Promise<string> => {
    const instanceId = `terminal-${Date.now()}`
    
    try {
      const result = await window.electronAPI.sshConnect({
        id: connection.id,
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password,
        privateKey: connection.privateKey,
        passphrase: connection.passphrase
      })

      if (!result.success) {
        throw new Error(result.message)
      }

      await window.electronAPI.sshStartShell(connection.id)

      const newInstance: TerminalInstance = {
        id: instanceId,
        name: connection.name,
        connectionId: connection.id,
        terminal: null,
        fitAddon: null,
        connection
      }

      setTerminalInstances(prev => [...prev, newInstance])
      setActiveSessionId(instanceId)

      setTimeout(() => {
        initTerminal(instanceId)
      }, 100)

      return instanceId
    } catch (error: any) {
      throw new Error(`连接失败: ${error.message}`)
    }
  }

  const initTerminal = (instanceId: string) => {
    const instance = terminalInstances.find(i => i.id === instanceId)
    if (!instance) return

    const terminal = new Terminal({
      fontFamily: settings?.fontFamily || 'Consolas, monospace',
      fontSize: settings?.fontSize || 14,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selection: 'rgba(255, 255, 255, 0.3)'
      },
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000
    })

    const fitAddon = new FitAddon()
    const linksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(linksAddon)

    const container = terminalRefs.current[instanceId]
    if (container) {
      terminal.open(container)
      fitAddon.fit()

      setTimeout(() => {
        window.electronAPI.sshResize(
          instance.connectionId,
          terminal.cols,
          terminal.rows
        )
      }, 100)

      terminal.onData((data) => {
        window.electronAPI.sshWrite(instance.connectionId, data)
      })

      terminal.onResize(({ cols, rows }) => {
        window.electronAPI.sshResize(instance.connectionId, cols, rows)
      })
    }

    const updatedInstances = terminalInstances.map(i =>
      i.id === instanceId ? { ...i, terminal, fitAddon } : i
    )
    setTerminalInstances(updatedInstances)
  }

  const handleQuickCommand = async (command: string) => {
    if (!activeSessionId) return

    const instance = terminalInstances.find(i => i.id === activeSessionId)
    if (!instance?.terminal) return

    const fullCommand = command + '\r'
    await window.electronAPI.sshWrite(instance.connectionId, fullCommand)
  }

  const closeTerminal = async (instanceId: string) => {
    const instance = terminalInstances.find(i => i.id === instanceId)
    if (!instance) return

    if (instance.terminal) {
      instance.terminal.dispose()
    }

    await window.electronAPI.sshDisconnect(instance.connectionId)

    const updatedInstances = terminalInstances.filter(i => i.id !== instanceId)
    setTerminalInstances(updatedInstances)

    if (activeSessionId === instanceId && updatedInstances.length > 0) {
      setActiveSessionId(updatedInstances[updatedInstances.length - 1].id)
    } else if (updatedInstances.length === 0) {
      setActiveSessionId(null)
    }
  }

  const handleRename = (instanceId: string) => {
    const instance = terminalInstances.find(i => i.id === instanceId)
    if (instance) {
      setEditingSessionId(instanceId)
      setEditName(instance.name)
    }
  }

  const saveRename = () => {
    if (editingSessionId) {
      const updatedInstances = terminalInstances.map(i =>
        i.id === editingSessionId ? { ...i, name: editName } : i
      )
      setTerminalInstances(updatedInstances)
      setEditingSessionId(null)
      setEditName('')
    }
  }

  const splitTerminal = (direction: 'horizontal' | 'vertical') => {
    if (!activeSessionId) return

    const newPane: SplitPane = {
      id: `pane-${Date.now()}`,
      direction,
      children: [
        { id: `pane-item-${Date.now()}-1`, sessionId: activeSessionId },
        { id: `pane-item-${Date.now()}-2` }
      ]
    }

    setSplitPanes(prev => [...prev, newPane])
    setActivePaneId(newPane.children[1].id)
  }

  const assignSessionToPane = (paneItemId: string, sessionId: string) => {
    setSplitPanes(prev => {
      const updatePane = (panes: SplitPane[]): SplitPane[] => {
        return panes.map(pane => ({
          ...pane,
          children: pane.children.map(child => {
            if (child.id === paneItemId) {
              return { ...child, sessionId }
            }
            if (child.children) {
              return { ...child, children: updatePane(child.children) }
            }
            return child
          })
        }))
      }
      return updatePane(prev)
    })
  }

  const removePane = (paneId: string) => {
    setSplitPanes(prev => {
      const removeFromPane = (panes: SplitPane[]): SplitPane[] => {
        return panes
          .filter(pane => pane.id !== paneId)
          .map(pane => ({
            ...pane,
            children: pane.children
              .filter(child => child.id !== paneId)
              .map(child => {
                if (child.children) {
                  return { ...child, children: removeFromPane(child.children) }
                }
                return child
              })
          }))
      }
      return removeFromPane(prev)
    })
  }

  return (
    <div className="terminal-sessions">
      <div className="sessions-sidebar">
        <div className="sidebar-header">
          <h3>连接列表</h3>
        </div>
        <div className="connections-list">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="connection-item"
              onClick={() => createTerminalInstance(conn).catch(err => alert(err.message))}
            >
              <div className="connection-icon">💻</div>
              <div className="connection-info">
                <div className="connection-name">{conn.name}</div>
                <div className="connection-host">
                  {conn.username}@{conn.host}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sessions-main">
        <div className="sessions-tabs">
          {terminalInstances.map((instance) => (
            <div
              key={instance.id}
              className={`session-tab ${activeSessionId === instance.id ? 'active' : ''}`}
              onClick={() => setActiveSessionId(instance.id)}
            >
              {editingSessionId === instance.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={saveRename}
                  onKeyPress={(e) => e.key === 'Enter' && saveRename()}
                  autoFocus
                  className="tab-name-input"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="tab-name"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    handleRename(instance.id)
                  }}
                >
                  {instance.name}
                </span>
              )}
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTerminal(instance.id)
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="terminal-toolbar">
          <div className="toolbar-left">
            <button
              className="toolbar-btn"
              onClick={() => setShowQuickCommands(!showQuickCommands)}
              title="快速命令"
            >
              ⚡ 快速命令
            </button>
            <button
              className="toolbar-btn"
              onClick={() => splitTerminal('horizontal')}
              disabled={!activeSessionId}
              title="左右分屏"
            >
              ⬌
            </button>
            <button
              className="toolbar-btn"
              onClick={() => splitTerminal('vertical')}
              disabled={!activeSessionId}
              title="上下分屏"
            >
              ⬍
            </button>
          </div>
          <div className="toolbar-right">
            <input
              type="text"
              placeholder="高亮关键字（逗号分隔）"
              value={highlightKeywords.join(', ')}
              onChange={(e) =>
                setHighlightKeywords(
                  e.target.value.split(',').map((k) => k.trim()).filter(Boolean)
                )
              }
              className="highlight-input"
            />
          </div>
        </div>

        {showQuickCommands && (
          <div className="quick-commands-panel">
            {quickCommands.map((cmd, idx) => (
              <button
                key={idx}
                className="quick-command-btn"
                onClick={() => {
                  handleQuickCommand(cmd.command)
                  setShowQuickCommands(false)
                }}
              >
                <div className="cmd-name">{cmd.name}</div>
                <div className="cmd-text">{cmd.command}</div>
              </button>
            ))}
          </div>
        )}

        <div className="terminals-container">
          {terminalInstances.length === 0 ? (
            <div className="empty-terminals">
              <div className="empty-icon">💻</div>
              <h3>暂无活动会话</h3>
              <p>从左侧选择一个连接来开始会话</p>
            </div>
          ) : splitPanes.length === 0 ? (
            terminalInstances.map((instance) => (
              <div
                key={instance.id}
                ref={(el) => {
                  if (el) terminalRefs.current[instance.id] = el
                }}
                className={`terminal-wrapper ${activeSessionId === instance.id ? 'active' : ''}`}
                style={{
                  display: activeSessionId === instance.id ? 'flex' : 'none'
                }}
              />
            ))
          ) : (
            <div className="split-container">
              {splitPanes.map((pane) => (
                <div
                  key={pane.id}
                  className={`split-pane ${pane.direction}`}
                >
                  {pane.children.map((child) => (
                    <div key={child.id} className="split-pane-item">
                      {child.sessionId ? (
                        <div
                          ref={(el) => {
                            if (el) terminalRefs.current[child.sessionId!] = el
                          }}
                          className="terminal-wrapper active"
                        />
                      ) : (
                        <div className="empty-pane">
                          <p>选择一个会话来填充此区域</p>
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                assignSessionToPane(child.id, e.target.value)
                              }
                            }}
                            value=""
                          >
                            <option value="">选择会话</option>
                            {terminalInstances.map((inst) => (
                              <option key={inst.id} value={inst.id}>
                                {inst.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <button
                        className="pane-close-btn"
                        onClick={() => removePane(child.id)}
                        title="关闭此面板"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TerminalSessions
