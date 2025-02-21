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

import { Color, Point, LineStripMarker, LineListMarker } from "@foxglove-studio/app/types/Messages";
import { emptyPose } from "@foxglove-studio/app/util/Pose";
import { COLORS, MARKER_MSG_TYPES } from "@foxglove-studio/app/util/globalConstants";

import { groupLinesIntoInstancedLineLists } from "./groupingUtils";

const DUMMY_POINT_COLOR = { r: 0, g: 0, b: 0, a: 0 };

function lineStrip({
  points,
  closed,
  color,
}: {
  points: Point[];
  closed?: boolean;
  color?: Color;
}): LineStripMarker {
  return {
    id: "foo",
    ns: "bar",
    scale: { x: 1.0, y: 1.0, z: 1.0 },
    points,
    ...(closed !== undefined ? { closed } : {}),
    header: { frame_id: "quux", stamp: { sec: 1, nsec: 2 }, seq: 0 },
    action: 0,
    pose: { position: { x: 0, y: 0, z: 0 }, orientation: { w: 1, x: 1, y: 1, z: 1 } },
    ...(color ? { color } : {}),
    type: MARKER_MSG_TYPES.LINE_STRIP as any,
  };
}

function lineList({ points, color }: { points: Point[]; color?: Color }): LineListMarker {
  return {
    id: "foo",
    ns: "bar",
    scale: { x: 1.0, y: 1.0, z: 1.0 },
    points,
    header: { frame_id: "quux", stamp: { sec: 1, nsec: 2 }, seq: 0 },
    action: 0,
    pose: { position: { x: 0, y: 0, z: 0 }, orientation: { w: 1, x: 1, y: 1, z: 1 } },
    ...(color ? { color } : {}),
    type: MARKER_MSG_TYPES.LINE_LIST as any,
  };
}

