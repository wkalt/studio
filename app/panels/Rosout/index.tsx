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

import { Stack } from "@fluentui/react";
import { useCallback, useMemo, useRef } from "react";

import * as PanelAPI from "@foxglove-studio/app/PanelAPI";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import TopicToRenderMenu from "@foxglove-studio/app/components/TopicToRenderMenu";
import { MessageEvent } from "@foxglove-studio/app/players/types";

import FilterBar, { FilterBarProps } from "./FilterBar";
import LogList from "./LogList";
import LogMessage from "./LogMessage";
import filterMessages from "./filter";
import helpContent from "./index.help.md";
import { RosgraphMsgs$Log } from "./types";

type Config = {
  searchTerms: string[];
  minLogLevel: number;
  topicToRender: string;
};

type Props = {
  config: Config;
  saveConfig: (arg0: Config) => void;
};

const RosoutPanel = React.memo(({ config, saveConfig }: Props) => {
  const { topics } = PanelAPI.useDataSourceInfo();
  const { minLogLevel, searchTerms } = config;

  const onFilterChange = useCallback<FilterBarProps["onFilterChange"]>(
    (filter) => {
      saveConfig({ ...config, minLogLevel: filter.minLogLevel, searchTerms: filter.searchTerms });
    },
    [config, saveConfig],
  );

  const { [config.topicToRender]: messages = [] } = PanelAPI.useMessagesByTopic({
    topics: [config.topicToRender],
    historySize: 100000,
  }) as { [key: string]: MessageEvent<RosgraphMsgs$Log>[] };

  // avoid making new sets for node names
  // the filter bar uess the node names during on-demand filtering
  const seenNodeNames = useRef(new Set<string>());
  messages.forEach((msg) => seenNodeNames.current.add(msg.message.name));

  const searchTermsSet = useMemo(() => new Set(searchTerms), [searchTerms]);

  const filteredMessages = useMemo(() => filterMessages(messages, { minLogLevel, searchTerms }), [
    messages,
    minLogLevel,
    searchTerms,
  ]);

  const topicToRenderMenu = (
    <TopicToRenderMenu
      topicToRender={config.topicToRender}
      onChange={(topicToRender) => saveConfig({ ...config, topicToRender })}
      topics={topics}
      singleTopicDatatype="rosgraph_msgs/Log"
      defaultTopicToRender={"/rosout"}
    />
  );

  return (
    <Stack verticalFill>
      <PanelToolbar floating helpContent={helpContent} additionalIcons={topicToRenderMenu}>
        <FilterBar
          searchTerms={searchTermsSet}
          minLogLevel={minLogLevel}
          nodeNames={seenNodeNames.current}
          messages={filteredMessages}
          onFilterChange={onFilterChange}
        />
      </PanelToolbar>
      <Stack grow>
        <LogList
          items={filteredMessages}
          renderRow={({ item, style, key, index, ref }) => (
            <div ref={ref} key={key} style={index === 0 ? { ...style, paddingTop: 36 } : style}>
              <LogMessage msg={item.message} />
            </div>
          )}
        />
      </Stack>
    </Stack>
  );
});

RosoutPanel.displayName = "Rosout";

export default Panel(
  Object.assign(RosoutPanel, {
    defaultConfig: { searchTerms: [], minLogLevel: 1, topicToRender: "/rosout" } as Config,
    panelType: "RosOut",
  }),
);
