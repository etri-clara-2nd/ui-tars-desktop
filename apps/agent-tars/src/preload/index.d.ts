import { ElectronAPI } from '@electron-toolkit/preload';
import { LocalStore } from '@main/store/types';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      on: (channel: string, callback: (...args: any[]) => void) => void;
      off: (channel: string, callback: (...args: any[]) => void) => void;
      getStore: () => Promise<LocalStore>;
      updateSetting: (setting: Partial<LocalStore>) => Promise<boolean>;
      clearSetting: () => Promise<boolean>;
      onSettingUpdated: (callback: (value: LocalStore) => void) => void;
      offSettingUpdated: (callback: (value: LocalStore) => void) => void;
      closeSettingsWindow: () => Promise<void>;
      showMainWindow: () => Promise<void>;
    };
  }
}
