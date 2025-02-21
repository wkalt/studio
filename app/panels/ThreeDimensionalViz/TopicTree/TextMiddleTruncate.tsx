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

import styled from "styled-components";

import Tooltip from "@foxglove-studio/app/components/Tooltip";

export const DEFAULT_END_TEXT_LENGTH = 16;

export const STextMiddleTruncate = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  justify-content: flex-start;
`;

const SStart = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
`;

const SEnd = styled.div`
  white-space: nowrap;
  flex-basis: content;
  flex-grow: 0;
  flex-shrink: 0;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

type Props = {
  tooltips?: React.ReactNode[];
  text: string;
  endTextLength?: number;
  style?: {
    [attr: string]: string | number;
  };
  testShowTooltip?: boolean;
};

export default function TextMiddleTruncate({
  tooltips,
  text,
  endTextLength,
  style,
  testShowTooltip,
}: Props): React.ReactElement {
  const startTextLen = Math.max(
    0,
    text.length -
      (endTextLength == undefined || endTextLength === 0 ? DEFAULT_END_TEXT_LENGTH : endTextLength),
  );
  const startText = text.substr(0, startTextLen);
  const endText = text.substr(startTextLen);

  const elem = (
    <STextMiddleTruncate style={style}>
      <SStart>{startText}</SStart>
      <SEnd>{endText}</SEnd>
    </STextMiddleTruncate>
  );
  return (
    <Tooltip contents={tooltips} placement="top" shown={testShowTooltip}>
      {elem}
    </Tooltip>
  );
}
