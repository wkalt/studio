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

import { useCallback } from "react";
import { Color } from "regl-worldview";
import styled from "styled-components";

import AutoSizingCanvas from "@foxglove/studio-base/components/AutoSizingCanvas";
import { getDefaultedRGBStringFromColor } from "@foxglove/studio-base/components/ColorPicker";
import ColorPickerButtonCallout from "@foxglove/studio-base/components/ColorPicker/ColorPickerButtonCallout";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const GRADIENT_BAR_INSET = 12;
const GRADIENT_BAR_HEIGHT = 10;
const GRADIENT_LINE_HEIGHT = 6;

const SPickerWrapper = styled.div`
  flex: 1 1 auto;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;
const SBarWrapper = styled.div`
  flex: 1 1 auto;
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  margin-left: ${GRADIENT_BAR_INSET}px;
  margin-right: ${GRADIENT_BAR_INSET}px;
`;
const SLine = styled.div`
  flex: 0 0 auto;
  width: 1px;
  height: ${GRADIENT_BAR_HEIGHT + GRADIENT_LINE_HEIGHT}px;
  background-color: ${colors.LIGHT2};
`;
const SBar = styled.div`
  flex: 1 1 auto;
  height: ${GRADIENT_BAR_HEIGHT}px;
`;

export default function GradientPicker({
  minColor,
  maxColor,
  onChange,
}: {
  minColor: Color;
  maxColor: Color;
  onChange: (arg0: { minColor: Color; maxColor: Color }) => void;
}): JSX.Element {
  const rgbMinColor = getDefaultedRGBStringFromColor(minColor);
  const rgbMaxColor = getDefaultedRGBStringFromColor(maxColor);

  const drawGradient = useCallback(
    (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, rgbMinColor);
      gradient.addColorStop(1, rgbMaxColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    },
    [rgbMaxColor, rgbMinColor],
  );

  return (
    <>
      <SPickerWrapper>
        <ColorPickerButtonCallout
          color={minColor}
          onChange={(newColor: any) => onChange({ minColor: newColor, maxColor })}
        />
        <ColorPickerButtonCallout
          color={maxColor}
          onChange={(newColor: any) => onChange({ minColor, maxColor: newColor })}
        />
      </SPickerWrapper>
      <SBarWrapper>
        <SLine />
        <SBar>
          <AutoSizingCanvas draw={drawGradient} />
        </SBar>
        <SLine />
      </SBarWrapper>
    </>
  );
}
