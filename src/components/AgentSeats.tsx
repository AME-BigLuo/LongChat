import React, { useState, useEffect } from 'react';
import { AgentTemplate, AppLanguage } from '../types';
import { 
  Sparkles, PlusCircle, Trash2, Loader2, Info, CheckSquare, Square, 
  HelpCircle, MessageSquare, Coffee, Flame, HeartHandshake, EyeOff, Eye 
} from 'lucide-react';
import { generateClientCustomPrompt, getLLMConfig } from '../llmService';
import { STORAGE_KEYS } from '../constants';

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
  language: AppLanguage;
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
  onCustomAgentsUpdated,
  language
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
    const key = STORAGE_KEYS.customAgents(teahouseId);
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
    const key = STORAGE_KEYS.customAgents(teahouseId);
    localStorage.setItem(key, JSON.stringify(agents));
    onCustomAgentsUpdated();
  };

  const handleForgeAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDesc.trim() || !formStyle.trim() || !formOutcome.trim()) {
      setFormError(language === 'zh' ? '请完整填写所有字段。' : 'Please fill in every field.');
      return;
    }

    const config = getLLMConfig();
    if (!config.apiKey) {
      setFormError(language === 'zh' ? '请先配置 API Key。' : 'Please configure an API key first.');
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
      setFormName('New Teahouse Guest');
      setFormDesc('Strong at analysis and structured thinking.');
    } catch (err: any) {
      setFormError(err.message || (language === 'zh' ? '创建新茶友失败。' : 'Unable to forge a new guest.'));
    } finally {
      setForging(false);
    }
  };

  const handleDeleteAgent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(language === 'zh' ? '确定删除这个自定义茶友吗？此操作不可撤销。' : 'Remove this custom guest? This cannot be undone.')) {
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
          <span>{language === 'zh' ? `3. 茶友席位（${allAgents.length}位）` : `3. Guest seats (${allAgents.length})`}</span>
        </h3>
        
        <button
          onClick={() => setShowForgeForm(!showForgeForm)}
          className={`px-2 py-0.5 text-[9px] font-mono font-bold border-2 border-black cursor-pointer transition-all ${
            showForgeForm ? 'bg-black text-white hover:bg-zinc-800' : 'bg-white text-black hover:bg-neutral-50'
          }`}
          id="btn_toggle_guest_forge"
        >
          {showForgeForm ? (language === 'zh' ? '返回' : 'Back') : (language === 'zh' ? '✨ 新茶友' : '✨ New guest')}
        </button>
      </div>

      {showForgeForm ? (
        /* Forge Form Block */
        <form onSubmit={handleForgeAgent} className="border-2 border-black p-3 space-y-3 bg-neutral-50 animate-fade-in" id="guest_forge_form">
          <div className="bg-black text-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest font-mono">
            {language === 'zh' ? '✨ 自定义 AI 茶友' : '✨ Custom guest forge'}
          </div>
          
          <div className="text-[10px] text-neutral-500 font-sans leading-tight">
            {language === 'zh'
              ? <>设定茶友性格，模型会为当前茶馆 <strong>（{teahouseName}）</strong> 生成对应的系统提示词。</>
              : <>Define the guest, and the model will help draft a system prompt for the current room <strong>({teahouseName})</strong>.</>}
          </div>

          <div className="space-y-2.5 text-xs text-black">
            <div>
              <label className="block font-bold mb-0.5">{language === 'zh' ? '1. 茶友名号' : '1. Guest name'}</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-white border border-black px-2 py-1 font-bold focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-0.5">{language === 'zh' ? '2. 背景与擅长' : '2. Background and strengths'}</label>
              <textarea
                rows={2}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="w-full bg-white border border-black p-1.5 text-[11px] focus:outline-none"
                placeholder={language === 'zh' ? '例如：擅长分析、检索和落地交付...' : 'Strong at analysis, retrieval, and delivery...'}
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-0.5">{language === 'zh' ? '3. 说话风格' : '3. Speaking style'}</label>
              <input
                type="text"
                value={formStyle}
                onChange={(e) => setFormStyle(e.target.value)}
                className="w-full bg-white border border-black px-2 py-1 focus:outline-none"
                placeholder={language === 'zh' ? '例如：简洁、幽默、技术感强...' : 'e.g. concise, playful, technical...'}
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-0.5">{language === 'zh' ? '4. 期望产出' : '4. Expected outcome'}</label>
              <input
                type="text"
                value={formOutcome}
                onChange={(e) => setFormOutcome(e.target.value)}
                className="w-full bg-white border border-black px-2 py-1 focus:outline-none"
                placeholder={language === 'zh' ? '例如：一份可执行落地方案' : 'e.g. a practical rollout plan'}
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
              {language === 'zh' ? '取消' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={forging}
              className="px-3 py-1 border-2 border-black bg-black text-white text-[10px] font-bold font-mono hover:bg-zinc-800 cursor-pointer disabled:opacity-50 flex items-center gap-1"
            >
              {forging ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{language === 'zh' ? '生成中...' : 'Forging...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-yellow-300" />
                  <span>{language === 'zh' ? '生成茶友 ⚙' : 'Forge guest ⚙'}</span>
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
                          {language === 'zh' ? '自定义' : 'Custom'}
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
                    title={isChecked ? (language === 'zh' ? '让该茶友离席' : 'Remove this guest from the room') : (language === 'zh' ? '请该茶友入席' : 'Add this guest to the room')}
                  >
                    <span>{isChecked ? (language === 'zh' ? '在席' : 'On') : (language === 'zh' ? '离席' : 'Off')}</span>
                  </button>
                </div>

                {/* Sub-style line */}
                <div className="text-[9px] text-amber-800 bg-amber-50/50 border border-dotted border-amber-300 px-1.5 py-0.5 mt-2 font-mono">
                  {language === 'zh' ? '风格' : 'Style'}: {ag.style.slice(0, 40)}...
                </div>

                {/* Direct Command Buttons Under Row */}
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-dashed border-neutral-200 text-[10px]">
                  <button
                    type="button"
                    onClick={() => onDirectPrompt(ag.id)}
                    className="py-1 px-1 border border-black bg-white hover:bg-neutral-100 text-center font-bold relative cursor-pointer active:top-0.5"
                    title={language === 'zh' ? `单独向 ${ag.name} 提问` : `Ask ${ag.name} directly`}
                  >
                    💬 {language === 'zh' ? '指名提问' : 'Direct ask'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDirectPoke(ag.id)}
                    className="py-1 px-1 border border-black bg-neutral-900 text-white hover:bg-black text-center font-bold relative cursor-pointer active:top-0.5"
                    title={language === 'zh' ? `请 ${ag.name} 先插话` : `Poke ${ag.name} to speak first`}
                  >
                    🍵 {language === 'zh' ? '请他插话' : 'Poke'}
                  </button>
                </div>

                {/* If custom, show trash bin */}
                {ag.isCustom && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteAgent(ag.id, e)}
                    className="absolute right-0 bottom-11 p-1 text-neutral-400 hover:text-red-600 cursor-pointer"
                    title={language === 'zh' ? '删除这个自定义茶友' : 'Remove this custom guest'}
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
