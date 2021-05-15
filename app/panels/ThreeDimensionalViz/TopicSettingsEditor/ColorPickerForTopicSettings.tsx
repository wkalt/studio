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

import {
  Callout,
  DefaultButton,
  DirectionalHint,
  IColor,
  ColorPicker,
  getColorFromRGBA,
} from "@fluentui/react";
import { useRef, useState } from "react";
import { Color } from "regl-worldview";
import tinyColor from "tinycolor2";

export const PICKER_SIZE = {
  NORMAL: { name: "NORMAL", size: 24 },
  SMALL: { name: "SMALL", size: 16 },
};

export type Size = keyof typeof PICKER_SIZE;

// todo remove with retirement of ColorPickerSettingsPanel
const DEFAULT_OVERRIDE_COLOR = "rgba(255,255,255,1)";

const DEFAULT_COLOR = { r: 255, g: 255, b: 255, a: 100 };

export function getHexFromColorSettingWithDefault(color?: Color): string {
  return color ? tinyColor.fromRatio(color).toRgbString() : DEFAULT_OVERRIDE_COLOR;
}

type Props = {
  color?: Color;
  onChange: (newColor: Color) => void;
};

// Translate our regl Color to a fluentUI color.
export function getFluentUIColorFromColor(color?: Color): IColor {
  const defaultedColor = color
    ? { r: 255 * color.r, g: 255 * color.g, b: 255 * color.b, a: 100 * color.a }
    : DEFAULT_COLOR;
  return getColorFromRGBA(defaultedColor);
}

// Translate a fluentui IColor implementation to our internal Color interface,
// defaulting the alpha value to 1 if it is not present.
export function getColorFromFluentUIColor(color: IColor): Color {
  return {
    r: color.r / 255,
    g: color.g / 255,
    b: color.b / 255,
    a: color.a ? color.a / 100 : 1,
  };
}

export default function ColorPickerForTopicSettings({ color, onChange }: Props): JSX.Element {
  const fluentColor = getFluentUIColorFromColor(color);
  const colorButtonRef = useRef<HTMLElement>(ReactNull);
  const [colorPickerShown, setColorPickerShown] = useState(false);

  return (
    <div>
      <DefaultButton
        elementRef={colorButtonRef}
        styles={{
          root: { backgroundColor: fluentColor.str },
          rootHovered: { backgroundColor: fluentColor.str, opacity: 0.8 },
          rootPressed: { backgroundColor: fluentColor.str, opacity: 0.6 },
        }}
        onClick={() => setColorPickerShown(!colorPickerShown)}
      />
      {colorPickerShown && (
        <Callout
          directionalHint={DirectionalHint.topAutoEdge}
          target={colorButtonRef.current}
          onDismiss={() => setColorPickerShown(false)}
        >
          <FGColorPicker color={color} onChange={onChange} />
        </Callout>
      )}
    </div>
  );
}

export function FGColorPicker({ color, onChange }: Props): JSX.Element {
  return (
    <ColorPicker
      color={getFluentUIColorFromColor(color)}
      alphaType="none"
      onChange={(_event, newValue) => onChange(getColorFromFluentUIColor(newValue))}
    />
  );
}
