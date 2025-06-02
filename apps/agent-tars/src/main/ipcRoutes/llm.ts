import {
  MCPServerName,
  Message,
  MessageData,
  ModelSettings,
} from '@agent-infra/shared';
import { initIpc } from '@ui-tars/electron-ipc/main';
import { ChatCompletionTool } from 'openai/resources/index.mjs';
import { BrowserWindow } from 'electron';
import { createLLM, LLMConfig } from '@main/llmProvider';
import { ProviderFactory } from '@main/llmProvider/ProviderFactory';
import { SettingStore } from '@main/store/setting';
import { logger } from '@main/utils/logger';
import { maskSensitiveData } from '@main/utils/maskSensitiveData';
import { extractToolNames } from '@main/utils/extractToolNames';
import { ipcMain } from 'electron';
import { LLM } from '@main/llmProvider';
import { VLMProviderV2 } from '@main/store/types';

const t = initIpc.create();

/**
 * Get the current provider configuration based on settings
 */
function getLLMProviderConfig(settings: ModelSettings): LLMConfig {
  const { provider, model, apiKey, apiVersion, endpoint } = settings;
  return {
    configName: provider,
    model,
    apiKey,
    apiVersion,
    // TODO: baseURL || endpoint
    baseURL: endpoint,
  };
}

export const currentLLMConfigRef: {
  current: LLMConfig;
} = {
  current: getLLMProviderConfig(SettingStore.get('model') || {}),
};

