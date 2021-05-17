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

import { Callout, DefaultButton, DirectionalHint } from "@fluentui/react";
import { useRef, useState } from "react";
import { Color } from "regl-worldview";

import ColorPicker from "@foxglove/studio-base/components/ColorPicker/index";
import { getIColorFromColor } from "@foxglove/studio-base/components/ColorPicker/utils";

type Props = {
  color?: Color;
  onChange: (newColor: Color) => void;
};

// Returns a button that pops out an ColorPicker in a fluent callout.
export default function ColorPickerButtonCallout({ color, onChange }: Props): JSX.Element {
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
          <ColorPicker color={color} onChange={onChange} />
        </Callout>
      )}
    </div>
  );
}
