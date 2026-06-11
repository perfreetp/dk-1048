export interface SSHConnection {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'privateKey'
  password?: string
  privateKey?: string
  passphrase?: string
  tags: string[]
  notes: string
  projectId?: string
  isFavorite: boolean
  lastConnected?: number
}

export interface Project {
  id: string
  name: string
  color: string
}

export interface Snippet {
  id: string
  name: string
  command: string
  categoryId: string
  variables: SnippetVariable[]
}

export interface SnippetVariable {
  name: string
  defaultValue: string
  description?: string
}

export interface SnippetCategory {
  id: string
  name: string
  icon?: string
}

export interface Settings {
  fontSize: number
  fontFamily: string
  theme: 'dark' | 'light'
  timeout: number
  proxyEnabled: boolean
  proxyHost: string
  proxyPort: number
  proxyType: 'socks5' | 'http'
}

export interface TerminalSession {
  id: string
  name: string
  connectionId: string
  connection: SSHConnection
  isActive: boolean
}

export interface FileItem {
  name: string
  isDirectory: boolean
  size: number
  mtime: number
  permissions?: string
}

export interface LocalFileItem {
  name: string
  isDirectory: boolean
  isFile: boolean
  path: string
}

export interface ConnectionsData {
  projects: Project[]
  connections: SSHConnection[]
}

export interface SnippetsData {
  categories: SnippetCategory[]
  snippets: Snippet[]
}

export interface BatchConnectionResult {
  connectionId: string
  connectionName: string
  success: boolean
  message?: string
}

declare global {
  interface Window {
    electronAPI: {
      getConnections: () => Promise<ConnectionsData>
      saveConnections: (data: ConnectionsData) => Promise<boolean>
      getSnippets: () => Promise<SnippetsData>
      saveSnippets: (data: SnippetsData) => Promise<boolean>
      getSettings: () => Promise<Settings>
      saveSettings: (data: Settings) => Promise<boolean>
      sshConnect: (config: {
        id: string
        host: string
        port: number
        username: string
        password?: string
        privateKey?: string
        passphrase?: string
      }) => Promise<{ success: boolean; message: string }>
      sshDisconnect: (id: string) => Promise<{ success: boolean; message?: string }>
      sshExec: (id: string, command: string) => Promise<{
        success: boolean
        output: string
        errorOutput: string
        code: number
      }>
      sshStartShell: (id: string) => Promise<{ success: boolean; message?: string }>
      sshWrite: (id: string, data: string) => Promise<{ success: boolean; message?: string }>
      sshResize: (id: string, cols: number, rows: number) => Promise<{ success: boolean; message?: string }>
      sshSftpList: (id: string, path: string) => Promise<{
        success: boolean
        files?: FileItem[]
        message?: string
      }>
      sshSftpReadFile: (id: string, path: string) => Promise<{
        success: boolean
        content?: string
        message?: string
      }>
      sshSftpWriteFile: (id: string, path: string, content: string) => Promise<{
        success: boolean
        message?: string
      }>
      sshSftpMkdir: (id: string, path: string) => Promise<{
        success: boolean
        message?: string
      }>
      sshSftpRmdir: (id: string, path: string) => Promise<{
        success: boolean
        message?: string
      }>
      sshSftpDelete: (id: string, path: string) => Promise<{
        success: boolean
        message?: string
      }>
      sshSftpRename: (id: string, oldPath: string, newPath: string) => Promise<{
        success: boolean
        message?: string
      }>
      sshSftpUpload: (id: string, localPath: string, remotePath: string) => Promise<{
        success: boolean
        message?: string
      }>
      sshSftpDownload: (id: string, remotePath: string, localPath: string) => Promise<{
        success: boolean
        message?: string
      }>
      localList: (dirPath: string) => Promise<{
        success: boolean
        files?: LocalFileItem[]
        currentPath?: string
        message?: string
      }>
      selectPrivateKey: () => Promise<{ path: string; content: string } | null>
      selectDirectory: () => Promise<string | null>
      openExternal: (url: string) => Promise<void>
      getHomeDirectory: () => Promise<string>
      onShellData: (callback: (data: { id: string; data: string }) => void) => void
      onShellClose: (callback: (data: { id: string }) => void) => void
    }
  }
}

export {}
