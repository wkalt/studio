// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import Checkbox from "@foxglove-studio/app/components/Checkbox";
import Flex from "@foxglove-studio/app/components/Flex";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import log from "@foxglove/log";

type Config = {
  // we store disabled channels so any new channels are default enabled
  disabledChannels: string[];
};

type Props = {
  config: Config;
  saveConfig: (config: Config) => void;
};

function InternalLogs(props: Props) {
  const { config } = props;

  const disabledChannels = useMemo(() => {
    return new Set(config.disabledChannels);
  }, [config]);

  const channels = useMemo(() => {
    const allChannels = log.channels();
    for (const channel of allChannels) {
      const name = channel.name().length === 0 ? "default" : channel.name();
      if (disabledChannels.has(name)) {
        channel.disable();
      } else {
        channel.enable();
      }
    }
    return allChannels;
  }, [disabledChannels]);

  return (
    <Flex col>
      <PanelToolbar />
      <Flex col>
        {channels.map((logger) => {
          const label = logger.name().length === 0 ? "default" : logger.name();
          return (
            <div key={label}>
              <Checkbox
                checked={logger.isEnabled()}
                label={label}
                onChange={(newChecked) => {
                  // track disabled channels so loggers are on by default
                  if (newChecked) {
                    disabledChannels.delete(label);
                  } else {
                    disabledChannels.add(label);
                  }

                  props.saveConfig({
                    disabledChannels: Array.from(disabledChannels.values()),
                  });
                }}
              />
            </div>
          );
        })}
      </Flex>
    </Flex>
  );
}

InternalLogs.panelType = "InternalLogs";
InternalLogs.defaultConfig = {
  disabledChannels: [],
} as Config;
InternalLogs.supportsStrictMode = false;

export default Panel(InternalLogs);
