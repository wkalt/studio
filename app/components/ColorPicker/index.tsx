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

import { ColorPicker as Picker } from "@fluentui/react";
import { Color } from "regl-worldview";
import styled from "styled-components";

import {
  getColorFromIRGB,
  getIColorFromColor,
} from "@foxglove/studio-base/components/ColorPicker/utils";

const SWrapper = styled.span<any>`
  .color-picker-trigger {
    border: none;
    box-shadow: none;
    display: inline-block;
    width: 16px;
    height: 16px;
    border-radius: 8px;
  }
`;

type Props = {
  color?: Color;
  onChange: (newColor: Color) => void;
};

// Returns a FluentUI ColorPicker that accepts our regl-worldview Color type.
export default function ColorPicker({ color, onChange }: Props): JSX.Element {
  return (
    <SWrapper>
      <Picker
        color={getIColorFromColor(color)}
        alphaType="none"
        onChange={(_event, newValue) => onChange(getColorFromIRGB(newValue))}
      />
    </SWrapper>
  );
}
