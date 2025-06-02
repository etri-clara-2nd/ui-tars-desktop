import { Operator } from '@ui-tars/sdk/core';
import { GUIAgentData } from '@ui-tars/shared/types';
import { UITarsModelVersion } from '@ui-tars/shared/types';

export interface Message {
  from: 'human' | 'assistant';
  value: string;
  timing?: {
    start: number;
    end?: number;
  };
  predictionParsed?: any[];
  screenshotBase64WithElementMarker?: string;
  show_screenshot?: boolean;
  screenshot_url?: string;
}

export interface GUIAgentConfig<T extends Operator> {
  model: {
    baseURL: string;
    apiKey: string;
    model: string;
  };
  systemPrompt: string;
  logger: any;
  signal?: AbortSignal;
  operator: T;
  screenshot?: {
    enabled: boolean;
    captureOnAction: boolean;
    captureOnError: boolean;
  };
  onData: (data: { data: GUIAgentData }) => Promise<void>;
  onError: (data: { error: Error }) => void;
  retry?: {
    model?: {
      maxRetries: number;
    };
    screenshot?: {
      maxRetries: number;
    };
    execute?: {
      maxRetries: number;
    };
  };
  maxLoopCount: number;
  loopIntervalInMs: number;
  uiTarsVersion: UITarsModelVersion;
}
