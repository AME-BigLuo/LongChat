export const APP_NAME = '碳硅茶馆';
export const APP_NAME_EN = 'Carbon-Silicon Teahouse';
export const APP_COPYRIGHT = 'Copyright © 2026 ScmEaic. All rights reserved.';

export const DEFAULT_LLM_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_LLM_ENDPOINT_PATH = '/chat/completions';
export const DEFAULT_LLM_MODEL = 'gpt-4o-mini';

export const STORAGE_KEYS = {
  apiKey: 'cs_teahouse_api_key',
  baseUrl: 'cs_teahouse_base_url',
  endpointPath: 'cs_teahouse_endpoint_path',
  model: 'cs_teahouse_model',
  language: 'cs_teahouse_language',
  nickname: 'cs_teahouse_user_nickname',
  customAgents: (teahouseId: string) => `cs_teahouse_custom_agents_${teahouseId}`,
  history: (teahouseId: string) => `cs_teahouse_history_${teahouseId}`,
  totalCharsSaved: 'cs_teahouse_total_chars_saved',
  compressionMaxTurns: 'cs_teahouse_compress_maxTurns',
  compressionHtml: 'cs_teahouse_compress_html',
  compressionLongText: 'cs_teahouse_compress_longText',
  compressionCharLimit: 'cs_teahouse_compress_charLimit'
} as const;
