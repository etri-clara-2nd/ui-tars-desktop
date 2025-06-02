/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
// /apps/ui-tars/src/renderer/src/pages/settings/index.tsx
import { Trash } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { api } from '@renderer/api';
import { VLMProviderV2 } from '@main/store/types';
import { useSetting } from '@renderer/hooks/useSetting';
import { Button } from '@renderer/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@renderer/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import { Input } from '@renderer/components/ui/input';
import { DragArea } from '@renderer/components/Common/drag';

import { PresetImport } from './PresetImport';
import { Tabs, TabsList, TabsTrigger } from '@renderer/components/ui/tabs';
import { ScrollArea } from '@renderer/components/ui/scroll-area';
import { PresetBanner } from './PresetBanner';

// 定义表单验证 schema
const formSchema = z.object({
  language: z.enum(['en', 'zh']),

  // UI-TARS 설정
  uiTarsProvider: z.nativeEnum(VLMProviderV2, {
    message: 'Please select a UI-TARS Provider',
  }),
  uiTarsBaseUrl: z.string().url(),
  uiTarsApiKey: z.string().min(1),
  uiTarsModelName: z.string().min(1),

  // LLaVA-OneVision 설정
  llavaProvider: z.nativeEnum(VLMProviderV2, {
    message: 'Please select a LLaVA-OneVision Provider',
  }),
  llavaBaseUrl: z.string().url(),
  llavaModelName: z.string().min(1),

  // 기타 설정
  maxLoopCount: z.number().min(25).max(200),
  loopIntervalInMs: z.number().min(0).max(3000),
  reportStorageBaseUrl: z.string().optional(),
  utioBaseUrl: z.string().optional(),
});

const SECTIONS = {
  uiTars: 'UI-TARS Settings',
  llava: 'LLaVA-OneVision Settings',
  chat: 'Chat Settings',
  report: 'Report Settings',
} as const;