export const llmRoute = t.router({
  askLLMText: t.procedure
    .input<{
      messages: MessageData[];
      systemMsgs?: MessageData[];
      requestId: string;
    }>()
    .handle(async ({ input }) => {
      logger.info('[llmRoute.askLLMText] input', input);
      const messages = input.messages.map((msg) => new Message(msg));
      const llm = createLLM(currentLLMConfigRef.current);
      const response = await llm.askLLMText({
        messages,
        requestId: input.requestId,
      });
      logger.info('[llmRoute.askLLMText] response', response);
      return response;
    }),
  testModelService: t.procedure
    .input<ModelSettings>()
    .handle(async ({ input }) => {
      try {
        const config = getLLMProviderConfig(input);
        const llm = createLLM(config);
        const response = await llm.askTool({
          messages: [Message.userMessage('What model are you using now?')],
          requestId: 'test',
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_model_name',
                description: 'Get the name of the current model',
                parameters: {
                  type: 'object',
                  properties: {
                    model: {
                      type: 'string',
                      description: 'The name of the model',
                    },
                  },
                },
              },
            },
          ],
        });
        if (!response.tool_calls || response.tool_calls.length === 0) {
          return {
            success: false,
            message:
              'Current model doses not support function call, response: ' +
              JSON.stringify(response, null, 2),
            response: null,
          };
        }
        return {
          success: true,
          message: '',
          response: response,
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error',
          response: null,
        };
      }
    }),
  askLLMTool: t.procedure
    .input<{
      messages: MessageData[];
      tools: ChatCompletionTool[];
      mcpServerKeys?: (MCPServerName | string)[];
      requestId: string;
    }>()
    .handle(async ({ input }) => {
      try {
        logger.info('[llmRoute.askLLMTool] input', input);
        const messages = input.messages.map((msg) => new Message(msg));
        logger.info(
          '[llmRoute.askLLMTool] Current LLM Config',
          maskSensitiveData(currentLLMConfigRef.current),
        );
        logger.info(
          '[llmRoute.askLLMTool] Current Search Config',
          maskSensitiveData(SettingStore.get('search')),
        );
        const llm = createLLM(currentLLMConfigRef.current);
        logger.info(
          '[llmRoute.askLLMTool] tools',
          extractToolNames(input.tools),
        );
        const response = await llm.askTool({
          messages,
          tools: input.tools,
          mcpServerKeys: input.mcpServerKeys,
          requestId: input.requestId,
        });
        logger.info(
          '[llmRoute.askLLMTool] response',
          JSON.stringify(response, null, 2),
        );
        return response;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? `[llmRoute.askLLMTool] Failed to get tool response from LLM: ${error.message}`
            : JSON.stringify(error);
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }
    }),

  askLLMTextStream: t.procedure
    .input<{
      messages: MessageData[];
      systemMsgs?: MessageData[];
      requestId: string;
    }>()
    .handle(async ({ input }) => {
      logger.info('[llmRoute.askLLMTextStream] input', input);
      const messages = input.messages.map((msg) => new Message(msg));
      const { requestId } = input;
      logger.info(
        '[llmRoute.askLLMTextStream] Current LLM Config',
        maskSensitiveData(currentLLMConfigRef.current),
      );
      const llm = createLLM(currentLLMConfigRef.current);

      (async () => {
        const windows = BrowserWindow.getAllWindows();
        try {
          const stream = llm.askLLMTextStream({ messages, requestId });
          logger.info('[llmRoute.askLLMTextStream] stream', !!stream);

          for await (const chunk of stream) {
            if (!windows.length) {
              return;
            }

            windows.forEach((win) => {
              win.webContents.send(`llm:stream:${requestId}:data`, chunk);
            });
          }

          windows.forEach((win) => {
            win.webContents.send(`llm:stream:${requestId}:end`);
          });
        } catch (error) {
          windows.forEach((win) => {
            win.webContents.send(`llm:stream:${requestId}:error`, error);
          });
        }
      })();

      return requestId;
    }),

  getLLMConfig: t.procedure.input<void>().handle(async () => {
    return SettingStore.get('model');
  }),

  updateLLMConfig: t.procedure
    .input<ModelSettings>()
    .handle(async ({ input }) => {
      logger.info('[llmRoute.updateLLMConfig] input', maskSensitiveData(input));
      try {
        SettingStore.set('model', input);
        currentLLMConfigRef.current = getLLMProviderConfig(input);
        return true;
      } catch (error) {
        logger.error(
          '[llmRoute.updateLLMConfig] Failed to update LLM configuration:',
          error,
        );
        return false;
      }
    }),

  getAvailableProviders: t.procedure.input<void>().handle(async () => {
    try {
      return ProviderFactory.getAvailableProviders();
    } catch (error) {
      logger.error(
        '[llmRoute.getAvailableProviders] Failed to get available providers:',
        error,
      );
      return [];
    }
  }),
  abortRequest: t.procedure
    .input<{ requestId: string }>()
    .handle(async ({ input }) => {
      logger.info('[llmRoute.abortRequest] input', input);
      try {
        const llm = createLLM(currentLLMConfigRef.current);
        llm.abortRequest(input.requestId);
        return true;
      } catch (error) {
        logger.error('[llmRoute.abortRequest] Failed to abort request:', error);
        return false;
      }
    }),
});

// LLM 인스턴스 생성
const llmInstance = new LLM(SettingStore.get('model') as LLMConfig);

// LLM 요청 처리
ipcMain.handle(
  'llm:ask',
  async (
    _,
    { messages, requestId }: { messages: Message[]; requestId: string },
  ) => {
    try {
      // LLM 결과 가져오기
      const llmResponse = await llmInstance.askLLMText({ messages, requestId });

      // VLM Provider가 설정되어 있고, 마지막 메시지에 스크린샷이 있는 경우 VLM 결과도 가져오기
      const settings = SettingStore.get('model');
      if (
        settings?.vlmProvider === VLMProviderV2.llava_onevision &&
        messages[messages.length - 1]?.screenshot
      ) {
        try {
          const vlmResponse = await llmInstance.askLLMText({
            messages: [messages[messages.length - 1]],
            requestId: `${requestId}-vlm`,
          });

          // LLM과 VLM 결과 통합
          return `${llmResponse}\n\n[Vision Analysis]\n${vlmResponse}`;
        } catch (vlmError) {
          logger.error('[llm:ask] VLM error:', vlmError);
          // VLM 에러가 발생해도 LLM 결과는 반환
          return llmResponse;
        }
      }

      return llmResponse;
    } catch (error) {
      logger.error('[llm:ask] error:', error);
      throw error;
    }
  },
);

