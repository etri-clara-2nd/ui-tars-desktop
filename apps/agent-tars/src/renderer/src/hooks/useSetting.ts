import { useEffect, useState } from 'react';
import { LocalStore } from '@main/store/types';
import { api } from '@renderer/api';

export function useSetting() {
  const [settings, setSettings] = useState<LocalStore | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const store = await api.getStore();
      setSettings(store);
    };

    loadSettings();

    const handleSettingUpdated = (_event: any, newValue: LocalStore) => {
      setSettings(newValue);
    };

    api.onSettingUpdated(handleSettingUpdated);

    return () => {
      api.offSettingUpdated(handleSettingUpdated);
    };
  }, []);

  const updateSetting = async (newSetting: Partial<LocalStore>) => {
    await api.updateSetting(newSetting);
  };

  const clearSetting = async () => {
    await api.clearSetting();
  };

  return {
    settings: settings || {},
    updateSetting,
    clearSetting,
  };
}
