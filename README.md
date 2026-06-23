# 碳硅茶馆

`碳硅茶馆` 是一个开源的多 Agent 茶馆式对话应用，围绕 AI、Agent 协作、企业 AI 落地三个主题房间展开。它把聊天、主持调度、席位管理、自定义茶友生成、会话总结和本地配置管理放在同一个界面里，适合做产品演示、方案讨论、Agent 玩法探索和团队协作原型。

## 项目特性

- 3 个预设茶馆房间：`AI 茶馆`、`Agent 茶馆`、`企业 AI 茶馆`
- 每个房间都有默认茶友与专属主持人
- 支持勾选在席茶友、指名提问、请某位茶友插话
- 支持创建自定义茶友，并用大模型自动生成对应系统提示词
- 支持中英文界面切换
- 支持本地保存昵称、房间历史、模型配置、上下文压缩参数
- 支持 OpenAI-compatible 接口，也支持官方 Google Gemini SDK
- 支持生成 HTML 形式的对话总结
- 带有 WebSocket 房间同步、参与者状态广播和语音信号转发能力

## 技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- Express
- WebSocket
- `@google/genai`

## 项目结构

- `src/App.tsx`：应用主入口与整体布局
- `src/components/`：茶馆列表、席位、聊天、设置弹窗等核心 UI
- `src/data/teahouseData.ts`：预设茶馆与默认茶友数据
- `src/llmService.ts`：浏览器端模型配置、上下文压缩与 LLM 请求封装
- `server.ts`：本地全栈服务、API、WebSocket、总结与房间逻辑
- `server-db.ts`：本地持久化存储与管理员/房间/消息数据管理

## 运行方式

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制示例文件并填写自己的模型参数：

```bash
cp .env.example .env.local
```

`.env.example` 中支持的变量如下：

- `LLM_API_KEY`
- `LLM_BASE_URL`
- `LLM_ENDPOINT_PATH`
- `LLM_MODEL`
- `ADMIN_ACCOUNTS`

说明：

- 当 `LLM_BASE_URL` 为空时，后端会走官方 Gemini SDK 路径
- 当 `LLM_BASE_URL` 有值时，系统会按 OpenAI-compatible 接口方式请求
- `ADMIN_ACCOUNTS` 用于配置管理员账号，格式为 `username:password,username2:password2`

### 3. 启动开发服务

```bash
npm run dev
```

开发模式会启动 `server.ts`，默认监听 `http://localhost:3001`。

### 4. 生产构建

```bash
npm run build
npm start
```

构建后会生成前端静态资源和 `dist/server.cjs`，生产模式同样默认监听 `3001` 端口。

## 使用说明

1. 打开应用后，先在右上角配置 API Key、Base URL、Endpoint Path 和 Model。
2. 在左侧选择一个茶馆房间。
3. 勾选想让它参与对话的茶友。
4. 在聊天框中直接发言，系统会根据主持人逻辑自动调度参与者回答。
5. 需要更个性化的讨论风格时，可以在席位面板里创建自定义茶友。
6. 对话结束后，可以生成 HTML 总结。

## 默认行为

- 用户昵称默认是 `发起人老张`
- 房间历史、昵称、模型配置、压缩配置会保存在浏览器本地
- 自定义茶友按茶馆分别存储
- 聊天历史按茶馆分别存储
- 右上角会显示当前是否已配置 API Key

## 后端 API

### 配置

- `GET /api/config`
- `POST /api/config`

### 对话

- `POST /api/chat`

### 管理员

- `POST /api/admin/login`
- `POST /api/admin/accounts`
- `GET /api/admin/accounts`
- `GET /api/admin/rooms`

### 房间

- `POST /api/rooms/generate-agent`
- `POST /api/rooms`
- `GET /api/rooms/:id`
- `POST /api/rooms/:id/join`
- `GET /api/rooms/:id/summary`

### WebSocket

- `/ws`

## 本地存储

浏览器端会使用 `localStorage` 保存以下内容：

- API Key
- Base URL
- Endpoint Path
- Model
- 语言偏好
- 用户昵称
- 每个茶馆的自定义茶友
- 每个茶馆的聊天历史
- 上下文压缩参数
- 已节省字符统计

## 环境与权限提示

- 当前项目请求了麦克风权限，用于语音相关能力
- 项目以浏览器本地状态为主，敏感信息不会主动上传到仓库
- 如果你打算把它部署到共享环境，建议优先使用服务端环境变量，不要把真实密钥写进前端本地配置

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](</Users/chiyu/Desktop/app develop/desktop-tutorial/LongChat/LICENSE>)。
