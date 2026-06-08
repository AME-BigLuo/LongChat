import React, { useState, useEffect } from 'react';
import { Sparkles, Key, HelpCircle, AlertCircle, Heart, User, Coffee, Info, ShieldCheck } from 'lucide-react';
import SettingsModal from './components/SettingsModal';
import TeahouseList from './components/TeahouseList';
import AgentSeats from './components/AgentSeats';
import AgentChat from './components/AgentChat';
import { PRESET_TEAHOUSES } from './data/teahouseData';
import { AgentTemplate } from './types';
import { getLLMConfig } from './llmService';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // User customizable nickname
  const [userNickname, setUserNickname] = useState(() => {
    return localStorage.getItem('longmenzhen_user_nickname') || '发起人老张';
  });

  // Selected active Teahouse Chamber (defaults to Jinli Storyteller Teahouse)
  const [activeTeahouseId, setActiveTeahouseId] = useState<string>('th_jinli_memory');

  // Multi-Agent selection list per teahouse
  const [activeAgentIdsByTeahouse, setActiveAgentIdsByTeahouse] = useState<Record<string, string[]>>({});

  // Custom guests forged by user (mapped by teahouseId)
  const [customAgentsByTeahouse, setCustomAgentsByTeahouse] = useState<Record<string, AgentTemplate[]>>({});

  // Multi-Agent reactive Trigger action signals from sidebar triggers to chat box
  const [triggerAction, setTriggerAction] = useState<{ agentId: string; action: 'direct' | 'poke'; timestamp: number } | null>(null);

  // Initialize or check key status on mount / updates
  useEffect(() => {
    checkApiKeyStatus();
    loadAllCustomAgents();
  }, []);

  const checkApiKeyStatus = async () => {
    const config = getLLMConfig();
    if (config.apiKey) {
      setHasApiKey(true);
      return;
    }

    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setHasApiKey(!!data.hasKey);
      } else {
        setHasApiKey(false);
      }
    } catch {
      setHasApiKey(false);
    }
  };

  const loadAllCustomAgents = () => {
    const map: Record<string, AgentTemplate[]> = {};
    PRESET_TEAHOUSES.forEach(th => {
      const key = `longmenzhen_custom_agents_v2_${th.id}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          map[th.id] = JSON.parse(stored);
        } catch {
          map[th.id] = [];
        }
      } else {
        map[th.id] = [];
      }
    });
    setCustomAgentsByTeahouse(map);
  };

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    setUserNickname(val);
    localStorage.setItem('longmenzhen_user_nickname', val);
  };

  // Get active teahouse configuration info
  const currentTeahouse = PRESET_TEAHOUSES.find(t => t.id === activeTeahouseId) || PRESET_TEAHOUSES[0];

  // Merge presets with cached custom agents
  const localCustoms = customAgentsByTeahouse[activeTeahouseId] || [];
  const allAgentsInTeahouse = [...currentTeahouse.defaultAgents, ...localCustoms];

  // Dynamic lists of checked agents 
  const activeAgentIds = activeAgentIdsByTeahouse[activeTeahouseId] || allAgentsInTeahouse.map(a => a.id);

  const handleToggleAgent = (agentId: string) => {
    const currentList = activeAgentIdsByTeahouse[activeTeahouseId] || allAgentsInTeahouse.map(a => a.id);
    let updated: string[];
    if (currentList.includes(agentId)) {
      updated = currentList.filter(id => id !== agentId);
    } else {
      updated = [...currentList, agentId];
    }
    setActiveAgentIdsByTeahouse(prev => ({
      ...prev,
      [activeTeahouseId]: updated
    }));
  };

  // Re-calculate experts count for switcher layout
  const customActiveCounts: Record<string, number> = {};
  PRESET_TEAHOUSES.forEach(th => {
    const customs = customAgentsByTeahouse[th.id] || [];
    customActiveCounts[th.id] = th.defaultAgents.length + customs.length;
  });

  return (
    <div className="min-h-screen bg-neutral-100 text-black flex flex-col p-2 sm:p-4 font-sans" id="app_root">
      
      {/* Brutalist Frame Container */}
      <div className="flex-grow bg-white border-4 md:border-8 border-black flex flex-col relative" id="app_frame">
        
        {/* Sichuan Teahouse Top Navigation Header */}
        <header className="border-b-4 border-black bg-white py-4 px-4 sm:px-6 sticky top-0 z-40 transition-all shrink-0" id="main_nav_header">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3" id="nav_wrapper">
            
            {/* Logo */}
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.location.reload()} id="nav_logo">
              {/* Sichuan Pixel-style Cube Logo */}
              <div className="grid grid-cols-2 gap-0.5 border-4 border-black p-0.5 shrink-0 bg-black">
                <div className="w-3.5 h-3.5 bg-white"></div>
                <div className="w-3.5 h-3.5 bg-black"></div>
                <div className="w-3.5 h-3.5 bg-black"></div>
                <div className="w-3.5 h-3.5 bg-white"></div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase text-black">
                  龙门阵 · 围炉茶友会
                </h1>
                <span className="text-[9px] font-bold border-2 border-black px-1.5 py-0.2 bg-amber-100 uppercase hidden sm:inline-block">
                  多 Agent 1对多群聊系统
                </span>
                <span className="text-[9px] font-bold border-2 border-dashed border-emerald-600 px-1.5 py-0.2 bg-emerald-50 text-emerald-800 uppercase hidden lg:inline-block">
                  内置互动沙箱 🌍
                </span>
              </div>
            </div>

            {/* Quick API Key status badge & Action Button */}
            <div className="flex items-center gap-2" id="nav_right_actions">
              {hasApiKey ? (
                <div className="hidden md:flex items-center gap-1 border border-emerald-500 bg-emerald-50 text-emerald-900 px-2 py-0.8 text-[11px] font-mono font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>服务核心就绪</span>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-1 border border-amber-500 bg-amber-50 text-amber-900 px-2 py-0.8 text-[10px] font-mono font-bold">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>缺少密钥，请右侧配置</span>
                </div>
              )}

              <button
                onClick={() => setShowSettings(true)}
                className={`border-3 border-black px-3 py-1.5 text-xs font-mono font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${hasApiKey ? 'bg-black text-white hover:bg-neutral-800' : 'bg-yellow-300 text-black hover:bg-black hover:text-white animate-pulse'}`}
                id="btn_open_settings_panel"
              >
                <Key className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{hasApiKey ? '⚙ 适配参数配置' : '⚙ 设置 API Key'}</span>
              </button>
            </div>

          </div>
        </header>

        {/* Info Banner if missing Key altogether */}
        {!hasApiKey && (
          <div className="bg-yellow-50 border-b-2 border-black p-3.5 text-xs font-mono text-amber-950 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 animate-pulse" id="key_alert_banner">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 animate-bounce" />
              <span>
                <strong>提醒：</strong>大模型服务未适配。请先点击右上角按钮输入您的 API Key（支持官方直连与自定义中转），以便开启多 AI 围炉群聊龙门阵。
              </span>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="border border-black bg-black text-white text-[10px] px-2.5 py-1 font-bold font-mono hover:bg-neutral-100 hover:text-black cursor-pointer shadow-[1px_1px_0px_rgba(0,0,0,1)]"
            >
              一键去配置
            </button>
          </div>
        )}

        {/* Main Workspace Frame */}
        <main className="flex-grow p-3 sm:p-5 flex flex-col justify-start bg-neutral-50" id="main_lobby_container">
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-start" id="lobby_grid_layout">
            
            {/* Left Column (SPAN 4) - Seat Settings & Teahouses switching */}
            <div className="lg:col-span-4 space-y-4" id="lobby_left_column">
              
              {/* Profile seat card */}
              <div className="border-4 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-2.5" id="user_profile_seat_box">
                <h3 className="text-xs font-mono font-black uppercase tracking-wider flex items-center gap-1 text-black border-b-2 border-black pb-1.5">
                  <Coffee className="w-3.5 h-3.5 text-black" />
                  <span>1. 确认您的茶座身份 (Your Identity)</span>
                </h3>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-600">
                    客官，摆阵商谈时，诸位茶友怎么称呼您？
                  </label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={userNickname}
                      onChange={handleNicknameChange}
                      placeholder="例如: 阵主阿张"
                      className="w-full bg-white border-2 border-black pl-8 pr-3 py-1.5 text-xs sm:text-sm text-black font-extrabold focus:outline-none"
                      id="input_global_user_nickname"
                    />
                  </div>
                  <p className="text-[9.5px] text-neutral-400 font-mono">
                    * AI 阵友在发言过招或结案提炼册子时会据此称呼客官。
                  </p>
                </div>
              </div>

              {/* 2. Teahouses switcher */}
              <TeahouseList 
                activeId={activeTeahouseId} 
                onSelect={(id) => {
                  setActiveTeahouseId(id);
                  setTriggerAction(null); // Clear any dangling poke actions
                }}
                customActiveCounts={customActiveCounts}
              />

              {/* 3. Seating Lists of Tea Friends */}
              <AgentSeats 
                teahouseId={activeTeahouseId}
                teahouseName={currentTeahouse.name}
                defaultAgents={currentTeahouse.defaultAgents}
                activeAgentIds={activeAgentIds}
                onToggleAgent={handleToggleAgent}
                onDirectPrompt={(agId) => setTriggerAction({ agentId: agId, action: 'direct', timestamp: Date.now() })}
                onDirectPoke={(agId) => setTriggerAction({ agentId: agId, action: 'poke', timestamp: Date.now() })}
                onOpenSettings={() => setShowSettings(true)}
                onCustomAgentsUpdated={loadAllCustomAgents}
              />

              {/* Secure sandbox local contract */}
              <div className="border-2 border-dashed border-neutral-400 p-3 bg-neutral-100 text-[10px] sm:text-xs text-neutral-500 font-mono leading-relaxed" id="local_privacy_banner">
                <span className="font-extrabold text-black block mb-0.5 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  龙门茶座保密契约：
                </span>
                本平台支持<strong>纯净离线安全体系</strong>。所有聊天流、客官资料、定制茶友底稿全部本地密封存储在您的浏览器中（LocalStorage）。关掉页面不存任何中继后遗症。点击「砸烂茶碗」大阵即化。
              </div>

            </div>

            {/* Right Column (SPAN 8) - Active Teahouse Chamber Panel */}
            <div className="lg:col-span-8 flex flex-col w-full" id="lobby_right_column">
              <div className="animate-fade-in flex flex-col flex-grow w-full">
                <AgentChat 
                  teahouseId={activeTeahouseId}
                  teahouseName={currentTeahouse.name}
                  teahouseIntro={currentTeahouse.welcomeIntro}
                  allAgents={allAgentsInTeahouse}
                  activeAgentIds={activeAgentIds}
                  userNickname={userNickname}
                  onOpenSettings={() => setShowSettings(true)}
                  triggerAction={triggerAction}
                  onClearTrigger={() => setTriggerAction(null)}
                />
              </div>
            </div>

          </div>
        </main>

        {/* Footer block */}
        <footer className="border-t-4 border-black py-4 px-6 bg-white text-center text-xs font-mono text-neutral-500 shrink-0" id="main_footer_box">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>© 2026 龙门阵 · 围炉大合唱茶友楼 (Sichuan AI Multi-Agent Sandbox Lounge)</span>
            <span className="font-bold text-black flex items-center gap-1">
              <span>Crafted proudly in Studio</span>
              <Heart className="w-3 h-3 text-red-500 fill-current" />
            </span>
          </div>
        </footer>

      </div>

      {/* Admin parameter configurator modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onConfigSaved={() => {
            checkApiKeyStatus();
          }}
        />
      )}

    </div>
  );
}
