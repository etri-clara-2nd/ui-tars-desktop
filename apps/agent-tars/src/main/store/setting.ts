/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { BrowserWindow } from 'electron';
import ElectronStore from 'electron-store';
import { logger } from '@main/utils/logger';
import { LocalStore, VLMProviderV2 } from './types';

export const DEFAULT_SETTING: LocalStore = {
  // 공통 설정
  language: 'en',

  // UI-TARS 설정
  uiTarsProvider: VLMProviderV2.ui_tars_1_5,
  uiTarsBaseUrl: 'http://129.254.196.201:8000',
  uiTarsApiKey: 'None',
  uiTarsModelName: 'ByteDance-Seed/UI-TARS-1.5-7B',

  // LLaVA-OneVision 설정
  llavaProvider: VLMProviderV2.llava_onevision_remote,
  llavaBaseUrl: 'http://129.254.196.201:8001',
  llavaModelName: 'llava-hf/llava-onevision-qwen2-7b-ov-hf',

  // 기타 설정
  maxLoopCount: 100,
  loopIntervalInMs: 1000,
  operator: 'browser',
};

export class SettingStore {
  private static instance: ElectronStore<LocalStore>;

  public static getInstance(): ElectronStore<LocalStore> {
    if (!SettingStore.instance) {
      SettingStore.instance = new ElectronStore<LocalStore>({
        name: 'agent_tars.setting',
        defaults: DEFAULT_SETTING,
      });

      SettingStore.instance.onDidAnyChange((newValue, oldValue) => {
        logger.log(
          `SettingStore: ${JSON.stringify(oldValue)} changed to ${JSON.stringify(newValue)}`,
        );
        // 설정 변경 시 모든 윈도우에 알림
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send('setting-updated', newValue);
        });
      });
    }
    return SettingStore.instance;
  }

  public static getStore(): LocalStore {
    return SettingStore.getInstance().store;
  }

  public static setStore(newSetting: Partial<LocalStore>): void {
    const store = SettingStore.getInstance();
    const currentSetting = store.store;
    store.store = { ...currentSetting, ...newSetting };
  }

  public static get<K extends keyof LocalStore>(key: K): LocalStore[K] {
    return SettingStore.getInstance().get(key);
  }

  public static set<K extends keyof LocalStore>(
    key: K,
    value: LocalStore[K],
  ): void {
    SettingStore.getInstance().set(key, value);
  }

  public static clear(): void {
    SettingStore.getInstance().set(DEFAULT_SETTING);
  }
}
