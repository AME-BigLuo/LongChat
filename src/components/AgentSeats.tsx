import React, { useState, useEffect } from 'react';
import { AgentTemplate } from '../types';
import { 
  Sparkles, PlusCircle, Trash2, Loader2, Info, CheckSquare, Square, 
  HelpCircle, MessageSquare, Coffee, Flame, HeartHandshake, EyeOff, Eye 
} from 'lucide-react';
import { generateClientCustomPrompt, getLLMConfig } from '../llmService';

interface AgentSeatsProps {
  teahouseId: string;
  teahouseName: string;
  defaultAgents: AgentTemplate[];
  activeAgentIds: string[];
  onToggleAgent: (agentId: string) => void;
  onDirectPrompt: (agentId: string) => void;
  onDirectPoke: (agentId: string) => void;
  onOpenSettings: () => void;
  onCustomAgentsUpdated: () => void;
}

export default function AgentSeats({
  teahouseId,
  teahouseName,
  defaultAgents,
  activeAgentIds,
  onToggleAgent,
  onDirectPrompt,
  onDirectPoke,
  onOpenSettings,
  onCustomAgentsUpdated
}: AgentSeatsProps) {
  // Custom agents specifically for this teahouse
  const [customAgents, setCustomAgents] = useState<AgentTemplate[]>([]);
  const [showForgeForm, setShowForgeForm] = useState(false);

  // Form states
  const [formName, setFormName] = useState('创意狂人诸葛亮');
  const [formDesc, setFormDesc] = useState('用极客眼光给你做大脑风暴，分析思路极其清奇活跃，喜欢用奇招突袭');
  const [formStyle, setFormStyle] = useState('狂诞自信、思维跳跃极快，喜欢抛出各种离经叛道又灵气十足的脑洞创意');
  const [formOutcome, setFormOutcome] = useState('设计出带有极其罕见但杀伤力十足的互动演示方案');
  const [forging, setForging] = useState(false);
  const [formError, setFormError] = useState('');

  // Load custom agents from LocalStorage whenever teahouse ID matches
  useEffect(() => {
    loadLocalCustomAgents();
    setShowForgeForm(false);
  }, [teahouseId]);

  const loadLocalCustomAgents = () => {
    const key = `longmenzhen_custom_agents_v2_${teahouseId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setCustomAgents(JSON.parse(stored));
      } catch (e) {
        setCustomAgents([]);
      }
    } else {
      setCustomAgents([]);
    }
  };

  const saveCustomAgentsToLocal = (agents: AgentTemplate[]) => {
    setCustomAgents(agents);
    const key = `longmenzhen_custom_agents_v2_${teahouseId}`;
    localStorage.setItem(key, JSON.stringify(agents));
    onCustomAgentsUpdated();
  };

  const handleForgeAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDesc.trim() || !formStyle.trim() || !formOutcome.trim()) {
      setFormError('所有大项均需填妥，以便神妙熔炉进行熔炼！');
      return;
    }

    const config = getLLMConfig();
    if (!config.apiKey) {
      setFormError('未在中转/官方平台检测到 API Key，请点击右上角【⚙ 适配参数配置】。');
      onOpenSettings();
      return;
    }

    setForging(true);
    setFormError('');

    try {
      // Use client helper to anti-construct professional prompt instructions
      const generatedInstructions = await generateClientCustomPrompt({
        name: formName.trim(),
        description: formDesc.trim(),
        nature: formStyle.trim(),
        expectedOutcome: formOutcome.trim(),
        agentNickname: formName.trim()
      });

      const newAgent: AgentTemplate = {
        id: 'cust_ag_' + Date.now().toString(36),
        name: formName.trim(),
        avatar: '🧙‍♂️',
        description: formDesc.trim(),
        style: formStyle.trim(),
        expectedOutcome: formOutcome.trim(),
        systemPrompt: generatedInstructions || `扮演一个叫 ${formName} 的茶客。风格是：${formStyle}。`,
        isCustom: true
      };

      const updated = [newAgent, ...customAgents];
      saveCustomAgentsToLocal(updated);
      
      // Auto enable it in active roundtable list
      onToggleAgent(newAgent.id);

      // Reset form variables
      setShowForgeForm(false);
      setFormName('龙门馆新掌门');
      setFormDesc('擅长分析...');
    } catch (err: any) {
      setFormError(err.message || '大炉融金失败，请确认您的密钥、中转端点连通率。');
    } finally {
      setForging(false);
    }
  };

  const handleDeleteAgent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('客官三思！是否确定拆除该 AI 茶客席位？拆除后将一去不返。')) {
      const remaining = customAgents.filter(a => a.id !== id);
      saveCustomAgentsToLocal(remaining);
    }
  };

  // Merge presets with customs
  const allAgents = [...defaultAgents, ...customAgents];

  return (
    <div className="border-4 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4" id="agent_seats_control_wrapper">
      
      {/* Block Header */}
      <div className="border-b-2 border-black pb-2.5 flex justify-between items-center" id="seats_section_header">
        <h3 className="text-xs font-black uppercase tracking-wider font-mono flex items-center gap-1.5 text-black">
          <span className="w-2.5 h-2.5 bg-black inline-block animate-pulse"></span>
          <span>3. 茶轩围炉席位 ({allAgents.length}位老客)</span>
        </h3>
        
        <button
          onClick={() => setShowForgeForm(!showForgeForm)}
          className={`px-2 py-0.5 text-[9px] font-mono font-bold border-2 border-black cursor-pointer transition-all ${
            showForgeForm ? 'bg-black text-white hover:bg-zinc-800' : 'bg-white text-black hover:bg-neutral-50'
          }`}
          id="btn_toggle_guest_forge"
        >
          {showForgeForm ? '返回茶席 ✕' : '✨ 淬炼新茶客'}
        </button>
      </div>

      {showForgeForm ? (
        /* Forge Form Block */
        <form onSubmit={handleForgeAgent} className="border-2 border-black p-3 space-y-3 bg-neutral-50 animate-fade-in" id="guest_forge_form">
          <div className="bg-black text-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest font-mono">
            ✨ 神铁熔炉 · 定制特邀 AI 席位
          </div>
          
          <div className="text-[10px] text-neutral-500 font-sans leading-tight">
            设定性格，我们将请 Gemini 底座反向写出完美的系统设定词，并直接注入进入当前雅间<strong>『{teahouseName}』</strong>中进行同桌对话摆阵。
          </div>

          <div className="space-y-2.5 text-xs text-black">
            <div>
              <label className="block font-bold mb-0.5">1. 客人名号 (Name)</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-white border border-black px-2 py-1 font-bold focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-0.5">2. 资历背景及擅长 (Context)</label>
              <textarea
                rows={2}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="w-full bg-white border border-black p-1.5 text-[11px] focus:outline-none"
                placeholder="擅长出奇招、深谙系统容错..."
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-0.5">3. 聊天风格 (Style)</label>
              <input
                type="text"
                value={formStyle}
                onChange={(e) => setFormStyle(e.target.value)}
                className="w-full bg-white border border-black px-2 py-1 focus:outline-none"
                placeholder="例如: 冷峻傲娇、热衷打趣、爱甩古诗句..."
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-0.5">4. 期望产出 (Goal)</label>
              <input
                type="text"
                value={formOutcome}
                onChange={(e) => setFormOutcome(e.target.value)}
                className="w-full bg-white border border-black px-2 py-1 focus:outline-none"
                placeholder="例如: 制定一套全栈部署命令清单"
                required
              />
            </div>
          </div>

          {formError && (
            <div className="p-1.5 bg-red-100 border border-red-400 text-red-900 text-[10px] font-mono leading-tight">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1 border-t border-neutral-300">
            <button
              type="button"
              onClick={() => setShowForgeForm(false)}
              className="px-2 py-1 border border-black bg-white hover:bg-neutral-100 text-[10px] cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={forging}
              className="px-3 py-1 border-2 border-black bg-black text-white text-[10px] font-bold font-mono hover:bg-zinc-800 cursor-pointer disabled:opacity-50 flex items-center gap-1"
            >
              {forging ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>神工铸魂中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-yellow-300" />
                  <span>精炼出关 ⚙</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Active Agents List */
        <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-0.5" id="agent_seats_list">
          {allAgents.map((ag) => {
            const isChecked = activeAgentIds.includes(ag.id);

            return (
              <div
                key={ag.id}
                className={`border-2 p-2.5 transition-all text-left flex flex-col relative ${
                  isChecked
                    ? 'bg-neutral-50/70 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white border-neutral-200 hover:border-black opacity-80'
                }`}
                id={`seat_agent_card_${ag.id}`}
              >
                {/* Info and top line */}
                <div className="flex gap-2 items-start relative">
                  <span className="text-2xl p-1 bg-white border border-black shrink-0 block">
                    {ag.avatar}
                  </span>
                  
                  <div className="flex-grow pr-12 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-extrabold text-xs tracking-tight truncate">{ag.name}</span>
                      {ag.isCustom && (
                        <span className="text-[8px] bg-amber-100 text-amber-900 px-1 border border-amber-300 scale-90 block">
                          定制
                        </span>
                      )}
                    </div>
                    <p className="text-[9.5px] text-neutral-500 font-sans leading-tight mt-0.5 truncate">
                      {ag.description}
                    </p>
                  </div>

                  {/* Switch participation state control banner */}
                  <button
                    type="button"
                    onClick={() => onToggleAgent(ag.id)}
                    className={`absolute right-0 top-0 p-1 border font-mono text-[9px] font-extrabold flex items-center gap-0.5 cursor-pointer hover:bg-neutral-100 ${
                      isChecked 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800' 
                        : 'border-neutral-300 bg-white text-neutral-400'
                    }`}
                    title={isChecked ? "使此茶客退席，不再参与多人大合唱" : "请此茶客入席，共同参与多人对话辩论"}
                  >
                    <span>{isChecked ? '🟢 席上' : '🔘 空席'}</span>
                  </button>
                </div>

                {/* Sub-style line */}
                <div className="text-[9px] text-amber-800 bg-amber-50/50 border border-dotted border-amber-300 px-1.5 py-0.5 mt-2 font-mono">
                  调性: {ag.style.slice(0, 40)}...
                </div>

                {/* Direct Command Buttons Under Row */}
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-dashed border-neutral-200 text-[10px]">
                  <button
                    type="button"
                    onClick={() => onDirectPrompt(ag.id)}
                    className="py-1 px-1 border border-black bg-white hover:bg-neutral-100 text-center font-bold relative cursor-pointer active:top-0.5"
                    title={`单独向 ${ag.name} 提个尖锐问题`}
                  >
                    💬 指名提问 TA
                  </button>
                  <button
                    type="button"
                    onClick={() => onDirectPoke(ag.id)}
                    className="py-1 px-1 border border-black bg-neutral-900 text-white hover:bg-black text-center font-bold relative cursor-pointer active:top-0.5"
                    title={`催促 ${ag.name} 根据全桌前文内容说几句短评插个嘴`}
                  >
                    🍵 请 TA 插嘴
                  </button>
                </div>

                {/* If custom, show trash bin */}
                {ag.isCustom && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteAgent(ag.id, e)}
                    className="absolute right-0 bottom-11 p-1 text-neutral-400 hover:text-red-600 cursor-pointer"
                    title="拆毁此茶席设定"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
