// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

declare module "@foxglove/studio" {
  export enum ExtensionMode {
    PRODUCTION = 1,
    DEVELOPMENT = 2,
    TEST = 3,
  }

  export interface ExtensionContext {
    readonly extensionMode: ExtensionMode;
  }

  export interface Extension<T> {
    readonly id: string;

    readonly packageJson: Record<string, unknown>;

    readonly exports: T;
  }
}
