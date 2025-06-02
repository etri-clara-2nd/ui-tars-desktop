/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { MousePointerClick } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';

import { PredictionParsed } from '@ui-tars/shared/types';
import { ActionIconMap } from '@renderer/const/actions';

interface ThoughtStepCardProps {
  step: PredictionParsed;
  index: number;
  onClick?: () => void;
  hasSomImage: boolean;
}

function ThoughtStepCard({ step, onClick, hasSomImage }: ThoughtStepCardProps) {
  const ActionIcon = ActionIconMap[step?.action_type] || MousePointerClick;

  // LLM과 VLM 결과를 분리
  const [llmContent, vlmContent] = step.thought?.split(
    '\n\n[Vision Analysis]\n',
  ) || [step.thought, ''];

  return (
    <>
      {step.reflection && (
        <div className="my-3">
          <p className="text-gray-600 whitespace-pre-wrap leading-7">
            {/* <span className="text-gray-900 font-medium">Reflection: </span> */}
            {step.reflection}
          </p>
        </div>
      )}

      {llmContent && (
        <div className="my-3">
          <p className="text-gray-600 whitespace-pre-wrap leading-7">
            {/* <span className="text-gray-900 font-medium">Thought: </span> */}
            {llmContent}
          </p>
        </div>
      )}

      {vlmContent && (
        <div className="my-3">
          <p className="text-blue-600 whitespace-pre-wrap leading-7 italic">
            <span className="font-medium text-blue-700">[Vision Analysis]</span>
            {vlmContent}
          </p>
        </div>
      )}

      {step.action_type && step.action_type === 'call_user' && (
        <Button variant="outline" className="rounded-full mb-6" disabled={true}>
          <ActionIcon className="h-4 w-4" />
          Waiting for user to take control
        </Button>
      )}
    </>
  );
}

interface ThoughtChainProps {
  steps: PredictionParsed[];
  hasSomImage: boolean;
  somImageHighlighted?: boolean;
  onClick?: () => void;
}

export default function ThoughtChain({
  steps,
  onClick,
  hasSomImage,
}: ThoughtChainProps) {
  return (
    <div>
      {steps?.map?.((step, index) => (
        <ThoughtStepCard
          key={index}
          step={step}
          index={index}
          onClick={onClick}
          hasSomImage={hasSomImage}
        />
      ))}
    </div>
  );
}
