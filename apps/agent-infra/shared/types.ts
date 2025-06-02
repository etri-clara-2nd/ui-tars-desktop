export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  screenshot?: string; // base64 encoded image data
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export enum LLMProviderV2 {
  openai = 'openai',
  azure = 'azure',
  anthropic = 'anthropic',
  none = 'none',
}

export enum VLMProviderV2 {
  none = 'none',
  llava_onevision = 'llava_onevision',
}

export interface ModelSettings {
  provider: LLMProviderV2;
  baseURL: string;
  modelName: string;
  vlmProvider: VLMProviderV2; // VLM Provider 설정
  vlmBaseUrl: string; // VLM Provider Base URL
  vlmModelName: string; // VLM Provider Model Name
  apiKey?: string;
  apiVersion?: string;
  endpoint?: string;
}
