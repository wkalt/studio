// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import path from "path";

import { GlobalVariables } from "@foxglove-studio/app/hooks/useGlobalVariables";
import {
  ProcessMessageOutput,
  RegistrationOutput,
} from "@foxglove-studio/app/players/UserNodePlayer/types";
import { DEFAULT_STUDIO_NODE_PREFIX } from "@foxglove-studio/app/util/globalConstants";

// Each node runtime worker runs one node at a time, hence why we have one
// global declaration of 'nodeCallback'.
let nodeCallback: (message: any, globalVariables: GlobalVariables) => any;

if (process.env.NODE_ENV === "test") {
  // When in tests, clear out the callback between tests.
  beforeEach(() => {
    nodeCallback = () => {
      // no-op
    };
  });
}

export const containsFuncDeclaration = (args: any[]): boolean => {
  for (const arg of args) {
    if (typeof arg === "function") {
      return true;
    } else if (arg != undefined && typeof arg === "object") {
      for (const value of Object.values(arg)) {
        if (containsFuncDeclaration([value])) {
          return true;
        }
      }
    }
  }
  return false;
};

export const stringifyFuncsInObject = (arg: unknown): unknown => {
  if (typeof arg === "function") {
    return `${arg}`;
  } else if (typeof arg === "object" && arg != undefined) {
    const newArg: Record<string, unknown> = { ...arg };
    for (const [key, value] of Object.entries(arg)) {
      newArg[key] = stringifyFuncsInObject(value);
    }
    return newArg;
  }
  return arg;
};

const getArgsToPrint = (args: any[]) => {
  return args
    .map(stringifyFuncsInObject)
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg));
};

// Exported for tests.
export const requireImplementation = (id: string, projectCode: Map<string, string>): unknown => {
  const requestedFile = `${path.join(DEFAULT_STUDIO_NODE_PREFIX, id)}.js`;
  for (const [file, source] of projectCode.entries()) {
    if (requestedFile.endsWith(file)) {
      const sourceExports = {};
      const require = (reqId: string) => requireImplementation(reqId, projectCode);
      // eslint-disable-next-line no-new-func
      new Function("exports", "require", source)(sourceExports, require);
      return sourceExports;
    }
  }
  throw new Error(`User node required unknown module: '${id}'`);
};

export const registerNode = ({
  nodeCode,
  projectCode,
}: {
  nodeCode: string;
  projectCode: Map<string, string>;
}): RegistrationOutput => {
  const userNodeLogs: any[] = [];
  const userNodeDiagnostics: any[] = [];
  (self as any).log = function (...args: any) {
    // recursively check that args do not contain a function declaration
    if (containsFuncDeclaration(args)) {
      const argsToPrint = getArgsToPrint(args);
      throw new Error(
        `Cannot invoke log() with a function argument (registerNode) - log(${argsToPrint.join(
          ", ",
        )})`,
      );
    }
    userNodeLogs.push(...args.map((value: any) => ({ source: "registerNode", value })));
  };
  // TODO: Blacklist global methods.
  try {
    const nodeExports: any = {};

    const require = (id: string) => requireImplementation(id, projectCode);

    // Using new Function in order to execute user-input text in Node Playground as code
    // eslint-disable-next-line no-new-func
    new Function("exports", "require", nodeCode)(nodeExports, require);
    nodeCallback = nodeExports.default;
    return {
      error: undefined,
      userNodeLogs,
      userNodeDiagnostics,
    };
  } catch (e) {
    const error = e.toString();
    return {
      error: error.length ? error : `Unknown error encountered registering this node.`,
      userNodeLogs,
      userNodeDiagnostics,
    };
  }
};

export const processMessage = ({
  message,
  globalVariables,
}: {
  message: any;
  globalVariables: GlobalVariables;
}): ProcessMessageOutput => {
  const userNodeLogs: any[] = [];
  const userNodeDiagnostics: any[] = [];
  (self as any).log = function (...args: any) {
    // recursively check that args do not contain a function declaration
    if (containsFuncDeclaration(args)) {
      const argsToPrint = getArgsToPrint(args);
      throw new Error(
        `Cannot invoke log() with a function argument (processMessage) - log(${argsToPrint.join(
          ", ",
        )})`,
      );
    }
    userNodeLogs.push(...args.map((value: any) => ({ source: "processMessage", value })));
  };
  try {
    const newMessage = nodeCallback(message, globalVariables);
    return { message: newMessage, error: undefined, userNodeLogs, userNodeDiagnostics };
  } catch (e) {
    // TODO: Be able to map line numbers from errors.
    const error = e.toString();
    return {
      message: undefined,
      error: error.length ? error : "Unknown error encountered running this node.",
      userNodeLogs,
      userNodeDiagnostics,
    };
  }
};
