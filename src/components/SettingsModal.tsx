import React, { useState, useEffect } from 'react';
import { Key, Globe, Cpu, HelpCircle, Zap, Sliders, X, Route } from 'lucide-react';
import { getLLMConfig, saveLLMConfig, fetchAvailableModels, getCompressionConfig, saveCompressionConfig } from '../llmService';
import { DEFAULT_LLM_BASE_URL, DEFAULT_LLM_ENDPOINT_PATH, DEFAULT_LLM_MODEL } from '../constants';
import { AppLanguage } from '../types';

interface SettingsModalProps {
  onClose: () => void;
  onConfigSaved: () => void;
  language: AppLanguage;
}

export default function SettingsModal({ onClose, onConfigSaved, language }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [endpointPath, setEndpointPath] = useState(DEFAULT_LLM_ENDPOINT_PATH);
  const [model, setModel] = useState(DEFAULT_LLM_MODEL);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
    const base = config.baseUrl || DEFAULT_LLM_BASE_URL;
    setBaseUrl(base);
    setEndpointPath(config.endpointPath || DEFAULT_LLM_ENDPOINT_PATH);
    setModel(config.model || DEFAULT_LLM_MODEL);

    // Load custom context compression configuration
    const compConfig = getCompressionConfig();
    setMaxTurns(compConfig.maxTurns);
    setCompressHtml(compConfig.compressHtml);
    setCompressLongText(compConfig.compressLongText);
    setMaxCharLimit(compConfig.maxCharLimit);

  }, []);

  const handleFetchModels = async () => {
    if (!apiKey) {
      setFetchError(language === 'zh' ? '请先输入 API Key，再拉取 Model 列表。' : 'Please enter an API key before fetching models.');
      return;
    }

    setIsFetchingModels(true);
    setFetchError(null);
    try {
      const modelsList = await fetchAvailableModels(apiKey, baseUrl);
      if (modelsList && modelsList.length > 0) {
        setFetchedModels(modelsList);
        const preferred = modelsList.find(m => m.includes(DEFAULT_LLM_MODEL)) || modelsList[0];
        setModel(preferred);
      } else {
        throw new Error(language === 'zh' ? '接口返回的 Model 列表为空。' : 'The endpoint returned an empty model list.');
      }
    } catch (err: any) {
      setFetchError(err.message || (language === 'zh' ? '无法拉取 Model，请检查 BaseURL 和 API Key。' : 'Unable to fetch models. Check the endpoint and key.'));
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveLLMConfig({
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      endpointPath: endpointPath.trim(),
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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-fade-in text-black overflow-hidden" id="settings_modal_overlay">
      <div className="modal_scale_shell bg-white border-4 border-black w-full max-w-3xl p-4 sm:p-6 relative flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" id="settings_modal_container">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 text-black hover:bg-black hover:text-white w-9 h-9 flex items-center justify-center text-sm font-black border-2 border-black transition-all cursor-pointer z-10 bg-white"
          id="btn_close_settings"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="border-b-4 border-black pb-2 mb-4 pr-10" id="settings_modal_header">
          <h2 className="text-lg md:text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <span>{language === 'zh' ? '⚙ 配置' : '⚙ Configuration'}</span>
          </h2>
          <p className="text-[11px] text-neutral-500 font-mono mt-1">
            {language === 'zh' ? '所有配置默认保存在你的浏览器本地。' : 'All settings stay in your browser unless you explicitly save them to the backend.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-3.5 dialog_scroll_area pr-1" id="settings_form">
          
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-black">
              {language === 'zh' ? '1. 仅使用自定义通道' : '1. Custom endpoint only'}
            </label>
            <p className="text-[10px] text-neutral-500 font-mono">
              {language === 'zh'
                ? '请填写自己的 API Key、BaseURL、ENDPOINT_PATH 和 Model。'
                : 'Enter your own API Key, BaseURL, ENDPOINT_PATH, and Model.'}
            </p>
          </div>

          {/* Key Input */}
          <div className="space-y-1">
            <label className="block text-xs font-extrabold text-black flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-black" />
              <span>LLM API Key <span className="text-red-600">*</span></span>
            </label>
            <input
              type="password"
              placeholder={language === 'zh' ? '请输入 API Key' : 'Enter your API key'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-white border-2 border-black p-2 text-xs sm:text-sm font-mono text-black focus:outline-none focus:bg-neutral-50"
              id="settings_api_key_input"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Base URL */}
            <div className="space-y-1">
              <label className="block text-xs font-extrabold text-black flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-black" />
                <span>API BaseURL</span>
              </label>
              <input
                type="text"
                placeholder="https://api.openai.com/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full border-2 border-black p-2 text-sm font-mono text-black focus:outline-none bg-white"
                id="settings_base_url_input"
              />
              <p className="text-[10px] text-neutral-500 font-mono">
                {language === 'zh' ? '* 例如 https://api.openai.com/v1。' : '* Example: https://api.openai.com/v1.'}
              </p>
            </div>

            {/* Endpoint Path */}
            <div className="space-y-1">
              <label className="block text-xs font-extrabold text-black flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5 text-black" />
                <span>ENDPOINT_PATH</span>
              </label>
              <input
                type="text"
                placeholder="/chat/completions"
                value={endpointPath}
                onChange={(e) => setEndpointPath(e.target.value)}
                className="w-full border-2 border-black p-2 text-sm font-mono text-black focus:outline-none bg-white"
                id="settings_endpoint_path_input"
              />
              <p className="text-[10px] text-neutral-500 font-mono">
                {language === 'zh' ? '* 默认 /chat/completions。' : '* Default: /chat/completions.'}
              </p>
            </div>

            {/* Model Code & Fetch Button */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-extrabold text-black flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-black" />
                  <span>Model</span>
                </label>
                
                {/* Dynamically Load configuration Models Button */}
                {apiKey && (
                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={isFetchingModels}
                    className="text-[9px] sm:text-[10px] font-bold border-2 border-black bg-yellow-300 text-black px-2 py-0.5 hover:bg-black hover:text-white transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isFetchingModels ? (language === 'zh' ? '拉取中...' : 'Fetching...') : (language === 'zh' ? '拉取 Model' : 'Fetch models')}
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
                    {language === 'zh' ? `✓ 已从接口同步 ${fetchedModels.length} 个可用 Model。` : `✓ Synced ${fetchedModels.length} available models from your endpoint.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <input
                    type="text"
                    placeholder={language === 'zh' ? '请输入 Model 名称' : 'Enter model name'}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-white border-2 border-black p-2 text-sm font-mono text-black focus:outline-none"
                    id="settings_model_input"
                    required
                  />
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
              <span>{language === 'zh' ? '2. 上下文压缩' : '2. Context compression'}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="compression_form_inputs">
              
              {/* Sliding Window max turns */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-black flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-neutral-600" />
                  <span>{language === 'zh' ? '保留最近对话轮数' : 'Keep recent turns'}</span>
                </label>
                <select
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(parseInt(e.target.value, 10))}
                  className="w-full bg-white border-2 border-black p-2 text-xs font-mono font-bold text-black focus:outline-none cursor-pointer"
                  id="settings_max_turns_select"
                >
                  <option value={4}>{language === 'zh' ? '4 轮' : '4 turns'}</option>
                  <option value={6}>{language === 'zh' ? '6 轮' : '6 turns'}</option>
                  <option value={8}>{language === 'zh' ? '8 轮' : '8 turns'}</option>
                  <option value={12}>{language === 'zh' ? '12 轮' : '12 turns'}</option>
                  <option value={16}>{language === 'zh' ? '16 轮' : '16 turns'}</option>
                </select>
                <p className="text-[10px] text-neutral-500 font-mono leading-tight">
                  {language === 'zh' ? '* 只把最近的对话轮数发送给模型。' : '* Only the most recent turns are sent to the model.'}
                </p>
              </div>

              {/* Excessive messages character limit */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-black flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-neutral-600" />
                  <span>{language === 'zh' ? '长消息压缩阈值' : 'Long-message trim threshold'}</span>
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
                  {language === 'zh' ? '* 单条历史消息过长时，会自动压缩中间部分。' : '* Long messages are shortened in the middle to keep context compact.'}
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
                    {language === 'zh' ? '压缩沙箱 HTML 输出' : 'Trim sandbox HTML output'}
                  </span>
                  <span className="text-[10px] text-neutral-500 leading-tight">
                    {language === 'zh' ? '折叠历史消息中的大段 ' : 'Collapse large '}
                    <code>```html```</code>
                    {language === 'zh' ? ' 内容。' : ' payloads inside chat history.'}
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
                    {language === 'zh' ? '压缩历史长文本' : 'Trim long history text'}
                  </span>
                  <span className="text-[10px] text-neutral-500 leading-tight">
                    {language === 'zh' ? '保留首尾语义，压缩过长历史文本。' : 'Shorten very long messages while keeping the beginning and end.'}
                  </span>
                </div>
              </label>

            </div>

          </div>

          {/* Cloudflare Pages configuration instructions */}
          <div className="bg-neutral-50 border-2 border-dashed border-neutral-400 p-3 space-y-2 mt-4" id="cloudflare_guide">
            <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1 text-black">
              <HelpCircle className="w-3.5 h-3.5 text-neutral-600" />
              <span>{language === 'zh' ? '开源配置说明' : 'Open-source setup notes'}</span>
            </h4>
            <div className="text-[11px] font-mono text-neutral-600 leading-relaxed space-y-1">
              <p>
                {language === 'zh' ? '此版本不会在仓库中内置密钥。请在本地填写自己的 API Key、BaseURL、ENDPOINT_PATH 和 Model。' : 'This build keeps secrets out of the repository. Enter your own API Key, BaseURL, ENDPOINT_PATH, and Model locally.'}
              </p>
              <p className="font-bold text-black pt-1">
                {language === 'zh' ? '推荐环境变量：' : 'Recommended environment variables:'}
              </p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 pl-2 text-[10px]">
                <li><strong className="text-black">VITE_LLM_API_KEY</strong>{language === 'zh' ? '：本地默认 API Key' : ': default API Key for local builds'}</li>
                <li><strong className="text-black">VITE_LLM_BASE_URL</strong>{language === 'zh' ? '：默认 OpenAI 兼容 BaseURL' : ': default OpenAI-compatible BaseURL'}</li>
                <li><strong className="text-black">VITE_LLM_ENDPOINT_PATH</strong>{language === 'zh' ? '：默认 ENDPOINT_PATH' : ': default ENDPOINT_PATH'}</li>
                <li><strong className="text-black">VITE_LLM_MODEL</strong>{language === 'zh' ? '：默认 Model 名称' : ': default Model name'}</li>
              </ul>
            </div>
          </div>

          {/* Messages */}
          {saveSuccess && (
            <div className="p-2 bg-emerald-50 text-emerald-800 border-2 border-emerald-500 text-xs font-mono font-bold" id="settings_save_success">
              {language === 'zh' ? '✓ 配置保存成功。' : '✓ Settings saved successfully.'}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-3 border-t-2 border-black" id="settings_actions_box">
            <button
              type="button"
              onClick={onClose}
              className="border-2 border-black px-4 py-2 text-xs font-mono font-extrabold hover:bg-neutral-100 cursor-pointer"
            >
              {language === 'zh' ? '取消' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="border-2 border-black bg-black text-white hover:bg-white hover:text-black px-4 py-2 text-xs font-mono font-extrabold transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
              id="btn_save_settings_submit"
            >
              {language === 'zh' ? '保存配置 ⚙' : 'Save settings ⚙'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
