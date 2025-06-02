/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { useSession } from '@renderer/hooks/useSession';
import logo from '@resources/clara-logo.png?url';

export const WelcomePage = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="w-full text-center flex flex-col items-center pb-8">
        <img src={logo} alt="CLARA logo" className="h-20" />
        <h1 className="text-2xl font-semibold mt-1">
          Welcome to CLARA Agentic Desktop
        </h1>
        <p className="text-sm text-gray-500 mt-1">(feat. ETRI/Bytedance)</p>
      </div>
    </div>
  );
};
