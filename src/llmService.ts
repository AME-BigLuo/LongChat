// Client-side LLM calling and settings persistence layer
// Resolves Cloudflare Pages Node-server DB and socket limits by doing direct in-browser REST API requests securely.
import { STORAGE_KEYS } from './constants';

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  endpointPath: string;
  model: string;
}

const DEFAULT_CONFIG: LLMConfig = {
  apiKey: '',
  baseUrl: '',
  endpointPath: '',
  model: ''
};

const OPENAI_CHAT_COMPLETIONS_PATH = '/chat/completions';
const STALE_AUTOFILL_BASE_URL = 'https://api.openai.com/v1';
const STALE_AUTOFILL_MODEL = 'gpt-4o-mini';
const STALE_AUTOFILL_MIGRATION = 'stale_autofill_cleared_v1';

function normalizeEndpointPath(path: string): string {
  const trimmed = (path || '').trim().replace(/^["']|["']$/g, '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function buildEndpointUrl(baseUrl: string, endpointPath: string): string {
  const base = (baseUrl || '').trim().replace(/\/+$/, '');
  const path = normalizeEndpointPath(endpointPath) || OPENAI_CHAT_COMPLETIONS_PATH;
  if (!base) return path;
  if (base.endsWith(path)) return base;
  return `${base}${path}`;
}

// 1. Get configuration
export function getLLMConfig(): LLMConfig {
  const defaultKey = '';
  const localKey = localStorage.getItem(STORAGE_KEYS.apiKey) || '';
  const localBase = localStorage.getItem(STORAGE_KEYS.baseUrl) || '';
  const localEndpointPath = localStorage.getItem(STORAGE_KEYS.endpointPath) || '';
  const localModel = localStorage.getItem(STORAGE_KEYS.model) || '';

  // Fallbacks to package build variables if any
  const envKey = (import.meta as any).env.VITE_LLM_API_KEY || (import.meta as any).env.VITE_API_KEY || '';
  const envBase = (import.meta as any).env.VITE_LLM_BASE_URL || '';
  const envEndpointPath = (import.meta as any).env.VITE_LLM_ENDPOINT_PATH || '';
  const envModel = (import.meta as any).env.VITE_LLM_MODEL || '';

  let finalKey = (localKey || envKey || defaultKey).trim();
  finalKey = finalKey.replace(/^["']|["']$/g, '').trim();
  if (finalKey === 'MY_LLM_API_KEY' || finalKey === 'YOUR_API_KEY' || finalKey === 'MY_API_KEY') {
    finalKey = '';
  }

  const migrationDone = localStorage.getItem(STORAGE_KEYS.configMigration) === STALE_AUTOFILL_MIGRATION;
  const shouldClearStaleAutofill = !migrationDone
    && localBase.trim() === STALE_AUTOFILL_BASE_URL
    && normalizeEndpointPath(localEndpointPath) === OPENAI_CHAT_COMPLETIONS_PATH
    && localModel.trim() === STALE_AUTOFILL_MODEL;

  if (!migrationDone) {
    if (shouldClearStaleAutofill) {
      localStorage.removeItem(STORAGE_KEYS.baseUrl);
      localStorage.removeItem(STORAGE_KEYS.endpointPath);
      localStorage.removeItem(STORAGE_KEYS.model);
    }
    localStorage.setItem(STORAGE_KEYS.configMigration, STALE_AUTOFILL_MIGRATION);
  }

  const cleanedLocalBase = shouldClearStaleAutofill ? '' : localBase;
  const cleanedLocalEndpointPath = shouldClearStaleAutofill ? '' : localEndpointPath;
  const cleanedLocalModel = shouldClearStaleAutofill ? '' : localModel;

  let finalBase = cleanedLocalBase || envBase || '';
  if (finalBase) {
    finalBase = finalBase.trim().replace(/^["']|["']$/g, '').trim();
  }
  
  const finalEndpointPath = normalizeEndpointPath(cleanedLocalEndpointPath || envEndpointPath);
  let finalModel = (cleanedLocalModel || envModel || '').trim().replace(/^["']|["']$/g, '').trim();

  return {
    apiKey: finalKey,
    baseUrl: finalBase,
    endpointPath: finalEndpointPath,
    model: finalModel
  };
}

// 1.5 Fetch available model list from OpenAI-compatible /v1/models endpoint
export async function fetchAvailableModels(apiKey: string, baseUrl: string): Promise<string[]> {
  if (!apiKey) return [];

  const trimmedKey = apiKey.trim();
  const trimmedBase = baseUrl.trim();

  if (!trimmedBase) {
    throw new Error('请先填写 BaseURL。');
  }

  // Construct target models endpoint
  let end = trimmedBase;
  if (end.endsWith('/v1')) {
    end += '/models';
  } else if (end.endsWith('/')) {
    end += 'models';
  } else {
    end += '/v1/models';
  }

  try {
    const response = await fetch(end, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${trimmedKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API 返回 HTTP 错误 ${response.status}`);
    }

    const data = await response.json();
    if (data && Array.isArray(data.data)) {
      // Return list of model IDs, filtered or sorted
      const modelCodes = data.data
        .map((m: any) => typeof m === 'string' ? m : m.id)
        .filter(Boolean) as string[];
      
      // Keep provider-returned models easy to scan without baking in a default model.
      modelCodes.sort((a, b) => {
        if (a.includes('mini')) return -1;
        if (b.includes('mini')) return 1;
        return a.localeCompare(b);
      });

      return modelCodes;
    }
    return [];
  } catch (err: any) {
    console.error('Fetch models error:', err);
    throw new Error(err.message || '网络无法访问目标底座，或者该 Key 无权拉取模型列表');
  }
}

// 2. Save configuration
export function saveLLMConfig(config: Partial<LLMConfig>) {
  if (config.apiKey !== undefined) localStorage.setItem(STORAGE_KEYS.apiKey, config.apiKey);
  if (config.baseUrl !== undefined) localStorage.setItem(STORAGE_KEYS.baseUrl, config.baseUrl);
  if (config.endpointPath !== undefined) localStorage.setItem(STORAGE_KEYS.endpointPath, normalizeEndpointPath(config.endpointPath));
  if (config.model !== undefined) localStorage.setItem(STORAGE_KEYS.model, config.model);
}

// 3. Clear configuration
export function clearLLMConfig() {
  localStorage.removeItem(STORAGE_KEYS.apiKey);
  localStorage.removeItem(STORAGE_KEYS.baseUrl);
  localStorage.removeItem(STORAGE_KEYS.endpointPath);
  localStorage.removeItem(STORAGE_KEYS.model);
}

// 3.5 Context Compression Config Management & Optimization
export interface CompressionConfig {
  maxTurns: number;           // Slicing threshold (sliding window, e.g. 4, 8, 12, 16)
  compressHtml: boolean;      // Strip out huge ```html ... ``` legacy codeblock payloads
  compressLongText: boolean;  // Truncate individual messages that are excessively long
  maxCharLimit: number;       // Truncation character threshold (e.g., 300)
}

export function getCompressionConfig(): CompressionConfig {
  const localTurns = localStorage.getItem(STORAGE_KEYS.compressionMaxTurns);
  const localHtml = localStorage.getItem(STORAGE_KEYS.compressionHtml);
  const localLongText = localStorage.getItem(STORAGE_KEYS.compressionLongText);
  const localCharLimit = localStorage.getItem(STORAGE_KEYS.compressionCharLimit);

  return {
    maxTurns: localTurns ? parseInt(localTurns, 10) : 8,
    compressHtml: localHtml !== 'false', // defaults to true
    compressLongText: localLongText !== 'false', // defaults to true
    maxCharLimit: localCharLimit ? parseInt(localCharLimit, 10) : 350
  };
}

export function saveCompressionConfig(config: Partial<CompressionConfig>) {
  if (config.maxTurns !== undefined) localStorage.setItem(STORAGE_KEYS.compressionMaxTurns, config.maxTurns.toString());
  if (config.compressHtml !== undefined) localStorage.setItem(STORAGE_KEYS.compressionHtml, config.compressHtml ? 'true' : 'false');
  if (config.compressLongText !== undefined) localStorage.setItem(STORAGE_KEYS.compressionLongText, config.compressLongText ? 'true' : 'false');
  if (config.maxCharLimit !== undefined) localStorage.setItem(STORAGE_KEYS.compressionCharLimit, config.maxCharLimit.toString());
}

/**
 * Intelligent conversation context compression algorithm.
 * Reduces raw tokens by trimming giant repetitive code blocks and slicing/summarizing excessive verbiage.
 */
export function compressHistoryContext(
  history: { role: 'user' | 'model' | 'assistant'; content: string }[],
  config: CompressionConfig = getCompressionConfig()
): { role: 'user' | 'model' | 'assistant'; content: string }[] {
  if (!history || history.length === 0) return [];

  // Filter out any system logs elements or empty roles to be safe
  const validHistory = history.filter(h => h.role === 'user' || h.role === 'model' || h.role === 'assistant');

  // Slicing by Sliding Window maxTurns threshold
  const sliced = validHistory.slice(-config.maxTurns);

  return sliced.map(item => {
    let content = item.content;

    // 1. Core Sandbox Optimization: Find large ```html ... ``` blocks and strip code to a lightweight tag
    if (config.compressHtml) {
      const htmlRegex = /```html([\s\S]*?)```/gi;
      content = content.replace(htmlRegex, (match, innerCode) => {
        const rawLen = innerCode.length;
        if (rawLen > 120) {
          const rawExcerpt = innerCode.trim().substring(0, 100).replace(/\s+/g, ' ');
          return `\n\`\`\`html\n<!-- [Carbon-Silicon Teahouse Token Compression]: history HTML collapsed (original length ${rawLen} chars). Summary: ${rawExcerpt}... -->\n\`\`\`\n`;
        }
        return match;
      });
    }

    // 2. Generic Message Length Optimization: Truncate texts to maxCharLimit and leave a small context window
    if (config.compressLongText && content.length > config.maxCharLimit) {
      const head = content.substring(0, config.maxCharLimit - 70);
      const tail = content.substring(content.length - 50);
      const reducedCount = content.length - head.length - tail.length;
      content = `${head}\n\n[... Carbon-Silicon Teahouse context trimmed automatically by ${reducedCount} chars ...]\n\n${tail}`;
    }

    return {
      role: item.role,
      content
    };
  });
}

// 4. Generate LLM response via hybrid proxy + browser REST fallbacks
export async function generateClientLLMResponse(
  systemInstruction: string,
  prompt: string,
  history?: { role: 'user' | 'model' | 'assistant'; content: string }[]
): Promise<string> {
  const config = getLLMConfig();
  const apiKey = config.apiKey;
  const model = config.model;
  const baseUrl = config.baseUrl ? config.baseUrl.trim() : '';
  const endpointPath = config.endpointPath;

  // Apply context token saving optimization prior to execution
  let finalHistory = history;
  if (history && history.length > 0) {
    const origCharCount = history.reduce((acc, val) => acc + (val.content?.length || 0), 0);
    const compConfig = getCompressionConfig();
    finalHistory = compressHistoryContext(history, compConfig);
    const compCharCount = finalHistory.reduce((acc, val) => acc + (val.content?.length || 0), 0);
    
    const savedCount = origCharCount - compCharCount;
    if (savedCount > 0) {
      const globalSaved = parseInt(localStorage.getItem(STORAGE_KEYS.totalCharsSaved) || '0', 10);
      localStorage.setItem(STORAGE_KEYS.totalCharsSaved, (globalSaved + savedCount).toString());
    }
  }

  // Try calling the unified backend chat API proxy first to securely utilize server environment variables
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction,
        prompt,
        history: finalHistory,
        model,
        baseUrl,
        endpointPath,
        apiKey
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data && typeof data.content === 'string') {
        return data.content;
      }
    } else {
      const errJson = await response.json().catch(() => ({}));
      const errMsg = errJson.error || `HTTP ${response.status}`;
      if (!apiKey) {
        throw new Error(errMsg);
      }
    }
  } catch (backendErr: any) {
    console.warn('[LLM Service] Backend chat proxy failed, trying browser direct request:', backendErr);
    if (!apiKey) {
      throw new Error(backendErr.message || '未检测到 API Key。请在配置中填写 API Key、BaseURL、ENDPOINT_PATH 和 Model。');
    }
  }

  if (!apiKey) {
    throw new Error('未检测到 API Key。请在配置中填写 API Key、BaseURL、ENDPOINT_PATH 和 Model。');
  }

  if (!model) {
    throw new Error('未检测到 Model。请在配置中填写 API Key、BaseURL、ENDPOINT_PATH 和 Model。');
  }

  // Case A: Custom OpenAI-compatible proxy (e.g. GRS, DeepSeek, OpenRouter, self-host proxy, etc.)
  if (baseUrl) {
    const endpoint = buildEndpointUrl(baseUrl, endpointPath);

    console.log(`[Client LLM Proxy] Path: ${endpoint}, model: ${model}`);

        // Map conversation history to OpenAI format
    const messages: any[] = [{ role: 'system', content: systemInstruction }];
    if (finalHistory && finalHistory.length > 0) {
      finalHistory.forEach(h => {
        messages.push({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.content
        });
      });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`中转平台请求错误 (HTTP ${response.status}): ${errText || '未知错误'}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';
    return reply.trim();
  }

  // Case B: Direct official Google Gemini API Endpoint on the client side
  else {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    console.log(`[Client Gemini Call] Url: ${url}`);

    // Map conversation history to Gemini format (user -> user, model -> model)
    const contents: any[] = [];
    if (finalHistory && finalHistory.length > 0) {
      finalHistory.forEach(h => {
        contents.push({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.content }]
        });
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    const payload = {
      contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errObj = await response.json().catch(() => ({}));
      const message = errObj.error?.message || `HTTP 错误 ${response.status}`;
      throw new Error(`Gemini 官方端点报错: ${message} (请检查您的 API Key 是否有效，或尝试在后台参数中设定自定义中转代理 URL以解决直连限制)`);
    }

    const data = await response.json();
    const candidates = data.candidates || [];
    if (candidates.length === 0) {
      throw new Error('Gemini API 未返回任何答复候选。可能是请求被安全限制拦截，请微调提示词。');
    }
    const txt = candidates[0]?.content?.parts?.[0]?.text || '';
    return txt.trim();
  }
}

// 5. Generate fully customized Agent inner system prompt
export async function generateClientCustomPrompt(params: {
  name: string;
  description: string;
  nature: string;
  expectedOutcome: string;
  agentNickname: string;
}): Promise<string> {
  const { name, description, nature, expectedOutcome, agentNickname } = params;

  const systemInstruction = "你是一个卓越的系统角色规划师和提示词专家。";
  const userPrompt = `你是一个人工智能专家，请为“碳硅茶馆”设计的“AI Agent discussion host”设计一个具有独特个性的系统指令（System Instruction）。
设计要素如下：
- 扮演配角名号/昵称：${agentNickname}
- 核心讨论议题/背景：${description}
- 讨论的风格偏向：${nature}
- 期望达成的目标产出：${expectedOutcome}

请为该${agentNickname}生成一段完整的系统角色指令，使其：
1. 具备地道传神的谈吐：风格必须精确契合“讨论的风格偏向”（如果是诙谐，说话就要幽默接地气；如果是犀利辣味，就要字字珠玑、针锋相对）。
2. 在用户交流讨论时，提供深度启发、分析漏洞、梳理共识，并协助用户朝着目标“${expectedOutcome}”不断推进。
3. 说话必须通俗简短，句句言之有物，带有极强的川渝茶馆轻松氛围，单次回复控制在130字以内。
4. 在回答中称赞用户为“阵主”或“客官”。

请直接输出这段生成的 System Instruction 指令文本，不要有任何 Markdown 包裹符, 不要包含任何多余的角色外开场白，直接输出内容。`;

  return generateClientLLMResponse(systemInstruction, userPrompt);
}

// 6. Generate the Final Summary html report client side
export async function generateClientSummaryHtml(params: {
  agentName: string;
  topicName: string;
  historyText: string;
  outcomeTarget: string;
}): Promise<string> {
  const { agentName, topicName, historyText, outcomeTarget } = params;
  const sys = `你是一个专业的资深会议主持、话题论证和文字总结专家。请为参与者生成一份极具含金量、排版精美、格式规范的 HTML 会议讨论结案终局报告。`;
  const prompt = `这里有一段用户与 AI Agent “${agentName}” 围绕 “${topicName}” 进行的碳硅茶馆讨论记录：
${historyText}

请为此设计并生成一份带有排版美学的终局总结 HTML，预期成果方向为：${outcomeTarget}。

你生成的 HTML 必须：
1. 使用完整的 HTML 代码包裹，包含独立的 <style> 样式定义。
2. 采用雅致高逼格的设计：背景为柔和 off-white 浅灰色（#fcfcfc），文字采用深邃墨石灰（#1f1f1f），配合纯白色的卡片面板、圆润厚重的黑色粗边框（Brutalist 极简朋克风），以及醒目的字号层级，富有现代杂志感。
3. 结构清晰，包含【对决/讨论主题】、【核心成果纲要】、【关键论点交锋记录】、【行动改善建议】等模块。
4. 将原本口语化的聊天汇总提炼，提炼出 3 条具有极强穿透力和落地性的核心干货结论。
5. 包含一节“主讲主持 AI 点评”，总结本场讨论。
6. 最下方展示：“Carbon-Silicon Teahouse case closed. The session is cleared and the memory is released.”
7. **重要：绝对不要使用 markdown 标记 (\`\`\`html) 进行包裹，直接输出完整的 html 文本代码。**`;

  return generateClientLLMResponse(sys, prompt);
}