// LLM 스트림 요청 처리
ipcMain.handle(
  'llm:askStream',
  async (
    _,
    { messages, requestId }: { messages: Message[]; requestId: string },
  ) => {
    const windows = BrowserWindow.getAllWindows();
    try {
      // LLM 스트림 결과 가져오기
      const llmStream = llmInstance.askLLMTextStream({ messages, requestId });

      // VLM Provider가 설정되어 있고, 마지막 메시지에 스크린샷이 있는 경우 VLM 결과도 가져오기
      const settings = SettingStore.get('model');
      if (
        settings?.vlmProvider === VLMProviderV2.llava_onevision &&
        messages[messages.length - 1]?.screenshot
      ) {
        try {
          // LLM 스트림 결과를 모두 수집하고 전송
          for await (const chunk of llmStream) {
            if (!windows.length) return;
            windows.forEach((win) => {
              win.webContents.send(`llm:stream:${requestId}:data`, chunk);
            });
          }

          // VLM 결과 가져오기
          const vlmResponse = await llmInstance.askLLMText({
            messages: [messages[messages.length - 1]],
            requestId: `${requestId}-vlm`,
          });

          // VLM 결과 전송
          if (windows.length) {
            windows.forEach((win) => {
              win.webContents.send(
                `llm:stream:${requestId}:data`,
                '\n\n[Vision Analysis]\n',
              );
              win.webContents.send(`llm:stream:${requestId}:data`, vlmResponse);
            });
          }
        } catch (vlmError) {
          logger.error('[llm:askStream] VLM error:', vlmError);
          // VLM 에러가 발생해도 LLM 스트림은 계속 진행
          for await (const chunk of llmStream) {
            if (!windows.length) return;
            windows.forEach((win) => {
              win.webContents.send(`llm:stream:${requestId}:data`, chunk);
            });
          }
        }
      } else {
        // VLM Provider가 없는 경우 LLM 스트림만 반환
        for await (const chunk of llmStream) {
          if (!windows.length) return;
          windows.forEach((win) => {
            win.webContents.send(`llm:stream:${requestId}:data`, chunk);
          });
        }
      }

      // 스트림 종료 신호 전송
      if (windows.length) {
        windows.forEach((win) => {
          win.webContents.send(`llm:stream:${requestId}:end`);
        });
      }
    } catch (error) {
      logger.error('[llm:askStream] error:', error);
      if (windows.length) {
        windows.forEach((win) => {
          win.webContents.send(`llm:stream:${requestId}:error`, error);
        });
      }
      throw error;
    }

    return requestId;
  },
);

// LLM 도구 요청 처리
ipcMain.handle(
  'llm:askTool',
  async (
    _,
    {
      messages,
      tools,
      requestId,
      toolChoice,
    }: {
      messages: Message[];
      tools: any[];
      requestId: string;
      toolChoice?: any;
    },
  ) => {
    try {
      // LLM 결과 가져오기
      const llmResponse = await llmInstance.askTool({
        messages,
        tools,
        requestId,
        toolChoice,
      });

      // VLM Provider가 설정되어 있고, 마지막 메시지에 스크린샷이 있는 경우 VLM 결과도 가져오기
      const settings = SettingStore.get('model');
      if (
        settings?.vlmProvider === VLMProviderV2.llava_onevision &&
        messages[messages.length - 1]?.screenshot
      ) {
        try {
          const vlmResponse = await llmInstance.askLLMText({
            messages: [messages[messages.length - 1]],
            requestId: `${requestId}-vlm`,
          });

          // LLM과 VLM 결과 통합
          return {
            content: `${llmResponse.content}\n\n[Vision Analysis]\n${vlmResponse}`,
            tool_calls: llmResponse.tool_calls,
          };
        } catch (vlmError) {
          logger.error('[llm:askTool] VLM error:', vlmError);
          // VLM 에러가 발생해도 LLM 결과는 반환
          return llmResponse;
        }
      }

      return llmResponse;
    } catch (error) {
      logger.error('[llm:askTool] error:', error);
      throw error;
    }
  },
);
