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

import DotsVerticalIcon from "@mdi/svg/svg/dots-vertical.svg";
import UndoVariantIcon from "@mdi/svg/svg/undo-variant.svg";
import { useState } from "react";
import styled from "styled-components";

import ChildToggle from "@foxglove-studio/app/components/ChildToggle";
import Icon from "@foxglove-studio/app/components/Icon";
import KeyboardShortcut from "@foxglove-studio/app/components/KeyboardShortcut";
import Menu, { Item } from "@foxglove-studio/app/components/Menu";
import useGuaranteedContext from "@foxglove-studio/app/hooks/useGuaranteedContext";
import {
  getHexFromColorSettingWithDefault,
  PICKER_SIZE,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicSettingsEditor/ColorPickerForTopicSettings";
import { ROW_HEIGHT } from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicTree/constants";
import { TopicTreeContext } from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicTree/useTopicTree";
import clipboard from "@foxglove-studio/app/util/clipboard";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";

import { SDotMenuPlaceholder } from "./TreeNodeRow";
import { OnNamespaceOverrideColorChange, SetEditingNamespace } from "./types";

const DISABLED_STYLE = { cursor: "not-allowed", color: colors.TEXT_MUTED };
const ICON_SIZE = 18; // The width of the small icon.
const COLOR_PIKCER_ICON_SPACING = 4;
export const DOT_MENU_WIDTH = ICON_SIZE; // The width of the small icon.
const COLOR_PICKER_SIZE = PICKER_SIZE.SMALL.size;
const COLOR_PICKER_AND_ICON_WIDTH = COLOR_PICKER_SIZE + ICON_SIZE + COLOR_PIKCER_ICON_SPACING;

const SItemContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;
const SColorPickerWrapper = styled.span`
  display: inline-flex;
  align-items: center;
`;

const SColorTrigger = styled.span<any>`
  display: inline-block;
  cursor: pointer;
  background: ${({ hexColor }) => hexColor};
  width: ${PICKER_SIZE.SMALL.size}px;
  height: ${PICKER_SIZE.SMALL.size}px;
  border-radius: ${PICKER_SIZE.SMALL.size / 2}px;
`;

type Props = {
  disableBaseColumn: boolean;
  disableFeatureColumn: boolean;
  featureKey: string;
  hasFeatureColumn: boolean;
  hasNamespaceOverrideColorChangedByColumn: boolean[];
  namespace: string;
  nodeKey: string;
  onNamespaceOverrideColorChange: OnNamespaceOverrideColorChange;
  overrideColorByColumn?: (string | undefined)[];
  providerAvailable: boolean;
  setEditingNamespace: SetEditingNamespace;
  topicName: string;
};

const overrideColorChangedIconStyle = {
  color: colors.HIGHLIGHT,
  marginLeft: COLOR_PIKCER_ICON_SPACING,
  height: ROW_HEIGHT,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

export default function NamespaceMenu({
  disableBaseColumn,
  disableFeatureColumn,
  featureKey,
  hasFeatureColumn,
  hasNamespaceOverrideColorChangedByColumn,
  namespace,
  nodeKey,
  onNamespaceOverrideColorChange,
  overrideColorByColumn,
  providerAvailable,
  setEditingNamespace,
  topicName,
}: Props): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  // Render with extra space for the reset icon if any column has the override color.
  const showResetOverrideColor =
    (hasNamespaceOverrideColorChangedByColumn[0] ?? false) ||
    (hasNamespaceOverrideColorChangedByColumn[1] ?? false);
  const colorPickerWrapperStyle = showResetOverrideColor
    ? { width: COLOR_PICKER_AND_ICON_WIDTH }
    : {};

  const { toggleCheckAllAncestors } = useGuaranteedContext(TopicTreeContext, "TopicTreeContext");
  // Don't render the dot menu if the datasources are unavailable.
  if (!providerAvailable) {
    return <SDotMenuPlaceholder />;
  }

  return (
    <ChildToggle
      position="below"
      isOpen={isOpen}
      onToggle={setIsOpen}
      dataTest={`namespace-row-menu~${topicName}~${namespace}`}
    >
      <Icon
        small
        fade
        style={{
          padding: "4px 0px",
          height: ROW_HEIGHT,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <DotsVerticalIcon />
      </Icon>
      <Menu>
        {providerAvailable && (
          <>
            <Item
              style={{ padding: "0 12px", ...(disableBaseColumn ? DISABLED_STYLE : undefined) }}
              onClick={() => {
                if (disableBaseColumn) {
                  return;
                }
                toggleCheckAllAncestors(nodeKey, 0, topicName);
                setIsOpen(false);
              }}
            >
              <SItemContent>
                <span style={{ paddingRight: 8 }}>Toggle ancestors</span>
                <KeyboardShortcut keys={["Alt", "Enter"]} />
              </SItemContent>
            </Item>
            {hasFeatureColumn && (
              <Item
                style={disableFeatureColumn ? DISABLED_STYLE : {}}
                onClick={() => {
                  if (disableFeatureColumn) {
                    return;
                  }
                  toggleCheckAllAncestors(nodeKey, 1, topicName);
                  setIsOpen(false);
                }}
              >
                Toggle feature ancestors
              </Item>
            )}
            {overrideColorByColumn && (
              <>
                <Item
                  onClick={() =>
                    setEditingNamespace({
                      namespaceColor: overrideColorByColumn[0],
                      namespaceKey: nodeKey,
                    })
                  }
                  style={{
                    padding: "0 12px",
                    height: 28,
                    ...(disableBaseColumn ? DISABLED_STYLE : undefined),
                  }}
                >
                  <SItemContent>
                    <span style={{ paddingRight: 8 }}>Marker color</span>
                    <SColorPickerWrapper style={colorPickerWrapperStyle}>
                      <SColorTrigger
                        hexColor={getHexFromColorSettingWithDefault(
                          overrideColorByColumn[0] as any,
                        )}
                      />
                      {(hasNamespaceOverrideColorChangedByColumn[0] ?? false) && (
                        <Icon
                          dataTest="reset-override-color-icon"
                          small
                          fade
                          tooltipProps={{ placement: "top", contents: "Reset to default" }}
                          onClick={() => onNamespaceOverrideColorChange(undefined, nodeKey)}
                          style={overrideColorChangedIconStyle}
                        >
                          <UndoVariantIcon />
                        </Icon>
                      )}
                    </SColorPickerWrapper>
                  </SItemContent>
                </Item>
                {hasFeatureColumn && (
                  <Item
                    onClick={() =>
                      setEditingNamespace({
                        namespaceColor: overrideColorByColumn[1],
                        namespaceKey: featureKey,
                      })
                    }
                    style={{
                      padding: "0 12px",
                      height: 28,
                      ...(disableBaseColumn ? DISABLED_STYLE : undefined),
                    }}
                  >
                    <SItemContent>
                      <span style={{ paddingRight: 8 }}>Feature marker color</span>
                      <SColorPickerWrapper style={colorPickerWrapperStyle}>
                        <SColorTrigger
                          hexColor={getHexFromColorSettingWithDefault(
                            overrideColorByColumn[1] as any,
                          )}
                        />
                        {(hasNamespaceOverrideColorChangedByColumn[1] ?? false) && (
                          <Icon
                            dataTest="reset-override-color-icon"
                            small
                            fade
                            tooltipProps={{
                              placement: "top",
                              contents: "Reset color to default.",
                            }}
                            onClick={() => onNamespaceOverrideColorChange(undefined, featureKey)}
                            style={overrideColorChangedIconStyle}
                          >
                            <UndoVariantIcon />
                          </Icon>
                        )}
                      </SColorPickerWrapper>
                    </SItemContent>
                  </Item>
                )}
              </>
            )}
          </>
        )}
        <Item
          onClick={() => {
            clipboard.copy(namespace);
            setIsOpen(false);
          }}
        >
          Copy name
        </Item>
      </Menu>
    </ChildToggle>
  );
}
