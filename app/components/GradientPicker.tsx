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

import AutoSizingCanvas from "@foxglove-studio/app/components/AutoSizingCanvas";
import ColorPickerForTopicSettings, {
  PICKER_SIZE,
  getHexFromColorSettingWithDefault,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicSettingsEditor/ColorPickerForTopicSettings";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";

const COLOR_PICKER_SIZE = PICKER_SIZE.NORMAL.size;
const GRADIENT_BAR_INSET = Math.floor(COLOR_PICKER_SIZE / 2);
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
  const hexMinColor = getHexFromColorSettingWithDefault(minColor);
  const hexMaxColor = getHexFromColorSettingWithDefault(maxColor);

  const drawGradient = useCallback(
    (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, hexMinColor);
      gradient.addColorStop(1, hexMaxColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    },
    [hexMaxColor, hexMinColor],
  );

  return (
    <>
      <SPickerWrapper>
        <ColorPickerForTopicSettings
          color={minColor}
          onChange={(newColor: any) => onChange({ minColor: newColor, maxColor })}
        />
        <ColorPickerForTopicSettings
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
