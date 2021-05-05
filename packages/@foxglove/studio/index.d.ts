// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

declare module "@foxglove/studio" {
  export enum ExtensionMode {
    Production = 1,
    Development = 2,
    Test = 3,
  }

  export interface ExtensionContext {
    readonly extensionMode: ExtensionMode;
  }

  export interface Extension<T> {
    readonly id: string;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly packageJSON: any;

    readonly exports: T;
  }
}
