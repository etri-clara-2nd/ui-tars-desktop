/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import assert from 'assert';

import { logger } from '@main/logger';
import { hideWindowBlock } from '@main/window/index';
import { StatusEnum, UITarsModelVersion } from '@ui-tars/shared/types';
import { type ConversationWithSoM } from '@main/shared/types';
import { GUIAgent, type GUIAgentConfig } from '@ui-tars/sdk';
import { markClickPosition } from '@main/utils/image';
import { UTIOService } from '@main/services/utio';
import { NutJSElectronOperator } from '../agent/operator';
import { DefaultBrowserOperator } from '@ui-tars/operator-browser';
import { getSystemPrompt, getSystemPromptV1_5 } from '../agent/prompts';
import {
  closeScreenMarker,
  hideWidgetWindow,
  hideScreenWaterFlow,
  showWidgetWindow,
  showPredictionMarker,
  showScreenWaterFlow,
} from '@main/window/ScreenMarker';
import { SettingStore } from '@main/store/setting';
import { AppState, VLMProviderV2 } from '@main/store/types';
import { GUIAgentManager } from '../ipcRoutes/agent';
import { checkBrowserAvailability } from './browserCheck';
import { initIpc } from '@ui-tars/electron-ipc/main';
const { api } = initIpc;

const getModelVersion = (
  provider: VLMProviderV2 | undefined,
): UITarsModelVersion => {
  switch (provider) {
    case VLMProviderV2.ui_tars_1_5:
      return UITarsModelVersion.V1_5;
    case VLMProviderV2.ui_tars_1_0:
      return UITarsModelVersion.V1_0;
    case VLMProviderV2.doubao_1_5:
      return UITarsModelVersion.DOUBAO_1_5_15B;
    default:
      return UITarsModelVersion.V1_0;
  }
};

