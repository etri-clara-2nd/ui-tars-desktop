/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from 'zod';

import { VLMProviderV2 } from './types';

export type PresetSource = {
  type: 'remote';
  url: string;
  lastUpdated: string;
  autoUpdate: boolean;
  operator: 'nutjs' | 'browser';
};

const presetSchema = z.object({
  language: z.enum(['en', 'zh']),

  // UI-TARS 설정
  uiTarsProvider: z.nativeEnum(VLMProviderV2),
  uiTarsBaseUrl: z.string().url(),
  uiTarsApiKey: z.string().min(1),
  uiTarsModelName: z.string().min(1),

  // LLaVA-OneVision 설정
  llavaProvider: z.nativeEnum(VLMProviderV2),
  llavaBaseUrl: z.string().url(),
  llavaModelName: z.string().min(1),

  // 기타 설정
  maxLoopCount: z.number().min(25).max(200),
  loopIntervalInMs: z.number().min(0).max(3000),
  reportStorageBaseUrl: z.string().optional(),
  utioBaseUrl: z.string().optional(),
  operator: z.enum(['nutjs', 'browser']),
});

export function validatePreset(preset: unknown) {
  return presetSchema.parse(preset);
}
