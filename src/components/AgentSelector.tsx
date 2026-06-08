import React, { useState, useEffect } from 'react';
import { Sparkles, Compass, PlusCircle, Trash2, ArrowRight, BookOpen, UserCheck, Flame, ShieldAlert, Loader2 } from 'lucide-react';
import { generateClientCustomPrompt, getLLMConfig } from '../llmService';

export interface AgentTemplate {
  id: string;
  name: string;
  avatar: string;
  description: string;
  style: string;
  expectedOutcome: string;
  systemPrompt: string;
  isCustom?: boolean;
}

const PRESET_AGENTS: AgentTemplate[] = [
  {
    id: 'preset_storyteller',
    name: '锦里说书老秀才',
    avatar: '👴🏽',
    description: '成都锦里茶馆老牌说书艺人，茶楼折扇一摇，说古论今，安逸得很。',
    style: '幽默风趣、乐天达观，夹杂安逸地道的四川话口音。说话有生活温度和老练智慧。',
    expectedOutcome: '以说古论今、讲掌故的方法点破心中迷津，推荐安逸知足的生活行动策略。',
    systemPrompt: `你是一位成都锦里古街的资深说书人，昵称“锦里说书老秀才”。你必须操着一口略带四川方言特色口吻的四川普通话（比如“要得嘛”、“脑壳痛”、“安逸得很”、“摆一摆”、“好生听我给你盘一盘”）。风格幽默风趣，喜欢讲段子、引用民俗和老祖宗的话。在指导和启发别人时，要以说书做局的口吻，每句话都要显得有生活智慧且接地气，称呼用户为“阵主”或“客官”。控制回复在 120 字内。`
  },
  {
    id: 'preset_matriarch',
    name: '盖碗茶馆辣掌柜',
    avatar: '👩🏻‍🍳',
    description: '性格泼辣爽利、点评针针见血，绝不兜圈子，最恨华而不实的浮夸修辞。',
    style: '火爆、直接、犀利、带有一点川渝辣妹子的豪爽泼辣，说话自带气场，绝无废话。',
    expectedOutcome: '一针见血剖析难题，直击虚言假饰，吐露最硬核、最直截了当的破局干货。',
    systemPrompt: `你是一位成都盖碗茶馆的狠辣老板娘，昵称“盖碗茶馆辣掌柜”。你性格爽朗急躁，说话风辣、一针见血，最反感言之无物的空泛套话、推脱之词。在与人交流时，你会直截了当地点出对方的漏洞，语气犀利幽默，带有点川渝女性的豪爽和泼辣劲。回答干练有骨气，称呼用户为“阵主”或“客官”。控制回复在 100 字内。`
  },
  {
    id: 'preset_advisor',
    name: '青城山隐世军师',
    avatar: '🧘‍♂️',
    description: '静水流深、清静无为的得道智囊。深谙辩证之法，善于剖析事物阴阳转折。',
    style: '冷静、深邃、富于古典辩证思维，谈吐高雅脱俗，充满道家顺应自然、借力打力的启迪。',
    expectedOutcome: '梳理困扰的核心死结，提供一两句极具穿透力、太极化劲般的行事锦囊锦集。',
    systemPrompt: `你是一位隐居青城山修身养性的智慧军师，昵称“青城隐世军师”。你言语高雅、冷静辩证，带着一股超然物外的道家智慧。擅长用“祸福相依”、“借力打力”、“无为而治”等辩证哲学思维帮人剖析困惑，指点迷津。发言深邃而具启迪性，字字珠玑，在回答中称呼用户为“阵主”或“客官”。控制回复在 120 字内。`
  }
];

interface AgentSelectorProps {
  onSelected: (agent: AgentTemplate) => void;
  activeAgentId?: string;
  onOpenSettings: () => void;
}

