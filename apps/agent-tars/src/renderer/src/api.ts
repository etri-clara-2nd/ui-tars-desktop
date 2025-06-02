import { LocalStore } from '@main/store/types';

declare global {
  interface Window {
    electron: {
      getStore: () => Promise<LocalStore>;
      updateSetting: (setting: Partial<LocalStore>) => Promise<void>;
      clearSetting: () => Promise<void>;
      onSettingUpdated: (
        callback: (event: any, value: LocalStore) => void,
      ) => void;
      offSettingUpdated: (
        callback: (event: any, value: LocalStore) => void,
      ) => void;
      closeSettingsWindow: () => Promise<void>;
      showMainWindow: () => Promise<void>;
    };
  }
}

export const api = {
  getStore: () => window.electron.getStore(),
  updateSetting: (setting: Partial<LocalStore>) =>
    window.electron.updateSetting(setting),
  clearSetting: () => window.electron.clearSetting(),
  onSettingUpdated: (callback: (event: any, value: LocalStore) => void) =>
    window.electron.onSettingUpdated(callback),
  offSettingUpdated: (callback: (event: any, value: LocalStore) => void) =>
    window.electron.offSettingUpdated(callback),
  closeSettingsWindow: () => window.electron.closeSettingsWindow(),
  showMainWindow: () => window.electron.showMainWindow(),
};
