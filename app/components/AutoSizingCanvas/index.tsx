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

import { useRef, useLayoutEffect } from "react";
import { useResizeDetector } from "react-resize-detector";

type Draw = (context: CanvasRenderingContext2D, width: number, height: number) => void;

type AutoSizingCanvasProps = {
  draw: Draw;
  overrideDevicePixelRatioForTest?: number;
};

const AutoSizingCanvas = ({
  draw,
  overrideDevicePixelRatioForTest,
}: AutoSizingCanvasProps): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(ReactNull);

  const { width, height } = useResizeDetector({
    targetRef: canvasRef,
  });

  const ratio = overrideDevicePixelRatioForTest ?? 1;

  const actualWidth = ratio * (width ?? 0);
  const actualHeight = ratio * (height ?? 0);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === undefined || height === undefined) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(ctx, width, height);
  });

  return (
    <canvas
      ref={canvasRef}
      width={actualWidth}
      height={actualHeight}
      style={{ width: "100%", height: "100%" }}
    />
  );
};

export default AutoSizingCanvas;
