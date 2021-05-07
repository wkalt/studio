// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import { Extensions } from "@foxglove-studio/app/Extensions";
import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import ExtensionsContext from "@foxglove-studio/app/context/ExtensionsContext";
import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

export default function ExtensionsProvider(props: PropsWithChildren<unknown>): JSX.Element {
  const extensions = useMemo(() => new Extensions(), []);

  useMemo(async () => {
    // Fetch the list of extension URIs and parsed package.json files
    const extensionList = await OsContextSingleton?.getExtensions();
    log.debug(`Found ${extensionList?.length ?? 0} extension(s)`);
    if (extensionList == undefined) {
      return;
    }

    // Start loading extension code asynchronously
    await extensions.load(extensionList);

    // Once all extension code is loaded, call the activate() method for all extensions
    extensions.activate();
  }, [extensions]);

  return (
    <ExtensionsContext.Provider value={extensions}>{props.children}</ExtensionsContext.Provider>
  );
}
