import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Flame, Wine, FileText, CheckCircle2, Copy, Download, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { AgentTemplate } from './AgentSelector';
import { generateClientLLMResponse, generateClientSummaryHtml } from '../llmService';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  username: string;
  text: string;
  timestamp: number;
}

interface AgentChatProps {
  agent: AgentTemplate;
  onOpenSettings: () => void;
  userNickname: string;
}

export default function AgentChat({ agent, onOpenSettings, userNickname }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [spicyMode, setSpicyMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Summary outputs
  const [summaryHtml, setSummaryHtml] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryStatusMessage, setSummaryStatusMessage] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history for THIS agent from localStorage
  useEffect(() => {
    setSummaryHtml(null);
    setSummaryStatusMessage('');
    const historyKey = `longmenzhen_chat_history_${agent.id}`;
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
  }, [agent.id]);

  // Initial welcome message per agent
  const initializeWelcomeMessage = (): ChatMessage[] => {
    return [
      {
        id: 'init_msg',
        sender: 'system',
        username: '茶馆小二',
        text: `【${agent.name}】端起长嘴古嘴铜壶长长倾泻一缕热水激荡，已经入座。您可以开始与他围炉摆起龙门阵了！`,
        timestamp: Date.now()
      },
      {
        id: 'welcome_msg',
        sender: 'agent',
        username: agent.name,
        text: `客官你好！我乃 ${agent.name}。茶座已为您抹得干干净净，盖碗茶已经焖上了。今天，咱们就围绕《${agent.expectedOutcome || '您关心的课题'}》开门见山见高下，您有什么高见，只管对我说！`,
        timestamp: Date.now() + 50
      }
    ];
  };

  const saveHistory = (newMsgs: ChatMessage[]) => {
    setMessages(newMsgs);
    const historyKey = `longmenzhen_chat_history_${agent.id}`;
    localStorage.setItem(historyKey, JSON.stringify(newMsgs));
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || loading) return;

    setErrorMsg('');
    const typedText = inputValue.trim();
    setInputValue('');

    const currentNick = userNickname || '阵主客官';

    const userMsg: ChatMessage = {
      id: 'msg_u_' + Date.now().toString(36),
      sender: 'user',
      username: currentNick,
      text: typedText,
      timestamp: Date.now()
    };

    const updatedWithUser = [...messages, userMsg];
    saveHistory(updatedWithUser);
    setLoading(true);

    try {
      // Compile system instructions for the LLM
      let systemInstruction = agent.systemPrompt;
      if (spicyMode) {
        systemInstruction += `\n[重要加辣调性覆盖]：现在，用户激活了“加辣挑战”模式！请你摒弃客套，说话一定要表现得极其犀利泼辣、话中带刺、专挑对方理据逻辑的破烂漏洞进行强硬质疑，充满川渝人的火爆快人快语脾气，但底子里要保持对核心答案探索的最佳智慧！`;
      }

      // Context history for the LLM calling
      const historyMapped = updatedWithUser
        .filter(m => m.sender !== 'system')
        .map(m => ({
          role: m.sender === 'user' ? 'user' as const : 'model' as const,
          content: m.text
        }));

      // Standard context prompt
      const prompt = typedText;

      const replyText = await generateClientLLMResponse(systemInstruction, prompt, historyMapped.slice(-10));

      const agentMsg: ChatMessage = {
        id: 'msg_a_' + Date.now().toString(36),
        sender: 'agent',
        username: agent.name,
        text: replyText,
        timestamp: Date.now()
      };

      saveHistory([...updatedWithUser, agentMsg]);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '与 AI 对话连接阻碍，请检查参数设置，或多刷新几次请求。');
      // Put message back to input box so they don't lose it
      setInputValue(typedText);
    } finally {
      setLoading(false);
    }
  };

  // Tea Add feature - Triggers the agent to speak proactively or guide discussions
  const handleAddTea = async () => {
    if (loading) return;
    setErrorMsg('');
    setLoading(true);

    try {
      let systemInstruction = agent.systemPrompt + `\n[当前时刻]: 讨论中场停顿，用户对你作了“斟茶加水”手势，示意需要你主动插话指点。请你对当前前面的讨论发表一两句极其机智犀利又幽默的高屋建瓴短评，或抛出一个极其一针见血的开放性提问，打破话语停滞，称呼要带上“客官”。`;
      
      const historyMapped = messages
        .filter(m => m.sender !== 'system')
        .map(m => ({
          role: m.sender === 'user' ? 'user' as const : 'model' as const,
          content: m.text
        }));

      const replyText = await generateClientLLMResponse(
        systemInstruction, 
        "茶博士长壶长嘴倾注沸水！请针对咱们刚才聊的一切，说几句提点，或者给我抛出个尖锐的问题！", 
        historyMapped.slice(-10)
      );

      const agentMsg: ChatMessage = {
        id: 'msg_a_tea_' + Date.now().toString(36),
        sender: 'agent',
        username: agent.name,
        text: replyText,
        timestamp: Date.now()
      };

      const sysMsg: ChatMessage = {
        id: 'msg_s_tea_' + Date.now().toString(36),
        sender: 'system',
        username: '茶馆小二',
        text: '【茶博士长壶长流浇注甘泉】给客官与阵友掺上热茶一盏，AI 阵友灵泉涌现，抛出提点。',
        timestamp: Date.now() - 10
      };

      saveHistory([...messages, sysMsg, agentMsg]);
    } catch (err: any) {
      setErrorMsg(`掺茶失败: ${err.message || '请检查右上角接口配置。'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('确认砸烂茶盅退桌吗？这将立刻完全粉碎清空本场全部聊天痕迹（关机即毁、不留后遗症）。')) {
      const init = initializeWelcomeMessage();
      saveHistory(init);
      setSummaryHtml(null);
      setSummaryStatusMessage('');
    }
  };

  // Compile full outcome HTML and open download
  const handleGenerateReport = async () => {
    if (messages.length < 4) {
      alert('茶还没泡开，消息寥寥几句，请多摆几轮龙门阵后再生成结案总结吧！');
      return;
    }

    setSummarizing(true);
    setSummaryStatusMessage('正在煮茶并研磨墨汁，汇总讨论脉络...');
    setErrorMsg('');

    try {
      const historyText = messages
        .filter(m => m.sender !== 'system')
        .map(m => `[${m.username}]: ${m.text}`)
        .join('\n\n');

      const outcomeHtml = await generateClientSummaryHtml({
        agentName: agent.name,
        topicName: agent.description,
        historyText: historyText,
        outcomeTarget: agent.expectedOutcome
      });

      setSummaryHtml(outcomeHtml);
      setSummaryStatusMessage('✓ 总结报告磨墨完毕，已成功淬炼终局册子！您可点击下方按钮随时下载。');
    } catch (err: any) {
      setErrorMsg(`报告提炼失败: ${err.message}`);
      setSummaryStatusMessage('');
    } finally {
      setSummarizing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已成功复制 HTML 总结源码！');
  };

  return (
    <div className="flex flex-col flex-grow bg-white border-4 border-black min-h-[550px] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" id="chat_box_wrapper">
      
      {/* Active Agent Info Header Dashboard */}
      <div className="border-b-4 border-black p-4 bg-neutral-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0" id="chat_dashboard_header">
        <div className="flex items-center gap-3">
          <span className="text-4xl bg-white border-2 border-black p-1.5 shrink-0 block">{agent.avatar}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base">{agent.name}</h3>
              <span className="text-[10px] font-bold border-2 border-dashed border-red-500 text-red-600 px-1.5 py-0.2 bg-red-50 font-mono">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-neutral-600 mt-0.5 font-sans">
              <span className="font-extrabold text-black">话题描述：</span>{agent.description}
            </p>
          </div>
        </div>

        {/* Quick controls bar */}
        <div className="flex items-center gap-2 flex-wrap" id="chat_top_bar_controls">
          
          {/* Spicy toggle */}
          <button
            onClick={() => setSpicyMode(!spicyMode)}
            className={`flex items-center gap-1.5 border-2 border-black px-2.5 py-1.5 text-xs font-mono font-bold transition-all cursor-pointer ${spicyMode ? 'bg-red-500 text-white shadow-sm' : 'bg-white text-black hover:bg-neutral-100'}`}
            id="btn_toggle_spicy"
            title="加辣挑战：让 AI 说话更辛辣犀利，直戳逻辑漏洞"
          >
            <Flame className={`w-3.5 h-3.5 ${spicyMode ? 'animate-bounce fill-current' : ''}`} />
            <span>{spicyMode ? '🔥 劲爆加辣中' : '🔥 点它加辣'}</span>
          </button>

          {/* Dump Chat */}
          <button
            onClick={handleClearChat}
            className="border-2 border-black bg-white hover:bg-red-50 hover:text-red-700 p-2 text-xs font-mono font-bold transition-all cursor-pointer text-black"
            id="btn_clear_chat"
            title="彻底清退本桌，销毁全部记录"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Target Outcome bar banner */}
      <div className="bg-amber-50 border-b-2 border-black px-4 py-2 text-xs font-mono flex items-start gap-1.5 text-amber-900" id="outcome_banner">
        <span className="font-bold underline text-black shrink-0">🎯 结案宗旨：</span>
        <span className="leading-relaxed">{agent.expectedOutcome || '围绕该方向达成行动智慧建议。'}</span>
      </div>

      {/* Message Scroll Area */}
      <div className="flex-grow p-4 overflow-y-auto space-y-4 max-h-[380px] bg-neutral-50/50" id="message_scroller">
        {messages.map((m) => {
          if (m.sender === 'system') {
            return (
              <div key={m.id} className="flex justify-center my-3" id={`sys_notif_${m.id}`}>
                <span className="text-[10px] sm:text-xs font-mono text-neutral-500 bg-neutral-200/80 px-3 py-1 border border-neutral-300 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)] text-center max-w-lg">
                  {m.text}
                </span>
              </div>
            );
          }

          const isUser = m.sender === 'user';
          return (
            <div key={m.id} className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`} id={`chat_bubble_${m.id}`}>
              {/* Avatar indicator */}
              <div className={`w-8 h-8 rounded-none border-2 border-black flex items-center justify-center shrink-0 font-bold text-sm bg-white ${isUser ? 'bg-amber-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}>
                {isUser ? '👤' : agent.avatar}
              </div>

              {/* Message content block */}
              <div className="space-y-1">
                <div className={`flex items-baseline gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-[10px] font-black font-sans text-neutral-800">{m.username}</span>
                  <span className="text-[8px] font-mono text-neutral-400">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                
                <div className={`p-3 border-2 border-black rounded-none break-words text-xs sm:text-sm font-sans line-height-relaxed max-w-md ${isUser ? 'bg-amber-100 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                  {m.text}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Bubble */}
        {loading && (
          <div className="flex gap-3 max-w-[80%] mr-auto" id="chat_agent_loading">
            <div className="w-8 h-8 rounded-none border-2 border-black flex items-center justify-center shrink-0 bg-white animate-pulse">
              🍵
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black font-sans text-neutral-600">{agent.name}</span>
              <div className="p-3 border-2 border-black bg-neutral-100 rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 text-xs font-mono">
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>正在洗杯斟茶、琢磨对策...</span>
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input panel & custom Sichuan actions */}
      <div className="border-t-4 border-black p-3 bg-white shrink-0 space-y-3" id="input_panel_wrapper">
        
        {/* Custom Actions buttons: Tea Add and Report Summary generator */}
        <div className="flex flex-wrap gap-2 justify-between items-center bg-neutral-50 p-2 border-2 border-dashed border-black" id="action_triggers_bar">
          <div className="flex items-center gap-1">
            <button
              onClick={handleAddTea}
              disabled={loading}
              className="px-2.5 py-1 bg-white border-2 border-black text-[11px] font-mono font-black text-black hover:bg-neutral-100 transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
              id="btn_add_tea_proactive"
              title="示意茶博士添水，催促 AI 帮腔插话打破沉闷"
            >
              <Wine className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>斟茶添水 🍵 (催促AI帮腔)</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleGenerateReport}
              disabled={summarizing || loading}
              className="px-3 py-1 bg-black text-white border-2 border-black text-[11px] font-mono font-black hover:bg-white hover:text-black transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
              id="btn_generate_summary_report"
              title="摆摆龙门阵完毕，盖印结案导出高逼格 HTML 总结卡"
            >
              {summarizing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>磨墨提炼中...</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  <span>结案陈词 📜 (导出终局总结)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main message input form */}
        <form onSubmit={handleSendMessage} className="flex gap-2" id="chat_submit_form">
          <input
            type="text"
            placeholder={loading ? "AI 茶友构思中，请稍候..." : "输入高见与 AI 畅快辩论 (按回车发送)..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={loading}
            className="flex-grow bg-white border-2 border-black p-2.5 text-xs sm:text-sm text-black focus:outline-none focus:bg-neutral-50/30"
            id="chat_input_text"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || loading}
            className="border-2 border-black bg-black hover:bg-white hover:text-black text-white px-5 py-2.5 font-bold transition-all text-xs font-mono uppercase flex items-center gap-1 cursor-pointer disabled:opacity-40"
            id="btn_send_chat_message"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">开杠</span>
          </button>
        </form>

        {/* Global errors display inside the chat box itself */}
        {errorMsg && (
          <div className="p-2 border bg-red-50 text-red-800 border-red-300 text-xs font-mono flex flex-col md:flex-row md:items-center justify-between gap-2" id="chat_error_box">
            <p className="font-semibold">⚠️ 遭遇阻碍: {errorMsg}</p>
            <button
              onClick={onOpenSettings}
              className="border border-black bg-black text-white text-[10px] px-2 py-0.5 font-mono cursor-pointer shrink-0 hover:bg-white hover:text-black"
            >
              立即前往右上角适配参数 ⚙
            </button>
          </div>
        )}

        {/* Summary Status indicator and final summary download widgets */}
        {summaryStatusMessage && (
          <div className="p-2 bg-neutral-50 border border-neutral-300 text-xs font-mono space-y-2 animate-fade-in" id="summary_status_widget">
            <p className="text-neutral-700">{summaryStatusMessage}</p>
            {summaryHtml && (
              <div className="flex gap-2" id="download_actions_row">
                <button
                  onClick={() => copyToClipboard(summaryHtml)}
                  className="bg-white border border-black hover:bg-neutral-100 text-[10px] font-mono px-3 py-1 cursor-pointer flex items-center gap-1 font-bold"
                >
                  <Copy className="w-3 h-3" /> 复制 HTML 源代码
                </button>
                <a
                  href={`data:text/html;charset=utf-8,${encodeURIComponent(summaryHtml)}`}
                  download={`long_men_zhen_${agent.name}_summary.html`}
                  className="bg-emerald-600 border border-black hover:bg-emerald-700 text-white text-[10px] font-mono px-3 py-1 cursor-pointer flex items-center gap-1 font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <Download className="w-3 h-3 text-white" /> 下载高逼格总结网页.html
                </a>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
