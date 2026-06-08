import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Trash2, Flame, Wine, FileText, CheckCircle2, Copy, Download, 
  Sparkles, Loader2, RefreshCw, Eye, Code, Play, ExternalLink, Laptop, Globe, Users 
} from 'lucide-react';
import { AgentTemplate, Message } from '../types';
import { generateClientLLMResponse, generateClientSummaryHtml } from '../llmService';

interface AgentChatProps {
  teahouseId: string;
  teahouseName: string;
  teahouseIntro: string;
  allAgents: AgentTemplate[]; // Combining both presets and custom guest agents
  activeAgentIds: string[];   // Currently checknotified agents
  userNickname: string;
  onOpenSettings: () => void;
  // External reactive action triggers passed by sidebar quick items
  triggerAction: { agentId: string; action: 'direct' | 'poke'; timestamp: number } | null;
  onClearTrigger: () => void;
}

export default function AgentChat({
  teahouseId,
  teahouseName,
  teahouseIntro,
  allAgents,
  activeAgentIds,
  userNickname,
  onOpenSettings,
  triggerAction,
  onClearTrigger
}: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinkingAgent, setThinkingAgent] = useState<string | null>(null);
  const [spicyMode, setSpicyMode] = useState(false);
  const [autoRoundtable, setAutoRoundtable] = useState(true); // Default sequence roundtable active
  const [errorMsg, setErrorMsg] = useState('');
  
  // Summary outputs
  const [summaryHtml, setSummaryHtml] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryStatusMessage, setSummaryStatusMessage] = useState('');

  // Target designated agent for focused talk
  const [designatedAgentId, setDesignatedAgentId] = useState<string | null>(null);
  
  // Track visual active tab ('text' | 'sandbox' | 'source') per chat message for HTML rendering
  const [messageViewModes, setMessageViewModes] = useState<Record<string, 'text' | 'sandbox' | 'source'>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history for THIS specific Teahouse chamber on mount & switch
  useEffect(() => {
    setSummaryHtml(null);
    setSummaryStatusMessage('');
    setDesignatedAgentId(null);
    setErrorMsg('');
    
    const historyKey = `longmenzhen_chamber_history_v2_${teahouseId}`;
    const stored = localStorage.getItem(historyKey);
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch (e) {
        setMessages(initializeWelcomeMessage());
      }
    } else {
      setMessages(initializeWelcomeMessage());
    }
  }, [teahouseId]);

  // Initial greeting sequence inside this teahouse room
  const initializeWelcomeMessage = (): Message[] => {
    const defaultGreetings: Message[] = [
      {
        id: 'init_sys_msg_' + Date.now().toString(36),
        roomId: teahouseId,
        role: 'system',
        userId: 'system_p',
        username: '茶馆小二',
        text: `【${teahouseName}】堂口起锅开气，长嘴青铜壶在白沸水中盘旋点花。${teahouseIntro}`,
        timestamp: Date.now()
      }
    ];

    // Let the first active agent offer a friendly opening banter
    const activeAgents = allAgents.filter(a => activeAgentIds.includes(a.id));
    const hostAgent = activeAgents[0] || allAgents[0];

    if (hostAgent) {
      defaultGreetings.push({
        id: 'init_host_msg_' + Date.now().toString(36),
        roomId: teahouseId,
        role: 'agent',
        userId: hostAgent.id,
        username: hostAgent.name,
        agentId: hostAgent.id,
        avatar: hostAgent.avatar,
        text: `客官吉祥！我乃『${hostAgent.name}』。本雅间今天的商谈宗旨为《${hostAgent.expectedOutcome || '探索出得体策略'}》。茶座已替您抹匀，清香盖碗茶已经焖上了。请客官尽管先丢个话头，看在野老朽、辣女掌柜和军师们如何为您各抒己见！`,
        timestamp: Date.now() + 50
      });
    }

    return defaultGreetings;
  };

  const saveHistory = (newMsgs: Message[]) => {
    setMessages(newMsgs);
    const historyKey = `longmenzhen_chamber_history_v2_${teahouseId}`;
    localStorage.setItem(historyKey, JSON.stringify(newMsgs));
  };

  // Listen to external click triggers on the sidebar ("指名提问 TA" / "请这人插嘴")
  useEffect(() => {
    if (!triggerAction) return;

    const targetAg = allAgents.find(a => a.id === triggerAction.agentId);
    if (!targetAg) {
      onClearTrigger();
      return;
    }

    if (triggerAction.action === 'direct') {
      // Focus user's prompt row exclusively on this agent
      setDesignatedAgentId(targetAg.id);
      setInputValue(`请问【${targetAg.name}】：针对... `);
      // Clean trigger queue
      onClearTrigger();
    } else if (triggerAction.action === 'poke') {
      // Poke agent to chime in immediately
      handleAgentPokeChime(targetAg);
      onClearTrigger();
    }
  }, [triggerAction, allAgents]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingAgent]);

  // Handle direct prompt submitting
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || loading) return;

    setErrorMsg('');
    const typedText = inputValue.trim();
    setInputValue('');

    const currentNick = userNickname || '阵主客官';

    const userMsg: Message = {
      id: 'msg_u_' + Date.now().toString(36),
      roomId: teahouseId,
      role: 'creator',
      userId: 'user_u',
      username: currentNick,
      text: typedText,
      timestamp: Date.now()
    };

    let updatedHistory = [...messages, userMsg];
    saveHistory(updatedHistory);
    setLoading(true);

    try {
      // Check who should respond:
      // Case 1: Designated specific agent (User focused output)
      if (designatedAgentId) {
        const targetAg = allAgents.find(a => a.id === designatedAgentId);
        if (targetAg) {
          setThinkingAgent(targetAg.name);
          const reply = await getSingleAgentResponse(targetAg, typedText, updatedHistory);
          
          const agMsg: Message = {
            id: 'msg_a_single_' + Date.now().toString(36),
            roomId: teahouseId,
            role: 'agent',
            userId: targetAg.id,
            username: targetAg.name,
            agentId: targetAg.id,
            avatar: targetAg.avatar,
            text: reply,
            timestamp: Date.now()
          };
          updatedHistory = [...updatedHistory, agMsg];
          saveHistory(updatedHistory);
        }
        // Remove special focus filter
        setDesignatedAgentId(null);
      } 
      // Case 2: Roundtable multiple responses
      else {
        // Find which agents are currently checked inside this teahouse
        const speakingAgents = allAgents.filter(a => activeAgentIds.includes(a.id));
        
        if (speakingAgents.length === 0) {
          // Fallback to everyone dormant
          const sysNotice: Message = {
            id: 'msg_sys_dormant_' + Date.now().toString(36),
            roomId: teahouseId,
            role: 'system',
            userId: 'system_p',
            username: '茶馆小二',
            text: '【茶博士温馨提点】您当前关闭了桌面上所有茶友席位，导致没人接话。可以点击左边“席位按钮”唤醒他们同桌共饮哟！',
            timestamp: Date.now()
          };
          saveHistory([...updatedHistory, sysNotice]);
        } 
        else if (!autoRoundtable || speakingAgents.length === 1) {
          // Just let the first speaking agent respond
          const speaker = speakingAgents[0];
          setThinkingAgent(speaker.name);
          const reply = await getSingleAgentResponse(speaker, typedText, updatedHistory);
          
          const agMsg: Message = {
            id: 'msg_a_' + Date.now().toString(36),
            roomId: teahouseId,
            role: 'agent',
            userId: speaker.id,
            username: speaker.name,
            agentId: speaker.id,
            avatar: speaker.avatar,
            text: reply,
            timestamp: Date.now()
          };
          saveHistory([...updatedHistory, agMsg]);
        } 
        else {
          // 👥 SEQUENCE ROUNDTABLE CYCLE MODE (自动连环开杠)
          // Each agent speaks sequentially, with the subsequent agents being aware of both user state 
          // and the previous agents' comments!
          for (let i = 0; i < speakingAgents.length; i++) {
            const speaker = speakingAgents[i];
            setThinkingAgent(speaker.name);
            
            // Build special roundtable prompt showing other agents' inputs
            const currentTurnPrompt = i === 0 
              ? typedText 
              : `（前面由于议题讨论，客官对所有人发言说: "${typedText}"。下面上一位茶友发言完毕，轮到你来进行补充或反驳交锋。请开始论证并承接前文。）`;

            const reply = await getSingleAgentResponse(speaker, currentTurnPrompt, updatedHistory);
            
            const agMsg: Message = {
              id: `msg_a_round_${i}_` + Date.now().toString(36),
              roomId: teahouseId,
              role: 'agent',
              userId: speaker.id,
              username: speaker.name,
              agentId: speaker.id,
              avatar: speaker.avatar,
              text: reply,
              timestamp: Date.now()
            };

            // Propagate forward so next in loop sees this agent's state
            updatedHistory = [...updatedHistory, agMsg];
            saveHistory(updatedHistory);
            
            // Brief visual delay between agents speaking
            await new Promise(resolve => setTimeout(resolve, 600));
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '大模型对话受到阻塞，请检查您的 API 密钥及连接端点连通性。');
      setInputValue(typedText); // Return the text so user doesn't lose it
    } finally {
      setLoading(false);
      setThinkingAgent(null);
    }
  };

  // Call API for single agent context
  const getSingleAgentResponse = async (
    agent: AgentTemplate,
    promptText: string,
    historyContext: Message[]
  ): Promise<string> => {
    // Compile system prompt instruction
    let systemInstruction = agent.systemPrompt;
    if (spicyMode) {
      systemInstruction += `\n[辣度加码特种覆盖]：现在被测客官触发了“硬核加辣挑战”！请在此段交流中，说话务必展现川渝人极其毒辣直爽、脾气急、眼里看不得伪饰的调性，字字扎在对方的逻辑软肋上，毫不留情地辩论驳斥，但必须保证核心内容是给予真知灼见的破局良策。`;
    }

    // Capture last 12 rounds of chatting
    const historyMapped = historyContext
      .filter(m => m.role !== 'system')
      .slice(-12)
      .map(m => {
        const isSelf = m.agentId === agent.id;
        return {
          role: m.role === 'creator' ? 'user' as const : 'model' as const,
          content: isSelf ? m.text : `[${m.username} 说]: ${m.text}`
        };
      });

    return generateClientLLMResponse(systemInstruction, promptText, historyMapped);
  };

  // Poke agent to chime in on active historical dialogue
  const handleAgentPokeChime = async (agent: AgentTemplate) => {
    if (loading) return;
    setErrorMsg('');
    setLoading(true);
    setThinkingAgent(agent.name);

    try {
      const specialSystemPoke = agent.systemPrompt + `\n[特别触发]: 当前议论告一段落，客官对你作了“请Ta插嘴”示意，要求你主动打破沉默，总结或对前面全桌聊的话题作出一两句幽默辛辣、高屋建瓴的短评，或者尖锐拷问！`;
      
      const historyMapped = messages
        .filter(m => m.role !== 'system')
        .slice(-12)
        .map(m => ({
          role: m.role === 'creator' ? 'user' as const : 'model' as const,
          content: `[${m.username}]: ${m.text}`
        }));

      const replyText = await generateClientLLMResponse(
        specialSystemPoke, 
        "（客官端起热茶向你致敬并作【请Ta插嘴】手势。请针对我们这桌刚才聊到的全部细节，发表一两句你的震撼弹精干妙评，或者给大伙抛出口气毒辣的思考提问！）", 
        historyMapped
      );

      const agMsg: Message = {
        id: 'msg_poke_a_' + Date.now().toString(36),
        roomId: teahouseId,
        role: 'agent',
        userId: agent.id,
        username: agent.name,
        agentId: agent.id,
        avatar: agent.avatar,
        text: replyText,
        timestamp: Date.now()
      };

      const sysNotice: Message = {
        id: 'msg_sys_poke_' + Date.now().toString(36),
        roomId: teahouseId,
        role: 'system',
        userId: 'system_p',
        username: '茶馆小二',
        text: `【茶博士浇注泉眼】请『${agent.name}』入局插话。`,
        timestamp: Date.now() - 5
      };

      saveHistory([...messages, sysNotice, agMsg]);
    } catch (err: any) {
      setErrorMsg(`插嘴点评失败: ${err.message || '请前往右上角配置密钥。'}`);
    } finally {
      setLoading(false);
      setThinkingAgent(null);
    }
  };

  // General add tea proactive (grabs random active agent to comment)
  const handleProactiveAddTea = async () => {
    const activeSpeakers = allAgents.filter(a => activeAgentIds.includes(a.id));
    const finalSpeaker = activeSpeakers[Math.floor(Math.random() * activeSpeakers.length)] || allAgents[0];
    if (finalSpeaker) {
      handleAgentPokeChime(finalSpeaker);
    }
  };

  const handleClearChat = () => {
    if (confirm('确认砸烂茶盅退桌吗？这将立刻粉碎清空当前茶轩的全部聊天痕迹（阅后即销、不留备份）。')) {
      const init = initializeWelcomeMessage();
      saveHistory(init);
      setSummaryHtml(null);
      setSummaryStatusMessage('');
      setDesignatedAgentId(null);
    }
  };

  // Compile full outcome HTML and open download using the consolidated multi-agent logs
  const handleGenerateReport = async () => {
    if (messages.length < 3) {
      alert('茶还没泡开，消息寥寥几句，大伙多唠唠几句后再结案大总结吧！');
      return;
    }

    setSummarizing(true);
    setSummaryStatusMessage('正在煮茶温酒、研磨宣纸墨汁，为您起草全雅间多茶友辩论总结...');
    setErrorMsg('');

    try {
      const conversationText = messages
        .filter(m => m.role !== 'system')
        .map(m => `[${m.username} (${m.role})]: ${m.text}`)
        .join('\n\n');

      const outcomeHtml = await generateClientSummaryHtml({
        agentName: teahouseName,
        topicName: `在『${teahouseName}』下的多客官联合辩论`,
        historyText: conversationText,
        outcomeTarget: allAgents.map(a => `${a.name}: ${a.expectedOutcome}`).join('; ')
      });

      setSummaryHtml(outcomeHtml);
      setSummaryStatusMessage('✓ 总结结案折子已雕版磨好！客官可在下方任意查看、复制源码，或直接下载在本地打开。');
    } catch (err: any) {
      setErrorMsg(`结案提炼失败: ${err.message}`);
      setSummaryStatusMessage('');
    } finally {
      setSummarizing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('极简 HTML 总结源码已成功写入剪切板！');
  };

  return (
    <div className="flex flex-col flex-grow bg-white border-4 border-black min-h-[550px] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full" id="chat_box_wrapper">
      
      {/* Active Teahouse Dashboard Header */}
      <div className="border-b-4 border-black p-4 bg-amber-50/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0" id="chat_dashboard_header">
        <div className="flex items-center gap-3">
          <span className="text-3xl bg-amber-100 border-2 border-black p-1.5 shrink-0 block">🧭</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base">{teahouseName}</h3>
              <div className="flex items-center gap-1.5 bg-neutral-900 text-white px-2 py-0.5 text-[9px] font-mono font-bold border border-black">
                <Users className="w-2.5 h-2.5" />
                <span>围炉群聊空间</span>
              </div>
            </div>
            <p className="text-[11px] text-neutral-600 mt-1 leading-snug font-sans">
              <span className="font-extrabold text-black">雅间调性：</span>{teahouseIntro}
            </p>
          </div>
        </div>

        {/* Global togglers */}
        <div className="flex items-center gap-2 flex-wrap" id="chat_top_bar_controls">
          {/* Automatically Roundtable toggler */}
          <button
            onClick={() => setAutoRoundtable(!autoRoundtable)}
            className={`flex items-center gap-1.5 border-2 border-black px-2.5 py-1 text-[10px] font-mono font-bold transition-all cursor-pointer ${
              autoRoundtable ? 'bg-amber-100 text-black shadow-[1px_1px_0px_rgba(0,0,0,1)]' : 'bg-white text-zinc-500'
            }`}
            title="自由围炉：用户开腔后，桌上所有活跃茶友将按序一人接一句连环发表见解；关闭后仅首位发言"
          >
            <span>{autoRoundtable ? '👥 自动围炉: 开启 (连环大唱)' : '👤 单独答复: 开启'}</span>
          </button>

          {/* Spicy toggle */}
          <button
            onClick={() => setSpicyMode(!spicyMode)}
            className={`flex items-center gap-1.5 border-2 border-black px-2.5 py-1 text-[10px] font-mono font-bold transition-all cursor-pointer ${
              spicyMode ? 'bg-red-500 text-white shadow-sm' : 'bg-white text-black hover:bg-neutral-50'
            }`}
            id="btn_toggle_spicy"
            title="加辣模式：点燃川渝人毒舌好辩本色，直击客官逻辑破绽进行深度论争"
          >
            <Flame className={`w-3 h-3 ${spicyMode ? 'animate-bounce fill-current' : ''}`} />
            <span>{spicyMode ? '🔥 劲辣开杠' : '🔥 注入辣味'}</span>
          </button>

          {/* Clear Room */}
          <button
            onClick={handleClearChat}
            className="border-2 border-black bg-white hover:bg-red-50 hover:text-red-700 p-1.5 text-xs font-mono font-bold transition-all cursor-pointer text-black"
            id="btn_clear_chat"
            title="砸烂茶碗，抹除此雅间全部聊天记录"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Designated Target Warning block */}
      {designatedAgentId && (
        <div className="bg-neutral-900 text-amber-300 px-4 py-2 text-[10.5px] font-mono flex items-center justify-between border-b-2 border-black" id="designated_warning_banner">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">📌</span>
            <span>
              已为您单独指定提问 <strong>『{allAgents.find(a => a.id === designatedAgentId)?.name}』</strong>，本次开杠结果将仅有 TA 对您作出专属审议。
            </span>
          </div>
          <button
            onClick={() => {
              setDesignatedAgentId(null);
              setInputValue('');
            }}
            className="text-[9px] bg-amber-400 text-black px-1.5 py-0.2 border border-black hover:bg-white transition-all cursor-pointer"
          >
            解除指名 ✕
          </button>
        </div>
      )}

      {/* Messages Scroll Output Feed */}
      <div className="flex-grow p-4 overflow-y-auto space-y-4 max-h-[380px] bg-neutral-50/50" id="message_scroller">
        {messages.map((m) => {
          if (m.role === 'system') {
            return (
              <div key={m.id} className="flex justify-center my-3.5" id={`sys_notif_${m.id}`}>
                <span className="text-[10px] font-mono text-neutral-500 bg-neutral-200/55 px-3 py-1 border border-neutral-300 rounded-none text-center max-w-xl">
                  {m.text}
                </span>
              </div>
            );
          }

          const isUser = m.role === 'creator';
          
          // Match and extract HTML blocks (e.g. for sandboxes)
          const codeBlockMatch = m.text.match(/```html([\s\S]*?)```/i);
          const hasHtmlCode = !!(codeBlockMatch && codeBlockMatch[1]);
          const extractedHtml = codeBlockMatch && codeBlockMatch[1] ? codeBlockMatch[1].trim() : '';
          
          const currentMode = messageViewModes[m.id] || 'text';

          // Inject compression for raw codeblocks to maintain clean chat reading experience
          let displayText = m.text;
          if (hasHtmlCode && currentMode === 'text') {
            displayText = m.text.replace(/```html[\s\S]*?```/gi, '\n\n【📋 网页沙箱模块已生成！点击上方「网页沙箱运行 🌐」选项卡，即可在这张对话框卡里直接试用、点选互动此原型游戏/文档设计！】\n');
          }

          return (
            <div key={m.id} className={`flex gap-3 max-w-[95%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`} id={`chat_bubble_${m.id}`}>
              
              {/* Dynamic Sender Avatar box */}
              <div className={`w-8 h-8 rounded-none border-2 border-black flex items-center justify-center shrink-0 font-bold text-sm bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>
                {isUser ? '👤' : (m.avatar || '🤖')}
              </div>

              {/* Box core contents block */}
              <div className="space-y-1 w-full max-w-full">
                <div className={`flex items-baseline gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-[10px] font-black font-sans text-neutral-800">{m.username}</span>
                  <span className="text-[8px] font-mono text-neutral-400">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Micro Tab bar for code generator models */}
                {hasHtmlCode && (
                  <div className="flex border-2 border-black divide-x-2 divide-black self-start mt-1 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-[10px] w-fit mb-1" id={`tab_bar_${m.id}`}>
                    <button
                      type="button"
                      onClick={() => setMessageViewModes(prev => ({ ...prev, [m.id]: 'text' }))}
                      className={`px-2.5 py-1 font-black cursor-pointer transition-all ${currentMode === 'text' ? 'bg-amber-100 text-black' : 'bg-white text-zinc-600'}`}
                    >
                      💬 对话论证
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessageViewModes(prev => ({ ...prev, [m.id]: 'sandbox' }))}
                      className={`px-2.5 py-1 font-black cursor-pointer transition-all flex items-center gap-1 ${currentMode === 'sandbox' ? 'bg-emerald-100 text-black animate-pulse' : 'bg-white text-zinc-600'}`}
                    >
                      🌐 网页沙箱运行
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessageViewModes(prev => ({ ...prev, [m.id]: 'source' }))}
                      className={`px-2.5 py-1 font-black cursor-pointer transition-all ${currentMode === 'source' ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-600'}`}
                    >
                      💻 源码视图
                    </button>
                  </div>
                )}
                
                {/* Mode tabs rendering switcher */}
                {currentMode === 'text' && (
                  <div className={`p-3 border-2 border-black rounded-none break-words text-xs sm:text-sm font-sans whitespace-pre-wrap leading-relaxed max-w-2xl ${
                    isUser ? 'bg-amber-100 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  }`}>
                    {displayText}
                  </div>
                )}

                {currentMode === 'sandbox' && hasHtmlCode && (
                  <div className="border-2 border-black bg-white p-1 relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full md:max-w-xl lg:max-w-2xl animate-fade-in">
                    <div className="flex justify-between items-center bg-neutral-100 p-2 border-b-2 border-black text-[10px] font-mono font-bold">
                      <span className="flex items-center gap-1 text-black">🚀 沙箱环境自主渲染运行并激活 (Running Live Sandbox)</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const win = window.open();
                            if (win) {
                              win.document.write(extractedHtml);
                              win.document.close();
                            } else {
                              alert('弹窗已拦截！请开启此页面的全屏权限。');
                            }
                          }}
                          className="px-1.5 py-0.5 border border-black bg-white hover:bg-neutral-50 text-[9px] cursor-pointer"
                        >
                          全屏独立测试 ↗
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const blob = new Blob([extractedHtml], { type: 'text/html' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `tea_sandbox_${m.id}.html`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="px-1.5 py-0.5 border border-black bg-black text-white text-[9px] cursor-pointer"
                        >
                          保存到本地 💾
                        </button>
                      </div>
                    </div>
                    <iframe
                      sandbox="allow-scripts allow-popups allow-pointer-lock"
                      srcDoc={extractedHtml}
                      className="w-full h-[380px] border-0 bg-white"
                      title={`sandbox_preview_${m.id}`}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                {currentMode === 'source' && hasHtmlCode && (
                  <div className="border-2 border-black bg-zinc-950 text-zinc-100 p-3 font-mono text-xs overflow-auto max-h-[350px] w-full md:max-w-xl lg:max-w-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex justify-between items-center text-zinc-400 border-b border-zinc-800 pb-1.5 mb-2 text-[10px]">
                      <span>SANDBOX SOURCE ({extractedHtml.length} 字节)</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(extractedHtml);
                          alert('HTML 源代码已全盘复制！');
                        }}
                        className="px-2 py-0.5 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-[9px] cursor-pointer"
                      >
                        全选复制代码
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap leading-tight text-[11px] font-mono text-emerald-300 select-all">{extractedHtml}</pre>
                  </div>
                )}

              </div>
            </div>
          );
        })}

        {/* Multi-agent consecutive loading status bubbles */}
        {loading && thinkingAgent && (
          <div className="flex gap-3 max-w-[80%] mr-auto animate-pulse" id="chat_agent_loading">
            <div className="w-8 h-8 rounded-none border-2 border-black flex items-center justify-center shrink-0 bg-white">
              🍵
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black font-sans text-neutral-600">{thinkingAgent}</span>
              <div className="p-2.5 border-2 border-black bg-neutral-100 rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 text-xs font-mono">
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>正在端杯品茶，酝酿【{thinkingAgent}】的交锋说词...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Typing & Action bar bottom cluster */}
      <div className="border-t-4 border-black p-3 bg-white shrink-0 space-y-3" id="input_panel_wrapper">
        
        {/* Quick Roundtable Actions drawer (Add water / Generate outcome summaries) */}
        <div className="flex flex-wrap gap-2 justify-between items-center bg-neutral-50 p-2 border-2 border-dashed border-black" id="action_triggers_bar">
          <button
            type="button"
            onClick={handleProactiveAddTea}
            disabled={loading}
            className="px-2.5 py-1 bg-white border-2 border-black text-[10.5px] font-mono font-black hover:bg-neutral-50 cursor-pointer disabled:opacity-50 flex items-center gap-1"
            title="催促其中一位在席茶客发言加入，打破谈话僵局"
          >
            <Wine className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>掺茶续杯 🍵 (随机催人发言)</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={summarizing || loading}
            className="px-3 py-1 bg-black text-white border-2 border-black text-[11.5px] font-mono font-black hover:bg-white hover:text-black cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            title="多茶友论点整合汇编，并下载一份高逼格折子"
          >
            {summarizing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>正在磨墨铺纸汇总...</span>
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5 text-yellow-300" />
                <span>堂前结案陈词 📜 (汇总终结大折子)</span>
              </>
            )}
          </button>
        </div>

        {/* Send message textfield form */}
        <form onSubmit={handleSendMessage} className="flex gap-2" id="chat_submit_form">
          <input
            type="text"
            placeholder={loading ? `${thinkingAgent} 整理说辞中，请客官慢用盖碗茶...` : "输入您的高论或反驳，直接开杠 (回车发送)..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={loading}
            className="flex-grow bg-white border-2 border-black p-2.5 text-xs sm:text-sm text-black focus:outline-none focus:bg-neutral-50/20"
            id="chat_input_text"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || loading}
            className="border-2 border-black bg-black hover:bg-white hover:text-black text-white px-5 py-2.5 font-bold transition-all text-xs font-mono uppercase flex items-center gap-1 cursor-pointer disabled:opacity-40"
            id="btn_send_chat_message"
          >
            <Send className="w-3.5 h-3.5" />
            <span>开杠 ⚡</span>
          </button>
        </form>

        {/* Global connection error banners */}
        {errorMsg && (
          <div className="p-2 border bg-red-50 text-red-800 border-red-300 text-xs font-mono flex flex-col md:flex-row md:items-center justify-between gap-2" id="chat_error_box">
            <p className="font-semibold">⚠️ 无法开炉: {errorMsg}</p>
            <button
              onClick={onOpenSettings}
              className="border border-black bg-black text-white text-[10px] px-2 py-0.5 font-mono cursor-pointer shrink-0 hover:bg-white hover:text-black"
            >
              立刻去右上角修补端点参数 ⚙
            </button>
          </div>
        )}

        {/* Summary output status and download file generators row */}
        {summaryStatusMessage && (
          <div className="p-2 bg-amber-50/40 border border-black text-xs font-mono space-y-2 animate-fade-in" id="summary_status_widget">
            <p className="text-neutral-800 leading-relaxed font-semibold">{summaryStatusMessage}</p>
            {summaryHtml && (
              <div className="flex gap-2 flex-wrap" id="download_actions_row">
                <button
                  onClick={() => copyToClipboard(summaryHtml)}
                  className="bg-white border border-black hover:bg-neutral-100 text-[10px] font-mono px-3 py-1 cursor-pointer flex items-center gap-1 font-bold"
                >
                  <Copy className="w-3 h-3" /> 复制 HTML 代码
                </button>
                <a
                  href={`data:text/html;charset=utf-8,${encodeURIComponent(summaryHtml)}`}
                  download={`long_men_zhen_${teahouseId}_summary.html`}
                  className="bg-neutral-900 border border-black text-white hover:bg-black text-[10px] font-mono px-3 py-1 cursor-pointer flex items-center gap-1 font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <Download className="w-3 h-3 text-white" /> 下载 HTML 结案折页.html
                </a>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
