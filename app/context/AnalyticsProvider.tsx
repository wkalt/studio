// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import { AppSetting } from "@foxglove-studio/app/AppSetting";
import AnalyticsContext from "@foxglove-studio/app/context/AnalyticsContext";
import { useAppConfigurationValue } from "@foxglove-studio/app/hooks/useAppConfigurationValue";
import { Analytics } from "@foxglove-studio/app/services/Analytics";

export default function AnalyticsProvider(
  props: PropsWithChildren<{ amplitudeApiKey?: string }>,
): React.ReactElement {
  const [enableTelemetry = false] = useAppConfigurationValue<boolean>(AppSetting.TELEMETRY_ENABLED);
  const [enableCrashReporting = false] = useAppConfigurationValue<boolean>(
    AppSetting.CRASH_REPORTING_ENABLED,
  );

  const analytics = useMemo(() => {
    return new Analytics({
      optOut: !enableTelemetry,
      crashReportingOptOut: !(enableCrashReporting && typeof process.env.SENTRY_DSN === "string"),
      amplitudeApiKey: props.amplitudeApiKey ?? process.env.AMPLITUDE_API_KEY,
    });
  }, [props.amplitudeApiKey, enableTelemetry, enableCrashReporting]);

  return <AnalyticsContext.Provider value={analytics}>{props.children}</AnalyticsContext.Provider>;
}
