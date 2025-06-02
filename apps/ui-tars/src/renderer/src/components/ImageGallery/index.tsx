/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MousePointerClick, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { type ConversationWithSoM } from '@main/shared/types';
import Image from '@renderer/components/Image';
import { ActionIconMap } from '@renderer/const/actions';
import ms from 'ms';
import { useSetting } from '@renderer/hooks/useSetting';

interface ImageGalleryProps {
  selectImgIndex?: number;
  messages: ConversationWithSoM[];
}

interface Action {
  action: string;
  type: string;
  cost?: number | undefined;
  input?: string;
}

interface Timing {
  start: number;
  end: number;
  cost: number;
}

interface ImageEntryBase {
  originalIndex: number;
  message: ConversationWithSoM;
  timing: Timing | undefined;
}

interface BrowserImageEntry extends ImageEntryBase {
  imageData: string;
  actions: Action[];
}

interface RobotImageEntry extends ImageEntryBase {
  imageUrl: string;
  actions: {
    action: string;
    type: string;
    cost: number | undefined;
  }[];
}

type ImageEntry = BrowserImageEntry | RobotImageEntry;

function isBrowserImageEntry(entry: ImageEntry): entry is BrowserImageEntry {
  return 'imageData' in entry;
}

function isRobotImageEntry(entry: ImageEntry): entry is RobotImageEntry {
  return 'imageUrl' in entry;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  messages,
  selectImgIndex,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<{ [key: string]: string }>(
    {},
  );
  const [streamingImage, setStreamingImage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const previousImageUrlRef = useRef<string | null>(null);
  const { settings } = useSetting();

  const imageEntries = useMemo(() => {
    // Robot Use가 아닐 경우 기존 이미지 처리 로직 사용
    if (settings.operator !== 'robot') {
      return messages
        .map((msg, index) => {
          let actions: Action[] = [];
          if (msg.predictionParsed?.length) {
            actions = msg.predictionParsed.map((item) => {
              let input = '';
              if (item.action_inputs?.start_box) {
                input += `(start_box: ${item.action_inputs.start_box})`;
              }
              if (item.action_inputs?.content) {
                input += ` (${item.action_inputs.content})`;
              }
              if (item.action_inputs?.key) {
                input += ` (${item.action_inputs.key})`;
              }
              return {
                action: 'Action',
                type: item.action_type,
                cost: msg.timing?.cost,
                input,
              };
            });
          }
          const imageData =
            msg.screenshotBase64 || msg.screenshotBase64WithElementMarker;
          if (!imageData) return null;

          return {
            originalIndex: index,
            message: msg,
            imageData,
            actions: actions,
            timing: msg.timing,
          };
        })
        .filter((entry): entry is BrowserImageEntry => entry !== null);
    }

    // Robot Use일 경우 스크린샷 표시 로직 사용
    return messages
      .map((msg, index) => {
        if (msg.screenshot_url) {
          return {
            originalIndex: index,
            message: msg,
            imageUrl: msg.screenshot_url,
            actions: [
              {
                action: 'Screenshot',
                type: 'screenshot',
                cost: msg.timing?.cost,
              },
            ],
            timing: msg.timing,
          };
        }
        return null;
      })
      .filter((entry): entry is RobotImageEntry => entry !== null);
  }, [messages, settings.operator]);

  useEffect(() => {
    const loadImage = async (url: string) => {
      if (!url || settings.operator !== 'robot') return;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch screenshot');
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setLoadedImages((prev) => ({ ...prev, [url]: imageUrl }));
      } catch (error) {
        console.error('Error loading image:', error);
      }
    };

    imageEntries.forEach((entry) => {
      if (
        'imageUrl' in entry &&
        entry.imageUrl &&
        !loadedImages[entry.imageUrl]
      ) {
        loadImage(entry.imageUrl);
      }
    });
  }, [imageEntries, loadedImages, settings.operator]);

  useEffect(() => {
    if (typeof selectImgIndex === 'number') {
      const targetIndex = imageEntries.findIndex(
        (entry) => entry.originalIndex === selectImgIndex,
      );
      if (targetIndex !== -1) {
        setCurrentIndex(targetIndex);
      }
    }
  }, [selectImgIndex, imageEntries]);

  useEffect(() => {
    setCurrentIndex(imageEntries.length - 1);
  }, [imageEntries]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];

    // 새 메시지가 들어올 때마다 이전 상태 초기화
    setStreamingImage(null);
    setIsStreaming(false);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (previousImageUrlRef.current) {
      URL.revokeObjectURL(previousImageUrlRef.current);
      previousImageUrlRef.current = null;
    }

    // 위치 확인 요청인 경우
    if (settings.operator === 'robot' && lastMessage?.show_screenshot) {
      // 새로운 WebSocket 연결 설정
      const ws = new WebSocket('ws://129.254.196.201:8002/ws/robot-stream');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected for screenshot');
        setIsStreaming(true);
      };

      ws.onmessage = (event) => {
        if (event.data instanceof Blob) {
          const imageUrl = URL.createObjectURL(event.data);
          if (previousImageUrlRef.current) {
            URL.revokeObjectURL(previousImageUrlRef.current);
          }
          previousImageUrlRef.current = imageUrl;
          setStreamingImage(imageUrl);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsStreaming(false);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsStreaming(false);
      };
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (previousImageUrlRef.current) {
        URL.revokeObjectURL(previousImageUrlRef.current);
        previousImageUrlRef.current = null;
      }
    };
  }, [messages, settings.operator]);

  const handleSliderChange = (value: number[]) => {
    setCurrentIndex(value[0]);
  };

  const handlePrevious = () => {
    setCurrentIndex(
      (current) => (current - 1 + imageEntries.length) % imageEntries.length,
    );
  };

  const handleNext = () => {
    setCurrentIndex((current) => (current + 1) % imageEntries.length);
  };

  if (settings.operator === 'robot' && streamingImage) {
    return (
      <div className="h-full flex flex-col py-10">
        <div className="pl-4 border-t">
          <h2 className="mt-2 mb-4 font-semibold text-lg">
            {settings.operator === 'robot' ? 'My Robot' : 'My Computer'}
          </h2>
          {isStreaming && (
            <div className="text-sm text-green-500 mb-4">
              로봇 동작 스트리밍 중...
            </div>
          )}
        </div>
        <div className="flex-1 relative">
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <img
              src={streamingImage}
              alt="Robot Stream"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      </div>
    );
  }

  if (imageEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No images to display
      </div>
    );
  }

  const currentEntry = imageEntries[currentIndex];

  if (!currentEntry) {
    return null;
  }

  return (
    <div className="h-full flex flex-col py-10">
      <div className="pl-4 border-t">
        <h2 className="mt-2 mb-4 font-semibold text-lg">My Computer</h2>
        {currentEntry.actions.map((action, idx) => {
          const ActionIcon = ActionIconMap[action.type] || MousePointerClick;

          if (!action.type) {
            return null;
          }

          return (
            <div key={idx} className="flex items-start gap-3 mb-2">
              <div className="text-muted-foreground">
                <ActionIcon className="w-9 h-9" />
              </div>
              <div className="flex-1">
                <div className="text-base font-medium leading-tight">
                  {action.action}
                </div>
                <div className="text-xs text-muted-foreground max-w-full mr-4">
                  <span className="font-medium text-primary/70">
                    {action.type}
                  </span>
                  {action.input && (
                    <span className="text-primary/70 break-all max-w-full">
                      {action.input}
                    </span>
                  )}
                  {action.cost && (
                    <span className="ml-1 text-muted-foreground/70">
                      {ms(action.cost)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 relative">
        <div className="absolute inset-0 flex items-center justify-center p-4">
          {settings.operator === 'robot' ? (
            'imageUrl' in currentEntry &&
            currentEntry.imageUrl &&
            loadedImages[currentEntry.imageUrl] ? (
              <Image
                src={loadedImages[currentEntry.imageUrl]}
                alt={`screenshot from message ${currentEntry.originalIndex + 1}`}
              />
            ) : (
              <div className="text-muted-foreground">Loading image...</div>
            )
          ) : (
            'imageData' in currentEntry &&
            currentEntry.imageData && (
              <Image
                src={`data:image/png;base64,${currentEntry.imageData}`}
                alt={`screenshot from message ${currentEntry.originalIndex + 1}`}
              />
            )
          )}
        </div>
      </div>
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevious}
            disabled={imageEntries.length <= 1}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            disabled={imageEntries.length <= 1}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImageGallery;
