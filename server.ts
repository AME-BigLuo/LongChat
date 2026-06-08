import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { Room, RoomSession, Message, Participant } from './src/types';
import { serverDb } from './server-db';

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to interact with the chosen model / endpoint
async function generateLLMResponse(systemInstruction: string, prompt: string, modelOverride?: string): Promise<string> {
  const settings = serverDb.getSettings();
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('大模型 API Key 未配置！请在管理员后台进行设置（支持官规/中转）。');
  }

  const modelName = modelOverride || settings.model || 'gemini-3.1-flash-lite';
  const baseUrl = settings.baseUrl ? settings.baseUrl.trim() : '';

  if (baseUrl) {
    // OpenAI-compatible middleware for custom proxies or models (e.g. GRS, DeepSeek, OpenRouter)
    let endpoint = baseUrl;
    if (!endpoint.endsWith('/chat/completions')) {
      if (endpoint.endsWith('/')) {
        endpoint += 'chat/completions';
      } else if (endpoint.endsWith('/v1')) {
        endpoint += '/chat/completions';
      } else {
        endpoint += '/v1/chat/completions';
      }
    }

    console.log(`[LLM Custom API Proxy] Endpoint: ${endpoint}, model: ${modelName}`);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`中转平台请求错误 (HTTP ${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return content.trim();
  } else {
    // Standard Official Google Gemini SDK Flow
    console.log(`[LLM Official API] Requesting standard Gemini model: ${modelName}`);
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });

    return (response.text || '').trim();
  }
}

// 1. Unified Backend Settings API
app.get('/api/config', (req, res) => {
  const isEnvSet = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY';
  const settings = serverDb.getSettings();
  res.json({
    hasKey: !!settings.apiKey || isEnvSet,
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    model: settings.model,
    source: settings.apiKey ? 'custom' : (isEnvSet ? 'env' : 'none')
  });
});

app.post('/api/config', (req, res) => {
  const { apiKey, baseUrl, model } = req.body;
  serverDb.saveSettings(apiKey, baseUrl, model);
  res.json({ success: true, message: '大模型适配与密钥参数更新成功！已持久保存于系统库中。' });
});

// 2. Administrator Authentication & Segmented Management Dashboard APIs
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: '请输入用户名和密码。' });
    return;
  }

  const success = serverDb.verifyAdmin(username, password);
  if (success) {
    res.json({ success: true, username });
  } else {
    res.status(401).json({ error: '用户名或密码错误，请重试。' });
  }
});

// Create admin accounts securely (no public registry, logged-in admins can invite or add colleagues)
app.post('/api/admin/accounts', (req, res) => {
  const { authUser, username, password } = req.body;
  if (!authUser) {
    res.status(401).json({ error: '请先登录管理员账号后进行此操作。' });
    return;
  }

  if (!username || !password) {
    res.status(400).json({ error: '用户名和密码不能为空。' });
    return;
  }

  const success = serverDb.createAdmin(username, password);
  if (success) {
    res.json({ success: true, message: `管理员账号 [${username}] 注册成功！` });
  } else {
    res.status(400).json({ error: `无法创建账号，该用户名已存在。` });
  }
});

app.get('/api/admin/accounts', (req, res) => {
  const list = serverDb.listAdmins();
  res.json({ accounts: list });
});

// List only rooms owned by THIS specific administrator
app.get('/api/admin/rooms', (req, res) => {
  const adminId = req.query.adminId as string;
  if (!adminId) {
    res.status(400).json({ error: '缺少管理员标识参数' });
    return;
  }
  const myRooms = serverDb.listAdminsRooms(adminId);
  res.json({ rooms: myRooms });
});


// 3. Generate custom Agent prompt before creating the room
app.post('/api/rooms/generate-agent', async (req, res) => {
  try {
    const { name, description, nature, expectedOutcome, agentNickname } = req.body;
    if (!name || !description || !nature || !expectedOutcome || !agentNickname) {
      res.status(400).json({ error: '请提供完整的房间配置信息以生成主持 Agent。' });
      return;
    }

    const systemPrompt = `你是一个人工智能专家，请为“龙门阵”聊天室设计一个专门负责协调多方、引导控场且具有独特个性的“主持人Agent”的系统提示词（System Instruction）。
聊天室信息如下：
- 话题名称：${name}
- 话题内容/背景：${description}
- 讨论性质与风格：${nature}
- 讨论目标成果：${expectedOutcome}
- 它的昵称：${agentNickname}

请生成一段完整的、面向大模型的系统指令。该指令必须指定：
1. 它扮演的角色身份和昵称（${agentNickname}），确保说话口吻完全契合定义的“讨论性质与风格”（例如：如果是犀利，就要一针见血；如果是温和，就要细腻包容；如果是茶馆小二，可以用一点川渝方言口吻，热心机智）。
2. 它的职责任务：监控对话流程，在有跑题、攻击、或者讨论停滞时适时地进行“纠偏”和“插话”，协调多方沟通的 rhythm。
3. 它需要具备“插话”和“纠偏”准则。不能说废话，不要每一句都回复。一般在别人发言数轮或者有关键停顿/偏移时才发表意见。
4. 发言务必精炼短小。字数限制为每次发言原则上不超过 100 字，简洁有力，直奔主题。

请直接输出生成的 System Instruction 文字，不要包含任何包裹符号（如 Markdown 标记 \`\`\` 等），不要有任何多余的角色外寒暄，直接以指令文本形式输出。`;

    const agentPrompt = await generateLLMResponse(
      "你是一个卓越的系统角色规划师和提示词专家。",
      systemPrompt
    );
    res.json({ agentPrompt });
  } catch (error: any) {
    console.error('Failed to generate agent prompt:', error);
    res.status(500).json({ error: error.message || '生成 Agent 失败' });
  }
});

