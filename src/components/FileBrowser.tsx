import React, { useState, useEffect, useRef } from 'react'
import { SSHConnection, FileItem, LocalFileItem } from '../types'
import './FileBrowser.css'

const FileBrowser: React.FC = () => {
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<SSHConnection | null>(null)
  const [remotePath, setRemotePath] = useState('/')
  const [localPath, setLocalPath] = useState('')
  const [remoteFiles, setRemoteFiles] = useState<FileItem[]>([])
  const [localFiles, setLocalFiles] = useState<LocalFileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<string | null>(null)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ oldPath: string; name: string } | null>(null)
  const [dragOverRemote, setDragOverRemote] = useState(false)
  const [dragOverLocal, setDragOverLocal] = useState(false)
  const [selectedRemoteFiles, setSelectedRemoteFiles] = useState<string[]>([])
  const [selectedLocalFiles, setSelectedLocalFiles] = useState<string[]>([])

  useEffect(() => {
    loadConnections()
    initLocalPath()
  }, [])

  useEffect(() => {
    if (selectedConnection) {
      loadRemoteFiles()
    }
  }, [selectedConnection, remotePath])

  useEffect(() => {
    if (localPath) {
      loadLocalFiles()
    }
  }, [localPath])

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

  const loadLocalFiles = async () => {
    if (!localPath) return

    try {
      const result = await window.electronAPI.localList(localPath)
      if (result.success && result.files) {
        setLocalFiles(
          result.files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1
            if (!a.isDirectory && b.isDirectory) return 1
            return a.name.localeCompare(b.name)
          })
        )
      }
    } catch (error) {
      console.error('Failed to load local files:', error)
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
      setSelectedRemoteFiles([])
    }
  }

  const handleRemoteFileClick = (file: FileItem) => {
    if (file.isDirectory) {
      const newPath = remotePath === '/' ? `/${file.name}` : `${remotePath}/${file.name}`
      setRemotePath(newPath)
      setSelectedRemoteFiles([])
    } else {
      if (selectedRemoteFiles.includes(file.name)) {
        setSelectedRemoteFiles(selectedRemoteFiles.filter((f) => f !== file.name))
      } else {
        setSelectedRemoteFiles([...selectedRemoteFiles, file.name])
      }
    }
  }

  const handleLocalFileClick = (file: LocalFileItem) => {
    if (file.isDirectory) {
      setLocalPath(file.path)
      setSelectedLocalFiles([])
    } else {
      if (selectedLocalFiles.includes(file.path)) {
        setSelectedLocalFiles(selectedLocalFiles.filter((f) => f !== file.path))
      } else {
        setSelectedLocalFiles([...selectedLocalFiles, file.path])
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

  const navigateRemoteUp = () => {
    if (remotePath === '/') return
    const parts = remotePath.split('/').filter(Boolean)
    parts.pop()
    setRemotePath(parts.length === 0 ? '/' : '/' + parts.join('/'))
  }

  const navigateLocalUp = () => {
    const parts = localPath.split(/[/\\]/).filter(Boolean)
    if (parts.length <= 1) return
    parts.pop()
    const newPath = parts.join('/')
    setLocalPath(newPath.startsWith('/') ? newPath : '/' + newPath)
  }

  const handleSelectLocalDirectory = async () => {
    const result = await window.electronAPI.selectDirectory()
    if (result) {
      setLocalPath(result)
    }
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

  const handleDragOver = (e: React.DragEvent, side: 'local' | 'remote') => {
    e.preventDefault()
    if (side === 'local') {
      setDragOverLocal(true)
    } else {
      setDragOverRemote(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent, side: 'local' | 'remote') => {
    e.preventDefault()
    if (side === 'local') {
      setDragOverLocal(false)
    } else {
      setDragOverRemote(false)
    }
  }

  const handleRemoteFileDragStart = (e: React.DragEvent, fileName: string) => {
    e.dataTransfer.setData('text/plain', fileName)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDrop = async (e: React.DragEvent, side: 'local' | 'remote') => {
    e.preventDefault()
    setDragOverLocal(false)
    setDragOverRemote(false)

    if (side === 'remote' && selectedConnection) {
      const files = e.dataTransfer.files
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const remoteFilePath = remotePath === '/' ? `/${file.name}` : `${remotePath}/${file.name}`
          
          try {
            await window.electronAPI.sshSftpUpload(
              selectedConnection.id,
              file.path,
              remoteFilePath
            )
          } catch (error) {
            alert(`上传失败: ${file.name}`)
          }
        }
        await loadRemoteFiles()
      }
    } else if (side === 'local' && selectedConnection) {
      const fileName = e.dataTransfer.getData('text/plain')
      if (fileName && !e.dataTransfer.files.length) {
        const remoteFilePath = remotePath === '/' ? `/${fileName}` : `${remotePath}/${fileName}`
        const localFilePath = `${localPath}/${fileName}`
        
        try {
          await window.electronAPI.sshSftpDownload(
            selectedConnection.id,
            remoteFilePath,
            localFilePath
          )
        } catch (error) {
          alert(`下载失败: ${fileName}`)
        }
        await loadLocalFiles()
      } else if (e.dataTransfer.files.length > 0) {
        const files = e.dataTransfer.files
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const remoteFilePath = remotePath === '/' ? `/${file.name}` : `${remotePath}/${file.name}`
          const localFilePath = `${localPath}/${file.name}`
          
          try {
            await window.electronAPI.sshSftpDownload(
              selectedConnection.id,
              remoteFilePath,
              localFilePath
            )
          } catch (error) {
            alert(`下载失败: ${file.name}`)
          }
        }
        await loadLocalFiles()
      }
    }
  }

  const handleUploadToRemote = async () => {
    if (!selectedConnection || selectedLocalFiles.length === 0) return

    for (const localFilePath of selectedLocalFiles) {
      const fileName = localFilePath.split(/[/\\]/).pop()
      const remoteFilePath = remotePath === '/' ? `/${fileName}` : `${remotePath}/${fileName}`
      
      try {
        await window.electronAPI.sshSftpUpload(
          selectedConnection.id,
          localFilePath,
          remoteFilePath
        )
      } catch (error) {
        alert(`上传失败: ${fileName}`)
      }
    }

    await loadRemoteFiles()
    setSelectedLocalFiles([])
  }

  const handleDownloadToLocal = async () => {
    if (!selectedConnection || selectedRemoteFiles.length === 0) return

    for (const fileName of selectedRemoteFiles) {
      const remoteFilePath = remotePath === '/' ? `/${fileName}` : `${remotePath}/${fileName}`
      const localFilePath = `${localPath}/${fileName}`
      
      try {
        await window.electronAPI.sshSftpDownload(
          selectedConnection.id,
          remoteFilePath,
          localFilePath
        )
      } catch (error) {
        alert(`下载失败: ${fileName}`)
      }
    }

    await loadLocalFiles()
    setSelectedRemoteFiles([])
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
          <div className="dual-panel-container">
            <div className="file-panel local-panel">
              <div className="panel-header">
                <h3>本地文件</h3>
                <button className="btn-small" onClick={handleSelectLocalDirectory}>
                  选择目录
                </button>
              </div>
              <div className="panel-toolbar">
                <button onClick={navigateLocalUp} disabled={localPath.split(/[/\\]/).filter(Boolean).length <= 1}>
                  ⬆️ 返回上级
                </button>
                <button onClick={() => loadLocalFiles()}>🔄 刷新</button>
                <button
                  onClick={handleUploadToRemote}
                  disabled={selectedLocalFiles.length === 0}
                  className="btn-upload"
                >
                  上传 →
                </button>
              </div>
              <div className="current-path">
                <span>路径:</span>
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && loadLocalFiles()}
                />
              </div>
              <div
                className={`files-container ${dragOverLocal ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, 'local')}
                onDragLeave={(e) => handleDragLeave(e, 'local')}
                onDrop={(e) => handleDrop(e, 'local')}
              >
                <div className="files-header">
                  <div className="col-name">文件名</div>
                  <div className="col-size">大小</div>
                </div>
                <div className="files-list">
                  {localFiles.map((file) => (
                    <div
                      key={file.path}
                      className={`file-item ${file.isDirectory ? 'directory' : ''} ${
                        selectedLocalFiles.includes(file.path) ? 'selected' : ''
                      }`}
                      onClick={() => handleLocalFileClick(file)}
                      draggable={!file.isDirectory}
                    >
                      <div className="col-name">
                        <span className="file-icon">
                          {file.isDirectory ? '�' : '📄'}
                        </span>
                        <span className="file-name">{file.name}</span>
                      </div>
                      <div className="col-size">
                        {file.isDirectory ? '-' : formatSize(0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="file-panel remote-panel">
              <div className="panel-header">
                <h3>远程文件</h3>
                <button
                  className="btn-small"
                  onClick={() => setShowNewFolderModal(true)}
                >
                  新建目录
                </button>
              </div>
              <div className="panel-toolbar">
                <button onClick={navigateRemoteUp} disabled={remotePath === '/'}>
                  ⬆️ 返回上级
                </button>
                <button onClick={() => loadRemoteFiles()}>🔄 刷新</button>
                <button
                  onClick={handleDownloadToLocal}
                  disabled={selectedRemoteFiles.length === 0}
                  className="btn-download"
                >
                  ← 下载
                </button>
              </div>
              <div className="current-path">
                <span>路径:</span>
                <input
                  type="text"
                  value={remotePath}
                  onChange={(e) => setRemotePath(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && loadRemoteFiles()}
                />
              </div>
              <div
                className={`files-container ${dragOverRemote ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, 'remote')}
                onDragLeave={(e) => handleDragLeave(e, 'remote')}
                onDrop={(e) => handleDrop(e, 'remote')}
              >
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
                          selectedRemoteFiles.includes(file.name) ? 'selected' : ''
                        }`}
                        onClick={() => handleRemoteFileClick(file)}
                        onDoubleClick={() => handlePreview(file)}
                        draggable={!file.isDirectory}
                        onDragStart={(e) => handleRemoteFileDragStart(e, file.name)}
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