export const runAgent = async (
  setState: (state: AppState) => void,
  getState: () => AppState,
) => {
  logger.info('runAgent');
  const settings = SettingStore.getStore();
  const { instructions, abortController } = getState();
  assert(instructions, 'instructions is required');

  const language = settings.language ?? 'en';

  showWidgetWindow();
  if (settings.operator === 'nutjs') {
    showScreenWaterFlow();
  }

  const handleData: GUIAgentConfig<NutJSElectronOperator>['onData'] = async ({
    data,
  }) => {
    const lastConv = getState().messages[getState().messages.length - 1];
    const { status, conversations, ...restUserData } = data;
    logger.info('[status]', status, conversations.length);

    // 상태가 CALL_USER가 되지 않도록 수정
    const newStatus = status === 'call_user' ? StatusEnum.RUNNING : status;

    // add SoM to conversations
    const conversationsWithSoM: ConversationWithSoM[] = await Promise.all(
      conversations.map(async (conv) => {
        const { screenshotContext, predictionParsed } = conv;
        // 스크린샷이 있는 경우 마지막 대화의 스크린샷을 사용
        if (lastConv?.screenshotBase64 && screenshotContext?.size) {
          const screenshotBase64WithElementMarker = predictionParsed
            ? await markClickPosition({
                screenshotContext: {
                  size: screenshotContext.size,
                  mime: screenshotContext.mime,
                  scaleFactor: screenshotContext.scaleFactor,
                },
                base64: lastConv.screenshotBase64,
                parsed: predictionParsed,
              }).catch((e) => {
                logger.error('[markClickPosition error]:', e);
                return '';
              })
            : undefined;

          return {
            ...conv,
            screenshotBase64: lastConv.screenshotBase64, // 스크린샷 추가
            screenshotBase64WithElementMarker,
          };
        }
        return conv;
      }),
    ).catch((e) => {
      logger.error('[conversationsWithSoM error]:', e);
      return conversations;
    });

    // 현재 상태의 메시지와 새로운 대화를 합침
    const currentMessages = getState().messages || [];
    const updatedMessages = [...currentMessages, ...conversationsWithSoM];

    // 상태 업데이트 - status가 user_stopped일 때도 대화 유지
    setState({
      ...getState(),
      status: newStatus === 'user_stopped' ? StatusEnum.END : newStatus,
      restUserData,
      messages: updatedMessages,
    });

    // LLaVA-OneVision 호출 조건 로깅
    logger.info('[LLaVA-OneVision] Call conditions:', {
      llavaProvider: settings.llavaProvider,
      llavaProviderIsNone: settings.llavaProvider === VLMProviderV2.none,
      hasConversations: updatedMessages.length > 0,
      conversationsLength: updatedMessages.length,
      lastConversation: updatedMessages[updatedMessages.length - 1]
        ? {
            hasPredictionParsed:
              !!updatedMessages[updatedMessages.length - 1]?.predictionParsed,
            predictionParsedLength:
              updatedMessages[updatedMessages.length - 1]?.predictionParsed
                ?.length,
            hasScreenshot:
              !!updatedMessages[updatedMessages.length - 1]?.screenshotBase64,
            screenshotLength:
              updatedMessages[updatedMessages.length - 1]?.screenshotBase64
                ?.length,
          }
        : null,
    });

    // LLaVA-OneVision 호출
    if (
      settings.llavaProvider !== VLMProviderV2.none &&
      updatedMessages.length > 0
    ) {
      const lastConversation = updatedMessages[updatedMessages.length - 1];
      const lastPrediction =
        lastConversation?.predictionParsed?.[
          lastConversation.predictionParsed.length - 1
        ];

      // Thought가 생성된 후에만 Vision Analysis 수행
      if (lastPrediction?.thought) {
        try {
          let screenshotBase64: string | undefined;

          // Browser Use와 Computer Use에 따라 스크린샷 캡처 방식 분리
          if (settings.operator === 'browser') {
            // Browser Use: 기존 operator 인스턴스 사용
            logger.info('[LLaVA-OneVision] Capturing browser screenshot...');
            const result = await operator.screenshot();
            screenshotBase64 = result.base64;
          } else {
            // Computer Use: 전체 화면 캡처
            logger.info(
              '[LLaVA-OneVision] Capturing full screen screenshot...',
            );
            const result = await operator.screenshot();
            screenshotBase64 = result.base64;
          }

          if (!screenshotBase64) {
            logger.error('[LLaVA-OneVision] Failed to capture screenshot');
            return;
          }

          logger.info('[LLaVA-OneVision] Calling LLaVA-OneVision API...');
          const requestBody = {
            model: settings.llavaModelName,
            messages: [
              {
                role: 'system',
                content:
                  'You are a vision assistant. Analyze the screenshot and provide insights about what you see.',
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Please analyze this screenshot and provide insights about what you see.',
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/jpeg;base64,${screenshotBase64}`,
                      detail: 'high',
                    },
                  },
                ] as const,
              },
            ],
            stream: false,
            temperature: 0.7,
            max_tokens: 1024,
          };
          logger.info(
            '[LLaVA-OneVision] Request body:',
            JSON.stringify(
              {
                ...requestBody,
                messages: requestBody.messages.map((msg) => {
                  if (typeof msg.content === 'string') {
                    return msg;
                  }
                  return {
                    ...msg,
                    content: msg.content.map((content) => {
                      if (content.type === 'image_url') {
                        return {
                          ...content,
                          image_url: {
                            ...content.image_url,
                            url: '[BASE64_IMAGE]',
                          },
                        };
                      }
                      return content;
                    }),
                  };
                }),
              },
              null,
              2,
            ),
          );

          const llavaResponse = await fetch(
            `${settings.llavaBaseUrl}/v1/chat/completions`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            },
          );

          if (!llavaResponse.ok) {
            const errorText = await llavaResponse.text();
            logger.error(
              '[LLaVA-OneVision] API Error:',
              llavaResponse.status,
              errorText,
            );
            throw new Error(
              `LLaVA-OneVision API error: ${llavaResponse.status} ${errorText}`,
            );
          }

          const llavaResult = await llavaResponse.json();
          logger.info(
            '[LLaVA-OneVision] Response:',
            JSON.stringify(llavaResult, null, 2),
          );

          if (llavaResult.choices?.[0]?.message?.content) {
            const visionAnalysis = llavaResult.choices[0].message.content;
            logger.info('[LLaVA-OneVision] Vision Analysis:', visionAnalysis);

            // 기존 thought에 Vision Analysis 추가
            lastPrediction.thought = `${lastPrediction.thought}\n\n[Vision Analysis]\n${visionAnalysis}`;

            // Vision Analysis를 새로운 대화 메시지로 추가
            const visionMessage: ConversationWithSoM = {
              from: 'assistant',
              value: `[Vision Analysis]\n${visionAnalysis}`,
              timing: {
                start: Date.now(),
                end: Date.now(),
                cost: 0,
              },
              screenshotBase64, // 새로운 스크린샷 사용
            };

            // 상태 업데이트
            setState({
              ...getState(),
              messages: [...updatedMessages, visionMessage],
            });
          } else {
            logger.error(
              '[LLaVA-OneVision] No content in response:',
              JSON.stringify(llavaResult, null, 2),
            );
          }
        } catch (error) {
          logger.error('[LLaVA-OneVision] Error:', error);
        }
      } else {
        logger.info('[LLaVA-OneVision] Waiting for thought to be generated...');
      }
    } else {
      logger.info('[LLaVA-OneVision] Skipping call - conditions not met:', {
        llavaProvider: settings.llavaProvider,
        hasConversations: updatedMessages.length > 0,
      });
    }
  };

  const lastStatus = getState().status;

  let operator: NutJSElectronOperator | DefaultBrowserOperator;
  if (settings.operator === 'nutjs') {
    operator = new NutJSElectronOperator();
  } else {
    await checkBrowserAvailability();
    const { browserAvailable } = getState();
    if (!browserAvailable) {
      setState({
        ...getState(),
        status: StatusEnum.ERROR,
        errorMsg:
          'Browser is not available. Please install Chrome and try again.',
      });
      return;
    }
    // 하나의 브라우저 인스턴스를 재사용
    operator = await DefaultBrowserOperator.getInstance(false, false, false);
  }

  const guiAgent = new GUIAgent({
    model: {
      baseURL: settings.uiTarsBaseUrl,
      apiKey: settings.uiTarsApiKey,
      model: settings.uiTarsModelName,
    },
    systemPrompt:
      getModelVersion(settings.uiTarsProvider) === UITarsModelVersion.V1_5
        ? getSystemPromptV1_5(language, 'normal')
        : getSystemPrompt(language),
    logger,
    signal: abortController?.signal,
    operator: operator,
    onData: handleData,
    onError: ({ error }) => {
      logger.error('[runAgent error]', settings, error);
    },
    retry: {
      model: {
        maxRetries: 3,
      },
      screenshot: {
        maxRetries: 5,
      },
      execute: {
        maxRetries: 1,
      },
    },
    maxLoopCount: settings.maxLoopCount,
    loopIntervalInMs: settings.loopIntervalInMs,
    uiTarsVersion: getModelVersion(settings.uiTarsProvider),
  });

  GUIAgentManager.getInstance().setAgent(guiAgent);

  await hideWindowBlock(async () => {
    await UTIOService.getInstance().sendInstruction(instructions);

    await guiAgent
      .run(instructions)
      .catch((e) => {
        logger.error('[runAgentLoop error]', e);
        setState({
          ...getState(),
          status: StatusEnum.ERROR,
          errorMsg: e.message,
        });
      })
      .finally(() => {
        hideWidgetWindow();
        if (settings.operator === 'nutjs') {
          closeScreenMarker();
          hideScreenWaterFlow();
        }
      });
  }).catch((e) => {
    logger.error('[runAgent error hideWindowBlock]', settings, e);
  });
};
