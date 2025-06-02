/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  ChevronRight,
  MonitorSmartphone,
  Globe,
  Bot,
  type LucideIcon,
  History,
  Settings,
} from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@renderer/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@renderer/components/ui/sidebar';
import { NavItem } from './nav-item';

export const NavMain = () => {
  return (
    <div className="space-y-4 py-4">
      <div className="px-3 py-2">
        <div className="space-y-1">
          <NavItem title="History" icon={History} href="#history" />
          <NavItem title="Settings" icon={Settings} href="#settings" />
        </div>
      </div>
    </div>
  );
};
