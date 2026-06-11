import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { Client } from 'ssh2'
import fs from 'fs'
import os from 'os'

let mainWindow: BrowserWindow | null = null
const connections = new Map<string, Client>()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'SSH Manager',
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  connections.forEach((conn) => {
    conn.end()
  })
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

const configDir = path.join(app.getPath('userData'), 'configs')
const connectionsFile = path.join(configDir, 'connections.json')
const snippetsFile = path.join(configDir, 'snippets.json')
const settingsFile = path.join(configDir, 'settings.json')

function ensureConfigDir() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }
  if (!fs.existsSync(connectionsFile)) {
    fs.writeFileSync(connectionsFile, JSON.stringify({ projects: [], connections: [] }, null, 2))
  }
  if (!fs.existsSync(snippetsFile)) {
    fs.writeFileSync(snippetsFile, JSON.stringify({ categories: [] }, null, 2))
  }
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify({
      fontSize: 14,
      fontFamily: 'Consolas, monospace',
      theme: 'dark',
      timeout: 30,
      proxyEnabled: false,
      proxyHost: '',
      proxyPort: 1080,
      proxyType: 'socks5'
    }, null, 2))
  }
}

app.whenReady().then(ensureConfigDir)

ipcMain.handle('get-connections', async () => {
  try {
    const data = fs.readFileSync(connectionsFile, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return { projects: [], connections: [] }
  }
})

ipcMain.handle('save-connections', async (_, data) => {
  fs.writeFileSync(connectionsFile, JSON.stringify(data, null, 2))
  return true
})

ipcMain.handle('get-snippets', async () => {
  try {
    const data = fs.readFileSync(snippetsFile, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return { categories: [] }
  }
})

ipcMain.handle('save-snippets', async (_, data) => {
  fs.writeFileSync(snippetsFile, JSON.stringify(data, null, 2))
  return true
})

ipcMain.handle('get-settings', async () => {
  try {
    const data = fs.readFileSync(settingsFile, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return {}
  }
})

ipcMain.handle('save-settings', async (_, data) => {
  fs.writeFileSync(settingsFile, JSON.stringify(data, null, 2))
  return true
})

ipcMain.handle('ssh-connect', async (event, { id, host, port, username, password, privateKey, passphrase }) => {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    const connectionConfig: any = {
      host,
      port: port || 22,
      username,
      readyTimeout: 30000
    }

    if (password) {
      connectionConfig.password = password
    } else if (privateKey) {
      connectionConfig.privateKey = privateKey
      if (passphrase) {
        connectionConfig.passphrase = passphrase
      }
    }

    conn.on('ready', () => {
      connections.set(id, conn)
      resolve({ success: true, message: 'Connected successfully' })
    })

    conn.on('error', (err) => {
      reject({ success: false, message: err.message })
    })

    conn.connect(connectionConfig)
  })
})

ipcMain.handle('ssh-disconnect', async (_, id) => {
  const conn = connections.get(id)
  if (conn) {
    conn.end()
    connections.delete(id)
    return { success: true }
  }
  return { success: false, message: 'Connection not found' }
})

ipcMain.handle('ssh-exec', async (event, { id, command }) => {
  return new Promise((resolve, reject) => {
    const conn = connections.get(id)
    if (!conn) {
      reject({ success: false, message: 'Connection not found' })
      return
    }

    conn.exec(command, (err, stream) => {
      if (err) {
        reject({ success: false, message: err.message })
        return
      }

      let output = ''
      let errorOutput = ''

      stream.on('close', () => {
        resolve({
          success: true,
          output,
          errorOutput,
          code: (stream as any).exitCode
        })
      })

      stream.on('data', (data: Buffer) => {
        output += data.toString()
      })

      stream.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString()
      })
    })
  })
})

ipcMain.handle('ssh-shell', async (event, { id }) => {
  return new Promise((resolve, reject) => {
    const conn = connections.get(id)
    if (!conn) {
      reject({ success: false, message: 'Connection not found' })
      return
    }

    conn.shell((err, stream) => {
      if (err) {
        reject({ success: false, message: err.message })
        return
      }

      resolve({ success: true, streamId: id })
    })
  })
})

