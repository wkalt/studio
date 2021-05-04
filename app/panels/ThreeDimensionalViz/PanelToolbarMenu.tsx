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

import ArrowLeftIcon from "@mdi/svg/svg/arrow-left.svg";
import ArrowRightIcon from "@mdi/svg/svg/arrow-right.svg";
import CheckboxBlankOutlineIcon from "@mdi/svg/svg/checkbox-blank-outline.svg";
import CheckboxMarkedIcon from "@mdi/svg/svg/checkbox-marked.svg";
import SwapHorizontalIcon from "@mdi/svg/svg/swap-horizontal.svg";
import SyncIcon from "@mdi/svg/svg/sync.svg";

import { Item, SubMenu } from "@foxglove-studio/app/components/Menu";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import { Save3DConfig } from "@foxglove-studio/app/panels/ThreeDimensionalViz";
import { TopicSettingsCollection } from "@foxglove-studio/app/panels/ThreeDimensionalViz/SceneBuilder";
import { SECOND_SOURCE_PREFIX } from "@foxglove-studio/app/util/globalConstants";

export const SYNC_OPTIONS = {
  bag1ToBag2: "bag1ToBag2",
  bag2ToBag1: "bag2ToBag1",
  swapBag1AndBag2: "swapBag1AndBag2",
};

type Props = {
  helpUrl: string;
  saveConfig: Save3DConfig;
  flattenMarkers: boolean;
  autoTextBackgroundColor: boolean;
  checkedKeys: string[];
  settingsByKey: TopicSettingsCollection;
};

type BagSyncData = { checkedKeys: string[]; settingsByKey: TopicSettingsCollection };
type SyncOption = keyof typeof SYNC_OPTIONS;
type Keys = { bag1: string[]; bag2: [] };

function bag2KeyToBag1Key(bag2Key: string) {
  if (bag2Key.startsWith(`t:${SECOND_SOURCE_PREFIX}`)) {
    return bag2Key.replace(`t:${SECOND_SOURCE_PREFIX}`, "t:");
  }
  if (bag2Key.startsWith("name_2:")) {
    return bag2Key.replace("name_2:", "name:");
  }
  return bag2Key.replace(`ns:${SECOND_SOURCE_PREFIX}`, "ns:");
}
function bag1KeyToBag2Key(bag1Key: string) {
  if (bag1Key.startsWith("t:")) {
    return bag1Key.replace("t:", `t:${SECOND_SOURCE_PREFIX}`);
  }
  if (bag1Key.startsWith("name:")) {
    return bag1Key.replace("name:", "name_2:");
  }
  return bag1Key.replace("ns:", `ns:${SECOND_SOURCE_PREFIX}`);
}

function partitionKeys(
  keys: string[],
): {
  groupKeys: Keys;
  topicKeys: Keys;
  namespaceKeys: Keys;
} {
  const result: any = {
    groupKeys: { bag1: [], bag2: [] },
    topicKeys: { bag1: [], bag2: [] },
    namespaceKeys: { bag1: [], bag2: [] },
  };
  keys.forEach((key) => {
    if (key.startsWith(`t:${SECOND_SOURCE_PREFIX}`)) {
      result.topicKeys.bag2.push(key);
    } else if (key.startsWith("t:")) {
      result.topicKeys.bag1.push(key);
    } else if (key.startsWith("name_2:")) {
      result.groupKeys.bag2.push(key);
    } else if (key.startsWith("name:")) {
      result.groupKeys.bag1.push(key);
    } else if (key.startsWith(`ns:${SECOND_SOURCE_PREFIX}`)) {
      result.namespaceKeys.bag2.push(key);
    } else if (key.startsWith("ns:")) {
      result.namespaceKeys.bag1.push(key);
    }
  });
  return result;
}

