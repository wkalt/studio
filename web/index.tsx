// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// inject the global os context - this has to happen first because of how the singleton is gotten in app
// need to change app to use a context for this - so then it isn't injected globally
// this is kind of special since it is a platform interface layer
// but it is full of things that don't _have_ to be done that way
import "./OsContextSingleton";

import { init as initSentry } from "@sentry/electron";
import ReactDOM from "react-dom";

import "@foxglove-studio/app/styles/global.scss";

import installDevtoolsFormatters from "@foxglove-studio/app/util/installDevtoolsFormatters";
import { initializeLogEvent } from "@foxglove-studio/app/util/logEvent";
import overwriteFetch from "@foxglove-studio/app/util/overwriteFetch";
import waitForFonts from "@foxglove-studio/app/util/waitForFonts";
import { APP_VERSION } from "@foxglove-studio/app/version";
import Logger from "@foxglove/log";

import App from "./App";

const log = Logger.getLogger(__filename);

log.debug("initializing renderer");

if (typeof process.env.SENTRY_DSN === "string") {
  log.info("initializing Sentry in renderer");
  initSentry({
    dsn: process.env.SENTRY_DSN,
    autoSessionTracking: true,
    release: `${process.env.SENTRY_PROJECT}@${APP_VERSION}`,
  });
}

installDevtoolsFormatters();
overwriteFetch();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("missing #root element");
}

async function main() {
  console.log("wait for fonts");
  // consider moving waitForFonts into App to display an app loading screen
  await waitForFonts();

  console.log("init log events");
  initializeLogEvent(() => undefined, {}, {});

  ReactDOM.render(<App />, rootEl, () => {
    // Integration tests look for this console log to indicate the app has rendered once
    log.debug("App rendered");
  });
}

main();