export default function Settings() {
  const { settings, updateSetting, clearSetting, updatePresetFromRemote } =
    useSetting();
  const [isPresetModalOpen, setPresetModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('uiTars');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isRemoteAutoUpdatedPreset =
    settings?.presetSource?.type === 'remote' &&
    settings.presetSource.autoUpdate;

  console.log('initialValues', settings);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
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
      reportStorageBaseUrl: '',
      utioBaseUrl: '',
      ...settings,
    },
  });
  useEffect(() => {
    if (Object.keys(settings)) {
      form.reset({
        language: settings.language,
        uiTarsProvider: settings.uiTarsProvider,
        uiTarsBaseUrl: settings.uiTarsBaseUrl,
        uiTarsApiKey: settings.uiTarsApiKey,
        uiTarsModelName: settings.uiTarsModelName,
        llavaProvider: settings.llavaProvider,
        llavaBaseUrl: settings.llavaBaseUrl,
        llavaModelName: settings.llavaModelName,
        maxLoopCount: settings.maxLoopCount,
        loopIntervalInMs: settings.loopIntervalInMs,
        reportStorageBaseUrl: settings.reportStorageBaseUrl,
        utioBaseUrl: settings.utioBaseUrl,
      });
    }
  }, [settings, form]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.5 },
    );

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (section: string) => {
    sectionRefs.current[section]?.scrollIntoView({ behavior: 'smooth' });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log('onSubmit', values);

    updateSetting(values);
    // toast.success('Settings saved successfully');
    await api.closeSettingsWindow();
    await api.showMainWindow();
  };

  const onCancel = async () => {
    await api.closeSettingsWindow();
  };

  const handlePresetModal = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setPresetModalOpen(true);
  };

  const handleUpdatePreset = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await updatePresetFromRemote();
      toast.success('Preset updated successfully');
    } catch (error) {
      toast.error('Failed to update preset', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handleResetPreset = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    await window.electron.setting.resetPreset();
    toast.success('Reset to manual mode successfully', {
      duration: 1500,
    });
  };

  const handleClearSettings = async () => {
    try {
      await clearSetting();
      toast.success('All settings cleared successfully');
    } catch (error) {
      toast.error('Failed to clear settings', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      <DragArea />

      <div className="flex-1 flex gap-4 p-6 overflow-hidden">
        <Tabs
          orientation="vertical"
          value={activeSection}
          onValueChange={scrollToSection}
          className="w-48 shrink-0"
        >
          <TabsList className="flex flex-col h-auto bg-transparent p-0">
            {Object.entries(SECTIONS).map(([key, label]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="justify-start w-full rounded-none border-0 border-l-4 data-[state=active]:shadow-none data-[state=active]:border-primary mb-1 text-sm"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <ScrollArea className="flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* UI-TARS 설정 */}
              <div
                id="uiTars"
                ref={(el) => {
                  sectionRefs.current.uiTars = el;
                }}
                className="space-y-6 ml-1 mr-4"
              >
                <h2 className="text-lg font-medium">{SECTIONS.uiTars}</h2>
                {!isRemoteAutoUpdatedPreset && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePresetModal}
                  >
                    Import Preset Config
                  </Button>
                )}
                {isRemoteAutoUpdatedPreset && (
                  <PresetBanner
                    url={settings.presetSource?.url}
                    date={settings.presetSource?.lastUpdated}
                    handleUpdatePreset={handleUpdatePreset}
                    handleResetPreset={handleResetPreset}
                  />
                )}
                <FormField
                  control={form.control}
                  name="uiTarsProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UI-TARS Provider</FormLabel>
                      <Select
                        disabled={isRemoteAutoUpdatedPreset}
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select UI-TARS provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(VLMProviderV2)
                            .filter(
                              ([key]) =>
                                key.startsWith('ui_tars_') ||
                                key.startsWith('doubao_'),
                            )
                            .map(([key, value]) => (
                              <SelectItem key={key} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="uiTarsBaseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UI-TARS Base URL</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isRemoteAutoUpdatedPreset}
                          placeholder="Enter UI-TARS Base URL"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="uiTarsApiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UI-TARS API Key</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isRemoteAutoUpdatedPreset}
                          placeholder="Enter UI-TARS API Key"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="uiTarsModelName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UI-TARS Model Name</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isRemoteAutoUpdatedPreset}
                          placeholder="Enter UI-TARS Model Name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* LLaVA-OneVision 설정 */}
              <div
                id="llava"
                ref={(el) => {
                  sectionRefs.current.llava = el;
                }}
                className="space-y-6 ml-1 mr-4"
              >
                <h2 className="text-lg font-medium">{SECTIONS.llava}</h2>
                <FormField
                  control={form.control}
                  name="llavaProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LLaVA-OneVision Provider</FormLabel>
                      <Select
                        disabled={isRemoteAutoUpdatedPreset}
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select LLaVA-OneVision provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(VLMProviderV2)
                            .filter(([key]) => key.startsWith('llava_'))
                            .map(([key, value]) => (
                              <SelectItem key={key} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="llavaBaseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LLaVA-OneVision Base URL</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isRemoteAutoUpdatedPreset}
                          placeholder="Enter LLaVA-OneVision Base URL"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="llavaModelName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LLaVA-OneVision Model Name</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isRemoteAutoUpdatedPreset}
                          placeholder="Enter LLaVA-OneVision Model Name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Chat Settings */}
              <div
                id="chat"
                ref={(el) => {
                  sectionRefs.current.chat = el;
                }}
                className="space-y-6 pt-6 ml-1 mr-4"
              >
                <h2 className="text-lg font-medium">{SECTIONS.chat}</h2>
                <FormField
                  control={form.control}
                  name="maxLoopCount"
                  render={({ field }) => {
                    // console.log('field', field);
                    return (
                      <FormItem>
                        <FormLabel>Max Loop</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            // disabled={isRemoteAutoUpdatedPreset}
                            placeholder="Enter a number between 25-200"
                            {...field}
                            value={field.value === 0 ? '' : field.value}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="loopIntervalInMs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loop Wait Time (ms)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          // disabled={isRemoteAutoUpdatedPreset}
                          placeholder="Enter a number between 0-3000"
                          {...field}
                          value={field.value === 0 ? '' : field.value}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div
                id="report"
                ref={(el) => {
                  sectionRefs.current.report = el;
                }}
                className="space-y-6 pt-6 ml-1 mr-4"
              >
                <h2 className="text-lg font-medium">{SECTIONS.report}</h2>
                {/* Report Settings Fields */}
                <FormField
                  control={form.control}
                  name="reportStorageBaseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Report Storage Base URL</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isRemoteAutoUpdatedPreset}
                          placeholder="https://your-report-storage-endpoint.com/upload"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* UTIO Base URL */}
                <FormField
                  control={form.control}
                  name="utioBaseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UTIO Base URL</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isRemoteAutoUpdatedPreset}
                          placeholder="https://your-utio-endpoint.com/collect"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="h-50"></div>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </div>

      <div className="border-t p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            type="button"
            className="text-red-400 border-red-400 hover:bg-red-50 hover:text-red-500"
            onClick={handleClearSettings}
          >
            <Trash className="h-4 w-4" />
            Clear
          </Button>
          <div className="flex gap-4">
            <Button variant="outline" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" onClick={form.handleSubmit(onSubmit)}>
              Save
            </Button>
          </div>
        </div>
      </div>

      <PresetImport
        isOpen={isPresetModalOpen}
        onClose={() => setPresetModalOpen(false)}
      />
      {/* <Toaster /> */}
    </div>
  );
}

export { Settings as Component };
