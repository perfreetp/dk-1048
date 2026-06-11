import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getConnections: () => ipcRenderer.invoke('get-connections'),
  saveConnections: (data: any) => ipcRenderer.invoke('save-connections', data),
  getSnippets: () => ipcRenderer.invoke('get-snippets'),
  saveSnippets: (data: any) => ipcRenderer.invoke('save-snippets', data),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (data: any) => ipcRenderer.invoke('save-settings', data),
  sshConnect: (config: any) => ipcRenderer.invoke('ssh-connect', config),
  sshDisconnect: (id: string) => ipcRenderer.invoke('ssh-disconnect', id),
  sshExec: (id: string, command: string) => ipcRenderer.invoke('ssh-exec', { id, command }),
  sshStartShell: (id: string) => ipcRenderer.invoke('ssh-start-shell', { id }),
  sshWrite: (id: string, data: string) => ipcRenderer.invoke('ssh-write', { id, data }),
  sshResize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('ssh-resize', { id, cols, rows }),
  sshSftpList: (id: string, path: string) => ipcRenderer.invoke('ssh-sftp-list', { id, path }),
  sshSftpReadFile: (id: string, path: string) => ipcRenderer.invoke('ssh-sftp-read-file', { id, path }),
  sshSftpWriteFile: (id: string, path: string, content: string) => ipcRenderer.invoke('ssh-sftp-write-file', { id, path, content }),
  sshSftpMkdir: (id: string, path: string) => ipcRenderer.invoke('ssh-sftp-mkdir', { id, path }),
  sshSftpRmdir: (id: string, path: string) => ipcRenderer.invoke('ssh-sftp-rmdir', { id, path }),
  sshSftpDelete: (id: string, path: string) => ipcRenderer.invoke('ssh-sftp-delete', { id, path }),
  sshSftpRename: (id: string, oldPath: string, newPath: string) => ipcRenderer.invoke('ssh-sftp-rename', { id, oldPath, newPath }),
  sshSftpUpload: (id: string, localPath: string, remotePath: string) => ipcRenderer.invoke('ssh-sftp-upload', { id, localPath, remotePath }),
  sshSftpDownload: (id: string, remotePath: string, localPath: string) => ipcRenderer.invoke('ssh-sftp-download', { id, remotePath, localPath }),
  localList: (dirPath: string) => ipcRenderer.invoke('local-list', dirPath),
  selectPrivateKey: () => ipcRenderer.invoke('select-private-key'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  getHomeDirectory: () => ipcRenderer.invoke('get-home-directory'),
  onShellData: (callback: (data: { id: string; data: string }) => void) => {
    ipcRenderer.on('ssh-shell-data', (_, data) => callback(data))
  },
  onShellClose: (callback: (data: { id: string }) => void) => {
    ipcRenderer.on('ssh-shell-close', (_, data) => callback(data))
  },
  sendBatchConnections: (connections: any[]) => {
    ipcRenderer.send('batch-connections-created', connections)
  },
  onBatchConnections: (callback: (connections: any[]) => void) => {
    ipcRenderer.on('batch-connections-created', (_, connections) => callback(connections))
  },
  sendSingleConnection: (connection: any) => {
    ipcRenderer.send('single-connection-created', connection)
  },
  onSingleConnection: (callback: (connection: any) => void) => {
    ipcRenderer.on('single-connection-created', (_, connection) => callback(connection))
  }
})
