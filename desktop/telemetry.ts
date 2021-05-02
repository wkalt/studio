// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { app } from "electron";
import fs from "fs";
import path from "path";
import Log from "@foxglove/log";

import { AppSetting } from "@foxglove-studio/app/AppSetting";

const log = Log.getLogger(__filename);

function getTelemetrySettings(): [crashReportingEnabled: boolean, telemetryEnabled: boolean] {
  const datastoreDir = path.join(app.getPath("userData"), "studio-datastores", "settings");
  const settingsPath = path.join(datastoreDir, "settings.json");

  // If we are unable to parse the settings file we disable telemetry and crash reporting.
  // Since we couldn't identify if the user's setting disabled crash and telemetry the
  // privacy preserving action is to disable.
  let crashReportingEnabled = false;
  let telemetryEnabled = false;

  try {
    fs.mkdirSync(datastoreDir, { recursive: true });
  } catch {
    // Ignore directory creation errors, including dir already exists
  }

  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, { encoding: "utf8" }));
    crashReportingEnabled = settings[AppSetting.CRASH_REPORTING_ENABLED] ?? true;
    telemetryEnabled = settings[AppSetting.TELEMETRY_ENABLED] ?? true;
  } catch (err) {
    log.error(err);
    // Ignore file load or parsing errors, including settings.json not existing
  }

  return [crashReportingEnabled, telemetryEnabled];
}

export { getTelemetrySettings };
