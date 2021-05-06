// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Toggle, Stack, Text, useTheme } from "@fluentui/react";

import { AppSetting } from "@foxglove-studio/app/AppSetting";
import { useAppConfigurationValue } from "@foxglove-studio/app/hooks/useAppConfigurationValue";

type Feature = {
  key: AppSetting;
  name: string;
  description: JSX.Element;
};

const features: Feature[] = [
  {
    key: AppSetting.UNLIMITED_MEMORY_CACHE,
    name: "Unlimited in-memory cache (requires restart)",
    description: <>Fully buffer a bag into memory. This may use up a lot of system memory.</>,
  },
];

function ExperimentalFeatureItem(props: { feature: Feature }) {
  const { feature } = props;

  const [enabled, setEnabled] = useAppConfigurationValue<boolean>(feature.key);
  return (
    <Stack>
      <Stack horizontal>
        <Stack grow>
          <Text as="h2" variant="medium">
            {feature.name}
          </Text>
        </Stack>
        <Toggle
          checked={enabled}
          onChange={(_, checked) => setEnabled(checked)}
          onText="Enabled"
          offText="Disabled"
        />
      </Stack>
      <div>{feature.description}</div>
    </Stack>
  );
}

export function ExperimentalFeatureSettings(): React.ReactElement {
  const theme = useTheme();
  return (
    <Stack style={{ padding: theme.spacing.m }} tokens={{ childrenGap: theme.spacing.m }}>
      {features.length === 0 && (
        <p>
          <em>Currently there are no experimental features.</em>
        </p>
      )}
      {features.map((feature) => (
        <ExperimentalFeatureItem key={feature.key} feature={feature} />
      ))}
    </Stack>
  );
}