export function syncBags(
  { checkedKeys, settingsByKey }: BagSyncData,
  syncOption: SyncOption,
): BagSyncData {
  const { groupKeys, topicKeys, namespaceKeys } = partitionKeys(checkedKeys);
  const bag1CheckedKeys = [...groupKeys.bag1, ...topicKeys.bag1, ...namespaceKeys.bag1];
  const bag2CheckedKeys = [...groupKeys.bag2, ...topicKeys.bag2, ...namespaceKeys.bag2];
  const settingKeys = Object.keys(settingsByKey);
  const { topicKeys: topicKeys1, namespaceKeys: namespaceKeys1 } = partitionKeys(settingKeys);
  const bag1SettingKeys = [...topicKeys1.bag1, ...namespaceKeys1.bag1];
  const bag2SettingKeys = [...topicKeys1.bag2, ...namespaceKeys1.bag2];

  const result: any = { checkedKeys: { bag1: [], bag2: [] }, settingsByKey: {} };
  const newSettingsByKey: any = {};

  switch (syncOption) {
    case "bag1ToBag2":
      result.checkedKeys = { bag1: bag1CheckedKeys, bag2: bag1CheckedKeys.map(bag1KeyToBag2Key) };
      bag1SettingKeys.forEach((bag1Key) => (newSettingsByKey[bag1Key] = settingsByKey[bag1Key]));
      bag1SettingKeys.forEach(
        (bag1Key) => (newSettingsByKey[bag1KeyToBag2Key(bag1Key)] = settingsByKey[bag1Key]),
      );
      break;
    case "bag2ToBag1":
      result.checkedKeys = { bag1: bag2CheckedKeys.map(bag2KeyToBag1Key), bag2: bag2CheckedKeys };
      bag2SettingKeys.forEach((bag2Key) => (newSettingsByKey[bag2Key] = settingsByKey[bag2Key]));
      bag2SettingKeys.forEach(
        (bag2Key) => (newSettingsByKey[bag2KeyToBag1Key(bag2Key)] = settingsByKey[bag2Key]),
      );
      break;
    case "swapBag1AndBag2":
      result.checkedKeys = {
        bag1: bag2CheckedKeys.map(bag2KeyToBag1Key),
        bag2: bag1CheckedKeys.map(bag1KeyToBag2Key),
      };
      bag2SettingKeys.forEach(
        (bag2Key) => (newSettingsByKey[bag2KeyToBag1Key(bag2Key)] = settingsByKey[bag2Key]),
      );
      bag1SettingKeys.forEach(
        (bag1Key) => (newSettingsByKey[bag1KeyToBag2Key(bag1Key)] = settingsByKey[bag1Key]),
      );
      break;
    default:
      throw new Error(`Unsupported sync option ${syncOption}`);
  }

  return {
    checkedKeys: [...result.checkedKeys.bag1, ...result.checkedKeys.bag2],
    settingsByKey: newSettingsByKey,
  };
}

export default function PanelToolbarMenu({
  helpUrl,
  checkedKeys,
  settingsByKey,
  saveConfig,
  flattenMarkers,
  autoTextBackgroundColor,
}: Props): JSX.Element {
  return (
    <PanelToolbar
      floating
      helpUrl={helpUrl}
      menuContent={
        <>
          <Item
            tooltip="Marker poses / points with a z-value of 0 are updated to have the flattened base frame's z-value."
            icon={flattenMarkers ? <CheckboxMarkedIcon /> : <CheckboxBlankOutlineIcon />}
            onClick={() => saveConfig({ flattenMarkers: !flattenMarkers })}
          >
            Flatten markers
          </Item>
          <Item
            tooltip="Automatically apply dark/light background color to text."
            icon={autoTextBackgroundColor ? <CheckboxMarkedIcon /> : <CheckboxBlankOutlineIcon />}
            onClick={() => saveConfig({ autoTextBackgroundColor: !autoTextBackgroundColor })}
          >
            Auto Text Background
          </Item>
          <SubMenu checked={false} text="Sync settings" icon={<SyncIcon />}>
            <Item
              icon={<ArrowRightIcon />}
              tooltip="Set bag 2's topic settings and selected topics to bag 1's"
              onClick={() =>
                saveConfig(syncBags({ checkedKeys, settingsByKey }, SYNC_OPTIONS.bag1ToBag2 as any))
              }
            >
              Sync bag 1 to bag 2
            </Item>
            <Item
              icon={<ArrowLeftIcon />}
              tooltip="Set bag 1's topic settings and selected topics to bag 2's"
              onClick={() =>
                saveConfig(syncBags({ checkedKeys, settingsByKey }, SYNC_OPTIONS.bag2ToBag1 as any))
              }
            >
              Sync bag 2 to bag 1
            </Item>
            <Item
              icon={<SwapHorizontalIcon />}
              tooltip="Swap topic settings and selected topics between bag 1 and bag 2"
              onClick={() =>
                saveConfig(
                  syncBags({ checkedKeys, settingsByKey }, SYNC_OPTIONS.swapBag1AndBag2 as any),
                )
              }
            >
              Swap bags 1 and 2
            </Item>
          </SubMenu>
        </>
      }
    />
  );
}
