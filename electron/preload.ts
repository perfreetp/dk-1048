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
  sshShell: (id: string) => ipcRenderer.invoke('ssh-shell', { id }),
  sshSftpList: (id: string, path: string) => ipcRenderer.invoke('ssh-sftp-list', { id, path }),
  sshSftpReadFile: (id: string, path: string) => ipcRenderer.invoke('ssh-sftp-read-file', { id, path }),
  sshSftpWriteFile: (id: string, path: string, content: string) => ipcRenderer.invoke('ssh-sftp-write-file', { id, path, content }),
  sshSftpMkdir: (id: string, path: string) => ipcRenderer.invoke('ssh-sftp-mkdir', { id, path }),
  sshSftpRmdir: (id: string, path: string) => ipcRenderer.invoke('ssh-sftp-rmdir', { id, path }),
  sshSftpDelete: (id: string, path: string) => ipcRenderer.invoke('ssh-sftp-delete', { id, path }),
  sshSftpRename: (id: string, oldPath: string, newPath: string) => ipcRenderer.invoke('ssh-sftp-rename', { id, oldPath, newPath }),
  selectPrivateKey: () => ipcRenderer.invoke('select-private-key'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  getHomeDirectory: () => ipcRenderer.invoke('get-home-directory')
})
