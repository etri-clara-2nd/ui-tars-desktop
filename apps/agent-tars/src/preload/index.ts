import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import { LocalStore } from '@main/store/types';

// Custom APIs for renderer
const api = {
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },

  // 설정 관련 API
  getStore: () => ipcRenderer.invoke('settings:getStore'),
  updateSetting: (setting: Partial<LocalStore>) =>
    ipcRenderer.invoke('settings:updateSetting', setting),
  clearSetting: () => ipcRenderer.invoke('settings:clearSetting'),
  onSettingUpdated: (callback: (value: LocalStore) => void) => {
    const handler = (_event: IpcRendererEvent, value: LocalStore) =>
      callback(value);
    ipcRenderer.on('setting-updated', handler);
    return () => ipcRenderer.removeListener('setting-updated', handler);
  },
  offSettingUpdated: (callback: (value: LocalStore) => void) => {
    const handler = (_event: IpcRendererEvent, value: LocalStore) =>
      callback(value);
    ipcRenderer.removeListener('setting-updated', handler);
  },
  closeSettingsWindow: () => ipcRenderer.invoke('window:closeSettings'),
  showMainWindow: () => ipcRenderer.invoke('window:showMain'),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
