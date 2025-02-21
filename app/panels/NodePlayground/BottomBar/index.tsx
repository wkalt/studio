// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import React, { useState, useRef, useEffect, ReactElement } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";

import { clearUserNodeLogs } from "@foxglove-studio/app/actions/userNodes";
import Button from "@foxglove-studio/app/components/Button";
import Flex from "@foxglove-studio/app/components/Flex";
import DiagnosticsSection from "@foxglove-studio/app/panels/NodePlayground/BottomBar/DiagnosticsSection";
import LogsSection from "@foxglove-studio/app/panels/NodePlayground/BottomBar/LogsSection";
import { Diagnostic, UserNodeLog } from "@foxglove-studio/app/players/UserNodePlayer/types";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";

const SHeaderItem = styled.div`
  cursor: pointer;
  padding: 4px;
  text-transform: uppercase;
`;

type Props = {
  nodeId?: string;
  isSaved: boolean;
  save: () => void;
  diagnostics: Diagnostic[];
  logs: UserNodeLog[];
};

type HeaderItemProps = {
  text: string;
  isOpen: boolean;
  numItems: number;
};

const HeaderItem = ({ isOpen, numItems, text }: HeaderItemProps) => (
  <SHeaderItem
    style={{
      color: numItems > 0 ? colors.RED : "inherit",
      borderBottom: isOpen ? `1px solid ${colors.DARK6}` : "none",
      paddingBottom: isOpen ? 2 : 0,
    }}
  >
    {text} {numItems > 0 ? numItems : ""}
  </SHeaderItem>
);

const BottomBar = ({ nodeId, isSaved, save, diagnostics, logs }: Props): ReactElement => {
  const [bottomBarDisplay, setBottomBarDisplay] = useState("closed");
  const [autoScroll, setAutoScroll] = useState(true);

  const dispatch = useDispatch();
  const clearLogs = React.useCallback((payload: string) => dispatch(clearUserNodeLogs(payload)), [
    dispatch,
  ]);
  const scrollContainer = useRef<HTMLDivElement>(ReactNull);

  useEffect(() => {
    if (autoScroll) {
      if (scrollContainer.current) {
        scrollContainer.current.scrollTop = scrollContainer.current.scrollHeight;
      }
    }
  }, [autoScroll, logs]);

  return (
    <Flex col style={{ backgroundColor: colors.DARK1, bottom: 0, right: 0, left: 0 }}>
      <Flex
        row
        start
        style={{
          padding: 5,
          bottom: 0,
        }}
      >
        <Flex
          center
          style={{ flexGrow: 0, color: colors.DARK9 }}
          dataTest="np-errors"
          onClick={() => {
            if (bottomBarDisplay !== "diagnostics") {
              setBottomBarDisplay("diagnostics");
            } else {
              setBottomBarDisplay("closed");
            }
          }}
        >
          <HeaderItem
            text="Problems"
            numItems={diagnostics.length}
            isOpen={bottomBarDisplay === "diagnostics"}
          />
        </Flex>
        <Flex
          center
          style={{ flexGrow: 0, color: colors.DARK9 }}
          dataTest="np-logs"
          onClick={() => {
            if (bottomBarDisplay !== "logs") {
              setBottomBarDisplay("logs");
            } else {
              setBottomBarDisplay("closed");
            }
          }}
        >
          <HeaderItem text="Logs" numItems={logs.length} isOpen={bottomBarDisplay === "logs"} />
        </Flex>
        <Button
          style={{ padding: "2px 4px" }}
          primary={!isSaved}
          disabled={isSaved}
          tooltip={"ctrl/cmd + s"}
          onClick={() => {
            if (nodeId != undefined) {
              save();
              clearLogs(nodeId);
            }
          }}
        >
          {isSaved ? "saved" : "save"}
        </Button>
      </Flex>
      <div
        ref={scrollContainer}
        onScroll={({ target }: any) => {
          const scrolledUp = target.scrollHeight - target.scrollTop > target.clientHeight;
          if (scrolledUp && autoScroll) {
            setAutoScroll(false);
          } else if (!scrolledUp && !autoScroll) {
            setAutoScroll(true);
          }
        }}
        style={{
          overflowY: bottomBarDisplay !== "closed" ? "scroll" : "auto",
          height: bottomBarDisplay !== "closed" ? 150 : 0,
          color: colors.DARK9,
        }}
      >
        {bottomBarDisplay === "diagnostics" && <DiagnosticsSection diagnostics={diagnostics} />}
        {bottomBarDisplay === "logs" && (
          <LogsSection nodeId={nodeId} logs={logs} clearLogs={clearLogs} />
        )}
      </div>
    </Flex>
  );
};

export default BottomBar;