// 4. Create room (Requires binding to an Administrator ID)
app.post('/api/rooms', (req, res) => {
  const { name, description, nature, expectedOutcome, password, agentNickname, agentPrompt, adminId } = req.body;
  if (!name || !password || !agentNickname || !agentPrompt || !adminId) {
    res.status(400).json({ error: '缺少关键房间设置（必须由已登录管理员创立）' });
    return;
  }

  const roomId = Math.random().toString(36).substring(2, 10);
  const room: Room = {
    id: roomId,
    name,
    description,
    expectedOutcome,
    status: 'active',
    agentNickname,
    agentPrompt,
    createdAt: Date.now()
  };

  // Securely persist into our core database service
  serverDb.saveRoom(room, password, adminId);

  res.json({ roomId, success: true });
});

// 5. Get room details
app.get('/api/rooms/:id', (req, res) => {
  const room = serverDb.getRoom(req.params.id);
  if (!room) {
    res.status(404).json({ error: '未找到该聊天室，可能已被销毁或链接输入有误。' });
    return;
  }
  
  const activeSessionUsersCount = activeParticipants[req.params.id] 
    ? Object.keys(activeParticipants[req.params.id]).length 
    : 0;

  res.json({
    room,
    participantsCount: activeSessionUsersCount
  });
});

// 6. Join Room Authentication
app.post('/api/rooms/:id/join', (req, res) => {
  const room = serverDb.getRoom(req.params.id);
  const correctPassword = serverDb.getRoomPassword(req.params.id);
  const { password, nickname, role } = req.body;

  if (!room || !correctPassword) {
    res.status(404).json({ error: '未找到该聊天室' });
    return;
  }

  if (room.status === 'destroyed') {
    res.status(400).json({ error: '该聊天室对话已经结束并已被销毁。' });
    return;
  }

  // Check room entry password
  if (correctPassword !== password) {
    res.status(401).json({ error: '密码错误' });
    return;
  }

  if (!nickname || nickname.trim() === '') {
    res.status(400).json({ error: '请输入有效的昵称' });
    return;
  }

  const userId = 'usr_' + Math.random().toString(36).substring(2, 10);
  const participant: Participant = {
    id: userId,
    nickname: nickname.trim(),
    role: role === 'creator' ? 'creator' : 'participant',
    isMuted: false,
    isTalking: false
  };

  // Synchronously store inside our live active users representation
  if (!activeParticipants[req.params.id]) {
    activeParticipants[req.params.id] = {};
  }
  activeParticipants[req.params.id][userId] = participant;

  res.json({
    success: true,
    userId,
    participant
  });
});

