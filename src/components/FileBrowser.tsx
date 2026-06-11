import React, { useState, useEffect } from 'react'
import { SSHConnection, FileItem } from '../types'
import './FileBrowser.css'

const FileBrowser: React.FC = () => {
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<SSHConnection | null>(null)
  const [remotePath, setRemotePath] = useState('/')
  const [localPath, setLocalPath] = useState('')
  const [remoteFiles, setRemoteFiles] = useState<FileItem[]>([])
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<string | null>(null)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ oldPath: string; name: string } | null>(null)

  useEffect(() => {
    loadConnections()
    initLocalPath()
  }, [])

  useEffect(() => {
    if (selectedConnection) {
      loadRemoteFiles()
    }
  }, [selectedConnection, remotePath])

  const loadConnections = async () => {
    try {
      const data = await window.electronAPI.getConnections()
      setConnections(data.connections || [])
    } catch (error) {
      console.error('Failed to load connections:', error)
    }
  }

  const initLocalPath = async () => {
    try {
      const home = await window.electronAPI.getHomeDirectory()
      setLocalPath(home)
    } catch (error) {
      console.error('Failed to get home directory:', error)
    }
  }

  const loadRemoteFiles = async () => {
    if (!selectedConnection) return

    setIsLoading(true)
    try {
      const result = await window.electronAPI.sshSftpList(selectedConnection.id, remotePath)
      if (result.success && result.files) {
        setRemoteFiles(
          result.files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1
            if (!a.isDirectory && b.isDirectory) return 1
            return a.name.localeCompare(b.name)
          })
        )
      } else {
        alert(`加载文件失败: ${result.message}`)
      }
    } catch (error) {
      alert('加载文件失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = async (connection: SSHConnection) => {
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

      if (result.success) {
        setSelectedConnection(connection)
        setRemotePath('/')
      } else {
        alert(`连接失败: ${result.message}`)
      }
    } catch (error) {
      alert('连接失败，请检查配置和网络')
    }
  }

  const handleDisconnect = async () => {
    if (selectedConnection) {
      await window.electronAPI.sshDisconnect(selectedConnection.id)
      setSelectedConnection(null)
      setRemoteFiles([])
      setRemotePath('/')
    }
  }

  const handleFileClick = (file: FileItem) => {
    if (file.isDirectory) {
      const newPath = remotePath === '/' ? `/${file.name}` : `${remotePath}/${file.name}`
      setRemotePath(newPath)
      setSelectedFiles([])
    } else {
      if (selectedFiles.includes(file.name)) {
        setSelectedFiles(selectedFiles.filter((f) => f !== file.name))
      } else {
        setSelectedFiles([...selectedFiles, file.name])
      }
    }
  }

  const handlePreview = async (file: FileItem) => {
    if (file.isDirectory) return

    const filePath = remotePath === '/' ? `/${file.name}` : `${remotePath}/${file.name}`
    
    try {
      const result = await window.electronAPI.sshSftpReadFile(selectedConnection!.id, filePath)
      if (result.success) {
        setPreviewContent(result.content || '')
        setPreviewFile(file.name)
      } else {
        alert(`预览失败: ${result.message}`)
      }
    } catch (error) {
      alert('预览失败')
    }
  }

  const handleCreateFolder = async () => {
    if (!selectedConnection || !newFolderName.trim()) return

    const folderPath = remotePath === '/' ? `/${newFolderName}` : `${remotePath}/${newFolderName}`

    try {
      const result = await window.electronAPI.sshSftpMkdir(selectedConnection.id, folderPath)
      if (result.success) {
        await loadRemoteFiles()
        setShowNewFolderModal(false)
        setNewFolderName('')
      } else {
        alert(`创建目录失败: ${result.message}`)
      }
    } catch (error) {
      alert('创建目录失败')
    }
  }

  const handleRename = async () => {
    if (!selectedConnection || !renameTarget) return

    const oldPath = renameTarget.oldPath
    const newPath = remotePath === '/' ? `/${renameTarget.name}` : `${remotePath}/${renameTarget.name}`

    try {
      const result = await window.electronAPI.sshSftpRename(selectedConnection.id, oldPath, newPath)
      if (result.success) {
        await loadRemoteFiles()
        setShowRenameModal(false)
        setRenameTarget(null)
      } else {
        alert(`重命名失败: ${result.message}`)
      }
    } catch (error) {
      alert('重命名失败')
    }
  }

  const handleDelete = async (file: FileItem) => {
    const filePath = remotePath === '/' ? `/${file.name}` : `${remotePath}/${file.name}`
    
    if (!confirm(`确定要删除 ${file.name} 吗？`)) return

    try {
      let result
      if (file.isDirectory) {
        result = await window.electronAPI.sshSftpRmdir(selectedConnection!.id, filePath)
      } else {
        result = await window.electronAPI.sshSftpDelete(selectedConnection!.id, filePath)
      }

      if (result.success) {
        await loadRemoteFiles()
      } else {
        alert(`删除失败: ${result.message}`)
      }
    } catch (error) {
      alert('删除失败')
    }
  }

  const navigateUp = () => {
    if (remotePath === '/') return
    const parts = remotePath.split('/').filter(Boolean)
    parts.pop()
    setRemotePath(parts.length === 0 ? '/' : '/' + parts.join('/'))
  }

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  return (
    <div className="file-browser">
      <div className="browser-header">
        <h2>文件浏览</h2>
        {!selectedConnection ? (
          <div className="connection-selector">
            <select
              onChange={(e) => {
                const conn = connections.find((c) => c.id === e.target.value)
                if (conn) handleConnect(conn)
              }}
              value=""
            >
              <option value="">选择连接</option>
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="connection-info">
            <span>已连接: {selectedConnection.name}</span>
            <button className="btn-disconnect" onClick={handleDisconnect}>
              断开连接
            </button>
          </div>
        )}
      </div>

      {selectedConnection && (
        <>
          <div className="browser-toolbar">
            <div className="toolbar-section">
              <button onClick={navigateUp} disabled={remotePath === '/'}>
                ⬆️ 返回上级
              </button>
              <button onClick={() => loadRemoteFiles()}>🔄 刷新</button>
              <button onClick={() => setShowNewFolderModal(true)}>📁 新建目录</button>
            </div>
            <div className="current-path">
              <span>当前路径:</span>
              <input
                type="text"
                value={remotePath}
                onChange={(e) => setRemotePath(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && loadRemoteFiles()}
              />
            </div>
          </div>

          <div className="files-container">
            <div className="files-header">
              <div className="col-name">文件名</div>
              <div className="col-size">大小</div>
              <div className="col-date">修改时间</div>
              <div className="col-actions">操作</div>
            </div>

            <div className="files-list">
              {isLoading ? (
                <div className="loading">加载中...</div>
              ) : (
                remoteFiles.map((file) => (
                  <div
                    key={file.name}
                    className={`file-item ${file.isDirectory ? 'directory' : ''} ${
                      selectedFiles.includes(file.name) ? 'selected' : ''
                    }`}
                    onClick={() => handleFileClick(file)}
                    onDoubleClick={() => handlePreview(file)}
                  >
                    <div className="col-name">
                      <span className="file-icon">
                        {file.isDirectory ? '📁' : '📄'}
                      </span>
                      <span className="file-name">{file.name}</span>
                    </div>
                    <div className="col-size">
                      {file.isDirectory ? '-' : formatSize(file.size)}
                    </div>
                    <div className="col-date">{formatDate(file.mtime)}</div>
                    <div className="col-actions">
                      <button
                        className="action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenameTarget({
                            oldPath: remotePath === '/' ? `/${file.name}` : `${remotePath}/${file.name}`,
                            name: file.name
                          })
                          setShowRenameModal(true)
                        }}
                        title="重命名"
                      >
                        ✏️
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(file)
                        }}
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {!selectedConnection && (
        <div className="empty-state">
          <div className="empty-icon">📂</div>
          <h3>未连接</h3>
          <p>请从上方选择一个SSH连接以浏览远程文件</p>
        </div>
      )}

      {previewContent !== null && (
        <div className="preview-modal" onClick={() => setPreviewContent(null)}>
          <div className="preview-content" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <h3>预览: {previewFile}</h3>
              <button onClick={() => setPreviewContent(null)}>×</button>
            </div>
            <pre className="preview-text">{previewContent}</pre>
          </div>
        </div>
      )}

      {showNewFolderModal && (
        <div className="modal-overlay" onClick={() => setShowNewFolderModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>新建目录</h3>
            <input
              type="text"
              placeholder="目录名称"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowNewFolderModal(false)}
              >
                取消
              </button>
              <button onClick={handleCreateFolder}>创建</button>
            </div>
          </div>
        </div>
      )}

      {showRenameModal && renameTarget && (
        <div className="modal-overlay" onClick={() => setShowRenameModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>重命名</h3>
            <input
              type="text"
              value={renameTarget.name}
              onChange={(e) =>
                setRenameTarget({ ...renameTarget, name: e.target.value })
              }
              autoFocus
            />
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowRenameModal(false)}
              >
                取消
              </button>
              <button onClick={handleRename}>确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FileBrowser
