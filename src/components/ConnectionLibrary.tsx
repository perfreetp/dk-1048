import React, { useState, useEffect } from 'react'
import { SSHConnection, Project, ConnectionsData } from '../types'
import { v4 as uuidv4 } from 'uuid'
import './ConnectionLibrary.css'

const ConnectionLibrary: React.FC = () => {
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [showFavorites, setShowFavorites] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingConnection, setEditingConnection] = useState<SSHConnection | null>(null)
  const [formData, setFormData] = useState<Partial<SSHConnection>>({
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password',
    password: '',
    tags: [],
    notes: '',
    projectId: '',
    isFavorite: false
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const data = await window.electronAPI.getConnections()
      setConnections(data.connections || [])
      setProjects(data.projects || [])
    } catch (error) {
      console.error('Failed to load connections:', error)
    }
  }

  const saveData = async (data: ConnectionsData) => {
    try {
      await window.electronAPI.saveConnections(data)
    } catch (error) {
      console.error('Failed to save connections:', error)
    }
  }

  const filteredConnections = connections.filter((conn) => {
    const matchesSearch =
      conn.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conn.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conn.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conn.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesProject =
      selectedProject === 'all' ||
      (selectedProject === 'ungrouped' && !conn.projectId) ||
      conn.projectId === selectedProject

    const matchesFavorites = !showFavorites || conn.isFavorite

    return matchesSearch && matchesProject && matchesFavorites
  })

  const handleOpenModal = (connection?: SSHConnection) => {
    if (connection) {
      setEditingConnection(connection)
      setFormData(connection)
    } else {
      setEditingConnection(null)
      setFormData({
        name: '',
        host: '',
        port: 22,
        username: '',
        authType: 'password',
        password: '',
        tags: [],
        notes: '',
        projectId: '',
        isFavorite: false
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingConnection(null)
  }

  const handleSelectPrivateKey = async () => {
    const result = await window.electronAPI.selectPrivateKey()
    if (result) {
      setFormData({ ...formData, privateKey: result.content })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const connection: SSHConnection = {
      id: editingConnection?.id || uuidv4(),
      name: formData.name!,
      host: formData.host!,
      port: formData.port!,
      username: formData.username!,
      authType: formData.authType!,
      password: formData.password,
      privateKey: formData.privateKey,
      passphrase: formData.passphrase,
      tags: formData.tags || [],
      notes: formData.notes || '',
      projectId: formData.projectId,
      isFavorite: formData.isFavorite || false,
      lastConnected: editingConnection?.lastConnected
    }

    let updatedConnections: SSHConnection[]
    if (editingConnection) {
      updatedConnections = connections.map((c) => (c.id === connection.id ? connection : c))
    } else {
      updatedConnections = [...connections, connection]
    }

    setConnections(updatedConnections)
    await saveData({ projects, connections: updatedConnections })
    handleCloseModal()
  }

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个连接吗？')) {
      const updatedConnections = connections.filter((c) => c.id !== id)
      setConnections(updatedConnections)
      await saveData({ projects, connections: updatedConnections })
    }
  }

  const toggleFavorite = async (id: string) => {
    const updatedConnections = connections.map((c) =>
      c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
    )
    setConnections(updatedConnections)
    await saveData({ projects, connections: updatedConnections })
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
        const updatedConnections = connections.map((c) =>
          c.id === connection.id ? { ...c, lastConnected: Date.now() } : c
        )
        setConnections(updatedConnections)
        await saveData({ projects, connections: updatedConnections })
        alert('连接成功！')
      } else {
        alert(`连接失败: ${result.message}`)
      }
    } catch (error) {
      alert('连接失败，请检查网络和配置')
    }
  }

  const handleBatchOpen = async (selectedIds: string[]) => {
    for (const id of selectedIds) {
      const connection = connections.find((c) => c.id === id)
      if (connection) {
        await handleConnect(connection)
      }
    }
  }

  return (
    <div className="connection-library">
      <div className="library-header">
        <h2>连接库</h2>
        <button className="btn-primary" onClick={() => handleOpenModal()}>
          + 新建连接
        </button>
      </div>

      <div className="library-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="搜索连接..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="toolbar-filters">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="all">全部项目</option>
            <option value="ungrouped">未分组</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            className={`btn-filter ${showFavorites ? 'active' : ''}`}
            onClick={() => setShowFavorites(!showFavorites)}
          >
            ⭐ 收藏
          </button>
        </div>
      </div>

      <div className="connections-grid">
        {filteredConnections.map((connection) => (
          <div key={connection.id} className="connection-card">
            <div className="card-header">
              <h3>{connection.name}</h3>
              <button
                className={`favorite-btn ${connection.isFavorite ? 'active' : ''}`}
                onClick={() => toggleFavorite(connection.id)}
              >
                {connection.isFavorite ? '⭐' : '☆'}
              </button>
            </div>
            <div className="card-body">
              <p>
                <strong>主机:</strong> {connection.host}:{connection.port}
              </p>
              <p>
                <strong>用户:</strong> {connection.username}
              </p>
              <p>
                <strong>认证:</strong> {connection.authType === 'password' ? '密码' : '密钥'}
              </p>
              {connection.tags.length > 0 && (
                <div className="tags">
                  {connection.tags.map((tag, idx) => (
                    <span key={idx} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {connection.notes && <p className="notes">{connection.notes}</p>}
            </div>
            <div className="card-actions">
              <button className="btn-connect" onClick={() => handleConnect(connection)}>
                连接
              </button>
              <button className="btn-secondary" onClick={() => handleOpenModal(connection)}>
                编辑
              </button>
              <button className="btn-danger" onClick={() => handleDelete(connection.id)}>
                删除
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredConnections.length === 0 && (
        <div className="empty-state">
          <p>没有找到匹配的连接</p>
          <button onClick={() => handleOpenModal()}>创建第一个连接</button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingConnection ? '编辑连接' : '新建连接'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>连接名称</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：生产服务器"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>主机地址</label>
                  <input
                    type="text"
                    required
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="192.168.1.100"
                  />
                </div>
                <div className="form-group" style={{ width: '100px' }}>
                  <label>端口</label>
                  <input
                    type="number"
                    required
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>用户名</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="root"
                />
              </div>

              <div className="form-group">
                <label>认证方式</label>
                <select
                  value={formData.authType}
                  onChange={(e) => setFormData({ ...formData, authType: e.target.value as 'password' | 'privateKey' })}
                >
                  <option value="password">密码认证</option>
                  <option value="privateKey">密钥认证</option>
                </select>
              </div>

              {formData.authType === 'password' ? (
                <div className="form-group">
                  <label>密码</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>私钥</label>
                    <button type="button" className="btn-secondary" onClick={handleSelectPrivateKey}>
                      选择私钥文件
                    </button>
                    {formData.privateKey && <span className="key-selected">已选择</span>}
                  </div>
                  <div className="form-group">
                    <label>密钥密码（可选）</label>
                    <input
                      type="password"
                      value={formData.passphrase}
                      onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>所属项目</label>
                <select
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                >
                  <option value="">无</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>标签（逗号分隔）</label>
                <input
                  type="text"
                  value={formData.tags?.join(', ')}
                  onChange={(e) => setFormData({
                    ...formData,
                    tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
                  })}
                  placeholder="生产, 重要"
                />
              </div>

              <div className="form-group">
                <label>备注</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                  取消
                </button>
                <button type="submit" className="btn-primary">
                  {editingConnection ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConnectionLibrary
