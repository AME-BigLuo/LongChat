export const APP_NAME = '碳硅茶馆';
export const APP_NAME_EN = 'Carbon-Silicon Teahouse';
export const APP_COPYRIGHT = 'Copyright © 2026 ScmEaic. All rights reserved.';

export const STORAGE_KEYS = {
  apiKey: 'cs_teahouse_api_key',
  baseUrl: 'cs_teahouse_base_url',
  endpointPath: 'cs_teahouse_endpoint_path',
  model: 'cs_teahouse_model',
  configMigration: 'cs_teahouse_config_migration',
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
