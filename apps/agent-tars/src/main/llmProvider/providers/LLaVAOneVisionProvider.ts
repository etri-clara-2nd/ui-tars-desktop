/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { BaseProvider } from './BaseProvider';
import { LLMConfig, LLMProvider } from '../interfaces/LLMProvider';
import { Message } from '@agent-infra/shared';
import { logger } from '@main/utils/logger';

export class LLaVAOneVisionProvider
  extends BaseProvider
  implements LLMProvider
{
  constructor(config: LLMConfig = {}) {
    super(config);
    logger.info('[LLaVAOneVisionProvider] initialized with config:', {
      baseURL: config.baseURL,
      model: config.model,
    });
  }

  protected formatMessages(messages: Message[]): any[] {
    // LLaVA-OneVision 형식에 맞게 메시지 변환
    return messages.map((msg) => {
      const formattedMsg: any = {
        role: msg.role,
        content: msg.content,
      };

      // 이미지 데이터가 있는 경우 처리
      if (msg.screenshot) {
        formattedMsg.content = [
          {
            type: 'text',
            text: msg.content,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${msg.screenshot}`,
            },
          },
        ];
      }

      return formattedMsg;
    });
  }

  async askLLMText(params: {
    messages: Message[];
    requestId: string;
  }): Promise<string> {
    const { messages, requestId } = params;
    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);

    try {
      logger.info(
        '[LLaVAOneVisionProvider.askLLMText] sending request to local server',
      );

      const response = await fetch(
        `${this.config.baseURL}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: this.formatMessages(messages),
            model: this.config.model,
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      logger.info('[LLaVAOneVisionProvider.askLLMText] received response');

      return data.choices[0].message.content;
    } catch (error) {
      logger.error('[LLaVAOneVisionProvider.askLLMText] error:', error);
      throw error;
    } finally {
      this.cleanupRequest(requestId);
    }
  }

  async askTool(params: any): Promise<any> {
    // LLaVA-OneVision은 현재 도구 호출을 지원하지 않음
    throw new Error(
      'Tool calling is not supported by LLaVA-OneVision provider',
    );
  }

  async *askLLMTextStream(params: {
    messages: Message[];
    requestId: string;
  }): AsyncGenerator<string> {
    const { messages, requestId } = params;
    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);

    try {
      logger.info(
        '[LLaVAOneVisionProvider.askLLMTextStream] sending stream request',
      );

      const response = await fetch(
        `${this.config.baseURL}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            messages: this.formatMessages(messages),
            model: this.config.model,
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
            stream: true,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              logger.error(
                '[LLaVAOneVisionProvider.askLLMTextStream] parse error:',
                e,
              );
            }
          }
        }
      }
    } catch (error) {
      logger.error('[LLaVAOneVisionProvider.askLLMTextStream] error:', error);
      throw error;
    } finally {
      this.cleanupRequest(requestId);
    }
  }
}
