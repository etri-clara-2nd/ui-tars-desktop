/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { GUIAgentData } from '@ui-tars/shared/types';

import { LocalStore, PresetSource } from './validate';
import { ConversationWithSoM } from '@main/shared/types';

export type NextAction =
  | { type: 'key'; text: string }
  | { type: 'type'; text: string }
  | { type: 'mouse_move'; x: number; y: number }
  | { type: 'left_click' }
  | { type: 'left_click_drag'; x: number; y: number }
  | { type: 'right_click' }
  | { type: 'middle_click' }
  | { type: 'double_click' }
  | { type: 'screenshot' }
  | { type: 'cursor_position' }
  | { type: 'finish' }
  | { type: 'error'; message: string };

export type AppState = {
  theme: 'dark' | 'light';
  ensurePermissions: { screenCapture?: boolean; accessibility?: boolean };
  instructions: string | null;
  restUserData: Omit<GUIAgentData, 'status' | 'conversations'> | null;
  status: GUIAgentData['status'];
  errorMsg: string | null;
  messages: ConversationWithSoM[];
  abortController: AbortController | null;
  thinking: boolean;
  browserAvailable: boolean;
};

export enum VlmProvider {
  // Ollama = 'ollama',
  Huggingface = 'Hugging Face',
  vLLM = 'vLLM',
}

export enum VLMProviderV2 {
  // UI-TARS 모델들
  ui_tars_1_0 = 'Hugging Face for UI-TARS-1.0',
  ui_tars_1_5 = 'Hugging Face for UI-TARS-1.5',
  doubao_1_5 = 'VolcEngine Ark for Doubao-1.5-UI-TARS',

  // LLaVA-OneVision 모델
  llava_onevision_remote = 'LLaVA-OneVision Remote',
  llava_onevision = 'LLaVA-OneVision Local',

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
  reportStorageBaseUrl?: string;
  utioBaseUrl?: string;
  presetSource?: PresetSource;
  operator: 'nutjs' | 'browser';
}

export type { PresetSource };
