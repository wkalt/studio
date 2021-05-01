// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { OsContext, NetworkInterface } from "@foxglove-studio/app/OsContext";
import { APP_VERSION } from "@foxglove-studio/app/version";

const ctx: OsContext = {
  platform: process.platform,
  pid: process.pid,
  handleToolbarDoubleClick() {},
  addIpcEventListener() {},
  async menuAddInputSource() {},
  async menuRemoveInputSource() {},

  isCrashReportingEnabled: (): boolean => true,
  isTelemetryEnabled: (): boolean => true,

  // Environment queries
  getEnvVar: (envVar: string) => process.env[envVar],
  getHostname: () => "web",
  getNetworkInterfaces: (): NetworkInterface[] => {
    return [];
  },
  getMachineId: (): string => {
    return "some-machine-id";
  },
  getAppVersion: (): string => {
    return APP_VERSION;
  },

  getDeepLinks: (): string[] => {
    return [];
  },

  storage: {
    list: () => Promise.resolve([]),
    all: () => Promise.resolve([]),
    get: () => Promise.resolve(undefined),
    put: () => Promise.resolve(),
    delete: () => Promise.resolve(),
  },
};

type GlobalWithCtx = typeof global & {
  ctxbridge?: OsContext;
};

(global as GlobalWithCtx).ctxbridge = ctx;
