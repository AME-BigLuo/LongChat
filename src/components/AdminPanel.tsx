import React, { useState, useEffect } from 'react';
import { Key, Check, Info, ShieldAlert, Cpu, Globe, Users, Plus, ListCollapse, FileCode, CheckCircle2, LogOut, Copy, Download } from 'lucide-react';

interface AdminPanelProps {
  onClosed: () => void;
  loggedInAdmin: string | null;
  onLogin: (username: string) => void;
  onLogout: () => void;
}

export default function AdminPanel({ onClosed, loggedInAdmin, onLogin, onLogout }: AdminPanelProps) {
  // Login fields
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Config fields
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('gemini-3.1-flash-lite');
  const [status, setStatus] = useState<{ hasKey: boolean; source: string; baseUrl: string; model: string } | null>(null);
  
  // Accounts management
  const [adminAccounts, setAdminAccounts] = useState<string[]>([]);
  const [newAdminUser, setNewAdminUser] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [accountSuccessMsg, setAccountSuccessMsg] = useState('');
  const [accountErrorMsg, setAccountErrorMsg] = useState('');

  // Rooms list state
  const [myRooms, setMyRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [activeTab, setActiveTab] = useState<'rooms' | 'keys' | 'accounts'>('rooms');

  // Preview Summary Modal
  const [previewSummaryHtml, setPreviewSummaryHtml] = useState<string | null>(null);
  const [previewRoomName, setPreviewRoomName] = useState('');

  // General loading states etc
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (loggedInAdmin) {
      fetchStatus();
      fetchMyRooms();
      fetchAccounts();
    }
  }, [loggedInAdmin]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setStatus(data);
      if (data.baseUrl) setBaseUrl(data.baseUrl);
      if (data.model) setModel(data.model);
    } catch (err) {
      console.error('Failed to get config status:', err);
    }
  };

  const fetchMyRooms = async () => {
    if (!loggedInAdmin) return;
    setLoadingRooms(true);
    try {
      const res = await fetch(`/api/admin/rooms?adminId=${encodeURIComponent(loggedInAdmin)}`);
      if (res.ok) {
        const data = await res.json();
        setMyRooms(data.rooms || []);
      }
    } catch (err) {
      console.error('Failed to load admin rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/admin/accounts');
      if (res.ok) {
        const data = await res.json();
        setAdminAccounts(data.accounts || []);
      }
    } catch (err) {
      console.error('Failed to fetch administrator listings:', err);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUser.trim() || !loginPass.trim()) {
      setLoginError('请填写用户名与密码');
      return;
    }
    setLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser.trim(), password: loginPass.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onLogin(data.username);
        setLoginUser('');
        setLoginPass('');
      } else {
        setLoginError(data.error || '验证失败，用户名或密码有误');
      }
    } catch (err) {
      setLoginError('云端网络连接失败，请稍后刷新重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setMessage('');

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          apiKey: apiKey.trim() || undefined,
          baseUrl: baseUrl.trim(),
          model: model.trim()
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('大模型兼容配置与密钥参数更新成功！结构已持久化保存。');
        setApiKey('');
        fetchStatus();
      } else {
        setErrorMsg(data.error || '保存失败');
      }
    } catch (err) {
      setErrorMsg('服务端网络异常，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUser.trim() || !newAdminPass.trim()) {
      setAccountErrorMsg('请提供有效的用户名和密码');
      return;
    }

    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authUser: loggedInAdmin,
          username: newAdminUser.trim(),
          password: newAdminPass.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAccountSuccessMsg(data.message || '子管理员账号注册成功！');
        setNewAdminUser('');
        setNewAdminPass('');
        setAccountErrorMsg('');
        fetchAccounts();
      } else {
        setAccountErrorMsg(data.error || '添加失败');
      }
    } catch (err) {
      setAccountErrorMsg('添加失败，服务器通讯异常');
    }
  };

  const setModelPreset = (presetModel: string) => {
    setModel(presetModel);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已成功复制到剪贴板！');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-black" id="admin_overlay">
      
      {/* 1. Preview Summary HTML Mode */}
      {previewSummaryHtml ? (
        <div className="bg-white border-4 border-black w-full max-w-4xl h-[90vh] flex flex-col p-6 relative animate-fade-in">
          <button 
            onClick={() => setPreviewSummaryHtml(null)}
            className="absolute top-4 right-4 bg-black text-white hover:bg-neutral-200 hover:text-black px-3 py-1 border-2 border-black font-bold font-mono transition-all"
          >
            返回工作台 ✕
          </button>
          
          <div className="border-b-2 border-black pb-2 mb-4">
            <h3 className="text-xl font-bold font-mono">
              龙门阵讨论大盘终局记录 - {previewRoomName}
            </h3>
            <p className="text-xs text-neutral-500 font-mono mt-0.5">
              以下大模型生成的终局研讨 HTML 已安全存档在系统持久库中。您可以随时复制或下载分发。
            </p>
          </div>

          <div className="flex-grow border-2 border-dashed border-neutral-300 p-2 overflow-auto bg-neutral-50">
            <iframe 
              srcDoc={previewSummaryHtml} 
              className="w-full h-full bg-white border border-black" 
              title="Discussion Summary Preview"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t-2 border-black mt-4">
            <button
              onClick={() => copyToClipboard(previewSummaryHtml)}
              className="border-2 border-black px-4 py-2 font-mono text-xs font-bold hover:bg-neutral-100 flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" /> 复制 HTML 源代码
            </button>
            <a
              href={`data:text/html;charset=utf-8,${encodeURIComponent(previewSummaryHtml)}`}
              download={`summary_${previewRoomName}.html`}
              className="border-2 border-black bg-black text-white px-4 py-2 font-mono text-xs font-bold hover:bg-white hover:text-black transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> 导出/下载总结网页
            </a>
          </div>
        </div>
      ) : (
        <div className="bg-white border-4 border-black max-w-4xl w-full p-6 relative flex flex-col max-h-[90vh] overflow-y-auto" id="admin_card">
          
          {/* Close Button */}
          <button
            onClick={onClosed}
            className="absolute top-4 right-4 text-black hover:bg-black hover:text-white p-1 border-2 border-transparent hover:border-black transition-all"
            id="btn_close_admin"
          >
            ✕
          </button>

          {/* If NOT Logger in -> Show Login UI */}
          {!loggedInAdmin ? (
            <div className="py-4" id="login_form_container">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-black">
                <Key className="w-6 h-6 stroke-[2]" />
                <h2 className="text-xl font-bold font-mono tracking-tight">管理人员身份校验 / 登录</h2>
              </div>
              <p className="text-xs text-neutral-600 mb-6 leading-relaxed">
                为满足 Cloudflare 多实例及多租户环境下消息的隐私安全隔离，龙门阵的所有房间创建与 AI 系统参数配置必须通过管理者账号进行。
              </p>

              <form onSubmit={handleLoginSubmit} className="space-y-4 max-w-md mx-auto border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div>
                  <label className="block text-xs font-mono font-bold uppercase mb-1">管理者账号 (Username)</label>
                  <input
                    type="text"
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                    placeholder="请输入管理员用户名"
                    className="w-full bg-white border-2 border-black p-2 text-sm font-mono focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold uppercase mb-1">管理者密码 (Password)</label>
                  <input
                    type="password"
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    placeholder="请输入管理员密码"
                    className="w-full bg-white border-2 border-black p-2 text-sm font-mono focus:outline-none"
                    required
                  />
                </div>

                {loginError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 p-2 font-mono">
                    ⚠️ {loginError}
                  </p>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-black text-white py-2 font-mono text-sm font-bold border-2 border-black hover:bg-white hover:text-black transition-all"
                  >
                    {loading ? '正在进行密钥及数据库匹配...' : '立即登录管理者后台'}
                  </button>
                </div>
              </form>

              {/* Seeding credentials footnotes */}
              <div className="mt-8 bg-neutral-50 p-4 border border-black text-xs space-y-1 font-mono text-neutral-500">
                <p className="font-bold text-black flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-neutral-600" /> 系统内置/Cloudflare 环境变量配置指引：
                </p>
                <p>1. 本地测试或首次部署默认初始系统管理员：</p>
                <p className="text-black font-semibold pl-4">用户名 / 账号： admin</p>
                <p className="text-black font-semibold pl-4">预设初始密码： adminpassword</p>
                <p>2. 云部署时建议您在 Cloudflare Dashboard 或者是 Docker 平台容器声明环境变量：</p>
                <div className="bg-neutral-100 p-2 text-[11px] text-zinc-700 mt-1">
                  ADMIN_ACCOUNTS="admin:您的强密码,owner:第二个伙伴密码"
                </div>
              </div>
            </div>
          ) : (
            // LOGGED IN DASHBOARD
            <div className="flex flex-col flex-grow h-full" id="admin_dashboard">
              
              {/* Header profile */}
              <div className="border-b-2 border-black pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-green-500 animate-pulse rounded-full border border-black"></span>
                    <span className="text-xs font-mono font-bold bg-neutral-100 px-1.5 border border-black">
                      管理员已连接: {loggedInAdmin}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black font-sans uppercase text-black mt-1">
                    管理者工作大堂 (Admin Console)
                  </h2>
                </div>
                
                <button
                  onClick={onLogout}
                  className="border-2 border-black text-xs font-mono font-bold px-3 py-1.5 bg-neutral-100 text-black hover:bg-black hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> 退出登录
                </button>
              </div>

              {/* Sub-navigation tabs */}
              <div className="flex border-b-2 border-black mb-4 font-mono text-xs font-bold overflow-x-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('rooms')}
                  className={`px-4 py-2 border-r-2 border-black hover:bg-neutral-50 flex items-center gap-1.5 ${activeTab === 'rooms' ? 'bg-black text-white hover:bg-black' : 'text-neutral-500'}`}
                >
                  <ListCollapse className="w-3.5 h-3.5" /> 我管辖的聊天室房间 ({myRooms.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('keys')}
                  className={`px-4 py-2 border-r-2 border-black hover:bg-neutral-50 flex items-center gap-1.5 ${activeTab === 'keys' ? 'bg-black text-white hover:bg-black' : 'text-neutral-500'}`}
                >
                  <Cpu className="w-3.5 h-3.5" /> 配置大模型 & 密钥
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('accounts')}
                  className={`px-4 py-2 hover:bg-neutral-50 flex items-center gap-1.5 ${activeTab === 'accounts' ? 'bg-black text-white hover:bg-black' : 'text-neutral-500'}`}
                >
                  <Users className="w-3.5 h-3.5" /> 管理团队账号 ({adminAccounts.length})
                </button>
              </div>

              {/* TAB 1: OWNED ROOMS */}
              {activeTab === 'rooms' && (
                <div className="space-y-4 flex-grow overflow-y-auto max-h-[50vh]">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono text-neutral-500">以下房间由您独立管辖，其他管理员无法看见或修改</span>
                    <button 
                      onClick={fetchMyRooms}
                      className="underline font-mono text-black hover:opacity-85"
                    >
                      刷新列表 ↻
                    </button>
                  </div>

                  {loadingRooms ? (
                    <p className="text-center text-xs text-neutral-400 font-mono py-10">正在调取您的专属会场记录...</p>
                  ) : myRooms.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-neutral-300">
                      <p className="text-sm text-neutral-400 font-mono">您尚未创建过任何研讨会。</p>
                      <p className="text-xs text-neutral-500 font-mono mt-1">关闭弹窗并在首页点击[开炉发阵]即刻创建新讨论。</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {myRooms.map((r: any) => (
                        <div key={r.id} className="border-2 border-black bg-white p-4 flex flex-col justify-between sm:flex-row sm:items-center gap-4">
                          <div className="space-y-1 text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold bg-neutral-100 px-1.5 border border-black text-black">
                                ID: {r.id}
                              </span>
                              {r.status === 'active' ? (
                                <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-800 px-1 font-black animate-pulse">
                                  ● 讨论进行中 (ACTIVE)
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-neutral-500 bg-neutral-100 border border-neutral-300 px-1 font-bold">
                                  ■ 已散伙销毁 (DESTROYED)
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-base text-black font-sans">{r.name}</h4>
                            <p className="text-xs text-neutral-500 font-mono">
                              控制 Agent: <span>{r.agentNickname}</span> | 建房时间: {new Date(r.createdAt).toLocaleString()}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end">
                            {r.status === 'active' && (
                              <button
                                onClick={() => copyToClipboard(`${window.location.protocol}//${window.location.host}/?roomId=${r.id}`)}
                                className="border border-black px-2 py-1 text-[11px] font-mono hover:bg-neutral-50 flex items-center gap-1 bg-white"
                              >
                                <Copy className="w-3 h-3" /> 复制加入链接
                              </button>
                            )}
                            
                            {r.summaryHtml ? (
                              <button
                                onClick={() => {
                                  setPreviewSummaryHtml(r.summaryHtml);
                                  setPreviewRoomName(r.name);
                                }}
                                className="border border-black bg-neutral-900 text-white hover:bg-white hover:text-black transition-all px-2 py-1 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                              >
                                <FileCode className="w-3 h-3" /> 阅看终局总结
                              </button>
                            ) : (
                              r.status === 'active' && (
                                <span className="text-[10px] text-neutral-400 font-mono py-1 self-center">
                                  [等待研讨终局]
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: MODEL SETTINGS */}
              {activeTab === 'keys' && (
                <form onSubmit={handleSaveConfig} className="space-y-4 text-left">
                  <div className="bg-neutral-50 p-3 border border-black font-mono space-y-1">
                    <div className="flex items-center gap-2 text-xs text-black">
                      <Info className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      <span>运行配置探针：</span>
                      {status ? (
                        status.hasKey ? (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-1 border border-emerald-700">
                            已就绪({status.source === 'env' ? '源于环境参数' : '源于临时内存'})
                          </span>
                        ) : (
                          <span className="text-red-700 font-bold bg-red-50 px-1 border border-red-700">
                            未配置 API 密钥
                          </span>
                        )
                      ) : (
                        '获取中...'
                      )}
                    </div>
                    {status && (
                      <p className="text-[11px] text-neutral-500">
                        当前模型: <strong className="text-neutral-800">{status.model}</strong> | 自定义端点: <strong className="text-neutral-800">{status.baseUrl || '官方谷歌直达'}</strong>
                      </p>
                    )}
                  </div>

                  {/* API Key Input */}
                  <div>
                    <label className="block text-xs font-mono font-bold uppercase mb-1 text-black flex items-center gap-1">
                      <Key className="w-3.5 h-3.5" /> API Key (大模型密钥):
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={status?.hasKey ? "••••••••••••   (留空代表采用原本设置，输入新值可覆盖)" : "API Key 秘钥"}
                      className="w-full bg-white border-2 border-black p-2 text-sm font-mono placeholder-neutral-400 focus:outline-none focus:bg-neutral-50 text-black animate-fade-in"
                      id="admin_apikey_input"
                    />
                  </div>

                  {/* Base URL Input */}
                  <div>
                    <label className="block text-xs font-mono font-bold uppercase mb-1 text-black flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" /> API Base URL (可选/中转端点地址):
                    </label>
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="例: https://api.openai.com/v1 或 https://grsai.com/v1 等"
                      className="w-full bg-white border-2 border-black p-2 text-sm font-mono placeholder-neutral-400 focus:outline-none focus:bg-neutral-50 text-black"
                      id="admin_baseurl_input"
                    />
                    <p className="text-[10px] text-neutral-400 mt-1">
                      * 留空则系统自动使用官方 Google Gemini API 网络结构；指定自定义中转端点则采用 OpenAI 兼容协议。
                    </p>
                  </div>

                  {/* Model Selection */}
                  <div>
                    <label className="block text-xs font-mono font-bold uppercase mb-1 text-black flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5" /> Active Model (模型标识码):
                    </label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="gemini-3.1-flash-lite"
                      className="w-full bg-white border-2 border-black p-2 text-sm font-mono placeholder-neutral-400 focus:outline-none focus:bg-neutral-50 text-black"
                      id="admin_model_input"
                    />

                    {/* Quick Presets */}
                    <div className="flex flex-wrap gap-1 mt-1.5" id="admin_presets">
                      <span className="text-[10px] self-center text-neutral-400 font-mono mr-1">一键配置推荐：</span>
                      <button
                        type="button"
                        onClick={() => setModelPreset('gemini-3.1-flash-lite')}
                        className={`text-[10px] font-mono px-2 py-0.5 border ${model === 'gemini-3.1-flash-lite' ? 'border-black bg-black text-white' : 'border-neutral-300 hover:border-black text-neutral-600'}`}
                      >
                        gemini-3.1-flash-lite (最省最快)
                      </button>
                      <button
                        type="button"
                        onClick={() => setModelPreset('gemini-3.5-flash')}
                        className={`text-[10px] font-mono px-2 py-0.5 border ${model === 'gemini-3.5-flash' ? 'border-black bg-black text-white' : 'border-neutral-300 hover:border-black text-neutral-600'}`}
                      >
                        gemini-3.5-flash
                      </button>
                      <button
                        type="button"
                        onClick={() => setModelPreset('gpt-4o-mini')}
                        className={`text-[10px] font-mono px-2 py-0.5 border ${model === 'gpt-4o-mini' ? 'border-black bg-black text-white' : 'border-neutral-300 hover:border-black text-neutral-600'}`}
                      >
                        gpt-4o-mini
                      </button>
                      <button
                        type="button"
                        onClick={() => setModelPreset('deepseek-chat')}
                        className={`text-[10px] font-mono px-2 py-0.5 border ${model === 'deepseek-chat' ? 'border-black bg-black text-white' : 'border-neutral-300 hover:border-black text-neutral-600'}`}
                      >
                        deepseek-chat
                      </button>
                    </div>
                  </div>

                  {message && (
                    <div className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-800 p-2.5 flex items-center gap-2 animate-fade-in" id="admin_success_msg">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{message}</span>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="text-xs bg-red-50 text-red-800 border border-red-800 p-2.5 flex items-center gap-2 animate-fade-in" id="admin_error_msg">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full sm:w-auto px-6 py-2 text-xs font-mono font-bold border-2 border-black bg-black text-white hover:bg-white hover:text-black transition-all cursor-pointer"
                    >
                      {loading ? '正在保存中...' : '提交配置更新'}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: ADMIN ACCOUNTS */}
              {activeTab === 'accounts' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-left">
                  
                  {/* Left part: admin accounts list */}
                  <div className="md:col-span-6 space-y-3">
                    <h4 className="text-xs font-mono font-bold uppercase text-zinc-500">
                      已授权管理员名单 ({adminAccounts.length})
                    </h4>
                    
                    <div className="border border-black p-4 space-y-2 bg-neutral-50 font-mono text-xs max-h-[35vh] overflow-y-auto">
                      {adminAccounts.map((ac, idx) => (
                        <div key={ac} className="flex justify-between items-center py-1.5 border-b border-neutral-200 last:border-0 text-black">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-600" />
                            {ac}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {idx === 0 ? '默认/种子账号' : '团队协作子人员'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-neutral-400 font-mono leading-tight">
                      * 团队内任一管理员均能对大模型API key进行设定，但各自创建的聊天室仍独立互不干扰。
                    </p>
                  </div>

                  {/* Right part: Add other admins account */}
                  <form onSubmit={handleCreateAccount} className="md:col-span-6 border-2 border-black p-4 space-y-4 bg-white relative">
                    <h4 className="text-xs font-mono font-bold uppercase flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> 注册/新增管理员账号
                    </h4>

                    <div>
                      <label className="block text-[10px] font-mono font-semibold mb-0.5">新增子账号用户名</label>
                      <input
                        type="text"
                        value={newAdminUser}
                        onChange={(e) => setNewAdminUser(e.target.value)}
                        placeholder="用户名"
                        className="w-full bg-white border border-black p-1.5 text-xs font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-semibold mb-0.5">预设进入密码</label>
                      <input
                        type="password"
                        value={newAdminPass}
                        onChange={(e) => setNewAdminPass(e.target.value)}
                        placeholder="密码"
                        className="w-full bg-white border border-black p-1.5 text-xs font-mono focus:outline-none"
                      />
                    </div>

                    {accountSuccessMsg && (
                      <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 font-mono">
                        ✓ {accountSuccessMsg}
                      </p>
                    )}

                    {accountErrorMsg && (
                      <p className="text-[11px] text-red-800 bg-red-50 border border-red-200 p-2 font-mono">
                        ! {accountErrorMsg}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-black text-white hover:bg-neutral-100 hover:text-black py-1.5 text-xs font-mono font-bold border border-black transition-all cursor-pointer"
                    >
                      确认添加该成员
                    </button>
                  </form>

                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}
