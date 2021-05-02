// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import AnalyticsContext from "@foxglove-studio/app/context/AnalyticsContext";
import { Analytics } from "@foxglove-studio/app/services/Analytics";
import useAppSetting from "@foxglove-studio/app/hooks/useAppSetting";
import { AppSetting } from "@foxglove-studio/app/AppSetting";

export default function AnalyticsProvider(
  props: PropsWithChildren<{ amplitudeApiKey?: string }>,
): React.ReactElement {
  // fixme - ensure this setting is available and loaded on first render
  const telemetryEnabled = useAppSetting<boolean>(AppSetting.TELEMETRY_ENABLED);
  const crashReportingEnabled = useAppSetting<boolean>(AppSetting.CRASH_REPORTING_ENABLED);

  const analytics = useMemo(() => {
    // fixme - rename optOut options to "enabled" - opt out is confusing when the settings are "enabled"
    // leads to trying to think about the opposite of what the setting conveys
    return new Analytics({
      optOut: !(telemetryEnabled ?? true),
      crashReportingOptOut: !(
        (crashReportingEnabled ?? true) &&
        typeof process.env.SENTRY_DSN === "string"
      ),
      amplitudeApiKey: props.amplitudeApiKey ?? process.env.AMPLITUDE_API_KEY,
    });
  }, [props.amplitudeApiKey]);

  return <AnalyticsContext.Provider value={analytics}>{props.children}</AnalyticsContext.Provider>;
}
