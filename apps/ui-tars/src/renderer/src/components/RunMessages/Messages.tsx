/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { AlertCircle, Camera, Loader2, User } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { cn } from '@renderer/utils';
import claraLogo from '../../assets/clara-logo.png';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const HumanTextMessage = ({ text }: { text: string }) => {
  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex items-center gap-2">
        <User className="h-6 w-6 text-primary" />
        <div className="text-sm font-medium">You</div>
      </div>
      <div className="text-sm">{text}</div>
    </div>
  );
};

export const RobotTextMessage = ({
  text,
  showScreenshot,
  screenshotUrl,
}: {
  text: string;
  showScreenshot?: boolean;
  screenshotUrl?: string;
}) => {
  const [screenshot, setScreenshot] = React.useState<string | null>(null);
  const [wsStatus, setWsStatus] = React.useState<
    'connecting' | 'connected' | 'error'
  >('connecting');
  const [wsError, setWsError] = React.useState<string | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout>();

  React.useEffect(() => {
    if (showScreenshot && screenshotUrl) {
      console.log(
        '[RobotTextMessage] Attempting to connect to WebSocket:',
        screenshotUrl,
      );
      setWsStatus('connecting');
      setWsError(null);

      const connectWebSocket = () => {
        try {
          // 이전 연결이 있다면 정리
          if (wsRef.current) {
            wsRef.current.close();
          }
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          // WebSocket 연결
          const ws = new WebSocket(screenshotUrl);
          wsRef.current = ws;

          ws.onopen = (event) => {
            console.log(
              '[RobotTextMessage] WebSocket connected successfully',
              event,
            );
            setWsStatus('connected');
            setWsError(null);
          };

          ws.onmessage = (event) => {
            console.log('[RobotTextMessage] Received WebSocket message:', {
              type: typeof event.data,
              size: event.data.size,
              isBlob: event.data instanceof Blob,
              isArrayBuffer: event.data instanceof ArrayBuffer,
            });

            try {
              // 바이너리 데이터를 Blob으로 변환
              const blob = new Blob([event.data], { type: 'image/png' });
              console.log('[RobotTextMessage] Created Blob:', {
                size: blob.size,
                type: blob.type,
              });

              const url = URL.createObjectURL(blob);
              console.log('[RobotTextMessage] Created blob URL:', url);

              // 이미지 로드 테스트
              const img = new Image();
              img.onload = () => {
                console.log('[RobotTextMessage] Image loaded successfully:', {
                  width: img.width,
                  height: img.height,
                });
                setScreenshot(url);
              };
              img.onerror = (error) => {
                console.error(
                  '[RobotTextMessage] Failed to load image:',
                  error,
                );
                setWsError('Failed to load image');
              };
              img.src = url;
            } catch (error) {
              console.error(
                '[RobotTextMessage] Error processing WebSocket message:',
                error,
              );
              setWsError('Failed to process screenshot data');
            }
          };

          ws.onerror = (error) => {
            console.error('[RobotTextMessage] WebSocket error:', error);
            setWsStatus('error');
            setWsError('WebSocket connection error');
          };

          ws.onclose = (event) => {
            console.log('[RobotTextMessage] WebSocket closed:', {
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean,
            });

            // 정상적인 종료가 아닌 경우에만 재연결 시도
            if (!event.wasClean) {
              setWsStatus('error');
              setWsError(`Connection lost (code: ${event.code})`);

              // 3초 후 재연결 시도
              reconnectTimeoutRef.current = setTimeout(() => {
                console.log('[RobotTextMessage] Attempting to reconnect...');
                connectWebSocket();
              }, 3000);
            }
          };
        } catch (error) {
          console.error(
            '[RobotTextMessage] Failed to create WebSocket:',
            error,
          );
          setWsStatus('error');
          setWsError(
            error instanceof Error
              ? error.message
              : 'Failed to create WebSocket connection',
          );
        }
      };

      // 초기 연결 시도
      connectWebSocket();

      // 컴포넌트 언마운트 시 정리
      return () => {
        if (wsRef.current) {
          wsRef.current.close();
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        if (screenshot) {
          URL.revokeObjectURL(screenshot);
        }
      };
    }
  }, [showScreenshot, screenshotUrl]);

  return (
    <div className="flex items-start gap-x-4 py-4">
      <div className="flex-none">
        <img src={claraLogo} alt="CLARA" className="h-6 w-6" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="text-sm text-foreground prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
        {showScreenshot && (
          <div className="mt-2">
            {wsStatus === 'connecting' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                스크린샷 연결 중...
              </div>
            )}
            {wsStatus === 'error' && (
              <div className="flex flex-col gap-2 text-sm text-red-500">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  스크린샷 연결 실패
                </div>
                {wsError && (
                  <div className="text-xs text-red-400 ml-6">{wsError}</div>
                )}
              </div>
            )}
            {wsStatus === 'connected' &&
              (screenshot ? (
                <img
                  src={screenshot}
                  alt="Robot Screenshot"
                  className="w-full max-w-lg rounded-lg shadow-lg"
                  onError={(e) => {
                    console.error('[RobotTextMessage] Image render error:', e);
                    setWsError('Failed to display image');
                  }}
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  이미지 로딩 중...
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const ScreenshotMessage = ({ onClick }: { onClick?: () => void }) => {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchScreenshot = async () => {
      try {
        const response = await fetch('http://localhost:8001/v1/screenshot');
        if (!response.ok) throw new Error('Failed to fetch screenshot');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
      } catch (error) {
        console.error('Error fetching screenshot:', error);
      }
    };
    fetchScreenshot();
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col gap-2 mb-4 cursor-pointer',
        onClick && 'hover:opacity-80',
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <Camera className="h-6 w-6" />
        <div className="text-sm font-medium">Screenshot</div>
      </div>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Robot Screenshot"
          className="w-full max-w-lg rounded-lg shadow-lg"
        />
      ) : (
        <div className="text-sm">Loading screenshot...</div>
      )}
    </div>
  );
};

export const ErrorMessage = ({ text }: { text: string }) => {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="text-sm text-red-500">{text}</div>
    </div>
  );
};

export const LoadingText = ({ text }: { text: string }) => {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Loader2 className="h-4 w-4 animate-spin" />
      <div className="text-sm">{text}</div>
    </div>
  );
};
