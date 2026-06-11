import React, { useState, useEffect } from 'react'
import { Snippet, SnippetCategory, SnippetsData, SnippetVariable } from '../types'
import { v4 as uuidv4 } from 'uuid'
import './CommandSnippets.css'

const CommandSnippets: React.FC = () => {
  const [categories, setCategories] = useState<SnippetCategory[]>([])
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<'category' | 'snippet'>('category')
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})
  const [variableValues, setVariableValues] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const data = await window.electronAPI.getSnippets()
      setCategories(data.categories || [])
      setSnippets(data.snippets || [])
    } catch (error) {
      console.error('Failed to load snippets:', error)
    }
  }

  const saveData = async (data: SnippetsData) => {
    try {
      await window.electronAPI.saveSnippets(data)
    } catch (error) {
      console.error('Failed to save snippets:', error)
    }
  }

  const filteredSnippets = selectedCategory
    ? snippets.filter((s) => s.categoryId === selectedCategory)
    : snippets

  const handleOpenModal = (type: 'category' | 'snippet', item?: any) => {
    setModalType(type)
    setEditingItem(item)
    
    if (type === 'category') {
      setFormData(item || { name: '', icon: '📂' })
    } else {
      setFormData(
        item || {
          name: '',
          command: '',
          categoryId: selectedCategory || categories[0]?.id || '',
          variables: []
        }
      )
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingItem(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (modalType === 'category') {
      const category: SnippetCategory = {
        id: editingItem?.id || uuidv4(),
        name: formData.name,
        icon: formData.icon
      }

      let updatedCategories: SnippetCategory[]
      if (editingItem) {
        updatedCategories = categories.map((c) =>
          c.id === category.id ? category : c
        )
      } else {
        updatedCategories = [...categories, category]
      }

      setCategories(updatedCategories)
      await saveData({ categories: updatedCategories, snippets })
    } else {
      const snippet: Snippet = {
        id: editingItem?.id || uuidv4(),
        name: formData.name,
        command: formData.command,
        categoryId: formData.categoryId,
        variables: formData.variables || []
      }

      let updatedSnippets: Snippet[]
      if (editingItem) {
        updatedSnippets = snippets.map((s) =>
          s.id === snippet.id ? snippet : s
        )
      } else {
        updatedSnippets = [...snippets, snippet]
      }

      setSnippets(updatedSnippets)
      await saveData({ categories, snippets: updatedSnippets })
    }

    handleCloseModal()
  }

  const handleDelete = async (type: 'category' | 'snippet', id: string) => {
    if (!confirm(`确定要删除这个${type === 'category' ? '分类' : '片段'}吗？`)) return

    if (type === 'category') {
      const updatedCategories = categories.filter((c) => c.id !== id)
      const updatedSnippets = snippets.filter((s) => s.categoryId !== id)
      setCategories(updatedCategories)
      setSnippets(updatedSnippets)
      await saveData({ categories: updatedCategories, snippets: updatedSnippets })
      
      if (selectedCategory === id) {
        setSelectedCategory(null)
      }
    } else {
      const updatedSnippets = snippets.filter((s) => s.id !== id)
      setSnippets(updatedSnippets)
      await saveData({ categories, snippets: updatedSnippets })
      
      if (selectedSnippet?.id === id) {
        setSelectedSnippet(null)
      }
    }
  }

  const addVariable = () => {
    const newVariable: SnippetVariable = {
      name: '',
      defaultValue: '',
      description: ''
    }
    setFormData({
      ...formData,
      variables: [...(formData.variables || []), newVariable]
    })
  }

  const updateVariable = (index: number, field: string, value: string) => {
    const updatedVariables = [...formData.variables]
    updatedVariables[index] = { ...updatedVariables[index], [field]: value }
    setFormData({ ...formData, variables: updatedVariables })
  }

  const removeVariable = (index: number) => {
    const updatedVariables = formData.variables.filter(
      (_: any, i: number) => i !== index
    )
    setFormData({ ...formData, variables: updatedVariables })
  }

  const executeSnippet = (snippet: Snippet) => {
    if (snippet.variables.length === 0) {
      navigator.clipboard.writeText(snippet.command)
      alert('命令已复制到剪贴板')
      return
    }

    setSelectedSnippet(snippet)
    const initialValues: { [key: string]: string } = {}
    snippet.variables.forEach((v) => {
      initialValues[v.name] = v.defaultValue
    })
    setVariableValues(initialValues)
  }

  const applyVariables = () => {
    if (!selectedSnippet) return

    let command = selectedSnippet.command
    Object.entries(variableValues).forEach(([key, value]) => {
      command = command.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    })

    navigator.clipboard.writeText(command)
    alert('命令已复制到剪贴板')
  }

  const getPreviewCommand = (command: string): string => {
    let preview = command
    Object.entries(variableValues).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`)
    })
    return preview
  }

  return (
    <div className="command-snippets">
      <div className="snippets-sidebar">
        <div className="sidebar-header">
          <h3>分类</h3>
          <button
            className="add-btn"
            onClick={() => handleOpenModal('category')}
            title="添加分类"
          >
            +
          </button>
        </div>
        <div className="categories-list">
          <div
            className={`category-item ${selectedCategory === null ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            <span className="category-icon">📋</span>
            <span className="category-name">全部片段</span>
          </div>
          {categories.map((category) => (
            <div
              key={category.id}
              className={`category-item ${selectedCategory === category.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category.id)}
            >
              <span className="category-icon">{category.icon || '📂'}</span>
              <span className="category-name">{category.name}</span>
              <button
                className="category-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete('category', category.id)
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="snippets-main">
        <div className="main-header">
          <h2>命令片段</h2>
          <button onClick={() => handleOpenModal('snippet')}>
            + 新建片段
          </button>
        </div>

        <div className="snippets-grid">
          {filteredSnippets.map((snippet) => {
            const category = categories.find((c) => c.id === snippet.categoryId)
            return (
              <div key={snippet.id} className="snippet-card">
                <div className="card-header">
                  <h3>{snippet.name}</h3>
                  {category && (
                    <span className="category-tag">
                      {category.icon} {category.name}
                    </span>
                  )}
                </div>
                <div className="card-command">
                  <code>{snippet.command}</code>
                </div>
                {snippet.variables.length > 0 && (
                  <div className="card-variables">
                    <small>变量: {snippet.variables.map((v) => v.name).join(', ')}</small>
                  </div>
                )}
                <div className="card-actions">
                  <button
                    className="btn-execute"
                    onClick={() => executeSnippet(snippet)}
                  >
                    使用片段
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => handleOpenModal('snippet', snippet)}
                  >
                    编辑
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => handleDelete('snippet', snippet.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {filteredSnippets.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>暂无片段</h3>
            <p>创建您的第一个命令片段</p>
          </div>
        )}
      </div>

      {selectedSnippet && selectedSnippet.variables.length > 0 && (
        <div className="variable-panel">
          <h3>填充变量</h3>
          {selectedSnippet.variables.map((variable, idx) => (
            <div key={idx} className="variable-input">
              <label>
                {variable.name}
                {variable.description && (
                  <small> - {variable.description}</small>
                )}
              </label>
              <input
                type="text"
                value={variableValues[variable.name] || ''}
                onChange={(e) =>
                  setVariableValues({
                    ...variableValues,
                    [variable.name]: e.target.value
                  })
                }
                placeholder={variable.defaultValue}
              />
            </div>
          ))}
          <div className="preview-section">
            <label>预览:</label>
            <pre>{getPreviewCommand(selectedSnippet.command)}</pre>
          </div>
          <div className="variable-actions">
            <button className="btn-secondary" onClick={() => setSelectedSnippet(null)}>
              取消
            </button>
            <button onClick={applyVariables}>复制命令</button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingItem ? `编辑${modalType === 'category' ? '分类' : '片段'}` : `新建${modalType === 'category' ? '分类' : '片段'}`}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>{modalType === 'category' ? '分类名称' : '片段名称'}</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {modalType === 'category' && (
                <div className="form-group">
                  <label>图标 (emoji)</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="📂"
                  />
                </div>
              )}

              {modalType === 'snippet' && (
                <>
                  <div className="form-group">
                    <label>所属分类</label>
                    <select
                      required
                      value={formData.categoryId}
                      onChange={(e) =>
                        setFormData({ ...formData, categoryId: e.target.value })
                      }
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>命令</label>
                    <textarea
                      required
                      value={formData.command}
                      onChange={(e) =>
                        setFormData({ ...formData, command: e.target.value })
                      }
                      rows={4}
                      placeholder="使用 {{变量名}} 表示变量"
                    />
                  </div>

                  <div className="form-group">
                    <label>变量定义</label>
                    {formData.variables?.map((variable: SnippetVariable, idx: number) => (
                      <div key={idx} className="variable-row">
                        <input
                          type="text"
                          placeholder="变量名"
                          value={variable.name}
                          onChange={(e) => updateVariable(idx, 'name', e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="默认值"
                          value={variable.defaultValue}
                          onChange={(e) =>
                            updateVariable(idx, 'defaultValue', e.target.value)
                          }
                        />
                        <input
                          type="text"
                          placeholder="描述（可选）"
                          value={variable.description}
                          onChange={(e) =>
                            updateVariable(idx, 'description', e.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="btn-remove"
                          onClick={() => removeVariable(idx)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button type="button" className="btn-add-variable" onClick={addVariable}>
                      + 添加变量
                    </button>
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                  取消
                </button>
                <button type="submit">
                  {editingItem ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CommandSnippets
