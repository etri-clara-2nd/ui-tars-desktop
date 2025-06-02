/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Conversation } from '@ui-tars/shared/types';

export interface ConversationWithSoM extends Conversation {
  screenshotBase64WithElementMarker?: string;
  show_screenshot?: boolean;
  screenshot_url?: string;
  from: 'gpt' | 'human' | 'assistant';
}
