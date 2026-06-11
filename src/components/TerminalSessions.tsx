import React, { useState, useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { SSHConnection, Settings } from '../types'
import 'xterm/css/xterm.css'
import './TerminalSessions.css'

interface Session {
  id: string
  name: string
  connectionId: string
  connection: SSHConnection
  terminal: Terminal | null
  fitAddon: FitAddon | null
  isActive: boolean
  shellStream?: any
}

const TerminalSessions: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [showQuickCommands, setShowQuickCommands] = useState(false)
  const [highlightKeywords, setHighlightKeywords] = useState<string[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
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
  }, [])

  useEffect(() => {
    const handleResize = () => {
      sessions.forEach((session) => {
        if (session.terminal && session.fitAddon && session.isActive) {
          session.fitAddon.fit()
        }
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [sessions])

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

  const createSession = async (connection: SSHConnection) => {
    const sessionId = `session-${Date.now()}`
    
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
        alert(`连接失败: ${result.message}`)
        return
      }

      const newSession: Session = {
        id: sessionId,
        name: connection.name,
        connectionId: connection.id,
        connection,
        terminal: null,
        fitAddon: null,
        isActive: sessions.length === 0
      }

      setSessions([...sessions, newSession])
      setActiveSessionId(sessionId)

      setTimeout(() => {
        initTerminal(sessionId)
      }, 100)
    } catch (error) {
      alert('连接失败，请检查配置和网络')
    }
  }

  const initTerminal = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) return

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

    const terminalContainer = terminalRefs.current[sessionId]
    if (terminalContainer) {
      terminal.open(terminalContainer)
      fitAddon.fit()

      terminal.writeln(`\x1b[36mConnecting to ${session.name}...\x1b[0m`)
      terminal.writeln('')

      startShell(sessionId, terminal)
    }

    const updatedSessions = sessions.map((s) =>
      s.id === sessionId ? { ...s, terminal, fitAddon } : s
    )
    setSessions(updatedSessions)
  }

  const startShell = (sessionId: string, terminal: Terminal) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) return

    const conn = session.connection

    fetch(`/api/ssh-shell/${conn.id}`, {
      method: 'POST'
    })
      .then((res) => res.json())
      .catch(() => {
        terminal.writeln('\x1b[31mFailed to start shell session\x1b[0m')
      })
  }

  const handleCommand = (command: string) => {
    const activeSession = sessions.find((s) => s.id === activeSessionId)
    if (!activeSession?.terminal) return

    const terminal = activeSession.terminal
    terminal.writeln(`\x1b[36m${command}\x1b[0m`)

    window.electronAPI
      .sshExec(activeSession.connectionId, command)
      .then((result) => {
        if (result.success) {
          if (result.output) {
            highlightAndWrite(terminal, result.output)
          }
          if (result.errorOutput) {
            terminal.writeln(`\x1b[31m${result.errorOutput}\x1b[0m`)
          }
        } else {
          terminal.writeln(`\x1b[31mError: ${result.message}\x1b[0m`)
        }
        prompt(terminal)
      })
      .catch((error) => {
        terminal.writeln(`\x1b[31mError: ${error.message}\x1b[0m`)
        prompt(terminal)
      })
  }

  const highlightAndWrite = (terminal: Terminal, text: string) => {
    const lines = text.split('\n')
    lines.forEach((line) => {
      let highlighted = line
      highlightKeywords.forEach((keyword) => {
        const regex = new RegExp(`(${keyword})`, 'gi')
        highlighted = highlighted.replace(
          regex,
          '\x1b[33m$1\x1b[0m'
        )
      })
      terminal.writeln(highlighted)
    })
  }

  const prompt = (terminal: Terminal) => {
    terminal.write('\r\n\x1b[32m$\x1b[0m ')
  }

  const closeSession = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) return

    if (session.terminal) {
      session.terminal.dispose()
    }

    await window.electronAPI.sshDisconnect(session.connectionId)

    const updatedSessions = sessions.filter((s) => s.id !== sessionId)
    setSessions(updatedSessions)

    if (activeSessionId === sessionId && updatedSessions.length > 0) {
      setActiveSessionId(updatedSessions[updatedSessions.length - 1].id)
    } else if (updatedSessions.length === 0) {
      setActiveSessionId(null)
    }
  }

  const handleRename = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (session) {
      setEditingSessionId(sessionId)
      setEditName(session.name)
    }
  }

  const saveRename = () => {
    if (editingSessionId) {
      const updatedSessions = sessions.map((s) =>
        s.id === editingSessionId ? { ...s, name: editName } : s
      )
      setSessions(updatedSessions)
      setEditingSessionId(null)
      setEditName('')
    }
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
              onClick={() => createSession(conn)}
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
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-tab ${activeSessionId === session.id ? 'active' : ''}`}
              onClick={() => setActiveSessionId(session.id)}
            >
              {editingSessionId === session.id ? (
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
                    handleRename(session.id)
                  }}
                >
                  {session.name}
                </span>
              )}
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  closeSession(session.id)
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
                  handleCommand(cmd.command)
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
          {sessions.length === 0 ? (
            <div className="empty-terminals">
              <div className="empty-icon">💻</div>
              <h3>暂无活动会话</h3>
              <p>从左侧选择一个连接来开始会话</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                ref={(el) => {
                  if (el) terminalRefs.current[session.id] = el
                }}
                className={`terminal-wrapper ${activeSessionId === session.id ? 'active' : ''}`}
                style={{
                  display: activeSessionId === session.id ? 'flex' : 'none'
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default TerminalSessions
