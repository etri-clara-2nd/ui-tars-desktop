import { AppSettings } from '@agent-infra/shared';
import { SettingStore } from '@main/store/setting';
import { initIpc } from '@ui-tars/electron-ipc/main';
import { logger } from '@main/utils/logger';
import { maskSensitiveData } from '@main/utils/maskSensitiveData';
import { currentLLMConfigRef } from './llm';
import { LocalStore } from '@main/store/types';
import { BrowserWindow } from 'electron';

const t = initIpc.create();

export const settingsRoute = t.router({
  getStore: t.procedure.input<void>().handle(async () => {
    const settings = SettingStore.getStore();
    logger.info('[settingsRoute.getStore] result', maskSensitiveData(settings));
    return settings;
  }),

  updateSetting: t.procedure
    .input<Partial<LocalStore>>()
    .handle(async ({ input }) => {
      logger.info(
        '[settingsRoute.updateSetting] input',
        maskSensitiveData(input),
      );
      try {
        SettingStore.setStore(input);
        // 설정 변경 시 모든 윈도우에 알림
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send('setting-updated', SettingStore.getStore());
        });
        return true;
      } catch (error) {
        logger.error(
          '[settingsRoute.updateSetting] Failed to update settings:',
          error,
        );
        return false;
      }
    }),

  clearSetting: t.procedure.input<void>().handle(async () => {
    try {
      SettingStore.clear();
      // 설정 초기화 시 모든 윈도우에 알림
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('setting-updated', SettingStore.getStore());
      });
      return true;
    } catch (error) {
      logger.error(
        '[settingsRoute.clearSetting] Failed to clear settings:',
        error,
      );
      return false;
    }
  }),

  getFileSystemSettings: t.procedure.input<void>().handle(async () => {
    const settings = SettingStore.get('fileSystem');
    logger.info(
      '[settingsRoute.getFileSystemSettings] result',
      maskSensitiveData(settings),
    );
    return settings;
  }),

  updateAppSettings: t.procedure
    .input<AppSettings>()
    .handle(async ({ input }) => {
      logger.info(
        '[settingsRoute.updateAppSettings]',
        maskSensitiveData(input),
      );
      SettingStore.setStore(input);
      // Closes: #270, #271, #272
      currentLLMConfigRef.current = {
        ...input.model,
        // Closes: #274
        baseURL: input.model.endpoint,
        // Close: #290
        configName: input.model.provider,
      };
      return true;
    }),

  updateFileSystemSettings: t.procedure
    .input<AppSettings['fileSystem']>()
    .handle(async ({ input }) => {
      logger.info(
        '[settingsRoute.updateFileSystemSettings]',
        maskSensitiveData(input),
      );
      SettingStore.set('fileSystem', input);
      return true;
    }),
});
