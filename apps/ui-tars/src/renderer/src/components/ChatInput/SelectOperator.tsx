/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect } from 'react';
import { Button } from '@renderer/components/ui/button';
import {
  ChevronDown,
  Globe,
  Monitor,
  Check,
  AlertCircle,
  RefreshCw,
  Bot,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu';
import { useSetting } from '@renderer/hooks/useSetting';
import { useState } from 'react';
import { BROWSER_USE, COMPUTERR_USE, ROBOT_USE } from '@renderer/const';
import { useStore } from '@renderer/hooks/useStore';
import { api } from '@renderer/api';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@renderer/components/ui/tooltip';

type Operator = 'nutjs' | 'browser' | 'robot';

const getOperatorIcon = (type: string) => {
  switch (type) {
    case 'nutjs':
      return <Monitor className="h-4 w-4 mr-2" />;
    case 'browser':
      return <Globe className="h-4 w-4 mr-2" />;
    case 'robot':
      return <Bot className="h-4 w-4 mr-2" />;
    default:
      return <Monitor className="h-4 w-4 mr-2" />;
  }
};

const getOperatorLabel = (type: string) => {
  switch (type) {
    case 'nutjs':
      return COMPUTERR_USE;
    case 'browser':
      return BROWSER_USE;
    case 'robot':
      return ROBOT_USE;
    default:
      return COMPUTERR_USE;
  }
};

export const SelectOperator = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const { settings, updateSetting } = useSetting();
  const { browserAvailable } = useStore();
  const [isRetrying, setIsRetrying] = useState(false);

  // Get the current operating mode and automatically
  // switch to computer mode if browser mode is not available
  const currentOperator = browserAvailable
    ? settings.operator || 'nutjs'
    : 'nutjs';

  // If the current setting is browser but the browser
  // is not available, automatically switched to Computer Use mode.
  useEffect(() => {
    if (settings.operator === 'browser' && !browserAvailable) {
      updateSetting({
        ...settings,
        operator: 'nutjs',
      });
      toast.info('Automatically switched to Computer Use mode', {
        description: 'Browser mode is not available',
      });
    }
  }, [browserAvailable, settings, updateSetting]);

  const handleSelect = (type: Operator) => {
    if (type === 'browser' && !browserAvailable) {
      return;
    }

    updateSetting({
      ...settings,
      operator: type,
    });
  };

  const handleRetryBrowserCheck = async () => {
    try {
      setIsRetrying(true);
      const available = await api.checkBrowserAvailability();
      if (available) {
        toast.success('Browser detected successfully!', {
          description: 'You can now use Browser mode.',
        });
        setTooltipOpen(false);
      } else {
        toast.error('No browser detected', {
          description: 'Please install Chrome and try again.',
        });
      }
    } catch (error) {
      toast.error('Failed to check browser availability');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="absolute left-4 bottom-4">
      <DropdownMenu onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            {getOperatorIcon(currentOperator)}
            {getOperatorLabel(currentOperator)}
            <ChevronDown
              className={`h-4 w-4 ml-2 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleSelect('nutjs')}>
            <Monitor className="h-4 w-4 mr-2" />
            Computer Use
            {currentOperator === 'nutjs' && <Check className="h-4 w-4 ml-2" />}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => browserAvailable && handleSelect('browser')}
            disabled={!browserAvailable}
          >
            <Globe className="h-4 w-4 mr-2" />
            Browser Use
            {currentOperator === 'browser' && (
              <Check className="h-4 w-4 ml-2" />
            )}
            {!browserAvailable && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertCircle className="h-4 w-4 ml-2 text-yellow-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Chrome browser not detected</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => handleSelect('robot')}>
            <Bot className="h-4 w-4 mr-2" />
            Robot Use
            {currentOperator === 'robot' && <Check className="h-4 w-4 ml-2" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
