import React, { useState, useEffect } from 'react'
import { Settings } from '../types'
import './SettingsPanel.css'

const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    fontSize: 14,
    fontFamily: 'Consolas, monospace',
    theme: 'dark',
    timeout: 30,
    proxyEnabled: false,
    proxyHost: '',
    proxyPort: 1080,
    proxyType: 'socks5'
  })
  const [saved, setSaved] = useState(false)
  const [diagnosticResults, setDiagnosticResults] = useState<string[]>([])

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await window.electronAPI.getSettings()
      setSettings(data)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const saveSettings = async () => {
    try {
      await window.electronAPI.saveSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('保存失败')
    }
  }

  const runDiagnostics = async () => {
    setDiagnosticResults([])
    const results: string[] = []

    results.push('🔍 开始诊断...\n')

    results.push('1. 检查网络连接...')
    try {
      const response = await fetch('https://www.google.com', {
        method: 'HEAD',
        mode: 'no-cors'
      })
      results.push('✅ 网络连接正常')
    } catch (error) {
      results.push('❌ 网络连接失败')
    }

    results.push('\n2. 检查SSH配置...')
    if (settings.timeout < 5) {
      results.push('⚠️ 超时时间过短，建议设置为30秒以上')
    } else {
      results.push('✅ 超时配置合理')
    }

    results.push('\n3. 检查代理设置...')
    if (settings.proxyEnabled) {
      if (!settings.proxyHost) {
        results.push('❌ 代理已启用但未配置代理地址')
      } else if (settings.proxyPort <= 0 || settings.proxyPort > 65535) {
        results.push('❌ 代理端口无效')
      } else {
        results.push(`✅ 代理配置: ${settings.proxyType}://${settings.proxyHost}:${settings.proxyPort}`)
      }
    } else {
      results.push('ℹ️ 代理未启用')
    }

    results.push('\n4. 检查终端配置...')
    if (settings.fontSize < 10) {
      results.push('⚠️ 字体过小，可能影响阅读')
    } else {
      results.push(`✅ 字体大小: ${settings.fontSize}px`)
    }

    results.push(`✅ 字体: ${settings.fontFamily}`)

    results.push('\n✨ 诊断完成')
    setDiagnosticResults(results)
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>偏好设置</h2>
        <button onClick={saveSettings}>保存设置</button>
      </div>

      {saved && <div className="save-notification">✅ 设置已保存</div>}

      <div className="settings-content">
        <div className="settings-section">
          <h3>终端设置</h3>
          <div className="setting-item">
            <label>字体大小</label>
            <input
              type="number"
              min="10"
              max="24"
              value={settings.fontSize}
              onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
            />
            <span>px</span>
          </div>

          <div className="setting-item">
            <label>字体</label>
            <select
              value={settings.fontFamily}
              onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
            >
              <option value="Consolas, monospace">Consolas</option>
              <option value="'Courier New', monospace">Courier New</option>
              <option value="Monaco, Menlo, monospace">Monaco</option>
              <option value="'Source Code Pro', monospace">Source Code Pro</option>
            </select>
          </div>

          <div className="setting-item">
            <label>主题</label>
            <select
              value={settings.theme}
              onChange={(e) => setSettings({ ...settings, theme: e.target.value as 'dark' | 'light' })}
            >
              <option value="dark">深色</option>
              <option value="light">浅色</option>
            </select>
          </div>

          <div className="setting-item">
            <label>连接超时</label>
            <input
              type="number"
              min="5"
              max="300"
              value={settings.timeout}
              onChange={(e) => setSettings({ ...settings, timeout: parseInt(e.target.value) })}
            />
            <span>秒</span>
          </div>
        </div>

        <div className="settings-section">
          <h3>代理设置</h3>
          <div className="setting-item checkbox">
            <input
              type="checkbox"
              id="proxyEnabled"
              checked={settings.proxyEnabled}
              onChange={(e) => setSettings({ ...settings, proxyEnabled: e.target.checked })}
            />
            <label htmlFor="proxyEnabled">启用代理</label>
          </div>

          {settings.proxyEnabled && (
            <>
              <div className="setting-item">
                <label>代理类型</label>
                <select
                  value={settings.proxyType}
                  onChange={(e) => setSettings({ ...settings, proxyType: e.target.value as 'socks5' | 'http' })}
                >
                  <option value="socks5">SOCKS5</option>
                  <option value="http">HTTP</option>
                </select>
              </div>

              <div className="setting-item">
                <label>代理地址</label>
                <input
                  type="text"
                  placeholder="127.0.0.1"
                  value={settings.proxyHost}
                  onChange={(e) => setSettings({ ...settings, proxyHost: e.target.value })}
                />
              </div>

              <div className="setting-item">
                <label>代理端口</label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={settings.proxyPort}
                  onChange={(e) => setSettings({ ...settings, proxyPort: parseInt(e.target.value) })}
                />
              </div>
            </>
          )}
        </div>

        <div className="settings-section">
          <h3>密钥管理</h3>
          <p className="section-description">
            管理您的SSH私钥文件，支持PEM、OpenSSH格式
          </p>
          <div className="key-management">
            <button
              className="btn-secondary"
              onClick={async () => {
                const result = await window.electronAPI.selectPrivateKey()
                if (result) {
                  alert(`已选择密钥: ${result.path}`)
                }
              }}
            >
              添加私钥
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h3>连接诊断</h3>
          <p className="section-description">
            运行诊断以检查连接配置和网络状态
          </p>
          <button onClick={runDiagnostics} className="btn-diagnostic">
            🔍 运行诊断
          </button>

          {diagnosticResults.length > 0 && (
            <div className="diagnostic-results">
              <h4>诊断结果:</h4>
              <pre>{diagnosticResults.join('\n')}</pre>
            </div>
          )}
        </div>

        <div className="settings-section">
          <h3>快捷命令</h3>
          <p className="section-description">
            常用快捷命令帮助
          </p>
          <div className="shortcuts-list">
            <div className="shortcut-item">
              <kbd>Ctrl + C</kbd>
              <span>复制选中内容</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl + V</kbd>
              <span>粘贴到终端</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl + L</kbd>
              <span>清屏</span>
            </div>
            <div className="shortcut-item">
              <kbd>Tab</kbd>
              <span>自动补全命令</span>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>关于</h3>
          <div className="about-info">
            <p><strong>SSH Manager</strong></p>
            <p>版本: 1.0.0</p>
            <p className="about-description">
              专业的SSH连接管理工具，专为开发和运维人员设计
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