describe("groupLineStripsIntoInstancedLineLists", () => {
  // NOTE: Some created markers have more properties than they should -- both `pose` and `poses`,
  // both `color` and `colors`. This isn't problematic, but it's also not necessary. If these
  // properties disappear in some future change that's fine -- these test outputs just serve to
  // document the current output, not necessarily the ideal output.
  it("handles markers with open loops", () => {
    const markers = [
      lineStrip({
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        closed: false,
        color: COLORS.RED,
      }),
    ];
    expect(groupLinesIntoInstancedLineLists(markers)).toEqual([
      {
        action: 0,
        colors: [COLORS.RED, COLORS.RED],
        header: { frame_id: "quux", stamp: { nsec: 2, sec: 1 }, seq: 0 },
        id: "ns:bar_type:4_scalex:1_scaley:1_scalez:1",
        metadataByIndex: [
          {
            header: { frame_id: "quux", stamp: { sec: 1, nsec: 2 }, seq: 0 },
            action: 0,
            id: "foo",
            ns: "bar",
            type: MARKER_MSG_TYPES.LINE_STRIP,
            scale: { x: 1.0, y: 1.0, z: 1.0 },
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
            closed: false,
            color: COLORS.RED,
            pose: { position: { x: 0, y: 0, z: 0 }, orientation: { w: 1, x: 1, y: 1, z: 1 } },
          },
        ],
        ns: "bar",
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        pose: { orientation: { w: 1, x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 } },
        poses: [{ orientation: { w: 1, x: 1, y: 1, z: 1 }, position: { x: 0, y: 0, z: 0 } }],
        scale: { x: 1, y: 1, z: 1 },
        type: MARKER_MSG_TYPES.LINE_STRIP,
        primitive: "line strip",
      },
    ]);
  });

  it("handles markers with closed loops", () => {
    const markers = [
      lineStrip({
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        closed: true,
        color: COLORS.RED,
      }),
    ];
    expect(groupLinesIntoInstancedLineLists(markers)).toEqual([
      {
        action: 0,
        colors: [COLORS.RED, COLORS.RED, COLORS.RED],
        header: { frame_id: "quux", stamp: { nsec: 2, sec: 1 }, seq: 0 },
        id: "ns:bar_type:4_scalex:1_scaley:1_scalez:1",
        metadataByIndex: [
          {
            header: { frame_id: "quux", stamp: { sec: 1, nsec: 2 }, seq: 0 },
            action: 0,
            id: "foo",
            ns: "bar",
            type: MARKER_MSG_TYPES.LINE_STRIP,
            scale: { x: 1.0, y: 1.0, z: 1.0 },
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
            closed: true,
            color: COLORS.RED,
            pose: { position: { x: 0, y: 0, z: 0 }, orientation: { w: 1, x: 1, y: 1, z: 1 } },
          },
          {
            header: { frame_id: "quux", stamp: { sec: 1, nsec: 2 }, seq: 0 },
            action: 0,
            id: "foo",
            ns: "bar",
            type: MARKER_MSG_TYPES.LINE_STRIP,
            scale: { x: 1.0, y: 1.0, z: 1.0 },
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
            closed: true,
            color: COLORS.RED,
            pose: { position: { x: 0, y: 0, z: 0 }, orientation: { w: 1, x: 1, y: 1, z: 1 } },
          },
        ],
        ns: "bar",
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },
        ],
        pose: emptyPose(),
        poses: [
          { orientation: { w: 1, x: 1, y: 1, z: 1 }, position: { x: 0, y: 0, z: 0 } },
          { orientation: { w: 1, x: 1, y: 1, z: 1 }, position: { x: 0, y: 0, z: 0 } },
        ],
        scale: { x: 1, y: 1, z: 1 },
        type: MARKER_MSG_TYPES.LINE_STRIP,
        primitive: "line strip",
      },
    ]);
  });

  it("handles markers with mixed open and closed loops", () => {
    const markers = [
      lineStrip({
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        closed: false,
        color: COLORS.RED,
      }),
      lineStrip({
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        closed: true,
        color: COLORS.RED,
      }),
    ];
    expect(groupLinesIntoInstancedLineLists(markers)).toEqual([
      expect.objectContaining({
        colors: [
          COLORS.RED,
          COLORS.RED,
          DUMMY_POINT_COLOR,
          DUMMY_POINT_COLOR,
          DUMMY_POINT_COLOR,
          COLORS.RED,
          COLORS.RED,
          COLORS.RED,
        ],
        metadataByIndex: [
          expect.objectContaining({
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
          }),
          expect.objectContaining({
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
          }),
          {},
          {},
          {},
          expect.objectContaining({
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
          }),
          expect.objectContaining({
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
          }),
        ],
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 }, // self point for transition
          { x: NaN, y: NaN, z: NaN }, // NaN point for transition
          { x: 0, y: 0, z: 0 }, // self point for transition
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 }, // close point
        ],
        poses: [
          { orientation: { w: 1, x: 1, y: 1, z: 1 }, position: { x: 0, y: 0, z: 0 } },
          { orientation: { w: 1, x: 1, y: 1, z: 1 }, position: { x: 0, y: 0, z: 0 } },
          { orientation: { w: 1, x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 } },
          { orientation: { w: 1, x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 } },
          { orientation: { w: 1, x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 } },
          { orientation: { w: 1, x: 1, y: 1, z: 1 }, position: { x: 0, y: 0, z: 0 } },
          { orientation: { w: 1, x: 1, y: 1, z: 1 }, position: { x: 0, y: 0, z: 0 } },
        ],
      }),
    ]);
  });

  it("handles markers without specified colors", () => {
    const markers = [
      lineStrip({
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        closed: false,
      }),
    ];
    expect(groupLinesIntoInstancedLineLists(markers)).toEqual([
      {
        action: 0,
        colors: [COLORS.WHITE, COLORS.WHITE],
        header: { frame_id: "quux", stamp: { nsec: 2, sec: 1 }, seq: 0 },
        id: "ns:bar_type:4_scalex:1_scaley:1_scalez:1",
        metadataByIndex: [
          {
            header: { frame_id: "quux", stamp: { sec: 1, nsec: 2 }, seq: 0 },
            action: 0,
            id: "foo",
            ns: "bar",
            type: MARKER_MSG_TYPES.LINE_STRIP,
            scale: { x: 1.0, y: 1.0, z: 1.0 },
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
            closed: false,
            pose: { position: { x: 0, y: 0, z: 0 }, orientation: { w: 1, x: 1, y: 1, z: 1 } },
          },
        ],
        ns: "bar",
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        pose: emptyPose(),
        poses: [{ orientation: { w: 1, x: 1, y: 1, z: 1 }, position: { x: 0, y: 0, z: 0 } }],
        scale: { x: 1, y: 1, z: 1 },
        type: MARKER_MSG_TYPES.LINE_STRIP,
        primitive: "line strip",
      },
    ]);
  });

  it("handles line lists", () => {
    const markers = [
      lineList({
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        color: COLORS.RED,
      }),
    ];
    expect(groupLinesIntoInstancedLineLists(markers)).toEqual([
      {
        header: { frame_id: "quux", stamp: { sec: 1, nsec: 2 }, seq: 0 },
        action: 0,
        ns: "bar",
        scale: { x: 1, y: 1, z: 1 },
        pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
        colors: [COLORS.RED, COLORS.RED],
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        poses: [{ position: { x: 0, y: 0, z: 0 }, orientation: { w: 1, x: 1, y: 1, z: 1 } }],
        metadataByIndex: [
          {
            id: "foo",
            ns: "bar",
            scale: { x: 1, y: 1, z: 1 },
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
            header: { frame_id: "quux", stamp: { sec: 1, nsec: 2 }, seq: 0 },
            action: 0,
            pose: { position: { x: 0, y: 0, z: 0 }, orientation: { w: 1, x: 1, y: 1, z: 1 } },
            color: COLORS.RED,
            type: MARKER_MSG_TYPES.LINE_LIST,
          },
          {
            id: "foo",
            ns: "bar",
            scale: { x: 1, y: 1, z: 1 },
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
            header: { frame_id: "quux", stamp: { sec: 1, nsec: 2 }, seq: 0 },
            action: 0,
            pose: { position: { x: 0, y: 0, z: 0 }, orientation: { w: 1, x: 1, y: 1, z: 1 } },
            color: COLORS.RED,
            type: MARKER_MSG_TYPES.LINE_LIST,
          },
        ],
        id: "ns:bar_type:5_scalex:1_scaley:1_scalez:1",
        type: MARKER_MSG_TYPES.INSTANCED_LINE_LIST,
        primitive: "lines",
      },
    ]);
  });

  it("handles line strips and line lists", () => {
    const markers = [
      lineStrip({
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        closed: false,
        color: COLORS.RED,
      }),
      lineList({
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        color: COLORS.RED,
      }),
    ];
    expect(groupLinesIntoInstancedLineLists(markers)).toEqual([
      {
        header: { frame_id: "quux", stamp: { sec: 1, nsec: 2 }, seq: 0 },
        action: 0,
        ns: "bar",
        scale: { x: 1, y: 1, z: 1 },
        pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
        colors: [COLORS.RED, COLORS.RED],
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        poses: [{ position: { x: 0, y: 0, z: 0 }, orientation: { w: 1, x: 1, y: 1, z: 1 } }],
        metadataByIndex: [
          {
            id: "foo",
            ns: "bar",
            scale: { x: 1, y: 1, z: 1 },
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
            closed: false,
            header: { frame_id: "quux", stamp: { sec: 1, nsec: 2 }, seq: 0 },
            action: 0,
            pose: { position: { x: 0, y: 0, z: 0 }, orientation: { w: 1, x: 1, y: 1, z: 1 } },
            color: COLORS.RED,
            type: MARKER_MSG_TYPES.LINE_STRIP,
          },
        ],
        id: "ns:bar_type:4_scalex:1_scaley:1_scalez:1",
        type: MARKER_MSG_TYPES.LINE_STRIP,
        primitive: "line strip",
      },
      {
        header: { frame_id: "quux", stamp: { sec: 1, nsec: 2 }, seq: 0 },
        action: 0,
        ns: "bar",
        scale: { x: 1, y: 1, z: 1 },
        pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
        colors: [COLORS.RED, COLORS.RED],
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        poses: [{ position: { x: 0, y: 0, z: 0 }, orientation: { w: 1, x: 1, y: 1, z: 1 } }],
        metadataByIndex: [
          {
            id: "foo",
            ns: "bar",
            scale: { x: 1, y: 1, z: 1 },
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
            header: { frame_id: "quux", stamp: { sec: 1, nsec: 2 }, seq: 0 },
            action: 0,
            pose: { position: { x: 0, y: 0, z: 0 }, orientation: { w: 1, x: 1, y: 1, z: 1 } },
            color: COLORS.RED,
            type: MARKER_MSG_TYPES.LINE_LIST,
          },
          {
            id: "foo",
            ns: "bar",
            scale: { x: 1, y: 1, z: 1 },
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
            header: { frame_id: "quux", stamp: { sec: 1, nsec: 2 }, seq: 0 },
            action: 0,
            pose: { position: { x: 0, y: 0, z: 0 }, orientation: { w: 1, x: 1, y: 1, z: 1 } },
            color: COLORS.RED,
            type: MARKER_MSG_TYPES.LINE_LIST,
          },
        ],
        id: "ns:bar_type:5_scalex:1_scaley:1_scalez:1",
        type: MARKER_MSG_TYPES.INSTANCED_LINE_LIST,
        primitive: "lines",
      },
    ]);
  });
});
