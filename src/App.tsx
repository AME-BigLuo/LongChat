import React, { useState, useEffect } from 'react';
import { Sparkles, Key, HelpCircle, AlertCircle, Heart, User, Coffee, Info, MessageSquareCode } from 'lucide-react';
import SettingsModal from './components/SettingsModal';
import AgentSelector, { AgentTemplate } from './components/AgentSelector';
import AgentChat from './components/AgentChat';
import { getLLMConfig } from './llmService';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // User customizable nickname
  const [userNickname, setUserNickname] = useState(() => {
    return localStorage.getItem('longmenzhen_user_nickname') || '发起人老张';
  });
  
  // Selected active AI agent
  const [activeAgent, setActiveAgent] = useState<AgentTemplate | null>(null);

  // Initialize or check key status on mount / updates
  useEffect(() => {
    checkApiKeyStatus();
  }, []);

  const checkApiKeyStatus = () => {
    const config = getLLMConfig();
    setHasApiKey(!!config.apiKey);
  };

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    setUserNickname(val);
    localStorage.setItem('longmenzhen_user_nickname', val);
  };

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
                  龙门阵 · 专属 AI 茶友馆
                </h1>
                <span className="text-[9px] font-bold border-2 border-black px-1.5 py-0.2 bg-amber-100 uppercase hidden sm:inline-block">
                  Pure Serverless / Ephemeral
                </span>
              </div>
            </div>

            {/* Quick API Key status badge & Action Button */}
            <div className="flex items-center gap-2" id="nav_right_actions">
              {hasApiKey ? (
                <div className="hidden md:flex items-center gap-1 border border-emerald-500 bg-emerald-50 text-emerald-900 px-2 py-0.8 text-[10px] font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>模型核心已适配就绪</span>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-1 border border-amber-500 bg-amber-50 text-amber-900 px-2 py-0.8 text-[10px] font-mono font-bold">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>未配置 API Key，请于右侧配置 ⚙</span>
                </div>
              )}

              <button
                onClick={() => setShowSettings(true)}
                className={`border-3 border-black px-3 py-1.5 text-xs font-mono font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${hasApiKey ? 'bg-black text-white hover:bg-neutral-800' : 'bg-yellow-300 text-black hover:bg-black hover:text-white animate-pulse'}`}
                id="btn_open_settings_panel"
              >
                <Key className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{hasApiKey ? '⚙ 适配参数配置' : '⚙ 点击配置 API Key'}</span>
              </button>
            </div>

          </div>
        </header>

        {/* Info Banner if missing Key altogether */}
        {!hasApiKey && (
          <div className="bg-yellow-50 border-b-2 border-black p-3.5 text-xs font-mono text-amber-950 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2" id="key_alert_banner">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 animate-bounce" />
              <span>
                <strong>通知：</strong>大模型未在本地适配。请先点击右侧按钮输入在官方或中转平台获取的 API Key 密钥，以便开启与 AI 茶友对话！
              </span>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="border border-black bg-black text-white text-[10px] px-2.5 py-1 font-bold font-mono hover:bg-neutral-100 hover:text-black cursor-pointer"
            >
              立刻去配置
            </button>
          </div>
        )}

        {/* Main Workspace Workspace */}
        <main className="flex-grow p-3 sm:p-5 md:p-6 flex flex-col justify-start bg-neutral-50" id="main_lobby_container">
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-start" id="lobby_grid_layout">
            
            {/* Left Column (SPAN 4) - Seat Settings & Agent Selection */}
            <div className="lg:col-span-4 space-y-5" id="lobby_left_column">
              
              {/* Profile seat card */}
              <div className="border-4 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3" id="user_profile_seat_box">
                <h3 className="text-xs font-mono font-black uppercase tracking-wider flex items-center gap-1 text-black border-b-2 border-black pb-1.5">
                  <Coffee className="w-3.5 h-3.5 text-black" />
                  <span>1. 确认您的茶座身份 (Your Seat ID)</span>
                </h3>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-600">
                    客官，今天您在茶楼摆阵用什么名号？
                  </label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={userNickname}
                      onChange={handleNicknameChange}
                      placeholder="例如: 发起人老张"
                      className="w-full bg-white border-2 border-black pl-8 pr-3 py-1.5 text-xs sm:text-sm text-black font-extrabold focus:outline-none"
                      id="input_global_user_nickname"
                    />
                  </div>
                  <p className="text-[10px] text-neutral-400 font-mono">
                    * 设置您的昵称后，AI 茶友会在讨论或生成结案总结时称呼您。
                  </p>
                </div>
              </div>

              {/* Agent Selector Card */}
              <div className="border-4 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" id="agent_selector_container">
                <AgentSelector
                  onSelected={(agent) => setActiveAgent(agent)}
                  activeAgentId={activeAgent?.id}
                  onOpenSettings={() => setShowSettings(true)}
                />
              </div>

              {/* Privacy protection notice */}
              <div className="border-2 border-dashed border-neutral-400 p-3 bg-neutral-100 text-[10px] sm:text-xs text-neutral-500 font-mono leading-relaxed" id="local_privacy_banner">
                <span className="font-extrabold text-black block mb-0.5 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  本茶楼郑重契约（阅后即销毁）：
                </span>
                您的所有私密聊天历史、自定义 Agent 数据全部存储在您个人的手机或电脑本地 (LocalStorage)，<strong>云端服务器不设存储中继、不架设数据库数据库</strong>。一旦主动点击并砸烂茶盅，记录将永远彻底销毁，支持绝对隐私防护。
              </div>

            </div>

            {/* Right Column (SPAN 8) - Active Chat Session dashboard */}
            <div className="lg:col-span-8 h-full flex flex-col" id="lobby_right_column">
              {activeAgent ? (
                /* Chat view */
                <div className="animate-fade-in flex flex-col flex-grow">
                  <AgentChat
                    agent={activeAgent}
                    onOpenSettings={() => setShowSettings(true)}
                    userNickname={userNickname}
                  />
                </div>
              ) : (
                /* Blank Slate state guiding selection */
                <div className="border-4 border-black border-dashed bg-white p-12 text-center my-auto flex flex-col items-center justify-center space-y-6 min-h-[450px]" id="empty_chat_blank_slate">
                  <div className="border-4 border-black p-5 bg-yellow-100 inline-block">
                    <Coffee className="w-12 h-12 text-black animate-pulse" />
                  </div>
                  <div className="space-y-2 max-w-md">
                    <h2 className="text-xl font-black font-sans uppercase tracking-tight">
                      好一个暖春下午，快摆起“龙门阵”！
                    </h2>
                    <p className="text-xs text-neutral-600 leading-relaxed font-mono">
                      客官请在<strong>左侧挑选一位茶友</strong>开始辩论过招！如果您觉得常驻的几位脾气不对，也可以点击【✨ 淬炼新客官】亲手淬炼一名专属您的辩论高僧。
                    </p>
                  </div>
                  <div className="pt-2 animate-bounce">
                    <span className="font-mono text-xs text-neutral-400">
                      ← 选妥阵友起锅开盖 👴🏽👩🏻‍🍳🧘‍♂️
                    </span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </main>

        {/* Footer info box */}
        <footer className="border-t-4 border-black py-4 px-6 bg-white text-center text-xs font-mono text-neutral-500 shrink-0" id="main_footer_box">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>© 2026 龙门茶馆. 专属 AI 客服话事论政平台. All rights reserved.</span>
            <span className="font-bold text-black flex items-center gap-1">
              <span>Made with Antigravity</span>
              <Heart className="w-3 h-3 text-red-500 fill-current" />
            </span>
          </div>
        </footer>

      </div>

      {/* Settings parameter config drawer layer modal */}
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
