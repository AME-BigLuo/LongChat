import React, { useState, useEffect } from 'react';
import { Key, Globe, Cpu, Check, HelpCircle } from 'lucide-react';
import { getLLMConfig, saveLLMConfig, LLMConfig } from '../llmService';

interface SettingsModalProps {
  onClose: () => void;
  onConfigSaved: () => void;
}

export default function SettingsModal({ onClose, onConfigSaved }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('gemini-3.1-flash-lite');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const config = getLLMConfig();
    setApiKey(config.apiKey);
    setBaseUrl(config.baseUrl);
    setModel(config.model || 'gemini-3.1-flash-lite');
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveLLMConfig({
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      model: model.trim()
    });
    setSaveSuccess(true);
    onConfigSaved();
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1500);
  };

  const handleSetModelPreset = (name: string) => {
    setModel(name);
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
            <span>⚙ 适配参数配置 / settings</span>
          </h2>
          <p className="text-[11px] text-neutral-500 font-mono mt-1">
            由于本版本优化为<strong>纯前端 Serverless 系统</strong>，数据 100% 留存在您的浏览器本地，不经过任何第三方服务器中转。
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4" id="settings_form">
          <div className="space-y-1">
            <label className="block text-xs font-extrabold text-black flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-black" />
              <span>大模型 API 密钥 (API KEY) <span className="text-red-600">*</span></span>
            </label>
            <input
              type="password"
              placeholder="请输入您的 Gemini Key 或中转平台的 API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-white border-2 border-black p-2 text-sm font-mono text-black focus:outline-none focus:bg-neutral-50"
              id="settings_api_key_input"
              required
            />
            <p className="text-[10px] text-neutral-500 font-mono">
              * 支持官方的 Gemini 密钥 (如 AIzaSy...)，也支持第三方中转平台的 OpenAI 格式密钥。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-extrabold text-black flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-black" />
                <span>自定义中转端点底座码 (API Base URL)</span>
              </label>
              <input
                type="text"
                placeholder="官方直连请留空"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full bg-white border-2 border-black p-2 text-sm font-mono text-black focus:outline-none focus:bg-neutral-50"
                id="settings_base_url_input"
              />
              <p className="text-[10px] text-neutral-500 font-mono">
                * <strong>若国内 IP 直连报错</strong>，请设置中转端点（例如 <code>https://api.openai.com</code> 或其他可用代理，或留空直连）。
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-extrabold text-black flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-black" />
                <span>驱动模型标识 (Model Code)</span>
              </label>
              <input
                type="text"
                placeholder="例如: gemini-3.1-flash-lite"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-white border-2 border-black p-2 text-sm font-mono text-black focus:outline-none focus:bg-neutral-50"
                id="settings_model_input"
                required
              />
              <div className="flex flex-wrap gap-1 mt-1" id="model_presets_wrapper">
                <button
                  type="button"
                  onClick={() => handleSetModelPreset('gemini-3.1-flash-lite')}
                  className={`text-[10px] font-mono border px-1.5 py-0.5 cursor-pointer ${model === 'gemini-3.1-flash-lite' ? 'bg-black text-white border-black' : 'bg-neutral-50 border-neutral-300 text-neutral-600 hover:border-black'}`}
                >
                  gemini-3.1-flash-lite
                </button>
                <button
                  type="button"
                  onClick={() => handleSetModelPreset('gemini-2.5-flash')}
                  className={`text-[10px] font-mono border px-1.5 py-0.5 cursor-pointer ${model === 'gemini-2.5-flash' ? 'bg-black text-white border-black' : 'bg-neutral-50 border-neutral-300 text-neutral-600 hover:border-black'}`}
                >
                  gemini-2.5-flash
                </button>
                <button
                  type="button"
                  onClick={() => handleSetModelPreset('deepseek-chat')}
                  className={`text-[10px] font-mono border px-1.5 py-0.5 cursor-pointer ${model === 'deepseek-chat' ? 'bg-black text-white border-black' : 'bg-neutral-50 border-neutral-300 text-neutral-600 hover:border-black'}`}
                >
                  deepseek-chat
                </button>
                <button
                  type="button"
                  onClick={() => handleSetModelPreset('gpt-4o-mini')}
                  className={`text-[10px] font-mono border px-1.5 py-0.5 cursor-pointer ${model === 'gpt-4o-mini' ? 'bg-black text-white border-black' : 'bg-neutral-50 border-neutral-300 text-neutral-600 hover:border-black'}`}
                >
                  gpt-4o-mini
                </button>
              </div>
            </div>
          </div>

          {/* Cloudflare Pages configuration instructions */}
          <div className="bg-neutral-50 border-2 border-dashed border-black p-3 space-y-2 mt-4" id="cloudflare_guide">
            <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1 text-black">
              <HelpCircle className="w-3.5 h-3.5 text-neutral-600" />
              <span>Cloudflare (CF) 环境变量部署指南：</span>
            </h4>
            <div className="text-[11px] font-mono text-neutral-700 leading-relaxed space-y-1">
              <p>
                在 Cloudflare Pages Dashboard「变量和机密」中输入登录密码报错，是因为本版本已<strong>升级为去服务器化 (Serverless) 的极简安全架构</strong>，您<strong>不再需要登录后端验证账号密码</strong>，也不需要任何外部数据库。
              </p>
              <p className="font-bold text-black pt-1">
                如果您希望在构建时将 API 参数直接预设好（省去手动配置），可在 CF 控制台的【变量和机密】中添加以下参数：
              </p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 pl-2 text-[10px] text-neutral-600">
                <li><strong className="text-black">VITE_GEMINI_API_KEY</strong>：配置您的默认大模型 API 密钥</li>
                <li><strong className="text-black">VITE_GEMINI_BASE_URL</strong>：配置您的自定义中转代理 API 链接（选填）</li>
                <li><strong className="text-black">VITE_LLM_MODEL</strong>：配置默认调拨的模型代码（默认 <code>gemini-3.1-flash-lite</code>）</li>
              </ul>
            </div>
          </div>

          {/* Messages */}
          {saveSuccess && (
            <div className="p-2 bg-emerald-50 text-emerald-800 border-2 border-emerald-500 text-xs font-mono font-bold" id="settings_save_success">
              ✓ 参数配置保存成功！大模型核心适配就绪。
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2 border-t-2 border-black" id="settings_actions_box">
            <button
              type="button"
              onClick={onClose}
              className="border-2 border-black px-4 py-2 text-xs font-mono font-extrabold hover:bg-neutral-100 cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="border-2 border-black bg-black text-white hover:bg-white hover:text-black px-4 py-2 text-xs font-mono font-extrabold transition-all cursor-pointer"
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
