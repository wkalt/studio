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
  IRGB,
  ColorPicker,
  getColorFromRGBA,
} from "@fluentui/react";
import { useRef, useState } from "react";
import { Color } from "regl-worldview";

/*
With the recent switch to FluentUI, Foxglove has two Color interfaces in use -
FluentUI's IColor, and the Color interface in regl-worldview used pervasively in
preexisting code. Fluent's IRGB works on a (255, 255, 255, 100) scale while
regl-worldview's works on (1, 1, 1, 1). This is why we need some conversion
functions here, and why we export a custom ColorPicker.
*/

const DEFAULT_RGBA = { r: 255, g: 255, b: 255, a: 100 };

// Convert our internal Color type to Fluent's IRGB.
function getIRGBFromColor(color?: Color): IRGB {
  return color
    ? { r: 255 * color.r, g: 255 * color.g, b: 255 * color.b, a: 100 * color.a }
    : DEFAULT_RGBA;
}

// Get a Fluent IColor from a regl-worldview color
function getIColorFromColor(color?: Color): IColor {
  return getColorFromRGBA(getIRGBFromColor(color));
}

// Translate a fluentui IRGB to our internal Color interface, defaulting the
// alpha value to 1 if it is not present.
function getColorFromIRGB(rgba: IRGB): Color {
  const alpha = rgba.a ?? 100;
  return {
    r: rgba.r / 255,
    g: rgba.g / 255,
    b: rgba.b / 255,
    a: alpha / 100,
  };
}

// Returns an RGB string for a regl-worldview color. The scale of the formatted
// tuple is (255, 255, 255, 1).
export function getDefaultedRGBStringFromColor(color?: Color): string {
  const rgba = getIRGBFromColor(color);
  const alpha = rgba.a ?? 100;
  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${alpha / 100})`;
}

type ColorPickerProps = {
  color?: Color;
  onChange: (newColor: Color) => void;
};

// Returns a FluentUI ColorPicker that accepts our regl-worldview Color type.
export function FGColorPicker({ color, onChange }: ColorPickerProps): JSX.Element {
  return (
    <ColorPicker
      color={getIColorFromColor(color)}
      alphaType="none"
      onChange={(_event, newValue) => onChange(getColorFromIRGB(newValue))}
    />
  );
}

// Returns a button that pops out an FGColorPicker in a fluent callout.
export default function ColorPickerButtonCallout({
  color,
  onChange,
}: ColorPickerProps): JSX.Element {
  const fluentColor = getIColorFromColor(color);
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
