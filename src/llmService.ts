// Client-side LLM calling and settings persistence layer
// Resolves Cloudflare Pages Node-server DB and socket limits by doing direct in-browser REST API requests securely.

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const DEFAULT_CONFIG: LLMConfig = {
  apiKey: '',
  baseUrl: 'https://api.grsai.com/v1',
  model: 'gemini-3.1-flash-lite'
};

// 1. Get configuration
export function getLLMConfig(): LLMConfig {
  const defaultKey = '';
  const defaultBase = 'https://api.grsai.com/v1';
  const defaultModel = 'gemini-3.1-flash-lite';

  const localKey = localStorage.getItem('longmenzhen_apiKey') || '';
  const localBase = localStorage.getItem('longmenzhen_baseUrl') || '';
  const localModel = localStorage.getItem('longmenzhen_model') || '';

  // Fallbacks to package build variables if any
  const envKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (import.meta as any).env.VITE_API_KEY || '';
  const envBase = (import.meta as any).env.VITE_GEMINI_BASE_URL || '';
  const envModel = (import.meta as any).env.VITE_LLM_MODEL || '';

  const finalKey = localKey || envKey || defaultKey;
  let finalBase = localBase !== null && localBase !== undefined ? localBase : (envBase || defaultBase);
  let finalModel = localModel || envModel || defaultModel;

  return {
    apiKey: finalKey,
    baseUrl: finalBase,
    model: finalModel
  };
}

// 1.5 Fetch available model list from OpenAI-compatible /v1/models endpoint
export async function fetchAvailableModels(apiKey: string, baseUrl: string): Promise<string[]> {
  if (!apiKey) return [];
  
  const trimmedKey = apiKey.trim();
  const trimmedBase = baseUrl.trim();

  // If baseUrl is empty, it's official Google Gemini direct
  if (!trimmedBase) {
    return [
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];
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
      
      // Sort so gemini-3.1-flash-lite is at top if present, otherwise alphabetical
      modelCodes.sort((a, b) => {
        if (a.includes('gemini-3.1-flash-lite')) return -1;
        if (b.includes('gemini-3.1-flash-lite')) return 1;
        if (a.includes('flash-lite')) return -1;
        if (b.includes('flash-lite')) return 1;
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
  if (config.apiKey !== undefined) localStorage.setItem('longmenzhen_apiKey', config.apiKey);
  if (config.baseUrl !== undefined) localStorage.setItem('longmenzhen_baseUrl', config.baseUrl);
  if (config.model !== undefined) localStorage.setItem('longmenzhen_model', config.model);
}

// 3. Clear configuration
export function clearLLMConfig() {
  localStorage.removeItem('longmenzhen_apiKey');
  localStorage.removeItem('longmenzhen_baseUrl');
  localStorage.removeItem('longmenzhen_model');
}

// 4. Generate LLM response via browser REST calls (zero server dependencies)
export async function generateClientLLMResponse(
  systemInstruction: string,
  prompt: string,
  history?: { role: 'user' | 'model' | 'assistant'; content: string }[]
): Promise<string> {
  const config = getLLMConfig();
  const apiKey = config.apiKey;

  if (!apiKey) {
    throw new Error('未检测到 API 密钥。请点击页面右上角【适配参数配置 ⚙】并在弹窗内输入您的 Gemini / OpenAI API Key。');
  }

  const model = config.model || 'gemini-3.1-flash-lite';
  const baseUrl = config.baseUrl ? config.baseUrl.trim() : '';

  // Case A: Custom OpenAI-compatible proxy (e.g. GRS, DeepSeek, OpenRouter, self-host proxy, etc.)
  if (baseUrl) {
    let endpoint = baseUrl;
    if (!endpoint.endsWith('/chat/completions')) {
      if (endpoint.endsWith('/')) {
        endpoint += 'chat/completions';
      } else if (endpoint.endsWith('/v1')) {
        endpoint += '/chat/completions';
      } else {
        endpoint += '/v1/chat/completions';
      }
    }

    console.log(`[Client LLM Proxy] Path: ${endpoint}, model: ${model}`);

    // Map conversation history to OpenAI format
    const messages: any[] = [{ role: 'system', content: systemInstruction }];
    if (history && history.length > 0) {
      history.forEach(h => {
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
    if (history && history.length > 0) {
      history.forEach(h => {
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
  const userPrompt = `你是一个人工智能专家，请为“龙门阵”设计的“AI Agent讨论话事官”设计一个具有独特个性的系统指令（System Instruction）。
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
  const prompt = `这里有一段用户与 AI Agent “${agentName}” 围绕 “${topicName}” 进行的龙门阵讨论记录：
${historyText}

请为此设计并生成一份带有排版美学的终局总结 HTML，预期成果方向为：${outcomeTarget}。

你生成的 HTML 必须：
1. 使用完整的 HTML 代码包裹，包含独立的 <style> 样式定义。
2. 采用雅致高逼格的设计：背景为柔和 off-white 浅灰色（#fcfcfc），文字采用深邃墨石灰（#1f1f1f），配合纯白色的卡片面板、圆润厚重的黑色粗边框（Brutalist 极简朋克风），以及醒目的字号层级，富有现代杂志感。
3. 结构清晰，包含【对决/讨论主题】、【核心成果纲要】、【关键论点交锋记录】、【行动改善建议】等模块。
4. 将原本口语化的聊天汇总提炼，提炼出 3 条具有极强穿透力和落地性的核心干货结论。
5. 包含一节“主讲主持 AI 点评”，总结本场讨论。
6. 最下方展示：“龙门阵结案盖印。阅后即散，服务器内存已彻底销毁，江湖再会。”
7. **重要：绝对不要使用 markdown 标记 (\`\`\`html) 进行包裹，直接输出完整的 html 文本代码。**`;

  return generateClientLLMResponse(sys, prompt);
}
