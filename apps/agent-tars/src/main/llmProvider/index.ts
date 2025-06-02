import dotenv from 'dotenv';
import { MCPServerName, Message } from '@agent-infra/shared';
import { ChatCompletionTool } from 'openai/resources/index.mjs';
import { mapToolKeysToAzureTools } from '../../main/mcp/tools';
import { createMcpClient } from '../../main/mcp/client';
import { listCustomTools } from '../../main/customTools';
import { ProviderFactory } from './ProviderFactory';
import {
  LLMConfig,
  LLMProvider,
  LLMResponse,
  ToolChoice,
} from './interfaces/LLMProvider';
import { logger } from '@main/utils/logger';
import { maskSensitiveData } from '@main/utils/maskSensitiveData';
import { SettingStore } from '@main/store/setting';
import { VLMProviderV2 } from '@main/store/types';

// Load environment variables
dotenv.config();

// Export interfaces and types from LLMProvider for convenience
export type {
  LLMConfig,
  LLMResponse,
  ToolChoice,
  LLMProvider,
} from './interfaces/LLMProvider';

/**
 * Unified LLM class that uses different providers based on configuration
 */
export class LLM {
  private provider: LLMProvider;
  private vlmProvider: LLMProvider | null = null;
  private config: LLMConfig;

  constructor(config: LLMConfig = {}) {
    this.config = config;
    // FIXME: config.configName does not exist !!!
    // Create provider instance based on the model or explicit provider setting
    this.provider = ProviderFactory.createProvider(config, config.configName);

    // VLM Provider가 설정되어 있으면 VLM Provider도 초기화
    const settings = SettingStore.get('model');
    if (settings?.vlmProvider === VLMProviderV2.llava_onevision) {
      this.vlmProvider = ProviderFactory.createProvider(
        {
          ...config,
          baseURL: settings.vlmBaseUrl,
          model: settings.vlmModelName,
        },
        'llava_onevision',
      );
    }
  }

  /**
   * Get the current provider
   */
  getProvider(): LLMProvider {
    return this.provider;
  }

  /**
   * Change the provider or model at runtime
   */
  setProvider(config: LLMConfig = {}, providerName?: string): void {
    this.config = { ...this.config, ...config };
    this.provider = ProviderFactory.createProvider(
      this.config,
      providerName || config.configName,
    );
  }

  /**
   * Send a message to the LLM and get a response
   */
  async askLLMText({
    messages,
    requestId,
  }: {
    messages: Message[];
    requestId: string;
  }): Promise<string> {
    try {
      // LLM 결과 가져오기
      const llmResponse = await this.provider.askLLMText({
        messages,
        requestId,
      });

      // VLM Provider가 있고, 마지막 메시지에 스크린샷이 있는 경우 VLM 결과도 가져오기
      if (this.vlmProvider && messages[messages.length - 1]?.screenshot) {
        try {
          const vlmResponse = await this.vlmProvider.askLLMText({
            messages: [messages[messages.length - 1]],
            requestId: `${requestId}-vlm`,
          });

          // LLM과 VLM 결과 통합
          return `${llmResponse}\n\n[Vision Analysis]\n${vlmResponse}`;
        } catch (vlmError) {
          logger.error('[LLM.askLLMText] VLM error:', vlmError);
          // VLM 에러가 발생해도 LLM 결과는 반환
          return llmResponse;
        }
      }

      return llmResponse;
    } catch (error) {
      logger.error('[LLM.askLLMText] error:', error);
      throw error;
    }
  }

  /**
   * Send a message to the LLM with tools and get a response with potential tool calls
   */
  async askTool({
    messages,
    tools,
    mcpServerKeys,
    requestId,
    toolChoice,
  }: {
    messages: Message[];
    tools: ChatCompletionTool[];
    mcpServerKeys?: (MCPServerName | string)[];
    requestId: string;
    toolChoice?: ToolChoice;
  }): Promise<LLMResponse> {
    const mcpClient = await createMcpClient();
    const mcpTools = await mcpClient.listTools();
    const customTools = listCustomTools();
    const normalizeMcpTools = mapToolKeysToAzureTools(
      mcpTools,
      mcpServerKeys || [],
    );

    const allTools = [...tools, ...normalizeMcpTools, ...customTools];
    try {
      // LLM 결과 가져오기
      const llmResponse = await this.provider.askTool({
        messages,
        tools: allTools,
        requestId,
        toolChoice: toolChoice || 'auto',
      });

      // VLM Provider가 있고, 마지막 메시지에 스크린샷이 있는 경우 VLM 결과도 가져오기
      if (this.vlmProvider && messages[messages.length - 1]?.screenshot) {
        try {
          const vlmResponse = await this.vlmProvider.askLLMText({
            messages: [messages[messages.length - 1]],
            requestId: `${requestId}-vlm`,
          });

          // LLM과 VLM 결과 통합
          return {
            content: `${llmResponse.content}\n\n[Vision Analysis]\n${vlmResponse}`,
            tool_calls: llmResponse.tool_calls,
          };
        } catch (vlmError) {
          logger.error('[LLM.askTool] VLM error:', vlmError);
          // VLM 에러가 발생해도 LLM 결과는 반환
          return llmResponse;
        }
      }

      return llmResponse;
    } catch (error) {
      logger.error('[LLM.askTool] error:', error);
      throw error;
    }
  }

  /**
   * Send a message to the LLM and get a streaming response
   */
  async *askLLMTextStream({
    messages,
    requestId,
  }: {
    messages: Message[];
    requestId: string;
  }): AsyncGenerator<string> {
    try {
      // LLM 스트림 결과 가져오기
      const llmStream = this.provider.askLLMTextStream({ messages, requestId });

      // VLM Provider가 있고, 마지막 메시지에 스크린샷이 있는 경우 VLM 결과도 가져오기
      if (this.vlmProvider && messages[messages.length - 1]?.screenshot) {
        try {
          // LLM 스트림 결과를 모두 수집
          let llmContent = '';
          for await (const chunk of llmStream) {
            llmContent += chunk;
            yield chunk;
          }

          // VLM 결과 가져오기
          const vlmResponse = await this.vlmProvider.askLLMText({
            messages: [messages[messages.length - 1]],
            requestId: `${requestId}-vlm`,
          });

          // VLM 결과 스트리밍
          yield '\n\n[Vision Analysis]\n';
          yield vlmResponse;
        } catch (vlmError) {
          logger.error('[LLM.askLLMTextStream] VLM error:', vlmError);
          // VLM 에러가 발생해도 LLM 스트림은 계속 진행
          yield* llmStream;
        }
      } else {
        // VLM Provider가 없는 경우 LLM 스트림만 반환
        yield* llmStream;
      }
    } catch (error) {
      logger.error('[LLM.askLLMTextStream] error:', error);
      throw error;
    }
  }

  /**
   * Abort an active request
   */
  abortRequest(requestId: string): boolean {
    if ('abortRequest' in this.provider) {
      return this.provider.abortRequest(requestId);
    }
    return false;
  }

  /**
   * Get a list of available providers
   */
  static getAvailableProviders(): string[] {
    return ProviderFactory.getAvailableProviders();
  }
}

export function createLLM(config: LLMConfig): LLM {
  logger.info('[LLM] Creating LLM with config:', maskSensitiveData(config));
  return new LLM(config);
}
