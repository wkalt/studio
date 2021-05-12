// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RosMsgDefinition } from "rosbag";

export function rosMsgDefinitionText(msgDefs: RosMsgDefinition[]): string {
  let output = "";
  for (let i = 0; i < msgDefs.length; i++) {
    const msgDef = msgDefs[i] as RosMsgDefinition;
    const constants = msgDef.definitions.filter((d) => d.isConstant);
    const variables = msgDef.definitions.filter((d) => d.isConstant == undefined || !d.isConstant);

    if (i > 0) {
      output +=
        "\n================================================================================\n";
      output += `MSG: ${msgDef.name ?? ""}\n`;
    }

    for (const def of constants) {
      output += `${def.type} ${def.name} = ${def.value}\n`;
    }
    if (variables.length > 0) {
      output += "\n";
      for (const def of variables) {
        output += `${def.type}${def.isArray === true ? "[]" : ""} ${def.name}\n`;
      }
    }
  }

  return output;
}
