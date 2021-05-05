// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import { Extensions } from "@foxglove-studio/app/Extensions";
import ExtensionsContext from "@foxglove-studio/app/context/ExtensionsContext";

export default function ExtensionsProvider(props: PropsWithChildren<unknown>): React.ReactElement {
  const extensions = useMemo(() => {
    const exts = new Extensions();
    exts.load().then(() => exts.activate());
    return exts;
  }, []);

  return (
    <ExtensionsContext.Provider value={extensions}>{props.children}</ExtensionsContext.Provider>
  );
}
