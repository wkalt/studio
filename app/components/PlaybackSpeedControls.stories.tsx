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
import { storiesOf } from "@storybook/react";

import MockMessagePipelineProvider from "@foxglove-studio/app/components/MessagePipeline/MockMessagePipelineProvider";
import PlaybackSpeedControls from "@foxglove-studio/app/components/PlaybackSpeedControls";

const CAPABILITIES = ["setSpeed", "playbackControl"];

function ControlsStory() {
  return (
    <div
      style={{ padding: 20, paddingTop: 300 }}
      ref={(el) => {
        setImmediate(() => {
          if (el) {
            (el as any).querySelector("[data-test=PlaybackSpeedControls-Dropdown]").click();
          }
        });
      }}
    >
      <PlaybackSpeedControls />
    </div>
  );
}

storiesOf("components/PlaybackSpeedControls", module)
  .add("without speed capability", () => {
    return (
      <MockMessagePipelineProvider>
        <ControlsStory />
      </MockMessagePipelineProvider>
    );
  })
  .add("without a speed from the player", () => {
    return (
      <MockMessagePipelineProvider capabilities={CAPABILITIES} activeData={{ speed: undefined }}>
        <ControlsStory />
      </MockMessagePipelineProvider>
    );
  })
  .add("with a speed", () => {
    return (
      <MockMessagePipelineProvider capabilities={CAPABILITIES}>
        <ControlsStory />
      </MockMessagePipelineProvider>
    );
  })
  .add("with a very small speed", () => {
    return (
      <MockMessagePipelineProvider capabilities={CAPABILITIES} activeData={{ speed: 0.01 }}>
        <ControlsStory />
      </MockMessagePipelineProvider>
    );
  });
