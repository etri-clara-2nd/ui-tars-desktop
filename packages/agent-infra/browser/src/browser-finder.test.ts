/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import * as fs from 'fs';
import * as os from 'os';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserFinder } from './browser-finder';

// Mock fs and os modules
vi.mock('fs');

vi.mock('os', () => ({
  homedir: vi.fn(),
}));

describe('BrowserFinder', () => {
  const mockHomedir = '/mock/home';
  const CHROME_PATH =
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  let browserFinder: BrowserFinder;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
    browserFinder = new BrowserFinder();

    // Mock homedir with the correct way
    vi.mocked(os.homedir).mockReturnValue(mockHomedir);

    // Mock platform
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
    });

    vi.mocked(fs.existsSync).mockImplementation((path) => {
      return path === CHROME_PATH;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findBrowser', () => {
    it('should find Chrome when it exists', () => {
      const result = browserFinder.findBrowser('Google Chrome');

      expect(result).toEqual({
        executable: CHROME_PATH,
        userDataDir: `${mockHomedir}/Library/Application Support/Google/Chrome`,
      });
    });

    it('should throw Error when specified browser not found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => browserFinder.findBrowser('Google Chrome')).toThrow(Error);
    });

    it('should find first available browser when no name specified', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === CHROME_PATH;
      });

      const result = browserFinder.findBrowser();

      expect(result).toEqual({
        executable: CHROME_PATH,
        userDataDir: `${mockHomedir}/Library/Application Support/Google/Chrome`,
      });
    });

    it('should throw error for unsupported platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'android',
      });

      expect(() => browserFinder.findBrowser()).toThrow(
        'Unsupported platform: android',
      );
    });
  });

  describe('getBrowserProfiles', () => {
    it('should return browser profiles when they exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          profile: {
            info_cache: {
              'Profile 1': { name: 'Default' },
              'Profile 2': { name: 'Work' },
            },
          },
        }),
      );

      const profiles = browserFinder.getBrowserProfiles('Google Chrome');

      expect(profiles).toEqual([
        {
          displayName: 'Default',
          path: expect.stringContaining('Profile 1'),
        },
        {
          displayName: 'Work',
          path: expect.stringContaining('Profile 2'),
        },
      ]);
    });

    it('should return empty array when profiles cannot be read', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      const profiles = browserFinder.getBrowserProfiles('Google Chrome');
      expect(profiles).toEqual([]);
    });
  });

  describe('findChrome', () => {
    it('should find Chrome executable path', () => {
      const result = browserFinder.findChrome();
      expect(result).toBe(CHROME_PATH);
    });

    it('should return null when Chrome not found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = browserFinder.findChrome();
      expect(result).toBeNull();
    });
  });
});
