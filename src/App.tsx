import React, { useState, useEffect } from 'react';
import { Key, Heart, User, Coffee } from 'lucide-react';
import SettingsModal from './components/SettingsModal';
import TeahouseList from './components/TeahouseList';
import AgentSeats from './components/AgentSeats';
import AgentChat from './components/AgentChat';
import { PRESET_TEAHOUSES } from './data/teahouseData';
import { AgentTemplate, AppLanguage } from './types';
import { getLLMConfig } from './llmService';
import { APP_COPYRIGHT, APP_NAME, STORAGE_KEYS } from './constants';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [uiScale, setUiScale] = useState(1);
  const [language, setLanguage] = useState<AppLanguage>(() => {
    return (localStorage.getItem(STORAGE_KEYS.language) as AppLanguage) || 'zh';
  });
  
  // User customizable nickname
  const [userNickname, setUserNickname] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.nickname) || '发起人老张';
  });

  // Selected active Teahouse Chamber (defaults to Jinli Storyteller Teahouse)
  const [activeTeahouseId, setActiveTeahouseId] = useState<string>(PRESET_TEAHOUSES[0]?.id || '');

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

  useEffect(() => {
    const updateScale = () => {
      const widthScale = window.innerWidth / 1440;
      const heightScale = window.innerHeight / 980;
      const nextScale = 1.3 * Math.min(1, widthScale, heightScale);
      setUiScale(Math.max(0.72, Math.round(nextScale * 100) / 100));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    document.title = APP_NAME;
  }, []);

  const handleLanguageChange = (nextLanguage: AppLanguage) => {
    setLanguage(nextLanguage);
    localStorage.setItem(STORAGE_KEYS.language, nextLanguage);
  };

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
      const key = STORAGE_KEYS.customAgents(th.id);
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
    localStorage.setItem(STORAGE_KEYS.nickname, val);
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
    <div
      className="min-h-screen bg-neutral-100 text-black flex flex-col font-sans"
      id="app_root"
      style={{ ['--ui-scale' as any]: uiScale }}
    >
      
      {/* Brutalist Frame Container */}
      <div className="flex-grow bg-white flex flex-col relative app_scale_shell" id="app_frame">
        
        {/* Sichuan Teahouse Top Navigation Header */}
        <header className="border-b-4 border-black bg-white h-[46.2px] px-3 sm:px-4 sticky top-0 z-50 transition-all shrink-0" id="main_nav_header">
          <div className="max-w-7xl mx-auto h-full flex flex-col sm:flex-row justify-between items-center gap-1" id="nav_wrapper">
            
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()} id="nav_logo">
              <img
                src="/cs-logo.png"
                alt={APP_NAME}
                className="h-4 sm:h-5 w-auto object-contain shrink-0"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-bold border-2 border-black px-1.5 py-0 bg-amber-100 uppercase hidden sm:inline-block">
                  {language === 'zh' ? '多 Agent 茶馆' : 'Multi-Agent Teahouse'}
                </span>
                <span className="text-[8px] font-bold border-2 border-dashed border-emerald-600 px-1.5 py-0 bg-emerald-50 text-emerald-800 uppercase hidden lg:inline-block">
                  {language === 'zh' ? '开源讨论空间' : 'Open Source Lounge'}
                </span>
              </div>
            </div>

            {/* Settings and language switch */}
            <div className="flex flex-col items-end" id="nav_right_actions">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(true)}
                  className={`border-3 border-black px-2 py-0 text-[9px] font-mono font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 h-5 ${hasApiKey ? 'bg-black text-white hover:bg-neutral-800' : 'bg-yellow-300 text-black hover:bg-black hover:text-white'}`}
                  id="btn_open_settings_panel"
                >
                  <Key className="w-2.5 h-2.5 stroke-[2.5]" />
                  <span>{hasApiKey ? (language === 'zh' ? '配置' : 'Settings') : (language === 'zh' ? '配置 Key' : 'Configure Key')}</span>
                </button>

                <div className="flex border-2 border-black bg-white text-[8px] font-mono font-black overflow-hidden h-5" id="language_switch">
                  <button
                    type="button"
                    onClick={() => handleLanguageChange('zh')}
                    className={`px-2 py-0.5 cursor-pointer ${language === 'zh' ? 'bg-black text-white' : 'bg-white text-black hover:bg-neutral-100'}`}
                  >
                    中文
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLanguageChange('en')}
                    className={`px-2 py-0.5 border-l-2 border-black cursor-pointer ${language === 'en' ? 'bg-black text-white' : 'bg-white text-black hover:bg-neutral-100'}`}
                  >
                    EN
                  </button>
                </div>
              </div>

            </div>

          </div>
        </header>

        {/* Main Workspace Frame */}
        <main className="flex-grow p-3 sm:p-5 flex flex-col justify-start bg-neutral-50" id="main_lobby_container">
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-start" id="lobby_grid_layout">
            
            {/* Left Column (SPAN 4) - Seat Settings & Teahouses switching */}
            <div className="lg:col-span-4 space-y-4" id="lobby_left_column">
              
              {/* Profile seat card */}
              <div className="border-4 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-2.5" id="user_profile_seat_box">
                <h3 className="text-xs font-mono font-black uppercase tracking-wider flex items-center gap-1 text-black border-b-2 border-black pb-1.5">
                  <Coffee className="w-3.5 h-3.5 text-black" />
                  <span>{language === 'zh' ? '1. 确认你的茶座身份' : '1. Your Identity'}</span>
                </h3>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-600">
                    {language === 'zh' ? '茶馆里的各位茶友应该怎么称呼你？' : 'How should the tea house call you?'}
                  </label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={userNickname}
                      onChange={handleNicknameChange}
                      placeholder={language === 'zh' ? '例如：张老板' : 'e.g. Teahouse Host Zhang'}
                      className="w-full bg-white border-2 border-black pl-8 pr-3 py-1.5 text-xs sm:text-sm text-black font-extrabold focus:outline-none"
                      id="input_global_user_nickname"
                    />
                  </div>
                  <p className="text-[9.5px] text-neutral-400 font-mono">
                    {language === 'zh' ? '* AI 茶友发言和总结时会使用这个称呼。' : '* AI guests will use this name while speaking and summarizing.'}
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
                language={language}
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
                language={language}
              />

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
                  language={language}
                />
              </div>
            </div>

          </div>
        </main>

        {/* Footer block */}
        <footer className="border-t-2 border-black py-4 px-6 bg-white text-center text-xs font-mono text-neutral-500 shrink-0" id="main_footer_box">
          <div className="max-w-6xl mx-auto space-y-2">
            <div className="text-[10px] sm:text-xs text-neutral-500 leading-relaxed">
              <span className="font-extrabold text-black">
                {language === 'zh' ? '开源隐私说明：' : 'Open-source privacy note: '}
              </span>
              {language === 'zh'
                ? '聊天记录、用户称呼和自定义茶友都保存在你的浏览器本地。仓库内不应包含任何私有项目数据或密钥。'
                : 'Chat history, nickname, and custom guests stay in your browser. The repository should not contain private project data or secrets.'}
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>{APP_COPYRIGHT}</span>
            <span className="font-bold text-black flex items-center gap-1">
              <span>{language === 'zh' ? '为开放实验而构建' : 'Built for open experimentation'}</span>
              <Heart className="w-3 h-3 text-red-500 fill-current" />
            </span>
            </div>
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
          language={language}
        />
      )}

    </div>
  );
}
