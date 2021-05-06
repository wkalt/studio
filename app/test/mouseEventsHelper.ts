// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import tick from "@foxglove-studio/app/util/tick";

export function findCanvas(): HTMLCanvasElement {
  const canvas = document.querySelectorAll("canvas")[0] as any;
  if (!canvas) {
    throw new Error("Could not find canvas element");
  }
  return canvas;
}

export async function simulateMouseMove(
  point: number[] = [0, 0],
  canvas: HTMLCanvasElement | undefined,
): Promise<void> {
  const [clientX, clientY] = point;
  canvas = canvas ?? findCanvas();
  canvas.dispatchEvent(
    new MouseEvent("mousemove", {
      bubbles: true,
      clientX,
      clientY,
    }),
  );
}

export async function simulateDragClick(
  point: number[] = [0, 0],
  canvas?: HTMLCanvasElement,
): Promise<void> {
  const [clientX, clientY] = point;
  canvas = canvas ?? findCanvas();
  canvas.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      clientX,
      clientY,
    }),
  );
  await tick();
  canvas.dispatchEvent(
    new MouseEvent("mouseup", {
      bubbles: true,
      clientX,
      clientY,
    }),
  );
}
