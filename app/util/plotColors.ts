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

import { memoize } from "lodash";
import tinycolor from "tinycolor2";

import { toolsColorScheme } from "@foxglove-studio/app/util/toolsColorScheme";

// Inspired by the "light" scheme from https://personal.sron.nl/~pault/#sec:qualitative
// but using our standard tools colors.
export const lineColors = [
  toolsColorScheme.blue.medium,
  toolsColorScheme.orange.medium,
  toolsColorScheme.yellow.medium,
  toolsColorScheme.purple.dark,
  toolsColorScheme.cyan.medium,
  toolsColorScheme.green.medium,
  toolsColorScheme.paleGreen.medium,
  "#DDDDDD",
];

export const lightColor: (_: string) => string = memoize((color: string): string =>
  tinycolor(color).brighten(15).toString(),
);

export const darkColor: (_: string) => string = memoize((color: string): string =>
  tinycolor(color).darken(30).toString(),
);
