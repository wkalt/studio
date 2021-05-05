// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Extension as ExtensionPublic, ExtensionContext } from "foxglove-studio";

export type Extension = ExtensionPublic<unknown> & {
  activate(context: ExtensionContext): void;
  deactivate(): void;
};
