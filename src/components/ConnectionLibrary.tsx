import React, { useState, useEffect } from 'react'
import { SSHConnection, Project, ConnectionsData, BatchConnectionResult } from '../types'
import { v4 as uuidv4 } from 'uuid'
import './ConnectionLibrary.css'

interface ConnectionLibraryProps {
  onSwitchToTerminal: () => void
}

const ConnectionLibrary: React.FC<ConnectionLibraryProps> = ({ onSwitchToTerminal }) => {
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [showFavorites, setShowFavorites] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<'connection' | 'project'>('connection')
  const [editingConnection, setEditingConnection] = useState<SSHConnection | null>(null)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
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
  const [projectFormData, setProjectFormData] = useState<Partial<Project>>({
    name: '',
    color: '#007acc'
  })
  const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set())
  const [batchResults, setBatchResults] = useState<BatchConnectionResult[]>([])

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

  const handleOpenModal = (type: 'connection' | 'project', item?: any) => {
    setModalType(type)
    
    if (type === 'connection') {
      if (item) {
        setEditingConnection(item)
        setFormData(item)
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
    } else {
      if (item) {
        setEditingProject(item)
        setProjectFormData(item)
      } else {
        setEditingProject(null)
        setProjectFormData({
          name: '',
          color: '#007acc'
        })
      }
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingConnection(null)
    setEditingProject(null)
  }

  const handleSelectPrivateKey = async () => {
    const result = await window.electronAPI.selectPrivateKey()
    if (result) {
      setFormData({ ...formData, privateKey: result.content })
    }
  }

  const handleConnectionSubmit = async (e: React.FormEvent) => {
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

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const project: Project = {
      id: editingProject?.id || uuidv4(),
      name: projectFormData.name!,
      color: projectFormData.color!
    }

    let updatedProjects: Project[]
    if (editingProject) {
      updatedProjects = projects.map((p) => (p.id === project.id ? project : p))
    } else {
      updatedProjects = [...projects, project]
    }

    setProjects(updatedProjects)
    await saveData({ projects: updatedProjects, connections })
    handleCloseModal()
  }

  const handleDeleteConnection = async (id: string) => {
    if (confirm('确定要删除这个连接吗？')) {
      const updatedConnections = connections.filter((c) => c.id !== id)
      setConnections(updatedConnections)
      await saveData({ projects, connections: updatedConnections })
      selectedConnections.delete(id)
      setSelectedConnections(new Set(selectedConnections))
    }
  }

  const handleDeleteProject = async (id: string) => {
    if (confirm('确定要删除这个项目吗？该操作不会删除项目下的连接。')) {
      const updatedProjects = projects.filter((p) => p.id !== id)
      const updatedConnections = connections.map((c) =>
        c.projectId === id ? { ...c, projectId: undefined } : c
      )
      setProjects(updatedProjects)
      setConnections(updatedConnections)
      await saveData({ projects: updatedProjects, connections: updatedConnections })
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
        onSwitchToTerminal()
      } else {
        alert(`连接失败: ${result.message}`)
      }
    } catch (error) {
      alert('连接失败，请检查网络和配置')
    }
  }

  const toggleSelectConnection = (id: string) => {
    const newSelected = new Set(selectedConnections)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedConnections(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedConnections.size === filteredConnections.length) {
      setSelectedConnections(new Set())
    } else {
      setSelectedConnections(new Set(filteredConnections.map(c => c.id)))
    }
  }

  const handleBatchConnect = async () => {
    if (selectedConnections.size === 0) {
      alert('请先选择要连接的服务器')
      return
    }

    const results: BatchConnectionResult[] = []
    const successfulConnections: SSHConnection[] = []
    
    for (const id of Array.from(selectedConnections)) {
      const connection = connections.find(c => c.id === id)
      if (!connection) continue

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

        results.push({
          connectionId: connection.id,
          connectionName: connection.name,
          success: result.success,
          message: result.message
        })

        if (result.success) {
          successfulConnections.push(connection)
          await window.electronAPI.sshStartShell(connection.id)
          const updatedConnections = connections.map((c) =>
            c.id === connection.id ? { ...c, lastConnected: Date.now() } : c
          )
          setConnections(updatedConnections)
        }
      } catch (error: any) {
        results.push({
          connectionId: connection.id,
          connectionName: connection.name,
          success: false,
          message: error.message || '连接失败'
        })
      }
    }

    setBatchResults(results)
    await saveData({ projects, connections })

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    if (successCount > 0) {
      const failList = results.filter(r => !r.success)
      let message = `连接完成：成功 ${successCount} 台`
      if (failCount > 0) {
        message += `，失败 ${failCount} 台\n\n失败列表：\n`
        failList.forEach(r => {
          message += `• ${r.connectionName}: ${r.message}\n`
        })
      }
      message += '\n点击确定跳转到终端会话'
      alert(message)
      setSelectedConnections(new Set())
      onSwitchToTerminal()
    } else {
      alert('所有连接均失败，请检查网络和配置')
    }
    
    setBatchResults([])
  }

  const getProjectConnections = (projectId: string) => {
    return connections.filter(c => c.projectId === projectId).length
  }

  return (
    <div className="connection-library">
      <div className="library-header">
        <h2>连接库</h2>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => handleOpenModal('project')}>
            + 新建项目
          </button>
          <button className="btn-primary" onClick={() => handleOpenModal('connection')}>
            + 新建连接
          </button>
        </div>
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
                {project.name} ({getProjectConnections(project.id)})
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

      {selectedConnections.size > 0 && (
        <div className="batch-actions">
          <span>已选择 {selectedConnections.size} 项</span>
          <button onClick={handleSelectAll}>
            {selectedConnections.size === filteredConnections.length ? '取消全选' : '全选'}
          </button>
          <button className="btn-connect-batch" onClick={handleBatchConnect}>
            批量连接
          </button>
          <button className="btn-clear" onClick={() => setSelectedConnections(new Set())}>
            清空选择
          </button>
        </div>
      )}

      <div className="projects-section">
        <h3>项目分组</h3>
        <div className="projects-grid">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`project-card ${selectedProject === project.id ? 'active' : ''}`}
              onClick={() => setSelectedProject(project.id)}
            >
              <div className="project-color" style={{ backgroundColor: project.color }} />
              <div className="project-info">
                <div className="project-name">{project.name}</div>
                <div className="project-count">{getProjectConnections(project.id)} 个连接</div>
              </div>
              <div className="project-actions">
                <button
                  className="project-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenModal('project', project)
                  }}
                  title="编辑"
                >
                  ✏️
                </button>
                <button
                  className="project-btn delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteProject(project.id)
                  }}
                  title="删除"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="connections-grid">
        {filteredConnections.map((connection) => (
          <div
            key={connection.id}
            className={`connection-card ${selectedConnections.has(connection.id) ? 'selected' : ''}`}
          >
            <div className="card-checkbox">
              <input
                type="checkbox"
                checked={selectedConnections.has(connection.id)}
                onChange={() => toggleSelectConnection(connection.id)}
              />
            </div>
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
              <button className="btn-secondary" onClick={() => handleOpenModal('connection', connection)}>
                编辑
              </button>
              <button className="btn-danger" onClick={() => handleDeleteConnection(connection.id)}>
                删除
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredConnections.length === 0 && (
        <div className="empty-state">
          <p>没有找到匹配的连接</p>
          <button onClick={() => handleOpenModal('connection')}>创建第一个连接</button>
        </div>
      )}

      {showModal && modalType === 'connection' && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingConnection ? '编辑连接' : '新建连接'}</h2>
            <form onSubmit={handleConnectionSubmit}>
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

      {showModal && modalType === 'project' && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingProject ? '编辑项目' : '新建项目'}</h2>
            <form onSubmit={handleProjectSubmit}>
              <div className="form-group">
                <label>项目名称</label>
                <input
                  type="text"
                  required
                  value={projectFormData.name}
                  onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                  placeholder="例如：生产环境"
                />
              </div>

              <div className="form-group">
                <label>项目颜色</label>
                <input
                  type="color"
                  value={projectFormData.color}
                  onChange={(e) => setProjectFormData({ ...projectFormData, color: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                  取消
                </button>
                <button type="submit" className="btn-primary">
                  {editingProject ? '保存' : '创建'}
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
