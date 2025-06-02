/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Box, Flex, HStack, IconButton, Image, Text } from '@chakra-ui/react';
import { IoIosSettings } from 'react-icons/io';
// import { useDispatch } from 'zutron';

import logo from '@resources/clara-logo.png?url';
import { api } from '@renderer/api';

export default function Header({ className }: { className?: string }) {
  // const dispatch = useDispatch(window.zutron);

  // return null;

  return (
    <Box position="relative" textAlign="center" className={className}>
      <Flex alignItems="center" justifyContent="center">
        <HStack userSelect="none" spacing={2}>
          <Image
            userSelect="none"
            alt="CLARA Logo"
            src={logo}
            h="32px"
            draggable={false}
          />
          <Text fontSize="lg" fontWeight="semibold">
            Agentic Desktop
          </Text>
        </HStack>
        <Box position="absolute" right="4">
          <IconButton
            aria-label="Settings"
            isRound
            icon={<IoIosSettings size={24} />}
            colorScheme="blackAlpha"
            variant="ghost"
            size="md"
            onClick={async () => {
              await api.openSettingsWindow();
            }}
          />
        </Box>
      </Flex>
    </Box>
  );
}
