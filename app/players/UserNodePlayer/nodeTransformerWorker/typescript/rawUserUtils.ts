// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import markers from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/typescript/userUtils/markers.ts?raw";
import pointClouds from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/typescript/userUtils/pointClouds.ts?raw";
import readers from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/typescript/userUtils/readers.ts?raw";
import time from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/typescript/userUtils/time.ts?raw";
import types from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/typescript/userUtils/types.ts?raw";
import vectors from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/typescript/userUtils/vectors.ts?raw";

export default [
  { fileName: "pointClouds.ts", sourceCode: pointClouds },
  { fileName: "readers.ts", sourceCode: readers },
  { fileName: "time.ts", sourceCode: time },
  { fileName: "types.ts", sourceCode: types },
  { fileName: "vectors.ts", sourceCode: vectors },
  { fileName: "markers.ts", sourceCode: markers },
];
