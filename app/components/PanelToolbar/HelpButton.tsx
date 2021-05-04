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

import HelpCircleOutlineIcon from "@mdi/svg/svg/help-circle-outline.svg";
import { CSSProperties } from "react";

import Icon from "@foxglove-studio/app/components/Icon";

import styles from "./index.module.scss";

type Props = {
  iconStyle?: CSSProperties;
  url: string;
};

export default function HelpButton(props: Props): JSX.Element {
  return (
    <a href={props.url} target="_blank" rel="noreferrer">
      <Icon tooltip="Help" fade>
        <HelpCircleOutlineIcon className={styles.icon} style={props.iconStyle} />
      </Icon>
    </a>
  );
}
