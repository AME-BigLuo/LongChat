import React, { useState, useEffect } from 'react';
import { Sparkles, MessageSquare, Plus, Key, HelpCircle, Shield, Heart, CornerDownRight, ArrowRight } from 'lucide-react';
import AdminPanel from './components/AdminPanel';
import RoomCreate from './components/RoomCreate';
import RoomActive from './components/RoomActive';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'create' | 'active'>('home');
  const [roomId, setRoomId] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [userNickname, setUserNickname] = useState('');
  const [userRole, setUserRole] = useState<'creator' | 'participant'>('participant');
  const [showAdmin, setShowAdmin] = useState(false);
  const [loggedInAdmin, setLoggedInAdmin] = useState<string | null>(() => {
    return localStorage.getItem('longmenzhen_admin');
  });

  // Simple input box in the homepage for quick password join
  const [joinRoomIdInput, setJoinRoomIdInput] = useState('');
  const [homepageError, setHomepageError] = useState('');

  // 1. URL routing detection (for invited joining link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mRoomId = params.get('roomId');
    if (mRoomId) {
      setRoomId(mRoomId);
      setUserRole('participant');
      setCurrentView('active');
    }
  }, []);

  const handleRoomCreated = (newRoomId: string, adminPassword: string, nickname: string) => {
    setRoomId(newRoomId);
    setRoomPassword(adminPassword);
    setUserNickname(nickname);
    setUserRole('creator');
    setCurrentView('active');
  };

  const handleExitRoom = () => {
    // Reset to homepage
    setRoomId('');
    setRoomPassword('');
    setUserNickname('');
    setUserRole('participant');
    setHomepageError('');
    setCurrentView('home');
    
    // Clear URL parameters securely
    if (window.history.pushState) {
      const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.pushState({ path: newurl }, '', newurl);
    }
  };

  const handleQuickJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomIdInput.trim()) {
      setHomepageError('请输入房间编号');
      return;
    }
    setRoomId(joinRoomIdInput.trim());
    setUserRole('participant');
    setCurrentView('active');
    setJoinRoomIdInput('');
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-black flex flex-col p-1 sm:p-4 font-sans" id="app_root">
      
      {/* Dynamic Main App Brutalist Frame Container */}
      <div className="flex-grow bg-white border-4 md:border-8 border-black flex flex-col min-h-[95vh] relative" id="app_frame">
        
        {/* Universal Minimalist Top Navigation Header - Artistic Flair Styled */}
        <header className="border-b-4 border-black bg-white py-4 px-6 sticky top-0 z-40 transition-all shrink-0" id="main_nav_header">
          <div className="max-w-6xl mx-auto flex justify-between items-center" id="nav_wrapper">
            <div className="flex items-center gap-3 cursor-pointer" onClick={handleExitRoom} id="nav_logo">
              {/* Grid Square Pixel Logo Motif for LongMenZhen */}
              <div className="grid grid-cols-2 gap-0.5 border-4 border-black p-0.5 shrink-0 bg-black">
                <div className="w-3.5 h-3.5 bg-white"></div>
                <div className="w-3.5 h-3.5 bg-black"></div>
                <div className="w-3.5 h-3.5 bg-black"></div>
                <div className="w-3.5 h-3.5 bg-white"></div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl md:text-3xl font-black tracking-tighter uppercase text-black">
                  龙门阵
                </span>
                <span className="text-[10px] font-bold border-2 border-black px-2 py-0.5 bg-neutral-100 text-black uppercase hidden sm:inline-block">
                  Encrypted / Temporary
                </span>
              </div>
            </div>

            <div className="flex gap-2" id="nav_buttons">
              <button
                onClick={() => setShowAdmin(true)}
                className={`border-3 border-black px-3 py-1.5 text-xs font-mono font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${loggedInAdmin ? 'bg-black text-white' : 'bg-white text-black hover:bg-black hover:text-white'}`}
                id="btn_admin_config_entry"
              >
                <Key className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{loggedInAdmin ? `管理工作台 [${loggedInAdmin}]` : '管理员登录/控制台'}</span>
              </button>
            </div>
          </div>
        </header>

      {/* Main Content Areas based on dynamic routing state */}
      <main className="flex-grow py-8 px-4 md:px-6 relative flex flex-col justify-start" id="app_main_box">
        <div className="max-w-6xl mx-auto w-full flex-grow flex flex-col" id="view_route_box">
          
          {/* VIEW 1: HOME LANDING VIEW */}
          {currentView === 'home' && (
            <div className="space-y-12 my-auto max-w-4xl mx-auto py-4" id="home_landing_grid">
              
              {/* Split Screen Layout: Traditional meets tech aesthetics */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center" id="home_landing_split">
                
                {/* Left hand column: Typography focus */}
                <div className="md:col-span-7 space-y-6 text-left" id="home_info_col">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 border border-black px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider bg-black text-white rounded-none">
                      <Sparkles className="w-3 h-3 text-white fill-white" />
                      <span>全物理内存托管 · 阅后即离关机即毁</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-black tracking-tight leading-none font-sans">
                      摆起龙门阵，<br />
                      智汇有主持。
                    </h1>
                    <p className="text-sm text-neutral-600 leading-relaxed max-w-lg pt-1">
                      「龙门阵」是一个专注于高隐私度、即创即毁、极简美学的多方实时语音研讨聊天室。
                      在这里，你是阵主。定义您的话题脉络与期待产出，Gemini 将为您深度淬炼出一个专业的<strong>协同话事 Agent</strong>。
                    </p>
                  </div>

                  {/* Operational Entry Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2" id="quick_panel_cards">
                    {/* Card A: Create */}
                    <div
                      onClick={() => setCurrentView('create')}
                      className="border-2 border-black bg-white p-5 cursor-pointer hover:bg-neutral-50 transition-all text-left flex flex-col justify-between h-36"
                      id="card_create_lobby"
                    >
                      <div className="space-y-1">
                        <h3 className="font-bold underline text-black text-sm flex items-center gap-1.5">
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                          开炉发阵 (创建房间)
                        </h3>
                        <p className="text-[11px] text-neutral-500 font-mono leading-tight">
                          定义您研讨的论点、主旨、密码，自动注入控制多方沟通节奏的 AI 主持人。
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-black font-extrabold flex items-center gap-0.5 self-end">
                        免费发起房间 <CornerDownRight className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    {/* Card B: Quick join through key identifier */}
                    <div className="border-2 border-black bg-white p-5 text-left flex flex-col justify-between h-36" id="card_join_lobby">
                      <div className="space-y-1">
                        <h3 className="font-bold underline text-black text-sm">
                          输入编号入阵 (快速加入)
                        </h3>
                        <p className="text-[11px] text-neutral-500 font-mono leading-tight">
                          如果您已知道朋友开设的聊天室号，可以在下方直接输入跳转接入。
                        </p>
                      </div>
                      
                      <form onSubmit={handleQuickJoinSubmit} className="flex gap-1.5 mt-2" id="quick_join_form">
                        <input
                          type="text"
                          placeholder="房间编号 (例如: 8ab2g)"
                          value={joinRoomIdInput}
                          onChange={(e) => setJoinRoomIdInput(e.target.value)}
                          className="flex-1 bg-white border border-black p-1 text-xs text-black focus:outline-none text-center font-mono"
                          id="quick_room_id_input"
                        />
                        <button
                          type="submit"
                          className="border border-black bg-black text-white px-2 py-1 text-xs font-mono font-bold hover:bg-white hover:text-black transition-all cursor-pointer"
                          id="btn_quick_join"
                        >
                          加入
                        </button>
                      </form>
                    </div>
                  </div>

                  {homepageError && (
                    <p className="text-xs text-red-700 bg-red-50 border border-red-200 p-2 font-mono" id="hp_error_box">
                      ! {homepageError}
                    </p>
                  )}
                </div>

                {/* Right hand column: Art-grid tech lines (brutalist Sichuan visual representation) */}
                <div className="md:col-span-5 hidden md:flex flex-col items-center justify-center p-4 border-2 border-black bg-white min-h-[300px]" id="visual_identity_col">
                  <div className="relative w-full aspect-square border border-neutral-200 max-w-[280px] p-6 flex flex-col justify-between" id="visual_teahouse_motif">
                    {/* Traditional Sichuan teahouse blueprint wireframe lines */}
                    <div className="absolute inset-0 grid grid-cols-6 divide-x divide-neutral-100 grid-rows-6 divide-y divide-neutral-100 pointer-events-none" />
                    
                    <div className="space-y-1.5 z-10" id="m_banner">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Teahouse Grid Wireframe</span>
                      <div className="h-0.5 bg-black w-10"></div>
                    </div>

                    {/* Minimal teacup shape using HTML lines */}
                    <div className="my-auto text-center z-10 flex flex-col items-center" id="m_logo_vector">
                      <div className="w-20 h-10 border-2 border-black relative rounded-b-xl border-t-0 bg-transparent flex items-center justify-center">
                        <div className="absolute right-[-10px] top-[4px] w-4 h-5 border-2 border-black border-l-0 rounded-r-lg"></div>
                        <span className="text-[10px] font-mono tracking-tighter text-black uppercase animate-pulse">
                          LIVE CHAT
                        </span>
                      </div>
                      <div className="w-24 h-0.5 bg-black mt-2"></div>
                      <span className="text-[10px] font-mono text-neutral-400 mt-1">「 围炉煮茶 · 言论无痕 」</span>
                    </div>

                    <div className="flex justify-between items-end border-t border-black/20 pt-2 z-10" id="m_footer">
                      <span className="font-mono text-[9px] text-neutral-500">PEER REAL VOICE</span>
                      <span className="font-mono text-[9px] text-green-700 font-extrabold animate-pulse">● WEB RTC P2P</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Grid 2: Core Philosophy / Security Badging */}
              <div className="border-t-2 border-black pt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left" id="philosophy_box">
                <div className="space-y-1.5" id="phil_privacy">
                  <h4 className="font-bold text-sm text-black uppercase flex items-center gap-1 font-mono">
                    <Shield className="w-4 h-4 text-black" />
                    安全隐私极致主义
                  </h4>
                  <p className="text-neutral-500 text-xs leading-normal">
                    不同于留存分析的社交软件，龙门阵没有数据库持久层。所有参与者的聊天记录仅随进程滞留在临时运行内存，会话关闭时执行彻底的终极销毁。
                  </p>
                </div>
                <div className="space-y-1.5" id="phil_agent">
                  <h4 className="font-bold text-sm text-black uppercase flex items-center gap-1 font-mono">
                    <Sparkles className="w-4 h-4 text-black" />
                    AI 主持协调控场
                  </h4>
                  <p className="text-neutral-500 text-xs leading-normal">
                    创建房间时，您可以预先针对讨论期望目标、言论倾向度让 Gemini 为此量身定制它的内置 System指令，AI 将在讨论偏移时自动插嘴并纠偏。
                  </p>
                </div>
                <div className="space-y-1.5" id="phil_export">
                  <h4 className="font-bold text-sm text-black uppercase flex items-center gap-1 font-mono">
                    <MessageSquare className="w-4 h-4 text-black" />
                    离线精纳 HTML 导出
                  </h4>
                  <p className="text-neutral-500 text-xs leading-normal">
                    当对话收尾时，主持人 Agent 会在物理销毁服务器消息之前，精炼撰写出一份包含主客观纠正和观点整理的 HTML 总结，一键分发并导给所有人。
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* VIEW 2: CREATE MEETING FORM */}
          {currentView === 'create' && (
            <div className="py-2 animate-fade-in" id="room_create_panel_box">
              <div className="mb-4 text-left" id="btn_back_home_wrap">
                <button
                  onClick={() => setCurrentView('home')}
                  className="text-xs font-mono text-neutral-500 hover:text-black hover:underline cursor-pointer flex items-center gap-1"
                >
                  ← 返回大堂 (Cancel and Back)
                </button>
              </div>
              <RoomCreate
                onRoomCreated={handleRoomCreated}
                onOpenAdmin={() => setShowAdmin(true)}
                loggedInAdmin={loggedInAdmin}
              />
            </div>
          )}

          {/* VIEW 3: ACTIVE ROOM workspace */}
          {currentView === 'active' && roomId && (
            <div className="flex-1 animate-fade-in" id="room_active_panel_box">
              <RoomActive
                roomId={roomId}
                initialPassword={roomPassword}
                userNickname={userNickname}
                userRole={userRole}
                onExit={handleExitRoom}
              />
            </div>
          )}

        </div>
      </main>

      {/* Admin system Configuration Overlay Panel */}
      {showAdmin && (
        <AdminPanel
          onClosed={() => setShowAdmin(false)}
          loggedInAdmin={loggedInAdmin}
          onLogin={(username) => {
            setLoggedInAdmin(username);
            localStorage.setItem('longmenzhen_admin', username);
          }}
          onLogout={() => {
            setLoggedInAdmin(null);
            localStorage.removeItem('longmenzhen_admin');
          }}
        />
      )}

      {/* Footer copyright */}
      <footer className="border-t-2 border-black py-4 px-6 bg-white text-center shrink-0" id="main_footer_bar">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center text-xs font-mono text-neutral-500 gap-2" id="footer_wrapper">
          <p>© 2026 龙门阵 (LongMenZhen). 摆龙门阵，理通天下。数据完全不留痕。</p>
          <p className="flex items-center gap-1">
            <span>Powered by Gemini 3.5 Flash & WebRTC</span>
          </p>
        </div>
      </footer>

      </div> {/* End app_frame */}
    </div>
  );
}
