// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type * as studio from "foxglove-studio";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(_context: studio.ExtensionContext): void {
  // eslint-disable-next-line no-restricted-syntax
  console.log("panel-image activate() called");
}

// this method is called when your extension is deactivated
export function deactivate(): void {
  // eslint-disable-next-line no-restricted-syntax
  console.log("panel-image deactivate() called");
}
