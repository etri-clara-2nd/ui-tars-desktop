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
import { Tabs, TabsList, TabsTrigger } from '@renderer/components/ui/tabs';
import { ScrollArea } from '@renderer/components/ui/scroll-area';

// 폼 검증 스키마
const formSchema = z.object({
  // 공통 설정
  language: z.enum(['en', 'zh']),

  // UI-TARS 설정
  uiTarsProvider: z.nativeEnum(VLMProviderV2),
  uiTarsBaseUrl: z.string().url(),
  uiTarsApiKey: z.string().min(1),
  uiTarsModelName: z.string().min(1),

  // LLaVA-OneVision 설정
  llavaProvider: z.nativeEnum(VLMProviderV2),
  llavaBaseUrl: z.string().url(),
  llavaModelName: z.string().min(1),

  // 기타 설정
  maxLoopCount: z.number().min(25).max(200),
  loopIntervalInMs: z.number().min(0).max(3000),
  operator: z.enum(['nutjs', 'browser']),
});

const SECTIONS = {
  uiTars: 'UI-TARS Settings',
  llava: 'LLaVA-OneVision Settings',
  common: 'Common Settings',
} as const;

export default function Settings() {
  const { settings, updateSetting, clearSetting } = useSetting();
  const [activeSection, setActiveSection] = useState('uiTars');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      language: 'en',
      uiTarsProvider: VLMProviderV2.ui_tars_1_0,
      uiTarsBaseUrl: '',
      uiTarsApiKey: '',
      uiTarsModelName: '',
      llavaProvider: VLMProviderV2.llava_onevision_remote,
      llavaBaseUrl: 'http://129.254.196.201:11434/api',
      llavaModelName: 'llava',
      maxLoopCount: 100,
      loopIntervalInMs: 1000,
      operator: 'browser',
      ...settings,
    },
  });

  useEffect(() => {
    if (Object.keys(settings)) {
      form.reset(settings);
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
    updateSetting(values);
    toast.success('Settings saved successfully');
    await api.closeSettingsWindow();
    await api.showMainWindow();
  };

  const onCancel = async () => {
    await api.closeSettingsWindow();
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
          className="w-34 shrink-0"
        >
          <TabsList className="flex flex-col h-auto bg-transparent p-0">
            {Object.entries(SECTIONS).map(([key, label]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="justify-start w-full rounded-none border-0 border-l-4 data-[state=active]:shadow-none data-[state=active]:border-primary mb-1"
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

                <FormField
                  control={form.control}
                  name="uiTarsProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UI-TARS Provider</FormLabel>
                      <Select
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
                        <Input placeholder="Enter UI-TARS API Key" {...field} />
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
                          placeholder="Enter LLaVA-OneVision Model Name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 공통 설정 */}
              <div
                id="common"
                ref={(el) => {
                  sectionRefs.current.common = el;
                }}
                className="space-y-6 ml-1 mr-4"
              >
                <h2 className="text-lg font-medium">{SECTIONS.common}</h2>

                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="zh">中文</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxLoopCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Loop Count</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
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
                  )}
                />

                <FormField
                  control={form.control}
                  name="loopIntervalInMs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loop Interval (ms)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
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

                <FormField
                  control={form.control}
                  name="operator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operator</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select operator" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nutjs">NutJS</SelectItem>
                          <SelectItem value="browser">Browser</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
            Clear All Settings
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
    </div>
  );
}
