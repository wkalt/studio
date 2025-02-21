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

import CogIcon from "@mdi/svg/svg/cog.svg";
import { storiesOf } from "@storybook/react";
import { useState } from "react";

import Dropdown from "@foxglove-studio/app/components/Dropdown";
import DropdownItem from "@foxglove-studio/app/components/Dropdown/DropdownItem";
import Icon from "@foxglove-studio/app/components/Icon";

function Example({
  position = "below",
  showCustomBtn = false,
}: {
  position?: "left" | "right" | "below";
  showCustomBtn?: boolean;
}) {
  const [value, setValue] = useState("one");
  const text = value === "one" ? "one" : "";
  const additionalProps = showCustomBtn
    ? {
        toggleComponent: (
          <Icon fade>
            <CogIcon />
          </Icon>
        ),
      }
    : {};
  return (
    <div style={{ margin: 20 }}>
      <Dropdown
        position={position}
        text={text}
        value={value}
        onChange={setValue}
        {...additionalProps}
      >
        <DropdownItem value="one" />
        <DropdownItem value="two" />
        <hr />
        <DropdownItem value="three" />
      </Dropdown>
    </div>
  );
}
storiesOf("components/Dropdown", module)
  .add("position_below", () => <Example position="below" />)
  .add("position_left", () => <Example position="left" />)
  .add("position_right", () => <Example position="right" />)
  .add("with custom button", () => <Example showCustomBtn />);
