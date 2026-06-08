import React, { useState, useEffect } from 'react';
import { Key, Globe, Cpu, Check, HelpCircle, Zap, Sliders } from 'lucide-react';
import { getLLMConfig, saveLLMConfig, LLMConfig, fetchAvailableModels, getCompressionConfig, saveCompressionConfig } from '../llmService';

interface SettingsModalProps {
  onClose: () => void;
  onConfigSaved: () => void;
}

type ProviderType = 'grsai' | 'gemini' | 'deepseek' | 'openai' | 'custom';

export default function SettingsModal({ onClose, onConfigSaved }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('gemini-3.1-flash-lite');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Advanced model list integration
  const [apiProvider, setApiProvider] = useState<ProviderType>('grsai');
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Dynamic Context Compression & Token Optimizer States
  const [maxTurns, setMaxTurns] = useState(8);
  const [compressHtml, setCompressHtml] = useState(true);
  const [compressLongText, setCompressLongText] = useState(true);
  const [maxCharLimit, setMaxCharLimit] = useState(350);

  useEffect(() => {
    const config = getLLMConfig();
    setApiKey(config.apiKey);
    
    const base = config.baseUrl || 'https://api.grsai.com/v1';
    setBaseUrl(base);
    setModel(config.model || 'gemini-3.1-flash-lite');

    // Load custom context compression configuration
    const compConfig = getCompressionConfig();
    setMaxTurns(compConfig.maxTurns);
    setCompressHtml(compConfig.compressHtml);
    setCompressLongText(compConfig.compressLongText);
    setMaxCharLimit(compConfig.maxCharLimit);

    // Auto-detect Provider based on baseUrl
    const bLower = base.toLowerCase();
    if (bLower.includes('api.grsai.com')) {
      setApiProvider('grsai');
    } else if (!base) {
      setApiProvider('gemini');
    } else if (bLower.includes('api.deepseek.com')) {
      setApiProvider('deepseek');
    } else if (bLower.includes('api.openai.com')) {
      setApiProvider('openai');
    } else {
      setApiProvider('custom');
    }
  }, []);

  const handleProviderChange = (provider: ProviderType) => {
    setApiProvider(provider);
    setFetchedModels([]);
    setFetchError(null);

    switch (provider) {
      case 'grsai':
        setBaseUrl('https://api.grsai.com/v1');
        setModel('gemini-3.1-flash-lite');
        break;
      case 'gemini':
        setBaseUrl('');
        setModel('gemini-3.1-flash-lite');
        break;
      case 'deepseek':
        setBaseUrl('https://api.deepseek.com/v1');
        setModel('deepseek-chat');
        break;
      case 'openai':
        setBaseUrl('https://api.openai.com/v1');
        setModel('gpt-4o-mini');
        break;
      case 'custom':
        // Keep current base URL or let it edit
        break;
    }
  };

  const handleFetchModels = async () => {
    if (!apiKey) {
      setFetchError('请先输入当前大模型的 API 密钥（API KEY）再尝试拉取！');
      return;
    }

    setIsFetchingModels(true);
    setFetchError(null);
    try {
      const modelsList = await fetchAvailableModels(apiKey, baseUrl);
      if (modelsList && modelsList.length > 0) {
        setFetchedModels(modelsList);
        
        // Auto-select first model in list or gemini-3.1-flash-lite if available
        const preferred = modelsList.find(m => m.includes('gemini-3.1-flash-lite')) || modelsList[0];
        setModel(preferred);
      } else {
        throw new Error('该接口返回了空模型列表数据');
      }
    } catch (err: any) {
      setFetchError(err.message || '网络连接失败，请确认端点和密钥无误，且网络支持跨域（CORS）');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveLLMConfig({
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      model: model.trim()
    });
    saveCompressionConfig({
      maxTurns,
      compressHtml,
      compressLongText,
      maxCharLimit
    });
    setSaveSuccess(true);
    onConfigSaved();
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-black" id="settings_modal_overlay">
      <div className="bg-white border-4 border-black max-w-2xl w-full p-6 relative flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" id="settings_modal_container">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-black hover:bg-black hover:text-white px-2.5 py-1 text-sm font-black border-2 border-black transition-all cursor-pointer"
          id="btn_close_settings"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="border-b-4 border-black pb-3 mb-5" id="settings_modal_header">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            <span>⚙ 适配参数配置 / SETTINGS</span>
          </h2>
          <p className="text-[11px] text-neutral-500 font-mono mt-1">
            数据 100% 留存在您的浏览器本地，不经过任何第三方服务器中叠，保证隐私安全。
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4" id="settings_form">
          
          {/* Provider Tabs Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-black">
              1. 选择接入通道 / Select API Channel
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" id="provider_tabs">
              <button
                type="button"
                onClick={() => handleProviderChange('grsai')}
                className={`border-2 border-black p-2 text-xs font-black transition-all cursor-pointer text-center ${apiProvider === 'grsai' ? 'bg-amber-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] translate-y-[-1px]' : 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-600'}`}
              >
                Grsai API
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange('gemini')}
                className={`border-2 border-black p-2 text-xs font-black transition-all cursor-pointer text-center ${apiProvider === 'gemini' ? 'bg-cyan-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] translate-y-[-1px]' : 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-600'}`}
              >
                Google 官方
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange('deepseek')}
                className={`border-2 border-black p-2 text-xs font-black transition-all cursor-pointer text-center ${apiProvider === 'deepseek' ? 'bg-blue-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] translate-y-[-1px]' : 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-600'}`}
              >
                DeepSeek 官方
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange('openai')}
                className={`border-2 border-black p-2 text-xs font-black transition-all cursor-pointer text-center ${apiProvider === 'openai' ? 'bg-emerald-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] translate-y-[-1px]' : 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-600'}`}
              >
                OpenAI 官方
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange('custom')}
                className={`border-2 border-black p-2 text-xs font-black transition-all cursor-pointer text-center ${apiProvider === 'custom' ? 'bg-neutral-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] translate-y-[-1px]' : 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-600'}`}
              >
                自定义通道
              </button>
            </div>
            <p className="text-[10px] text-neutral-500 font-mono">
              * {apiProvider === 'grsai' && '推荐使用：Grsai 接口兼容标准 OpenAI 协议，模型极速稳定，多渠道汇聚。'}
              {apiProvider === 'gemini' && '直连 Google 官方 Gemini 引擎。在少部分网络不佳或受限区域中转可能报错。'}
              {apiProvider === 'deepseek' && '直连官方 DeepSeek 模型大底座（须使用官方 sk- 格式 Key）。'}
              {apiProvider === 'openai' && '直连 OpenAI 官方接口。国内网络无代理可能发生阻断。'}
              {apiProvider === 'custom' && '如果您有自己设立的内网代理或专享 API 镜像，请在此手动输入底座和模型。'}
            </p>
          </div>

          {/* Key Input */}
          <div className="space-y-1">
            <label className="block text-xs font-extrabold text-black flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-black" />
              <span>大模型 API 密钥 (API KEY) <span className="text-red-600">*</span></span>
            </label>
            <input
              type="password"
              placeholder={
                apiProvider === 'grsai' ? "请输入您的 Grsai API Key（例如 gp-... 等）" : 
                apiProvider === 'gemini' ? "请输入您的 Google 官方 API Key" :
                "请输入适配当前通道的 API 密钥密钥密码"
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-white border-2 border-black p-2 text-xs sm:text-sm font-mono text-black focus:outline-none focus:bg-neutral-50"
              id="settings_api_key_input"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Base URL */}
            <div className="space-y-1">
              <label className="block text-xs font-extrabold text-black flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-black" />
                <span>接口中转端点地址 (API Base URL)</span>
              </label>
              <input
                type="text"
                placeholder="Google直连请留空"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                disabled={apiProvider !== 'custom'}
                className={`w-full border-2 border-black p-2 text-sm font-mono text-black focus:outline-none ${apiProvider === 'custom' ? 'bg-white' : 'bg-neutral-100 select-all cursor-not-allowed text-neutral-500'}`}
                id="settings_base_url_input"
              />
              <p className="text-[10px] text-neutral-500 font-mono">
                {apiProvider === 'custom' ? '* 必须配置正确的 OpenAI 格式的基础 v1 端点（如 https://api.xxx.com/v1）' : '* 当前通道已为您预置了极速专用接口底座。'}
              </p>
            </div>

            {/* Model Code & Fetch Button */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-extrabold text-black flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-black" />
                  <span>驱动模型标识 (Model Code)</span>
                </label>
                
                {/* Dynamically Load configuration Models Button */}
                {apiKey && apiProvider !== 'gemini' && (
                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={isFetchingModels}
                    className="text-[9px] sm:text-[10px] font-bold border-2 border-black bg-yellow-300 text-black px-2 py-0.5 hover:bg-black hover:text-white transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isFetchingModels ? '📡 正在拉取...' : '📡 动态拉取可用模型'}
                  </button>
                )}
              </div>

              {fetchedModels.length > 0 ? (
                <div className="relative">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-white border-2 border-black p-2 text-sm font-mono text-black focus:outline-none"
                    id="settings_model_select"
                  >
                    {fetchedModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-emerald-800 font-mono mt-0.5">
                    ✓ 成功从大模型底座同步了 {fetchedModels.length} 个最新模型！
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <input
                    type="text"
                    placeholder="输入模型名称"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-white border-2 border-black p-2 text-sm font-mono text-black focus:outline-none"
                    id="settings_model_input"
                    required
                  />
                  <div className="flex flex-wrap gap-1 mt-1" id="model_presets_wrapper">
                    {apiProvider === 'grsai' ? (
                      ['gemini-3.1-flash-lite', 'gemini-1.5-flash', 'gemini-2.5-flash', 'deepseek-chat', 'gpt-4o-mini'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setModel(p)}
                          className={`text-[9px] font-mono border px-1.5 py-0.2 cursor-pointer ${model === p ? 'bg-black text-white border-black' : 'bg-neutral-50 border-neutral-300 text-neutral-600 hover:border-black'}`}
                        >
                          {p}
                        </button>
                      ))
                    ) : (
                      ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'deepseek-chat', 'gpt-4o-mini'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setModel(p)}
                          className={`text-[9px] font-mono border px-1.5 py-0.2 cursor-pointer ${model === p ? 'bg-black text-white border-black' : 'bg-neutral-50 border-neutral-300 text-neutral-600 hover:border-black'}`}
                        >
                          {p}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {fetchError && (
                <p className="text-[9px] text-amber-900 border border-amber-300 bg-amber-50 p-1 font-mono leading-tight mt-1">
                  ⚠️ {fetchError}
                </p>
              )}
            </div>
          </div>

          {/* 🔋 2. 智能 Token 压缩与上下文省电模式 */}
          <div className="border-4 border-black p-4 bg-teal-50/20 space-y-3.5" id="settings_compression_box">
            <h3 className="text-xs font-mono font-black uppercase tracking-wider flex items-center gap-1.5 text-black border-b-2 border-black pb-2">
              <Zap className="w-4 h-4 text-amber-500 fill-current" />
              <span>2. 智能 Token 节约与上下文压缩配置 (Token Saving Optimizer)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="compression_form_inputs">
              
              {/* Sliding Window max turns */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-black flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-neutral-600" />
                  <span>历史对话保留轮数 (Sliding Window Turns)</span>
                </label>
                <select
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(parseInt(e.target.value, 10))}
                  className="w-full bg-white border-2 border-black p-2 text-xs font-mono font-bold text-black focus:outline-none cursor-pointer"
                  id="settings_max_turns_select"
                >
                  <option value={4}>4 轮对话 (极度省 Token 🔋)</option>
                  <option value={6}>6 轮对话 (均衡高效 ⚡)</option>
                  <option value={8}>8 轮对话 (丰满语义 ☕)</option>
                  <option value={12}>12 轮对话 (超长语境 📊)</option>
                  <option value={16}>16 轮对话 (未压缩状态 📈)</option>
                </select>
                <p className="text-[10px] text-neutral-500 font-mono leading-tight">
                  * 仅向大模型附带发送最近设定轮数的对话。轮数越少，Tokens 消耗大幅度呈几何级锐减。
                </p>
              </div>

              {/* Excessive messages character limit */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-black flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-neutral-600" />
                  <span>长消息字符压缩阈值 (Max Message Limits)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={150}
                    max={1000}
                    step={50}
                    value={maxCharLimit}
                    onChange={(e) => setMaxCharLimit(parseInt(e.target.value, 10))}
                    className="flex-grow accent-black cursor-ew-resize h-1.5 bg-neutral-200 rounded-lg appearance-none"
                  />
                  <span className="text-xs font-black font-mono border-2 border-black bg-white px-2 py-0.5 min-w-[70px] text-center shrink-0">
                    {maxCharLimit} 字
                  </span>
                </div>
                <p className="text-[10px] text-neutral-500 font-mono leading-tight">
                  * 历史单条发言超出该长度时，中间部分自动截除提炼，省电 70% 避免重复重复拉取。
                </p>
              </div>

            </div>

            {/* Checkbox Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1" id="compression_toggles">
              
              {/* Compress HTML sandbox code */}
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={compressHtml}
                  onChange={(e) => setCompressHtml(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-black cursor-pointer border-2 border-black"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-black flex items-center gap-1">
                    精简沙箱网页原型 HTML 源码
                  </span>
                  <span className="text-[10px] text-neutral-500 leading-tight">
                    历史消息中的大段 <code>```html```</code> 源码智能折叠，<strong>可狂省 90% 以上的无用 Tokens</strong>！
                  </span>
                </div>
              </label>

              {/* Compress excessively long text */}
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={compressLongText}
                  onChange={(e) => setCompressLongText(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-black cursor-pointer border-2 border-black"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-black">
                    启用历史长文本截断优化
                  </span>
                  <span className="text-[10px] text-neutral-500 leading-tight">
                    淘汰大块历史冗余语料。自动进行掐头去尾压缩，确保首尾逻辑和语义不丢。
                  </span>
                </div>
              </label>

            </div>

          </div>

          {/* Cloudflare Pages configuration instructions */}
          <div className="bg-neutral-50 border-2 border-dashed border-neutral-400 p-3 space-y-2 mt-4" id="cloudflare_guide">
            <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1 text-black">
              <HelpCircle className="w-3.5 h-3.5 text-neutral-600" />
              <span>本地极简安全体系指南 (Local Sandbox Guide)</span>
            </h4>
            <div className="text-[11px] font-mono text-neutral-600 leading-relaxed space-y-1">
              <p>
                本茶楼已升级为完整的纯前端无密交互安全网。您不需要再进行耗时、高损、不安全的登录步骤。一旦填入 Key 并保存，全部交互指令将直接从您的浏览器端直接加密调用。
              </p>
              <p className="font-bold text-black pt-1">
                支持持久预配置（在 Cloudflare Pages Dashboard【变量和机密】中新增）：
              </p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 pl-2 text-[10px]">
                <li><strong className="text-black">VITE_GEMINI_API_KEY</strong>：配置默认的大模型 API 密钥</li>
                <li><strong className="text-black">VITE_GEMINI_BASE_URL</strong>：配置您的默认自定义代理 API（如需默认使用）</li>
                <li><strong className="text-black">VITE_LLM_MODEL</strong>：自主定义默认加载的模型，例如 <code>gemini-3.1-flash-lite</code></li>
              </ul>
            </div>
          </div>

          {/* Messages */}
          {saveSuccess && (
            <div className="p-2 bg-emerald-50 text-emerald-800 border-2 border-emerald-500 text-xs font-mono font-bold" id="settings_save_success">
              ✓ 参数配置保存成功！茶座核心大模型已加载并适配完毕！
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-3 border-t-2 border-black" id="settings_actions_box">
            <button
              type="button"
              onClick={onClose}
              className="border-2 border-black px-4 py-2 text-xs font-mono font-extrabold hover:bg-neutral-100 cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="border-2 border-black bg-black text-white hover:bg-white hover:text-black px-4 py-2 text-xs font-mono font-extrabold transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
              id="btn_save_settings_submit"
            >
              保存参数 ⚙
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
