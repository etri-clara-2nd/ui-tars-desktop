/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  SidebarMenu,
  SidebarMenuButton,
} from '@renderer/components/ui/sidebar';

import logo from '@resources/clara-logo.png?url';

export function UITarsHeader() {
  return (
    <SidebarMenu>
      <SidebarMenuButton
        size="lg"
        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
      >
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
          <img src={logo} alt="CLARA" className="size-6" />
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">CLARA</span>
          <span className="truncate text-xs">Agentic Desktop</span>
        </div>
      </SidebarMenuButton>
    </SidebarMenu>
  );
}
