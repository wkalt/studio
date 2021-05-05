// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { ExtensionContext } from "foxglove-studio";

import Logger from "@foxglove/log";

import { Extension } from "./Extension";
import OsContextSingleton from "./OsContextSingleton";

const log = Logger.getLogger(__filename);

export class Extensions {
  loaded: Extension[] = [];

  async load(): Promise<void> {
    const uris = (await OsContextSingleton?.getExtensionUris()) ?? [];
    for (const uri of uris) {
      log.debug(`Importing extension from ${uri}`);
      try {
        const extension = (await import(/* webpackIgnore: true */ uri)) as Extension;
        this.loaded.push(extension);
      } catch (err) {
        log.error(`Failed to import extension ${uri}: ${err}`);
      }
    }
  }

  activate(): void {
    const extensionMode =
      process.env.NODE_ENV === "production" ? 1 : process.env.NODE_ENV === "test" ? 3 : 2;
    const ctx: ExtensionContext = { extensionMode };

    for (const ext of this.loaded) {
      ext.activate(ctx);
    }
  }

  deactivate(): void {
    for (const ext of this.loaded) {
      ext.deactivate();
    }
  }
}
