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
  isActive: boolean
}

export interface FileItem {
  name: string
  isDirectory: boolean
  size: number
  mtime: number
  permissions?: string
}

export interface SSH2Stream {
  id: number
  on(event: string, callback: (data: any) => void): void
  write(data: string): void
  end(): void
}

export interface ConnectionsData {
  projects: Project[]
  connections: SSHConnection[]
}

export interface SnippetsData {
  categories: SnippetCategory[]
  snippets: Snippet[]
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
      sshShell: (id: string) => Promise<{ success: boolean; streamId?: string }>
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
      selectPrivateKey: () => Promise<{ path: string; content: string } | null>
      openExternal: (url: string) => Promise<void>
      getHomeDirectory: () => Promise<string>
    }
  }
}

export {}
