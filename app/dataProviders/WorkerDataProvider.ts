// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Time } from "rosbag";

import RpcDataProvider from "@foxglove-studio/app/dataProviders/RpcDataProvider";
import Rpc from "@foxglove-studio/app/util/Rpc";

import {
  DataProvider,
  InitializationResult,
  DataProviderDescriptor,
  ExtensionPoint,
  GetMessagesResult,
  GetMessagesTopics,
} from "./types";

const WorkerDataProviderWorker = () => {
  return new Worker(new URL("./WorkerDataProvider.worker", import.meta.url));
};

// We almost always use a WorkerDataProvider in Studio. By initializing the first worker before we actually construct
// the WorkerDataProvider we can potentially improve performance by loading while waiting for async requests.
let preinitializedWorkers: any[] = [];
if (process.env.NODE_ENV !== "test") {
  preinitializedWorkers = [WorkerDataProviderWorker(), WorkerDataProviderWorker()];
}

// Wraps the underlying DataProviderDescriptor tree in a Web Worker, therefore allowing
// `getMessages` calls to get resolved in parallel to the main thread.
export default class WorkerDataProvider implements DataProvider {
  _worker?: Worker;
  _provider?: RpcDataProvider;
  _child?: DataProviderDescriptor;

  constructor(_args: unknown, children: DataProviderDescriptor[]) {
    if (children.length !== 1) {
      throw new Error(`Incorrect number of children to WorkerDataProvider: ${children.length}`);
    }
    const child = children[0];
    if (child) {
      this._child = child;
    }
  }

  initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    if (preinitializedWorkers.length > 0) {
      this._worker = preinitializedWorkers.pop();
    } else {
      this._worker = WorkerDataProviderWorker();
    }

    if (!this._worker || !this._child) {
      throw new Error("WorderDataProvider failed to initialize");
    }

    this._provider = new RpcDataProvider(new Rpc(this._worker), [this._child]);
    return this._provider.initialize(extensionPoint);
  }

  getMessages(start: Time, end: Time, topics: GetMessagesTopics): Promise<GetMessagesResult> {
    if (!this._provider) {
      throw new Error("WorkerDataProvieder not initialized");
    }
    return this._provider.getMessages(start, end, topics);
  }

  async close(): Promise<void> {
    await this._provider?.close();
    this._worker?.terminate();
  }
}
