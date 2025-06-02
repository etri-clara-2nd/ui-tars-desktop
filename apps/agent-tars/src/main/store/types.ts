export enum VLMProviderV2 {
  // UI-TARS 모델들
  ui_tars_1_0 = 'Hugging Face for UI-TARS-1.0',
  ui_tars_1_5 = 'Hugging Face for UI-TARS-1.5',
  doubao_1_5 = 'VolcEngine Ark for Doubao-1.5-UI-TARS',

  // LLaVA-OneVision 모델
  llava_onevision_remote = 'LLaVA-OneVision Remote',

  // None
  none = 'None',
}

export interface LocalStore {
  // 공통 설정
  language: 'en' | 'zh';

  // UI-TARS 설정
  uiTarsProvider: VLMProviderV2;
  uiTarsBaseUrl: string;
  uiTarsApiKey: string;
  uiTarsModelName: string;

  // LLaVA-OneVision 설정
  llavaProvider: VLMProviderV2;
  llavaBaseUrl: string;
  llavaModelName: string;

  // 기타 설정
  maxLoopCount: number;
  loopIntervalInMs: number;
  operator: 'nutjs' | 'browser';
}

export interface AppState {
  status: StatusEnum;
  messages: Conversation[];
  instructions: string;
  thinking: boolean;
  errorMsg: string | null;
  abortController: AbortController | null;
  browserAvailable: boolean;
  restUserData: any;
}

export enum StatusEnum {
  INIT = 'init',
  RUNNING = 'running',
  PAUSE = 'pause',
  END = 'end',
  ERROR = 'error',
  CALL_USER = 'call_user',
}

export interface Conversation {
  from: 'human' | 'assistant' | 'gpt';
  value: string;
  timing?: {
    start: number;
    end: number;
    cost: number;
  };
  screenshotBase64?: string;
  screenshotBase64WithElementMarker?: string;
  predictionParsed?: any[];
  show_screenshot?: boolean;
  screenshot_url?: string;
}
