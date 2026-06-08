import React, { useState, useEffect, useRef } from 'react';
import { Send, LogOut, Users, Mic, MicOff, Volume2, Shield, Swords, Sparkles, CheckCircle2, Download, Info, RefreshCw, Loader2 } from 'lucide-react';
import { Room, Message, Participant } from '../types';

interface RoomActiveProps {
  roomId: string;
  initialPassword?: string;
  userNickname: string;
  userRole: 'creator' | 'participant';
  onExit: () => void;
}

const getInitials = (name: string, isAgent: boolean) => {
  if (isAgent) return 'AI';
  if (!name) return '??';
  const clean = name.trim();
  if (/[\u4e00-\u9fa5]/.test(clean)) {
    return clean.slice(0, 2);
  }
  const parts = clean.split(/[\s_\-]+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
};

export default function RoomActive({ roomId, initialPassword = '', userNickname, userRole, onExit }: RoomActiveProps) {
  // Join verification stage if joining via link with unknown password
  const [password, setPassword] = useState(initialPassword);
  const [nickname, setNickname] = useState(userNickname);
  const [isJoined, setIsJoined] = useState(!!initialPassword && !!userNickname);
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  // Active chat state
  const [roomMetadata, setRoomMetadata] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUser, setCurrentUser] = useState<Participant | null>(null);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  // Speech-to-Text Dictation options
  const [isDictating, setIsDictating] = useState(false);
  const [dictationError, setDictationError] = useState('');

  // Suffix/Summary
  const [roomEnding, setRoomEnding] = useState(false);
  const [summaryHtml, setSummaryHtml] = useState('');
  const [downloadCounting, setDownloadCounting] = useState(0);

  // References
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Audio Visual References (For dictation sound wave representation)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 1. Fetch Room Metadata on load
  useEffect(() => {
    fetchRoomInfo();
  }, [roomId]);

  const fetchRoomInfo = async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      const data = await res.json();
      if (res.ok) {
        setRoomMetadata(data.room);
      } else {
        setJoinError(data.error || '未找到该聊天室背景；可能该龙门阵已散并自动销毁');
      }
    } catch (err) {
      setJoinError('无法加载聊天室元数据，请检查网路连接');
    }
  };

  // 2. Perform joining auth handler
  const handleJoinAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setJoinError('请输入房间密码');
      return;
    }
    if (!nickname.trim()) {
      setJoinError('请输入参会昵称');
      return;
    }
    setJoinLoading(true);
    setJoinError('');

    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: password.trim(),
          nickname: nickname.trim(),
          role: userRole
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser(data.participant);
        setIsJoined(true);
      } else {
        setJoinError(data.error || '密码或账户验证失败，请重试');
      }
    } catch (err) {
      setJoinError('服务器无响应，请确保后台配置的大模型 API key 已生效并且服务正常');
    } finally {
      setJoinLoading(false);
    }
  };

  // 3. Connect to WebSocket after authenticated joining
  useEffect(() => {
    if (!isJoined || !nickname || !password) return;

    // Use current location origin to connect securely
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      // Join Room through socket
      socket.send(JSON.stringify({
        type: 'join',
        roomId,
        userId: currentUser?.id || 'usr_temp_' + Math.random().toString(36).substring(2, 6),
        nickname: nickname.trim()
      }));
    };

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'error') {
        setJoinError(data.message);
        setIsJoined(false);
      }

      if (data.type === 'room:sync') {
        setMessages(data.messages);
        setParticipants(data.participants);
        if (data.currentUser) {
          setCurrentUser(data.currentUser);
        }
        if (data.room) {
          setRoomMetadata(data.room);
        }
      }

      if (data.type === 'message') {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }

      if (data.type === 'participants:update') {
        setParticipants(data.participants);
        if (currentUser) {
          const updatedSelf = data.participants.find((p: Participant) => p.id === currentUser.id);
          if (updatedSelf) setCurrentUser(updatedSelf);
        }
      }

      if (data.type === 'room:ending') {
        setRoomEnding(true);
      }

      if (data.type === 'room:destroyed') {
        setSummaryHtml(data.summaryHtml);
        setDownloadCounting(data.messagesCount);
        setRoomEnding(false);
        // Safely stop dictation
        stopDictation();
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    socket.onerror = (e) => {
      console.error('Socket encounter error:', e);
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      stopDictation();
    };
  }, [isJoined]);

  // Audio scrolling helper
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send single text message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    socketRef.current.send(JSON.stringify({
      type: 'message',
      text: inputText.trim()
    }));
    setInputText('');
  };

  // Creator Ends Dialog Flow
  const handleEndDialogue = () => {
    if (confirm('确认结束本场龙门阵？\n这将立刻自动生成会议总结分发给所有人，并彻底销毁全部实时聊天历史，保障极高隐私权！')) {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'room:end'
        }));
      }
    }
  };

  // --- Speech Dictation / Voice Input System ---
  const startDictation = () => {
    setDictationError('');
    setIsDictating(true);

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setDictationError('您的浏览器未启用 Web Speech API 音频识别。建议在 Chrome/Edge 中打开体验！');
      setIsDictating(false);
      return;
    }

    try {
      const rec = new SpeechRecognitionClass();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'zh-CN';

      rec.onstart = () => {
        setIsDictating(true);
        drawSimulatedWaveform();
      };

      rec.onresult = (event: any) => {
        let finalResult = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalResult += event.results[i][0].transcript;
          }
        }
        if (finalResult) {
          setInputText(prev => prev + finalResult);
        }
      };

      rec.onerror = (err: any) => {
        console.error('Speech recognition error:', err);
        if (err.error === 'not-allowed') {
          setDictationError('麦克风访问被拒绝，请在地址栏启用权限。');
        } else {
          setDictationError(`识别中断: ${err.error || '未知情况'}`);
        }
        setIsDictating(false);
        stopVisuals();
      };

      rec.onend = () => {
        setIsDictating(false);
        stopVisuals();
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e: any) {
      setDictationError('启动语音识能失败: ' + e.message);
      setIsDictating(false);
    }
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {}
      recognitionRef.current = null;
    }
    setIsDictating(false);
    stopVisuals();
  };

  const stopVisuals = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const drawSimulatedWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let offset = 0;
    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      // Symmetrical line sound wave
      for (let x = 0; x < canvas.width; x += 4) {
        const angle = (x / canvas.width) * Math.PI * 4 + offset;
        const amplitude = Math.sin(offset * 2.5) * 8 + 10;
        const yHeight = Math.sin(angle) * amplitude;
        
        ctx.moveTo(x, canvas.height / 2 - yHeight / 2);
        ctx.lineTo(x, canvas.height / 2 + yHeight / 2);
      }
      ctx.stroke();
      offset += 0.08;
    };
    draw();
  };

  // Helpers to copy invitation links
  const [copyStatus, setCopyStatus] = useState('口令链接已就绪 · 点击复制');
  const copyInviteLink = () => {
    const joinUrl = `${window.location.origin}${window.location.pathname}?roomId=${roomId}`;
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopyStatus('已复制到剪贴板！');
      setTimeout(() => setCopyStatus('复制链接'), 2000);
    });
  };

  // Format timestamp helper
  const getFormattedTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Download summary HTML helper
  const handleExportSummary = () => {
    window.open(`/api/rooms/${roomId}/summary`, '_blank');
  };

  return (
    <div className="w-full flex flex-col h-[calc(100vh-100px)] border-2 border-black bg-white" id="room_active_container">
      {/* 1. Enter Verification Stage */}
      {!isJoined && (
        <div className="flex-1 flex items-center justify-center p-4" id="join_auth_grid">
          <div className="border-2 border-black max-w-sm w-full p-6 bg-white shrink-0" id="join_auth_card">
            <h3 className="text-xl font-extrabold pb-2 border-b-2 border-black uppercase text-black font-mono">
              龙门阵 · 接入密匙
            </h3>
            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
              您将进入一场高隐私等级的加密研讨沙龙。开始之前，请输入本场主持的验证密码和个人的昵称代号。
            </p>

            <form onSubmit={handleJoinAuth} className="space-y-4 mt-4" id="join_auth_form">
              <div>
                <label className="block text-[11px] font-mono font-bold mb-1 uppercase text-black">入阵密钥匙 (Password)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入管理者设定的密码"
                  className="w-full bg-white border-2 border-black p-2 text-sm text-black focus:outline-none font-mono"
                  id="auth_password_input"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold mb-1 uppercase text-black">个人名号/昵称 (Nickname)</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="例: 文人墨客、匿名道友"
                  className="w-full bg-white border-2 border-black p-2 text-sm text-black focus:outline-none"
                  id="auth_nickname_input"
                  required
                />
              </div>

              {joinError && (
                <div className="p-2 border border-black bg-red-50 text-red-800 text-xs font-mono" id="join_auth_err">
                  {joinError}
                </div>
              )}

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={onExit}
                  className="px-4 py-2 text-xs font-bold border-2 border-black hover:bg-neutral-100 transition-all text-black cursor-pointer"
                  id="btn_back_from_auth"
                >
                  放弃返回
                </button>
                <button
                  type="submit"
                  disabled={joinLoading}
                  className="px-4 py-2 text-xs font-bold border-2 border-black bg-black text-white hover:bg-white hover:text-black transition-all cursor-pointer disabled:opacity-50"
                  id="btn_submit_auth"
                >
                  {joinLoading ? '验证密匙中...' : '核对并加入'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Chatroom Core Layout */}
      {isJoined && (
        <div className="flex-1 flex flex-col md:flex-row divide-y-2 md:divide-y-0 md:divide-x-2 divide-black h-full relative" id="grid_active_workspace">
          
          {/* Main Chat Stream Section */}
          <div className="flex-1 flex flex-col h-full bg-white" id="box_chat_stream_panel">
            {/* Upper Action Bar */}
            <div className="p-4 border-b-2 border-black flex justify-between items-center bg-white shrink-0" id="chat_stream_actionbar">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="w-2.5 h-2.5 bg-green-600 rounded-full inline-block shrink-0 animate-ping"></span>
                <h2 className="text-base font-extrabold tracking-tight text-black truncate font-sans">
                  {roomMetadata?.name || '龙门阵研讨中'}
                </h2>
                <span className="text-[10px] font-mono border border-black px-1.5 py-0.5 uppercase bg-black text-white shrink-0">
                  {isConnected ? '加密连接' : '掉线重连'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyInviteLink}
                  className="text-xs font-mono border-2 border-black px-2 py-1 text-black hover:bg-neutral-100 transition-all cursor-pointer hidden sm:inline-block"
                  id="btn_copy_invite"
                >
                  {copyStatus}
                </button>
                {userRole === 'creator' && (
                  <button
                    onClick={handleEndDialogue}
                    className="text-xs font-bold border-2 border-black bg-black text-white hover:bg-red-500 hover:text-white px-3 py-1 transition-all cursor-pointer"
                    id="btn_terminate_session"
                  >
                    结束对话 ✕
                  </button>
                )}
                <button
                  onClick={onExit}
                  className="text-xs border-2 border-black p-1 text-black hover:bg-neutral-100 transition-all cursor-pointer"
                  id="btn_room_signout"
                  title="离开房间"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Room Banner description - Artistic Flair Style */}
            {roomMetadata?.description && (
              <div className="bg-neutral-50 px-4 py-3 border-b-2 border-black text-xs text-neutral-800 flex flex-col sm:flex-row gap-3 overflow-hidden shrink-0" id="chat_room_purpose">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase font-black tracking-wider text-black">TOPIC & DEFINITION (研讨主题与定义)</p>
                  <p className="truncate italic font-medium mt-0.5 text-black">"{roomMetadata.description}"</p>
                </div>
                <div className="sm:border-l-2 border-t sm:border-t-0 border-black pt-1.5 sm:pt-0 sm:pl-4 w-full sm:w-72">
                  <p className="text-[10px] uppercase font-black tracking-wider text-black">OUTCOME GOAL (期望交付成果)</p>
                  <p className="truncate font-mono text-xs font-bold mt-0.5 text-sky-950">{roomMetadata.expectedOutcome}</p>
                </div>
              </div>
            )}

            {/* Real messages list container */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[calc(100vh-270px)] md:max-h-[calc(100vh-270px)] min-h-[150px] bg-white divide-y divide-dashed divide-neutral-200" id="chat_view_scroller">
              {messages.length === 0 && (
                <div className="text-center py-10 space-y-2" id="chat_history_empty">
                  <p className="text-sm font-mono text-neutral-400">一 龙门阵已亮起火烛，等候各位入阵言谈 一</p>
                  <p className="text-xs text-neutral-400 font-mono">任何发言和文字都将暂存于服务器内存，在会话拆台后随风消尽。</p>
                </div>
              )}
              {messages.map((msg, idx) => {
                const isSelf = msg.userId === currentUser?.id;
                const isSystem = msg.role === 'system';
                const isAgent = msg.role === 'agent';
                
                if (isSystem) {
                  return (
                    <div key={msg.id} className="pt-3 text-center" id={`msg_wrap_${msg.id}`}>
                      <span className="inline-block bg-neutral-100 border-2 border-black text-[10px] font-mono text-neutral-600 px-3 py-1 font-bold">
                        {getFormattedTime(msg.timestamp)} • {msg.text}
                      </span>
                    </div>
                  );
                }

                const initials = getInitials(msg.username || (isAgent ? 'AI' : '??'), isAgent);

                return (
                  <div
                    key={msg.id}
                    className={`pt-6 pb-2 flex gap-4 ${isSelf ? 'flex-row-reverse' : 'flex-row'} items-start w-full`}
                    id={`msg_wrap_${msg.id}`}
                  >
                    {/* Avatar Initials Frame - Brutalist Grid Box */}
                    <div className={`w-10 h-10 font-bold font-mono text-xs tracking-tight shrink-0 flex items-center justify-center border-2 border-black ${
                      isAgent ? 'bg-black text-white' : 'bg-white text-black'
                    }`}>
                      {initials}
                    </div>

                    {/* Chat Text Bubble Layout */}
                    <div className={`space-y-1.5 max-w-[75%] ${isSelf ? 'text-right' : 'text-left'}`}>
                      <p className="text-[10px] font-black uppercase tracking-wider text-black font-mono flex items-center gap-1.5 justify-start">
                        {isAgent ? (
                          <span className="bg-black text-white px-1.5 py-0.5 border-2 border-black font-bold flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-white stroke-[2.5]" />
                            AGENT: {msg.username}
                          </span>
                        ) : (
                          <span className="font-bold underline">{msg.username}</span>
                        )}
                        {msg.role === 'creator' && (
                          <span className="border-2 border-black px-1 text-[9px] bg-neutral-100 font-bold text-black uppercase">
                            HOST (发起人)
                          </span>
                        )}
                        <span className="font-normal opacity-55 text-[9px]">{getFormattedTime(msg.timestamp)}</span>
                      </p>
                      
                      <div className={`p-3 border-2 border-black inline-block text-left ${
                        isSelf 
                          ? 'bg-neutral-50 text-black' 
                          : isAgent 
                          ? 'bg-neutral-50 border-double border-4 text-black' 
                          : 'bg-white text-black'
                      }`}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap font-sans">{msg.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input form controller */}
            <form onSubmit={handleSendMessage} className="p-4 border-t-2 border-black flex gap-2 bg-white shrink-0" id="chat_active_input_bar">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={roomEnding ? '正在生成深度讨论总结，请稍候...' : '围炉夜话、直抒胸臆...（点击发送）'}
                disabled={roomEnding}
                className="flex-1 bg-white border-2 border-black p-3 text-sm focus:outline-none focus:bg-neutral-50 placeholder-neutral-400 text-black text-xs sm:text-sm"
                id="message_text_input"
              />
              <button
                type="submit"
                disabled={roomEnding || !inputText.trim()}
                className="border-2 border-black bg-black text-white px-5 hover:bg-white hover:text-black transition-all flex items-center justify-center cursor-pointer disabled:opacity-40"
                id="btn_send_message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Sidebar Area: Participants, Voice, and Admin Controls */}
          <div className="w-full md:w-64 h-auto md:h-full bg-white flex flex-col divide-y-2 divide-black shrink-0" id="box_active_sidebar_panel">
            
            {/* Speech-to-Text Voice Dictation Controller */}
            <div className="p-4 space-y-3 bg-white" id="voice_chat_controller">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black flex items-center gap-1">
                <Mic className="w-4 h-4 text-black animate-pulse" />
                语音输入听写 (STT Dictation)
              </h3>
 
              <div className="border border-black p-3 flex flex-col items-center justify-center text-center space-y-2 bg-neutral-50">
                <canvas
                  ref={canvasRef}
                  width={150}
                  height={40}
                  className="w-full h-10 border border-black/30 bg-white"
                  title="语音输入波动监控"
                />
 
                {isDictating ? (
                  <div className="space-y-2 w-full animate-fade-in" id="voice_actions_row">
                    <p className="text-[10px] text-green-700 font-mono font-bold flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-650 animate-ping"></span>
                      ✓ 正在聆听您的声音 (实时听写中)...
                    </p>
                    <button
                      type="button"
                      onClick={stopDictation}
                      className="w-full border bg-black text-white text-xs font-mono font-bold py-2 hover:bg-white hover:text-black transition-all cursor-pointer flex items-center justify-center gap-1"
                      id="btn_quit_voice"
                    >
                      <MicOff className="w-3.5 h-3.5" />
                      <span>停止录音并保留文字</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1 w-full" id="voice_inactive_row">
                    <p className="text-[10px] text-neutral-400 font-mono leading-tight">
                      点击开启麦克风，您说的话将自动转化为文字填入输入框。
                    </p>
                    <button
                      type="button"
                      onClick={startDictation}
                      className="w-full border-2 border-black bg-white text-black text-xs font-bold py-2 hover:bg-black hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      id="btn_join_voice"
                    >
                      <Mic className="w-4 h-4 text-black" />
                      <span>开始语音听写输入</span>
                    </button>
                  </div>
                )}
 
                {dictationError && (
                  <p className="text-[9px] text-red-650 font-mono text-left leading-tight mt-1">
                    ! {dictationError}
                  </p>
                )}
              </div>
            </div>

            {/* Participants Status List */}
            <div className="p-4 space-y-2 flex-grow overflow-y-auto max-h-[220px] md:max-h-none" id="participants_list_box">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black flex items-center gap-1 shrink-0 pb-1 border-b border-black">
                <Users className="w-4 h-4 text-black" />
                入阵群英录 ({participants.length} 人)
              </h3>

              <div className="space-y-1" id="participants_grid">
                {participants.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center justify-between p-1.5 border border-black/10 text-xs hover:bg-neutral-50 transition-all font-mono"
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className={`w-2 h-2 shrink-0 ${person.role === 'creator' ? 'bg-black' : 'bg-neutral-400'}`}></span>
                      <span className="font-semibold text-black truncate">{person.nickname}</span>
                      {person.id === currentUser?.id && <span className="text-[10px] text-neutral-400 font-normal shrink-0">(自己)</span>}
                    </div>

                    <div className="flex gap-1 shrink-0">
                      {person.isMuted && <span className="text-[10px] bg-red-50 border border-red-500 text-red-700 px-1">静音</span>}
                      {person.isTalking && <span className="text-[10px] bg-green-50 border border-green-500 text-green-700 px-1 animate-pulse">说话中</span>}
                      {person.role === 'creator' && <span className="text-[9px] border border-black px-1 bg-neutral-150">主</span>}
                    </div>
                  </div>
                ))}

                {/* AI Agent Item inside roster */}
                {roomMetadata && (
                  <div className="flex items-center justify-between p-1.5 border border-black/40 bg-neutral-50 text-xs font-mono">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <Sparkles className="w-3.5 h-3.5 stroke-[2] text-black shrink-0" />
                      <span className="font-bold text-black truncate">{roomMetadata.agentNickname}</span>
                    </div>
                    <span className="text-[9px] border border-black bg-black text-white px-1">AI 助理</span>
                  </div>
                )}
              </div>
            </div>

            {/* Privacy reminder footer */}
            <div className="p-4 space-y-1 bg-white shrink-0 hidden md:block" id="privacy_reminder_badge">
              <div className="flex items-center gap-1 text-[10px] font-bold text-black uppercase font-mono">
                <Shield className="w-3.5 h-3.5 text-black" />
                <span>龙门保密协议已生效</span>
              </div>
              <p className="text-[9px] text-neutral-400 leading-normal">
                对话全程暂存于极速内存区。发起人点击【结束对话】之后，整场聊天记录将被完全擦除。
              </p>
            </div>
            
          </div>
        </div>
      )}

      {/* 3. Generating summary progress fullscreen overlay */}
      {roomEnding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="loading_ending_barrier">
          <div className="bg-white border-2 border-black max-w-sm w-full p-6 text-center space-y-4" id="ending_feedback_card">
            <Loader2 className="w-10 h-10 animate-spin text-black mx-auto" />
            <h3 className="text-lg font-extrabold text-black font-sans uppercase">
              龙门阵收官 · 正在撰写深度终局报告
            </h3>
            <p className="text-xs text-neutral-500 font-mono leading-relaxed">
              Gemini 3.5 Flash 智能化主笔正在深度剖析本次会谈纪要。我们将对立场交锋、达成的共识目标以及关键意见进行网格化 HTML 输出。
            </p>
            <p className="text-[10px] text-neutral-400 font-mono">
              * 正文字数较多时，可能需等待 5-10 秒，聊天历史数据即刻物理销毁。
            </p>
          </div>
        </div>
      )}

      {/* 4. Dialogue end state summary full visual representation popup */}
      {summaryHtml && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in" id="summary_full_overlay">
          <div className="bg-white border-4 border-black max-w-4xl w-full h-[85vh] flex flex-col p-6 relative" id="summary_full_card">
            
            {/* Heading row */}
            <div className="pb-4 border-b-2 border-black flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0" id="summary_output_header">
              <div>
                <span className="text-[10px] font-mono border border-black bg-black text-white px-2 py-0.5 uppercase">
                  龙门阵 · 终局研讨报告
                </span>
                <h2 className="text-2xl font-black text-black tracking-tight font-sans mt-1">
                  《{roomMetadata?.name || '无标题会议'}》深度论证报告
                </h2>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleExportSummary}
                  className="px-3 py-1.5 border-2 border-black bg-black text-white font-mono text-xs hover:bg-white hover:text-black transition-all flex items-center gap-1.5 cursor-pointer"
                  id="btn_download_summary"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>导出 html 文件</span>
                </button>
                <button
                  onClick={onExit}
                  className="px-3 py-1.5 border-2 border-black bg-white text-black font-bold text-xs hover:bg-neutral-100 transition-all cursor-pointer"
                  id="btn_confirm_close_summary"
                >
                  彻底关闭并安全销毁
                </button>
              </div>
            </div>

            {/* Inner iframe representation containing the stunning Gemini-compiled HTML summary */}
            <div className="flex-grow my-4 border-2 border-black bg-neutral-50 overflow-hidden" id="summary_iframe_box">
              <iframe
                title="龙门阵终局深度总结HTML"
                srcDoc={summaryHtml}
                referrerPolicy="no-referrer"
                className="w-full h-full bg-white border-0"
                id="summary_rendered_iframe"
              />
            </div>

            {/* Footer feedback */}
            <div className="pt-2 border-t border-black text-[10px] text-neutral-400 font-mono flex justify-between shrink-0" id="summary_output_footer">
              <span>* 该 HTML 页面符合极简黑白像素网格规范，包含内置美学 CSS 样式，离线也能无障碍阅读。</span>
              <span className="text-red-700">✓ 共清退 {downloadCounting} 条消息记录 · 物理数据销毁完毕</span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