export default function AgentSelector({ onSelected, activeAgentId, onOpenSettings }: AgentSelectorProps) {
  const [customAgents, setCustomAgents] = useState<AgentTemplate[]>([]);
  const [showForgeForm, setShowForgeForm] = useState(false);

  // Form states
  const [formName, setFormName] = useState('创意狂人诸葛亮');
  const [formDesc, setFormDesc] = useState('专门用极客黑客眼光给你做头脑风暴，性格极度活跃狂妄，喜欢用奇招突袭');
  const [formStyle, setFormStyle] = useState('狂妄自信、语速极快、思维跳跃，喜欢抛出各种无厘头又灵气十足的绝妙创意');
  const [formOutcome, setFormOutcome] = useState('输出 3 个极其离经叛道但效果奇佳的鬼才营销点子');
  const [forging, setForging] = useState(false);
  const [formError, setFormError] = useState('');

  // Load custom agents from LocalStorage
  useEffect(() => {
    const records = localStorage.getItem('longmenzhen_custom_agents');
    if (records) {
      try {
        setCustomAgents(JSON.parse(records));
      } catch (e) {
        console.error('Error loading custom agents', e);
      }
    }
  }, []);

  const saveCustomAgentsToLocal = (agents: AgentTemplate[]) => {
    setCustomAgents(agents);
    localStorage.setItem('longmenzhen_custom_agents', JSON.stringify(agents));
  };

  const handleForgeAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDesc.trim() || !formStyle.trim() || !formOutcome.trim()) {
      setFormError('请填写所有必需项，以便淬炼定制 Agent 提示词。');
      return;
    }

    const config = getLLMConfig();
    if (!config.apiKey) {
      setFormError('您尚未配置 API 密钥，请先点击页面右上角【适配参数配置 ⚙】填写 API 密钥。');
      onOpenSettings();
      return;
    }

    setForging(true);
    setFormError('');

    try {
      const generatedPrompt = await generateClientCustomPrompt({
        name: formName.trim(),
        description: formDesc.trim(),
        nature: formStyle.trim(),
        expectedOutcome: formOutcome.trim(),
        agentNickname: formName.trim()
      });

      const newAgent: AgentTemplate = {
        id: 'custom_' + Date.now().toString(36),
        name: formName.trim(),
        avatar: '🧙‍♂️',
        description: formDesc.trim(),
        style: formStyle.trim(),
        expectedOutcome: formOutcome.trim(),
        systemPrompt: generatedPrompt || `你是一个名叫 ${formName} 的自定义AI。按照：${formStyle} 的风格行事。`,
        isCustom: true
      };

      const updated = [newAgent, ...customAgents];
      saveCustomAgentsToLocal(updated);
      
      // Select immediately
      onSelected(newAgent);
      
      // Reset form view
      setShowForgeForm(false);
    } catch (err: any) {
      setFormError(err.message || '大模型生成指令失败，请检查您的 API 密钥及代理端点是否配置正确。');
    } finally {
      setForging(false);
    }
  };

  const handleDeleteAgent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要销毁这个自定义 Agent 吗？数据一旦抹除不可恢复。')) {
      const remaining = customAgents.filter(a => a.id !== id);
      saveCustomAgentsToLocal(remaining);
    }
  };

  return (
    <div className="space-y-6" id="agent_selector_box">
      
      {/* Title block */}
      <div className="border-b-2 border-black pb-2 flex justify-between items-center" id="agent_section_header">
        <h3 className="text-sm font-black uppercase tracking-wider font-mono flex items-center gap-1.5 text-black">
          <span className="w-2.5 h-2.5 bg-black inline-block"></span>
          挑选 AI 阵友 (Choose Agent)
        </h3>
        <button
          onClick={() => setShowForgeForm(!showForgeForm)}
          className={`px-2.5 py-1 text-xs font-mono font-bold border-2 border-black transition-all cursor-pointer flex items-center gap-1 ${showForgeForm ? 'bg-black text-white' : 'bg-white text-black hover:bg-neutral-100'}`}
          id="btn_toggle_forge"
        >
          {showForgeForm ? '返回列表 ✕' : '✨ 淬炼新客官 (Forge)'}
        </button>
      </div>

      {showForgeForm ? (
        /* Forge Form Component */
        <form onSubmit={handleForgeAgent} className="border-2 border-black p-4 space-y-4 bg-white animate-fade-in" id="forge_agent_form">
          <div className="space-y-1">
            <h4 className="text-xs font-bold font-mono uppercase bg-black text-white px-2 py-0.5 inline-block rounded-none">
              炼铁炉 · 淬炼自定义 Agent 系统关键词
            </h4>
            <p className="text-[10px] text-neutral-500 font-mono">
              提供基本偏好，Gemini 会为您反推写出一整段完美的 Agent 系统提示词 (System Instructions)。
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-bold mb-0.5 text-black">1. 阵友名号 (Agent Nickname)</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-white border border-black p-2 text-xs text-black font-semibold text-left"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-0.5 text-black">2. 议题背景与职责设定 (Context & Focus)</label>
              <textarea
                rows={2}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="w-full bg-white border border-black p-2 text-xs text-black text-left"
                placeholder="它扮演什么具体专家/角色？日常聚焦剖析什么难题？"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-0.5 text-black font-mono">3. 话风与个性描写 (Persona/Style)</label>
                <input
                  type="text"
                  value={formStyle}
                  onChange={(e) => setFormStyle(e.target.value)}
                  className="w-full bg-white border border-black p-2 text-xs text-black text-left"
                  placeholder="如: 极其自信、幽默接地气、针锋相对点评..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-0.5 text-black font-mono">4. 预期终局成果 (Guiding Outcome)</label>
                <input
                  type="text"
                  value={formOutcome}
                  onChange={(e) => setFormOutcome(e.target.value)}
                  className="w-full bg-white border border-black p-2 text-xs text-black text-left"
                  placeholder="如: 指导得出一套明确的营销创意...等"
                  required
                />
              </div>
            </div>
          </div>

          {formError && (
            <div className="p-2 bg-red-50 text-red-800 border border-red-300 text-xs font-mono" id="forge_form_error">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
            <button
              type="button"
              onClick={() => setShowForgeForm(false)}
              className="border border-black px-3 py-1.5 text-xs font-mono hover:bg-neutral-100 cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={forging}
              className="border-2 border-black bg-black text-white hover:bg-white hover:text-black transition-all px-4 py-1.5 text-xs font-mono font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              id="btn_submit_forge_agent"
            >
              {forging ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>淬炼大炉中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>立刻注入神韵 ⚡</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Presets and Custom list */
        <div className="space-y-4" id="agent_templates_list_container">
          
          {/* Custom Agents section if any */}
          {customAgents.length > 0 && (
            <div className="space-y-2" id="custom_agents_sublist">
              <h4 className="text-[11px] font-bold tracking-wider font-mono uppercase text-neutral-500">
                您亲手淬炼的阵友 (Custom Agents)
              </h4>
              <div className="grid grid-cols-1 gap-2.5">
                {customAgents.map(agent => (
                  <div
                    key={agent.id}
                    onClick={() => onSelected(agent)}
                    className={`border-2 p-3 text-left cursor-pointer transition-all flex justify-between items-center relative ${activeAgentId === agent.id ? 'bg-black text-white border-black shadow-md' : 'bg-white text-black border-neutral-300 hover:border-black'}`}
                  >
                    <div className="flex gap-2.5 items-start pr-8">
                      <span className="text-2xl mt-0.5">{agent.avatar}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-xs">{agent.name}</span>
                          <span className="text-[9px] border px-1.5 py-0.2 uppercase font-mono font-bold bg-amber-50 text-amber-800 scale-90">
                            Custom
                          </span>
                        </div>
                        <p className={`text-[10px] mt-0.5 leading-relaxed line-clamp-2 ${activeAgentId === agent.id ? 'text-neutral-300' : 'text-neutral-500'}`}>
                          {agent.description}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteAgent(agent.id, e)}
                      className={`absolute right-3 top-3 p-1 border hover:bg-red-500 hover:text-white transition-all rounded-none cursor-pointer ${activeAgentId === agent.id ? 'border-neutral-700 text-neutral-400' : 'border-neutral-200 text-neutral-400'}`}
                      title="销毁角色"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preset templates list */}
          <div className="space-y-2" id="preset_agents_sublist">
            <h4 className="text-[11px] font-bold tracking-wider font-mono uppercase text-neutral-500">
              茶馆招牌常驻阵友 (Teahouse Classics)
            </h4>
            <div className="grid grid-cols-1 gap-2.5">
              {PRESET_AGENTS.map(agent => (
                <div
                  key={agent.id}
                  onClick={() => onSelected(agent)}
                  className={`border-2 p-3.5 text-left cursor-pointer transition-all flex gap-3 items-start relative ${activeAgentId === agent.id ? 'bg-black text-white border-black shadow-md' : 'bg-white text-black border-neutral-300 hover:border-black'}`}
                >
                  <span className="text-3xl mt-1 shrink-0">{agent.avatar}</span>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs">{agent.name}</span>
                      <span className="text-[9px] border-2 border-black px-1 font-mono font-black scale-95 bg-neutral-100 text-black">
                        PRESET
                      </span>
                    </div>
                    <p className={`text-[11px] leading-relaxed line-clamp-2 ${activeAgentId === agent.id ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      {agent.description}
                    </p>
                    <div className="flex gap-2 pt-0.5 font-mono text-[9px]">
                      <span className={activeAgentId === agent.id ? 'text-amber-400' : 'text-amber-800'}>
                        风格: {agent.style.slice(0, 15)}...
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
