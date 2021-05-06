// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Make Electron type definitions available globally, such as extensions to File and other built-ins
/// <reference types="electron" />

import { init as initSentry } from "@sentry/electron";
import ReactDOM from "react-dom";

import "@foxglove-studio/app/styles/global.scss";

import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import installDevtoolsFormatters from "@foxglove-studio/app/util/installDevtoolsFormatters";
import { initializeLogEvent } from "@foxglove-studio/app/util/logEvent";
import overwriteFetch from "@foxglove-studio/app/util/overwriteFetch";
import waitForFonts from "@foxglove-studio/app/util/waitForFonts";
import { APP_VERSION } from "@foxglove-studio/app/version";
import { Sockets } from "@foxglove/electron-socket/renderer";
import Logger from "@foxglove/log";

import App from "./App";

const log = Logger.getLogger(__filename);

log.debug("initializing renderer");

if (
  (OsContextSingleton?.isCrashReportingEnabled() ?? false) &&
  typeof process.env.SENTRY_DSN === "string"
) {
  log.info("initializing Sentry in renderer");
  initSentry({
    dsn: process.env.SENTRY_DSN,
    autoSessionTracking: true,
    release: `${process.env.SENTRY_PROJECT}@${APP_VERSION}`,
    // Remove the default breadbrumbs integration - it does not accurately track breadcrumbs and
    // creates more noise than benefit.
    integrations: (integrations) => {
      return integrations.filter((integration) => {
        return integration.name !== "Breadcrumbs";
      });
    },
    maxBreadcrumbs: 10,
  });
}

installDevtoolsFormatters();
overwriteFetch();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("missing #root element");
}

async function main() {
  // Initialize the RPC channel for electron-socket. This method is called first
  // since the window.onmessage handler needs to be installed before
  // window.onload fires
  await Sockets.Create();

  // consider moving waitForFonts into App to display an app loading screen
  await waitForFonts();

  initializeLogEvent(() => undefined, {}, {});

  ReactDOM.render(<App />, rootEl, () => {
    // Integration tests look for this console log to indicate the app has rendered once
    log.debug("App rendered");
  });
}

main();
