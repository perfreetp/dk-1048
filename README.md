# SSH Manager - SSH连接管理桌面应用

专业的SSH连接管理工具，专为开发和运维人员设计。

## 功能特性

### 🔗 连接库
- 按项目分组管理SSH连接
- 支持主机、端口、账号、标签和备注
- 强大的搜索功能
- 收藏功能，方便快速访问
- 支持密码和私钥两种认证方式

### 💻 终端会话
- 多标签页管理会话
- 支持会话重命名
- 常用命令快捷发送
- 输出关键字高亮
- 快速命令面板

### 📁 文件浏览
- 远程文件浏览
- 文本文件预览
- 创建目录、重命名和删除
- 直观的文件列表视图

### 📝 命令片段
- 按分类保存常用命令
- 支持变量定义和填充
- 快速复制到剪贴板
- 预览填充后的命令

### ⚙️ 偏好设置
- 密钥管理
- 代理配置
- 超时设置
- 字体和主题配置
- 连接诊断工具

## 技术栈

- **框架**: Electron + React
- **终端模拟**: xterm.js
- **SSH连接**: ssh2
- **数据存储**: JSON本地文件
- **构建工具**: Vite + electron-builder

## 开发

### 安装依赖

```bash
npm install
```

### 运行开发服务器

```bash
npm run dev
```

### 构建应用

```bash
npm run build
```

构建完成的应用将位于 `release` 目录。

## 项目结构

```
ssh-manager/
├── electron/          # Electron主进程代码
│   ├── main.ts       # 主进程入口
│   └── preload.ts    # 预加载脚本
├── src/              # React前端代码
│   ├── components/   # React组件
│   │   ├── ConnectionLibrary.tsx
│   │   ├── TerminalSessions.tsx
│   │   ├── FileBrowser.tsx
│   │   ├── CommandSnippets.tsx
│   │   └── SettingsPanel.tsx
│   ├── types/        # TypeScript类型定义
│   └── App.tsx       # 主应用组件
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 使用说明

1. **添加SSH连接**: 在"连接库"页面点击"新建连接"
2. **连接服务器**: 从连接列表中选择一个连接，点击"连接"按钮
3. **管理会话**: 在"终端会话"页面可以管理多个会话
4. **浏览文件**: 使用"文件浏览"功能查看远程服务器文件
5. **使用命令片段**: 在"命令片段"页面创建和管理常用命令

## 配置存储

所有配置和连接信息存储在用户数据目录下的 `configs` 文件夹中：
- `connections.json` - SSH连接配置
- `snippets.json` - 命令片段
- `settings.json` - 应用设置

## 系统要求

- Node.js 16+
- Windows 7+ / macOS 10.12+ / Linux

## 许可证

MIT License
