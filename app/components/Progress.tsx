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

import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";

type Props = {
  percent: number;
  color?: string;
  width?: number | string;
  height?: number;
  vertical?: boolean;
};

const Progress = (props: Props): JSX.Element => {
  const { percent = 0, vertical = false, color = "black" } = props;
  const viewBoxWidth = vertical ? 1 : 100;
  const viewBoxHeight = vertical ? 100 : 1;
  const style: React.CSSProperties = {};
  style.border = `solid ${colors.DARK3}`;
  style.borderWidth = "0 1px";
  const max = 100 - percent;

  const lineProps: React.SVGProps<SVGLineElement> = {};

  if (vertical) {
    style.width = props.width ?? 10;
    style.height = "100%";
    lineProps.x1 = 0;
    lineProps.x2 = 0;
    lineProps.y1 = 100;
    lineProps.y2 = max;
  } else {
    style.height = props.height ?? 10;
    style.flex = "1 1 100%";
    lineProps.x1 = 0;
    lineProps.x2 = 100 - max;
    lineProps.y1 = 0;
    lineProps.y2 = 0;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      style={style}
      version="1.1"
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
    >
      <line {...lineProps} stroke={color} strokeWidth={2} />
    </svg>
  );
};

Progress.displayName = "Progress";

export default Progress;
