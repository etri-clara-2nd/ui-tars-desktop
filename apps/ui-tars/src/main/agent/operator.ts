/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Key, keyboard } from '@computer-use/nut-js';
import {
  type ScreenshotOutput,
  type ExecuteParams,
  type ExecuteOutput,
} from '@ui-tars/sdk/core';
import { NutJSOperator } from '@ui-tars/operator-nut-js';
import { clipboard } from 'electron';
import { desktopCapturer } from 'electron';

import * as env from '@main/env';
import { logger } from '@main/logger';
import { sleep } from '@ui-tars/shared/utils';
import { getScreenSize } from '@main/utils/screen';

export class NutJSElectronOperator extends NutJSOperator {
  static MANUAL = {
    ACTION_SPACES: [
      `click(start_box='[x1, y1, x2, y2]')`,
      `left_double(start_box='[x1, y1, x2, y2]')`,
      `right_single(start_box='[x1, y1, x2, y2]')`,
      `drag(start_box='[x1, y1, x2, y2]', end_box='[x3, y3, x4, y4]')`,
      `hotkey(key='')`,
      `type(content='') #If you want to submit your input, use "\\n" at the end of \`content\`.`,
      `scroll(start_box='[x1, y1, x2, y2]', direction='down or up or right or left')`,
      `wait() #Sleep for 5s and take a screenshot to check for any changes.`,
      `finished()`,
      `call_user() # Submit the task and call the user when the task is unsolvable, or when you need the user's help.`,
    ],
  };

  public async screenshot(): Promise<ScreenshotOutput> {
    logger.info('[NutJSElectronOperator] Taking screenshot...');

    const {
      physicalSize,
      logicalSize,
      scaleFactor,
      id: primaryDisplayId,
    } = getScreenSize(); // Logical = Physical / scaleX

    logger.info('[NutJSElectronOperator] Screen info:', {
      physicalSize,
      logicalSize,
      scaleFactor,
      primaryDisplayId,
    });

    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.round(logicalSize.width),
          height: Math.round(logicalSize.height),
        },
      });

      logger.info(
        '[NutJSElectronOperator] Available sources:',
        sources.map((s) => ({ id: s.display_id, name: s.name })),
      );

      const primarySource =
        sources.find(
          (source) => source.display_id === primaryDisplayId.toString(),
        ) || sources[0];

      if (!primarySource) {
        logger.error(
          '[NutJSElectronOperator] Primary display source not found',
          {
            primaryDisplayId,
            availableSources: sources.map((s) => s.display_id),
          },
        );
        // fallback to default screenshot
        const fallbackResult = await super.screenshot();
        logger.info('[NutJSElectronOperator] Using fallback screenshot');
        return fallbackResult;
      }

      logger.info('[NutJSElectronOperator] Using source:', {
        id: primarySource.display_id,
        name: primarySource.name,
      });

      const screenshot = primarySource.thumbnail;
      if (!screenshot) {
        logger.error('[NutJSElectronOperator] Failed to get thumbnail');
        throw new Error('Failed to get thumbnail');
      }

      const resized = screenshot.resize({
        width: physicalSize.width,
        height: physicalSize.height,
      });

      const result = {
        base64: resized.toJPEG(75).toString('base64'),
        scaleFactor,
        mime: 'image/jpeg',
      };

      logger.info('[NutJSElectronOperator] Screenshot captured successfully', {
        base64Length: result.base64.length,
        scaleFactor: result.scaleFactor,
        mime: result.mime,
      });

      return result;
    } catch (error) {
      logger.error('[NutJSElectronOperator] Screenshot error:', error);
      throw error;
    }
  }

  async execute(params: ExecuteParams): Promise<ExecuteOutput> {
    const { action_type, action_inputs } = params.parsedPrediction;

    if (action_type === 'type' && env.isWindows && action_inputs?.content) {
      const content = action_inputs.content?.trim();

      logger.info('[device] type', content);
      const stripContent = content.replace(/\\n$/, '').replace(/\n$/, '');
      const originalClipboard = clipboard.readText();
      clipboard.writeText(stripContent);
      await keyboard.pressKey(Key.LeftControl, Key.V);
      await sleep(50);
      await keyboard.releaseKey(Key.LeftControl, Key.V);
      await sleep(50);
      clipboard.writeText(originalClipboard);
    } else {
      return await super.execute(params);
    }
  }
}
