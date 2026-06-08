import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Trash2, Flame, Wine, FileText, CheckCircle2, Copy, Download, 
  Sparkles, Loader2, RefreshCw, Eye, Code, Play, ExternalLink, Laptop, Globe, Users, HelpCircle 
} from 'lucide-react';
import { AgentTemplate, Message } from '../types';
import { generateClientLLMResponse, generateClientSummaryHtml } from '../llmService';
import { PRESET_TEAHOUSES } from '../data/teahouseData';

interface AgentChatProps {
  teahouseId: string;
  teahouseName: string;
  teahouseIntro: string;
  allAgents: AgentTemplate[]; // Combining both presets and custom guest agents
  activeAgentIds: string[];   // Currently checked agents
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
  const [autoRoundtable, setAutoRoundtable] = useState(true); // Now serves as Host dispatch toggle or kept for backward-compatibility
  const [errorMsg, setErrorMsg] = useState('');

  // Real-time Token & Char Optimizations Tracker
  const [totalSavedChars, setTotalSavedChars] = useState(0);

  useEffect(() => {
    const updateStats = () => {
      const stored = parseInt(localStorage.getItem('longmenzhen_total_chars_saved') || '0', 10);
      setTotalSavedChars(stored);
    };
    updateStats();
    const statsTimer = setInterval(updateStats, 2000);
    return () => clearInterval(statsTimer);
  }, []);
  
  // Custom Host details
  const activeTeahouse = PRESET_TEAHOUSES.find(t => t.id === teahouseId);
  const currentHost = activeTeahouse?.host || {
    id: 'host_fallback',
    name: '茶馆馆长',
    avatar: '🤵',
    role: '司茶 / 雅间调度人',
    description: '茶馆掌门人，热心协调、倒茶调度并引导聊天话题。',
    systemPrompt: '你是一位热心的茶铺掌门，调度各位席上茶友。'
  };

  // Guided Topics State
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [lastInteractionTime, setLastInteractionTime] = useState<number>(Date.now());
  const [isIdle, setIsIdle] = useState(false);