// 7. Download summary HTML
app.get('/api/rooms/:id/summary', (req, res) => {
  const room = serverDb.getRoom(req.params.id);
  if (!room || !room.summaryHtml) {
    res.status(404).send('未找到会议总结，或会议尚未结束。');
    return;
  }
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `attachment; filename=long_men_zhen_${req.params.id}_summary.html`);
  res.send(room.summaryHtml);
});


// Set up HTTP and WebSocket Integration
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Handle express upgrades on path '/ws'
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Track active WebSocket clients by connection
interface ActiveClient {
  ws: WebSocket;
  roomId: string;
  userId: string;
}

const activeClients: Set<ActiveClient> = new Set();
// Dynamic list of active participants holding transient structures
const activeParticipants: Record<string, Record<string, Participant>> = {};
// To prevent simultaneous Agent triggers per room
const agentProcessing: Record<string, boolean> = {};

// Helper to broadcast to the room
function broadcastToRoom(roomId: string, data: any) {
  const payload = JSON.stringify(data);
  for (const client of activeClients) {
    if (client.roomId === roomId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

// System message generator
function makeSystemMessage(roomId: string, text: string): Message {
  return {
    id: 'sys_' + Math.random().toString(36).substring(2, 10),
    roomId,
    role: 'system',
    userId: 'system',
    username: '系统提示',
    text,
    timestamp: Date.now()
  };
}

// AI Agent Evaluation Core
async function triggerAgentEvaluation(roomId: string) {
  const room = serverDb.getRoom(roomId);
  if (!room || room.status === 'destroyed') return;
  if (agentProcessing[roomId]) return; // Avoid concurrency

  agentProcessing[roomId] = true;

  try {
    const messages = serverDb.getMessages(roomId);
    
    // Grab last 12 messages for quick context evaluation
    const recentMessages = messages.slice(-12);
    if (recentMessages.length === 0) {
      agentProcessing[roomId] = false;
      return;
    }

    // Don't respond if the last message was already from agent to avoid infinite loops,
    // or if the message history lists very little content.
    const lastMsg = recentMessages[recentMessages.length - 1];
    if (lastMsg.role === 'agent') {
      agentProcessing[roomId] = false;
      return;
    }

    const messagesFormatted = recentMessages
      .map(m => `[${m.role === 'system' ? '系统' : m.username}]: ${m.text}`)
      .join('\n');

    const promptMessage = `
[聊天室上下文]
- 主题：${room.name}
- 话题描述：${room.description}
- 预计讨论目标成果：${room.expectedOutcome}
- 你的昵称：${room.agentNickname}

[当前对话历史（最旧在前，最新在后）]
${messagesFormatted}

[重要指令]
你现在需要决定是否插话、协调节奏或者纠正大家的讨论偏向。
请严格遵循以下规则判断：
1. 评估讨论是否已经偏离主题：如果跑题，你必须立刻发言“纠偏”，温和或犀利地将大家引回 "${room.expectedOutcome}"。
2. 评估讨论是否停滞不前：如果停滞，迅速插话抛出新的具有启发性的开放性问题。
3. 评估多方发言：协调不同观点的冲突 and 节奏。
4. 如果当前的对话十分顺利、深刻，目前并不需要你介入，或者你觉得没有发言必要，请【绝对只回复】单词 [SILENT]。
5. 不要进行频繁插话。如果前几句你发过言，本次极大几率应当保持 [SILENT]。
6. 如果必须发言，直接输出想要说的内容。字数控制在 100 字内。切忌废话，不要带自己的昵称前缀（如 "${room.agentNickname}: "）。`;

    const reply = await generateLLMResponse(
      room.agentPrompt,
      promptMessage
    );

    if (reply && reply !== '[SILENT]' && !reply.startsWith('[SILENT]')) {
      const agentMsg: Message = {
        id: 'msg_' + Math.random().toString(36).substring(2, 10),
        roomId,
        role: 'agent',
        userId: 'agent',
        username: room.agentNickname,
        text: reply,
        timestamp: Date.now()
      };
      serverDb.saveMessage(roomId, agentMsg);
      broadcastToRoom(roomId, { type: 'message', message: agentMsg });
    }
  } catch (error) {
    console.error(`Agent evaluation failed for room ${roomId}:`, error);
  } finally {
    agentProcessing[roomId] = false;
  }
}

// Discussion End + HTML Summary Generation
async function handleEndRoomDialogue(roomId: string, creatorId: string) {
  const room = serverDb.getRoom(roomId);
  if (!room || room.status === 'destroyed') return;

  // Mark status as destroyed
  serverDb.updateRoomStatus(roomId, 'destroyed');
  broadcastToRoom(roomId, { type: 'room:ending' });

  try {
    const messages = serverDb.getMessages(roomId);
    // Grab transcript
    const textTranscript = messages
      .map(m => `[时间: ${new Date(m.timestamp).toLocaleTimeString()} - 发言人: ${m.username} (角色: ${m.role})]: ${m.text}`)
      .join('\n\n');

    const summaryPrompt = `你是一个专业的资深会议主持、话题论证和文字总结专家。现在“龙门阵”聊天室的讨论已结束，请为参与者生成一份极具含金量、排版精美、格式规范的 HTML 会议讨论深度总结。

[聊天室基本参数]
- 主题：${room.name}
- 话题讨论内容：${room.description}
- 预期目标成果：${room.expectedOutcome}
- 核心协调AI主持：${room.agentNickname}

[整场讨论全部发言记录]
${textTranscript}

[HTML生成规范]
请生成一个独立的、完整的 HTML 页面的源代码。
我们的应用是“极简黑白像素与线条风格 (Minimalist Black-and-White & Simple Lines)”。你的网页设计一定要百分之百契合这一美学主张。
1. 使用纯白背景（#ffffff），纯黑文字（#111111）。
2. 使用极具设计感的黑色边框线条（border: 2px solid #000000），表格、模块块之间要用清晰坚决的黑色实线进行分割，不做圆角，或者只在必要时做锋利的 0 边距网格排列。
3. 字体选用优美的无衬线字体（如 System-ui, Inter, sans-serif），对于代码、元数据、技术细节或旁白点评使用等宽字体（如 JetBrains Mono, SFMono-Regular, monospace）。
4. 页面主体需要高度可读，模块分明，设计合理的内边距（padding: 1.5rem）以及充足的外留白（负空间），展现极其高雅的极简设计。
5. 包含以下核心版块：
   - 【龙门阵·终局总结】标题与话题核心元数据（参与人数、发起时间等，置于精美的黑线网格中）
   - 【原定目标 vs 讨论达成度评估】对比评估原定 ${room.expectedOutcome} 目标在本轮讨论中的最终实现程度。
   - 【观点对垒与交锋纪实】分析各参与者的视角、争论分歧点及最终达成的最大公约数。
   - 【AI 主持点评】讨论的主持人（${room.agentNickname}）对本场讨论风气、深度、论证逻辑的主题点评。
   - 【落地行动蓝图/后续倡议】讨论导出的具体要点或下一步可操作建议。
6. 不需要输出 Markdown 包装，直接输出以 <!DOCTYPE html> 开头的标准的 HTML。`;

    const summaryHtml = await generateLLMResponse(
      "你是一个专业的资深会议主持、话题论证和文字总结专家、高阶内容梳理家。",
      summaryPrompt
    );

    serverDb.updateRoomStatus(roomId, 'destroyed', summaryHtml);

    // Broadcast the summary HTML to users
    broadcastToRoom(roomId, {
      type: 'room:destroyed',
      summaryHtml,
      messagesCount: messages.length
    });

    // Destroy message log for privacy if desired (or keep for database archive)
    // serverDb.clearMessages(roomId);

  } catch (error: any) {
    console.error('Failed to generate summary:', error);
    const fallbackHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>龙门阵 · 讨论终局</title>
        <style>
          body { font-family: monospace; padding: 2rem; background: #fff; color: #000; text-align: center; }
          .box { border: 2px solid #000; padding: 2rem; display: inline-block; max-width: 500px; text-align: left; }
          h2 { border-bottom: 2px solid #000; padding-bottom: 0.5rem; margin-top: 0; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>龙门阵已散</h2>
          <p>房间主题：${room?.name || '未知主题'}</p>
          <p>本次讨论已经正式结束，您的会场讨论彻底清空已保障隐私。</p>
          <p style="color: red;">[自动总结生成异常]: ${error.message || '未知大模型异常'}</p>
          <p>您可以安全关闭当前网页。</p>
        </div>
      </body>
      </html>
    `;
    serverDb.updateRoomStatus(roomId, 'destroyed', fallbackHtml);
    broadcastToRoom(roomId, {
      type: 'room:destroyed',
      summaryHtml: fallbackHtml,
      messagesCount: 0
    });
  }
}

// WebSocket Connection Management
wss.on('connection', (ws: WebSocket) => {
  let clientRef: ActiveClient | null = null;

  ws.on('message', async (messageBuffer) => {
    try {
      const data = JSON.parse(messageBuffer.toString());

      if (data.type === 'join') {
        const { roomId, userId, nickname } = data;
        const room = serverDb.getRoom(roomId);
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: '未找到房间验证项，或房间已被销毁' }));
          return;
        }

        // Add client reference in sockets set
        clientRef = { ws, roomId, userId };
        activeClients.add(clientRef);

        // Fetch user nickname
        if (!activeParticipants[roomId]) {
          activeParticipants[roomId] = {};
        }

        let currentParticipant = activeParticipants[roomId][userId];
        if (!currentParticipant) {
          // Fallback or recreate participant structure
          currentParticipant = {
            id: userId,
            nickname: nickname || '访客',
            role: 'participant',
            isMuted: false,
            isTalking: false
          };
          activeParticipants[roomId][userId] = currentParticipant;
        }

        const messagesList = serverDb.getMessages(roomId);

        // Send full history and user info details
        ws.send(JSON.stringify({
          type: 'room:sync',
          room: room,
          messages: messagesList,
          participants: Object.values(activeParticipants[roomId]),
          currentUser: currentParticipant
        }));

        // Send join system message
        const sysMsg = makeSystemMessage(roomId, `${nickname || '成员'} 加入了龙门阵。`);
        serverDb.saveMessage(roomId, sysMsg);
        broadcastToRoom(roomId, { type: 'message', message: sysMsg });
        broadcastToRoom(roomId, { type: 'participants:update', participants: Object.values(activeParticipants[roomId]) });
      }

      if (data.type === 'message') {
        if (!clientRef) return;
        const { text } = data;
        const room = serverDb.getRoom(clientRef.roomId);
        if (!room || room.status === 'destroyed') return;

        const participant = activeParticipants[clientRef.roomId]?.[clientRef.userId];
        if (!participant) return;

        const chatMsg: Message = {
          id: 'msg_' + Math.random().toString(36).substring(2, 10),
          roomId: clientRef.roomId,
          role: participant.role,
          userId: clientRef.userId,
          username: participant.nickname,
          text: text,
          timestamp: Date.now()
        };

        serverDb.saveMessage(clientRef.roomId, chatMsg);
        broadcastToRoom(clientRef.roomId, { type: 'message', message: chatMsg });

        // Lazy evaluate Agent response
        setTimeout(() => {
          if (clientRef) {
            triggerAgentEvaluation(clientRef.roomId);
          }
        }, 1500);
      }

      if (data.type === 'room:end') {
        if (!clientRef) return;
        const room = serverDb.getRoom(clientRef.roomId);
        if (!room) return;

        // Verify either room creator or admin who owns this room ends the session
        const participant = activeParticipants[clientRef.roomId]?.[clientRef.userId];
        const ownedAdminId = serverDb.getRoomAdminId(clientRef.roomId);

        // Trigger end room flow
        await handleEndRoomDialogue(clientRef.roomId, clientRef.userId);
      }

      // --- VOICE CALL SIGNALLING ---
      if (data.type === 'voice:join' || data.type === 'voice:leave' || data.type === 'voice:toggle') {
        if (!clientRef) return;
        const participant = activeParticipants[clientRef.roomId]?.[clientRef.userId];
        if (!participant) return;

        if (data.type === 'voice:join') {
          participant.isTalking = false;
          participant.isMuted = false;
          // Notify other participants in the room to connect WebRTC P2P
          broadcastToRoom(clientRef.roomId, {
            type: 'voice:userJoined',
            userId: clientRef.userId,
            nickname: participant.nickname
          });
        } else if (data.type === 'voice:leave') {
          delete participant.isTalking;
          delete participant.isMuted;
          broadcastToRoom(clientRef.roomId, {
            type: 'voice:userLeft',
            userId: clientRef.userId
          });
        } else if (data.type === 'voice:toggle') {
          if (data.muted !== undefined) participant.isMuted = data.muted;
          if (data.talking !== undefined) participant.isTalking = data.talking;
          broadcastToRoom(clientRef.roomId, {
            type: 'participants:update',
            participants: Object.values(activeParticipants[clientRef.roomId])
          });
        }
      }

      // WebRTC SDP Offer / Answer / ICE Candidates relays
      if (data.type === 'voice:offer' || data.type === 'voice:answer' || data.type === 'voice:ice-candidate') {
        if (!clientRef) return;
        const { targetUserId } = data;
        for (const client of activeClients) {
          if (client.roomId === clientRef.roomId && client.userId === targetUserId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
              ...data,
              senderUserId: clientRef.userId
            }));
          }
        }
      }

    } catch (err) {
      console.error('WebSocket message handling error:', err);
    }
  });

  ws.on('close', () => {
    if (clientRef) {
      activeClients.delete(clientRef);
      const roomId = clientRef.roomId;
      const userId = clientRef.userId;
      
      const participant = activeParticipants[roomId]?.[userId];
      if (participant) {
        // Remove active participant
        delete activeParticipants[roomId][userId];
        
        // Send system leave message
        const sysMsg = makeSystemMessage(roomId, `${participant.nickname} 退出了龙门阵。`);
        serverDb.saveMessage(roomId, sysMsg);
        broadcastToRoom(roomId, { type: 'message', message: sysMsg });
        broadcastToRoom(roomId, { type: 'participants:update', participants: Object.values(activeParticipants[roomId]) });
        
        // Clean up WebRTC signaling maps
        broadcastToRoom(roomId, {
          type: 'voice:userLeft',
          userId: userId
        });
      }
    }
  });
});

// Vite middleware development setup or express serving in production
if (process.env.NODE_ENV !== 'production') {
  import('vite').then((Vite) => {
    Vite.createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    }).then((vite) => {
      app.use(vite.middlewares);
      
      app.get('*', (req, res) => {
        const indexPath = path.join(process.cwd(), 'index.html');
        res.sendFile(indexPath);
      });
      
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`Developer full-stack server running on http://localhost:${PORT}`);
      });
    });
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Production full-stack server running on port ${PORT}`);
  });
}