ipcMain.handle('ssh-sftp-list', async (event, { id, path: dirPath }) => {
  return new Promise((resolve, reject) => {
    const conn = connections.get(id)
    if (!conn) {
      reject({ success: false, message: 'Connection not found' })
      return
    }

    conn.sftp((err, sftp) => {
      if (err) {
        reject({ success: false, message: err.message })
        return
      }

      sftp.readdir(dirPath, (err, list) => {
        if (err) {
          reject({ success: false, message: err.message })
          return
        }

        const files = list.map(item => ({
          name: item.filename,
          isDirectory: item.attrs.isDirectory(),
          size: item.attrs.size,
          mtime: item.attrs.mtime * 1000
        }))

        resolve({ success: true, files })
      })
    })
  })
})

ipcMain.handle('ssh-sftp-read-file', async (event, { id, path: filePath }) => {
  return new Promise((resolve, reject) => {
    const conn = connections.get(id)
    if (!conn) {
      reject({ success: false, message: 'Connection not found' })
      return
    }

    conn.sftp((err, sftp) => {
      if (err) {
        reject({ success: false, message: err.message })
        return
      }

      const readStream = sftp.createReadStream(filePath)
      let content = ''

      readStream.on('data', (data: Buffer) => {
        content += data.toString()
      })

      readStream.on('close', () => {
        resolve({ success: true, content })
      })

      readStream.on('error', (err: Error) => {
        reject({ success: false, message: err.message })
      })
    })
  })
})

ipcMain.handle('ssh-sftp-write-file', async (event, { id, path: filePath, content }) => {
  return new Promise((resolve, reject) => {
    const conn = connections.get(id)
    if (!conn) {
      reject({ success: false, message: 'Connection not found' })
      return
    }

    conn.sftp((err, sftp) => {
      if (err) {
        reject({ success: false, message: err.message })
        return
      }

      const writeStream = sftp.createWriteStream(filePath)

      writeStream.on('close', () => {
        resolve({ success: true })
      })

      writeStream.on('error', (err: Error) => {
        reject({ success: false, message: err.message })
      })

      writeStream.write(content)
      writeStream.end()
    })
  })
})

ipcMain.handle('ssh-sftp-mkdir', async (event, { id, path: dirPath }) => {
  return new Promise((resolve, reject) => {
    const conn = connections.get(id)
    if (!conn) {
      reject({ success: false, message: 'Connection not found' })
      return
    }

    conn.sftp((err, sftp) => {
      if (err) {
        reject({ success: false, message: err.message })
        return
      }

      sftp.mkdir(dirPath, (err) => {
        if (err) {
          reject({ success: false, message: err.message })
          return
        }
        resolve({ success: true })
      })
    })
  })
})

ipcMain.handle('ssh-sftp-rmdir', async (event, { id, path: dirPath }) => {
  return new Promise((resolve, reject) => {
    const conn = connections.get(id)
    if (!conn) {
      reject({ success: false, message: 'Connection not found' })
      return
    }

    conn.sftp((err, sftp) => {
      if (err) {
        reject({ success: false, message: err.message })
        return
      }

      sftp.rmdir(dirPath, (err) => {
        if (err) {
          reject({ success: false, message: err.message })
          return
        }
        resolve({ success: true })
      })
    })
  })
})

ipcMain.handle('ssh-sftp-delete', async (event, { id, path: filePath }) => {
  return new Promise((resolve, reject) => {
    const conn = connections.get(id)
    if (!conn) {
      reject({ success: false, message: 'Connection not found' })
      return
    }

    conn.sftp((err, sftp) => {
      if (err) {
        reject({ success: false, message: err.message })
        return
      }

      sftp.unlink(filePath, (err) => {
        if (err) {
          reject({ success: false, message: err.message })
          return
        }
        resolve({ success: true })
      })
    })
  })
})

ipcMain.handle('ssh-sftp-rename', async (event, { id, oldPath, newPath }) => {
  return new Promise((resolve, reject) => {
    const conn = connections.get(id)
    if (!conn) {
      reject({ success: false, message: 'Connection not found' })
      return
    }

    conn.sftp((err, sftp) => {
      if (err) {
        reject({ success: false, message: err.message })
        return
      }

      sftp.rename(oldPath, newPath, (err) => {
        if (err) {
          reject({ success: false, message: err.message })
          return
        }
        resolve({ success: true })
      })
    })
  })
})

ipcMain.handle('select-private-key', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Private Keys', extensions: ['pem', 'key', ''] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const keyPath = result.filePaths[0]
  const privateKey = fs.readFileSync(keyPath, 'utf-8')
  return { path: keyPath, content: privateKey }
})

ipcMain.handle('open-external', async (_, url) => {
  await shell.openExternal(url)
})

ipcMain.handle('get-home-directory', async () => {
  return os.homedir()
})

export {}