  // Summary outputs
  const [summaryHtml, setSummaryHtml] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryStatusMessage, setSummaryStatusMessage] = useState('');

  // Target designated agent for focused talk
  const [designatedAgentId, setDesignatedAgentId] = useState<string | null>(null);
  
  // Track visual active tab ('text' | 'sandbox' | 'source') per chat message for HTML rendering
  const [messageViewModes, setMessageViewModes] = useState<Record<string, 'text' | 'sandbox' | 'source'>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const initializeWelcomeMessage = (): Message[] => {
    return [
      {
        id: 'init_sys_msg_' + Date.now().toString(36),
        roomId: teahouseId,
        role: 'system',
        userId: 'system_p',
        username: '茶馆小二',
        text: `【${teahouseName}】堂口起锅开气，长嘴青铜壶在白沸水中盘旋点花。${teahouseIntro}\n\n💡 席上已为您备好数位各有绝活的茶友，勾选激活他们并提问，即可开始精彩漫漫。`,
        timestamp: Date.now()
      }
    ];
  };

  const saveHistory = (newMsgs: Message[]) => {
    setMessages(newMsgs);
    const historyKey = `longmenzhen_chamber_history_v2_${teahouseId}`;
    localStorage.setItem(historyKey, JSON.stringify(newMsgs));
  };

  // Load chat history for THIS specific Teahouse chamber on mount & switch
  useEffect(() => {
    setSummaryHtml(null);
    setSummaryStatusMessage('');
    setDesignatedAgentId(null);
    setErrorMsg('');
    setLastInteractionTime(Date.now());
    setIsIdle(false);
    
    // Set Default suggestions immediately based on the room
    if (teahouseId === 'th_jinli_memory') {
      setSuggestions([
        '请说书老秀才摆一摆成都街巷的奇闻趣事，清清脑壳 👴🏽',
        '请辣掌柜算一算，我这不温不火的性子如何生财破局 👩🏻‍🍳',
        '听隐世军师解一解，道家如何借太极“无为”卸掉当下的苦闷 🧘‍♂️'
      ]);
    } else if (teahouseId === 'th_cyber_silicon') {
      setSuggestions([
        '叫赛博极客代码侠给我现场搓一个好玩的可视化交互网页原型 🧙‍♂️',
        '呼唤红杉创投硬核心帮我算一算这个方向的付费转化率与生命周期价值 👩🏻‍💼',
        '听智脑分析姬梳理整个业务流和并发瓶颈，找技术死穴 🦾'
      ]);
    } else {
      setSuggestions([
        '叫太极道长现场展示肩颈舒展与一分钟太极安神打坐法 📿',
        '请识药小药童为我调配一剂防熬夜脱发和护肝明目的盖碗茶方 🌿',
        '请梅花易占师起一个易数吉凶卦，推演当前焦虑行止的周流之变 🌌'
      ]);
    }

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

  // Idle detection effect to show conversational suggestions proactively after 45 seconds of silence
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastInteractionTime;
      if (elapsed > 45000) {
        setIsIdle(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [lastInteractionTime]);

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

  // Handle direct prompt submitting or trigger-based input
  const handleSendMessage = async (e?: React.FormEvent, directText?: string) => {
    if (e) e.preventDefault();
    
    const rawInput = directText !== undefined ? directText : inputValue;
    if (!rawInput.trim() || loading) return;

    setErrorMsg('');
    const typedText = rawInput.trim();
    if (directText === undefined) {
      setInputValue('');
    }

    // Reset idle timers
    setLastInteractionTime(Date.now());
    setIsIdle(false);

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
      // Case 1: Designated specific agent (User clicked "指指名提问")
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
        // Remove focus filter
        setDesignatedAgentId(null);
      } 
      // Case 2: 🤵🏽 HOST INTERACTING & INTELLIGENT DISPATCHING CHRONICLE
      else {
        // Find which agents are currently checked inside this teahouse room
        const speakingAgents = allAgents.filter(a => activeAgentIds.includes(a.id));
        
        // Define Host thinking visual while determining routing
        setThinkingAgent(`${currentHost.name} (司茶调度中...)`);

        // Format history context for Host
        const hostHistoryContext = updatedHistory
          .filter(m => m.role !== 'system')
          .slice(-10)
          .map(m => {
            return {
              role: m.role === 'creator' ? 'user' as const : 'model' as const,
              content: `[${m.username}]: ${m.text}`
            };
          });

        if (speakingAgents.length === 0) {
          // Rescue/圆场: Since no other guests are active, the host comes to the rescue to answer directly in chat
          let hostSystemPromptRescue = `${currentHost.systemPrompt}
【重要圆场指令】：
当前雅间里的茶友席位均为空席（客官关闭了座位上所有的茶客），雅间内目前没有在席茶客。
你作为雅间大堂调度堂倌/主控，必须亲自出来“圆场接客”，以你极具个性的人物语调和智慧给客官进行风趣温馨的直接答复（控制在 120 字内）。
并同时在末尾附带 “---SUGGESTIONS---” 标识及 3 个全新追问。

【圆场输出格式模板】：
[你独特的风趣解答与圆场温茶词，控制在 100 字内。绝对不要使用 Markdown 标题，直接段落陈述。]

---SUGGESTIONS---
- [全新交互追问话题 1]
- [全新交互追问话题 2]
- [全新交互追问话题 3]`;

          let hostRescueResponse = '';
          try {
            hostRescueResponse = await generateClientLLMResponse(
              hostSystemPromptRescue,
              `客官最新言论：“${typedText}”\n有请调度！`,
              hostHistoryContext
            );
          } catch (err: any) {
            console.error("Rescue host error:", err);
            hostRescueResponse = `哎呀，茶水滚烫，客官抛出开板高见，瞧把人都说愣了！既然大家还没落座，二娃先给您掺一碗盖碗茶！您可点击下方推荐的话题把高人们唤醒共同开杠。`;
          }

          const suggestionsRegex = /---SUGGESTIONS---([\s\S]*?)$/i;
          const suggestionsMatch = hostRescueResponse.match(suggestionsRegex);
          let parsedHostComment = hostRescueResponse.split(/---SUGGESTIONS---/i)[0]?.trim() || '';
          parsedHostComment = parsedHostComment.replace(/#+\s+/g, '').replace(/[\*\_]/g, '').trim();

          let parsedSuggestions: string[] = [];
          if (suggestionsMatch && suggestionsMatch[1]) {
            parsedSuggestions = suggestionsMatch[1]
              .split('\n')
              .map(s => s.trim().replace(/^[-*\d\.\s]+/, ''))
              .filter(s => s.length > 3 && s.length < 60);
          }
          if (parsedSuggestions.length >= 2) {
            setSuggestions(parsedSuggestions.slice(0, 3));
          }

          // Append Host Rescue Msg (the only time the host posts a visible chat bubble!)
          const hostMsg: Message = {
            id: 'msg_host_rescue_' + Date.now().toString(36),
            roomId: teahouseId,
            role: 'agent',
            userId: currentHost.id,
            username: currentHost.name,
            agentId: currentHost.id,
            avatar: currentHost.avatar,
            text: parsedHostComment,
            timestamp: Date.now()
          };

          updatedHistory = [...updatedHistory, hostMsg];
          saveHistory(updatedHistory);
        } else {
          // Normal conversation: Host operates silently behind the scenes.
          const speakingAgentsLabel = speakingAgents
            .map(a => `ID: "${a.id}" (名称: ${a.name}, 擅长: ${a.expectedOutcome})`)
            .join('\n');

          let hostSystemPromptDispatch = `【设定与背景】：
你目前担任雅间主持人/司茶总调度（“${currentHost.name}”）。
你的重要职责是：
1. 分析客官最新的输入：“${typedText}”；
2. 分析当前话题，在目前在座的合格茶客列表中，挑选出应该发言的茶客。
${autoRoundtable ? '当前由于开启了“自动围炉(连环大唱)”多茶友讨论模式，请挑选【1个至 3个】最相关的茶客，按答复顺序以英文逗号分隔输出 ID。' : '当前为单独答复模式，请挑选【唯一 1 位】最适宜出来作答的茶客 ID。'}

【当前可被调度的合格茶客列表】：
${speakingAgentsLabel}

【你需要计算并输出的具体格式说明】：
你必须且只能以下列精确的格式结构输出，不要包含多余的排版或包装词：

---DISPATCH---
[拼写完全精确的 1 或多个在席茶客 Agent ID，若有多个，采用英文逗号分隔。例如: ${speakingAgents[0]?.id || ''}${autoRoundtable && speakingAgents[1] ? ',' + speakingAgents[1].id : ''}]

---SUGGESTIONS---
- [针对客官当前聊的话题，写出第 1 个供客官下一步点击继续聊的灵感追问，不超过35字]
- [针对当前话题，写出第 2 个点击追问，不超过35字]
- [针对当前话题，写出第 3 个点击追问，不超过35字]`;

          let hostResponse = '';
          try {
            hostResponse = await generateClientLLMResponse(
              hostSystemPromptDispatch,
              `客官最新言论：“${typedText}”\n有请调度！`,
              hostHistoryContext
            );
          } catch (err: any) {
            console.error("Host dispatch background error:", err);
            const defaultId = speakingAgents[0].id;
            hostResponse = `---DISPATCH---\n${defaultId}\n\n---SUGGESTIONS---\n- 请继续探讨当下的深度细节 🍵\n- 抛出当下面临的具体瓶颈与思路 🚀\n- 听听还有什么别有洞天的奇招 🧘‍♂️`;
          }

          const dispatchRegex = /---DISPATCH---([\s\S]*?)(?:---|$)/i;
          const suggestionsRegex = /---SUGGESTIONS---([\s\S]*?)$/i;

          const dispatchMatch = hostResponse.match(dispatchRegex);
          const suggestionsMatch = hostResponse.match(suggestionsRegex);

          let chosenIdsString = '';
          if (dispatchMatch && dispatchMatch[1]) {
            chosenIdsString = dispatchMatch[1].trim().replace(/^[-*\s]+/, '').split('\n')[0].trim();
          }

          // Split by commas
          const dispatchedIds = chosenIdsString
            .split(',')
            .map(s => s.trim())
            .filter(id => speakingAgents.some(a => a.id === id));

          // If valid dispatch list is empty, default to first active agent
          if (dispatchedIds.length === 0) {
            dispatchedIds.push(speakingAgents[0].id);
          }

          let parsedSuggestions: string[] = [];
          if (suggestionsMatch && suggestionsMatch[1]) {
            parsedSuggestions = suggestionsMatch[1]
              .split('\n')
              .map(s => s.trim().replace(/^[-*\d\.\s]+/, ''))
              .filter(s => s.length > 3 && s.length < 60);
          }

          if (parsedSuggestions.length >= 2) {
            setSuggestions(parsedSuggestions.slice(0, 3));
          }

          // Let the dispatched experts speak sequentially
          for (let i = 0; i < dispatchedIds.length; i++) {
            const expertId = dispatchedIds[i];
            const targetAg = speakingAgents.find(a => a.id === expertId);
            if (!targetAg) continue;

            setThinkingAgent(targetAg.name);

            // Build a supportive prompt that points out we chose this agent for thematic relevance
            const promptBooster = `客官提问：“${typedText}”\n请你发挥独特的【${targetAg.name}】身段、语调和专业擅长，犀利或安详地答复客官的话头（务必紧密结合并承接整桌之前所有的论证上下文，拒绝任何多余的客套寒暄或自我介绍背景，直接切入核心分析论点！）。不要超出系统字数设定！`;

            const replyText = await getSingleAgentResponse(targetAg, promptBooster, updatedHistory);

            const agMsg: Message = {
              id: `msg_disp_ag_${targetAg.id}_${i}_` + Date.now().toString(36),
              roomId: teahouseId,
              role: 'agent',
              userId: targetAg.id,
              username: targetAg.name,
              agentId: targetAg.id,
              avatar: targetAg.avatar,
              text: replyText,
              timestamp: Date.now()
            };

            updatedHistory = [...updatedHistory, agMsg];
            saveHistory(updatedHistory);

            // Pause slightly for reading comfort and realism only if there are more upcoming replies
            if (i < dispatchedIds.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 800));
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '大模型对话受到阻塞，请检查您的 API 密钥及连接端点连通性。');
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
      const specialSystemPoke = agent.systemPrompt + `\n[特别触发]: 当前议论告一段落，客官对你作了“请Ta插嘴”示意，要求你主动打破沉默，总结或对前面全桌聊的话题作出一两句幽默辛辣、高屋建瓴的短评，或者尖锐拷贝！`;
      
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
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black text-base">{teahouseName}</h3>
              <div className="flex items-center gap-1.5 bg-neutral-900 text-white px-2 py-0.5 text-[9px] font-mono font-bold border border-black">
                <Users className="w-2.5 h-2.5" />
                <span>围炉群聊空间</span>
              </div>
              {currentHost && (
                <div className="flex items-center gap-1.5 bg-amber-500 text-black px-2 py-0.5 text-[9px] font-mono font-bold border border-black shadow-[1px_1px_0px_rgba(0,0,0,1)]">
                   <span className="animate-pulse">{currentHost.avatar}</span>
                  <span>调度总控：{currentHost.name}</span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-neutral-600 mt-1 leading-snug font-sans">
              <span className="font-extrabold text-black">雅间调性：</span>{teahouseIntro}
            </p>
          </div>
        </div>

        {/* Global togglers */}
        <div className="flex items-center gap-2 flex-wrap" id="chat_top_bar_controls">
          {/* Smart Token Saver Battery Badge */}
          <button
            onClick={onOpenSettings}
            className={`flex items-center gap-1.5 border-2 border-black px-2.5 py-1 text-[10px] font-mono font-bold transition-all cursor-pointer ${
              totalSavedChars > 0 ? 'bg-emerald-50 text-emerald-950 shadow-[1px_1px_0px_rgba(0,0,0,1)]' : 'bg-teal-50/50 text-teal-800'
            }`}
            title="点此配置智能 Token 压缩与滑动历史轮数，拯救您的 Token 钱包！"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${totalSavedChars > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-teal-400'} shrink-0`} />
            <span className="font-extrabold">🔋 {totalSavedChars > 0 ? `已省 ${totalSavedChars} 字符 (~${(totalSavedChars * 0.95).toFixed(0)} Token)` : '智能省电: 已就绪'}</span>
          </button>

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
                  <span className="text-[10px] font-black font-sans text-neutral-800">
                    {m.username}
                    {m.userId === currentHost.id && (
                      <span className="bg-amber-500 text-white font-mono px-1 pb-0.5 text-[8px] font-black border border-black ml-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] select-none">
                        堂倌/总调度 🤵🏽
                      </span>
                    )}
                  </span>
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
                    isUser
                      ? 'bg-amber-100 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                      : m.userId === currentHost.id
                      ? 'bg-amber-50/70 border-amber-500 text-black shadow-[3px_3px_0px_0px_rgba(245,158,11,1)]'
                      : 'bg-white text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
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
        
        {/* Dynamic Host Topic Suggestions & Idle Tips */}
        {suggestions.length > 0 && (
          <div className="space-y-1.5" id="host_guidance_block">
            {/* Active Idle Hint Callout */}
            {isIdle ? (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-800 font-mono font-bold animate-pulse bg-amber-50 p-2 border border-dashed border-amber-400">
                <span>{currentHost.avatar}</span>
                <span>
                  {teahouseId === 'th_jinli_memory' && `【堂倌二娃过来续茶】: “客官师兄，盖碗茶焖得久咯！二娃推荐您撮个热乎话题唠唠：”`}
                  {teahouseId === 'th_cyber_silicon' && `【总控主频调度警报】: “检测到指令线中断。操作员，输入端推荐重新激活以下任一核心逻辑：”`}
                  {teahouseId === 'th_qingcheng_wellness' && `【小师妹托腮温水】: “师兄，手持温茶，闭目片刻。得空了再点点下边的话题，叫先生开讲：”`}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono font-bold">
                <Sparkles className="w-3 h-3 text-amber-500 animate-spin" />
                <span>{currentHost.name} 堂前提议新议题 (点击快速调度席上大佬)：</span>
              </div>
            )}

            {/* Clickable Card Chips Container */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" id="chip_suggestions_wrapper">
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSendMessage(undefined, sug)}
                  className="flex flex-col justify-between p-2 text-left bg-zinc-50 hover:bg-amber-50/50 border-2 border-black text-[10.5px] leading-snug font-sans text-neutral-800 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span className="font-bold flex-grow pr-1 text-zinc-900">{sug}</span>
                  <span className="text-[8px] bg-neutral-900 text-white px-1 py-0.2 mt-1.5 font-mono uppercase w-fit rounded-none">点击开杠 ⚡</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
