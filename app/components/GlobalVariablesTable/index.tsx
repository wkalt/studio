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
import { Callout, DefaultButton, IconButton } from "@fluentui/react";
import CloseIcon from "@mdi/svg/svg/close.svg";
import { partition, pick, union, without } from "lodash";
import { useEffect, useMemo, useCallback, useRef, useState, ReactElement } from "react";
import styled, { css, keyframes } from "styled-components";

import Flex from "@foxglove-studio/app/components/Flex";
import Icon from "@foxglove-studio/app/components/Icon";
import Menu, { Item } from "@foxglove-studio/app/components/Menu";
import Tooltip from "@foxglove-studio/app/components/Tooltip";
import { JSONInput } from "@foxglove-studio/app/components/input/JSONInput";
import { ValidatedResizingInput } from "@foxglove-studio/app/components/input/ValidatedResizingInput";
import useGlobalVariables, { GlobalVariables } from "@foxglove-studio/app/hooks/useGlobalVariables";
import { usePreviousValue } from "@foxglove-studio/app/hooks/usePreviousValue";
import useLinkedGlobalVariables from "@foxglove-studio/app/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import { colors as sharedColors } from "@foxglove-studio/app/util/sharedStyleConstants";

// The minimum amount of time to wait between showing the global variable update animation again
export const ANIMATION_RESET_DELAY_MS = 3000;

// Returns an keyframe object that animates between two styles– "highlight twice then return to normal"
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const makeFlashAnimation = (initialCssProps: any, highlightCssProps: any) => {
  return css`
    ${keyframes`
      0%, 20%, 100% {
        ${initialCssProps}
      }
      10%, 30%, 80% {
        ${highlightCssProps}
      }
    `}
  `;
};

const SGlobalVariablesTable = styled.div`
  display: flex;
  flex-direction: column;
  white-space: nowrap;
  color: ${sharedColors.LIGHT};

  table {
    width: calc(100% + 1px);
  }

  thead {
    user-select: none;
    border-bottom: 1px solid ${sharedColors.BORDER_LIGHT};
  }

  th,
  td {
    line-height: 100%;
    border: none;
  }

  tr:first-child th {
    border: none;
    text-align: left;
    color: rgba(255, 255, 255, 0.6);
  }

  td {
    input {
      background: none !important;
      color: inherit;
      width: 100%;
      padding-left: 0;
      padding-right: 0;
      min-width: 0;
    }
    &:last-child {
      color: rgba(255, 255, 255, 0.6);
    }
  }
`;

const SIconWrapper = styled.span<{ isOpen?: boolean }>`
  display: inline-block;
  cursor: pointer;
  padding: 0;
  color: ${sharedColors.LIGHT};

  svg {
    opacity: ${({ isOpen = false }) => (isOpen ? 1 : undefined)};
  }
`;

const SLinkedTopicsSpan = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  direction: rtl;
  max-width: 240px;
  margin-left: -5px;
`;

const FlashRowAnimation = makeFlashAnimation(
  css`
    background: transparent;
  `,
  css`
    background: ${sharedColors.HIGHLIGHT_MUTED};
  `,
);

const AnimationDuration = 3;
const SAnimatedRow = styled.tr<{ animate: boolean; skipAnimation: any }>`
  background: transparent;
  animation: ${({ animate, skipAnimation }) =>
      animate && !skipAnimation ? FlashRowAnimation : "none"}
    ${AnimationDuration}s ease-in-out;
  animation-iteration-count: 1;
  animation-fill-mode: forwards;
  border-bottom: 1px solid ${sharedColors.BORDER_LIGHT};
`;

export function isActiveElementEditable(): boolean {
  const activeEl = document.activeElement;
  return (
    activeEl != undefined &&
    ((activeEl as HTMLElement).isContentEditable ||
      activeEl.tagName === "INPUT" ||
      activeEl.tagName === "TEXTAREA")
  );
}

const changeGlobalKey = (
  newKey: string,
  oldKey: string,
  globalVariables: any,
  idx: number,
  overwriteGlobalVariables: any,
) => {
  const keys = Object.keys(globalVariables);
  overwriteGlobalVariables({
    ...pick(globalVariables, keys.slice(0, idx)),
    [newKey]: globalVariables[oldKey],
    ...pick(globalVariables, keys.slice(idx + 1)),
  });
};

function LinkedGlobalVariableRow({ name }: { name: string }): ReactElement {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { globalVariables, setGlobalVariables } = useGlobalVariables();
  const { linkedGlobalVariables, setLinkedGlobalVariables } = useLinkedGlobalVariables();

  const linkedTopicPaths = useMemo(
    () =>
      linkedGlobalVariables
        .filter((variable: any) => variable.name === name)
        .map(({ topic, markerKeyPath }: any) => [topic, ...markerKeyPath].join(".")),
    [linkedGlobalVariables, name],
  );

  const unlink = useCallback(
    (path) => {
      setLinkedGlobalVariables(
        linkedGlobalVariables.filter(
          ({ name: varName, topic, markerKeyPath }: any) =>
            !(varName === name && [topic, ...markerKeyPath].join(".") === path),
        ),
      );
    },
    [linkedGlobalVariables, name, setLinkedGlobalVariables],
  );

  const unlinkAndDelete = useCallback(() => {
    const newLinkedGlobalVariables = linkedGlobalVariables.filter(
      ({ name: varName }: any) => varName !== name,
    );
    setLinkedGlobalVariables(newLinkedGlobalVariables);
    setGlobalVariables({ [name]: undefined });
  }, [linkedGlobalVariables, name, setGlobalVariables, setLinkedGlobalVariables]);

  const moreButton = useRef<HTMLElement>(ReactNull);

  return (
    <>
      <td>${name}</td>
      <td width="100%">
        <JSONInput
          value={JSON.stringify(globalVariables[name] ?? "")}
          onChange={(newVal) => setGlobalVariables({ [name]: newVal })}
        />
      </td>
      <td>
        <Flex center style={{ justifyContent: "space-between" }}>
          <Flex style={{ marginRight: 16 }}>
            {linkedTopicPaths.length > 1 && <span>({linkedTopicPaths.length})</span>}

            <Tooltip
              contents={
                linkedTopicPaths.length > 0 ? (
                  <>
                    <div style={{ fontWeight: "bold", opacity: 0.4 }}>
                      {linkedTopicPaths.length} LINKED TOPIC{linkedTopicPaths.length > 1 ? "S" : ""}
                    </div>
                    {linkedTopicPaths.map((path: any) => (
                      <div key={path} style={{ paddingTop: "5px" }}>
                        {path}
                      </div>
                    ))}
                  </>
                ) : undefined
              }
            >
              <SLinkedTopicsSpan>
                {linkedTopicPaths.length > 0 ? <bdi>{linkedTopicPaths.join(", ")}</bdi> : "--"}
              </SLinkedTopicsSpan>
            </Tooltip>
          </Flex>
          <IconButton
            elementRef={moreButton}
            iconProps={{ iconName: "MoreVertical" }}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen && (
              // use Callout instead of a menu on the button for now so that we can style the menu text
              <Callout target={moreButton} isBeakVisible={false} onDismiss={() => setIsOpen(false)}>
                <Menu style={{ padding: "4px 0px" }}>
                  {linkedTopicPaths.map((path: any) => (
                    <Item dataTest="unlink-path" key={path} onClick={() => unlink(path)}>
                      <span>
                        Remove <span style={{ color: sharedColors.LIGHT, opacity: 1 }}>{path}</span>
                      </span>
                    </Item>
                  ))}
                  <Item onClick={unlinkAndDelete}>Delete variable</Item>
                </Menu>
              </Callout>
            )}
          </IconButton>
        </Flex>
      </td>
    </>
  );
}

function GlobalVariablesTable(): ReactElement {
  const { globalVariables, setGlobalVariables, overwriteGlobalVariables } = useGlobalVariables();
  const { linkedGlobalVariablesByName } = useLinkedGlobalVariables();
  const globalVariableNames = useMemo(() => Object.keys(globalVariables), [globalVariables]);

  const [linked, unlinked] = useMemo(() => {
    return partition(globalVariableNames, (name) => !!linkedGlobalVariablesByName[name]);
  }, [globalVariableNames, linkedGlobalVariablesByName]);

  // Don't run the animation when the Table first renders
  const skipAnimation = useRef<boolean>(true);
  useEffect(() => {
    const timeoutId = setTimeout(() => (skipAnimation.current = false), ANIMATION_RESET_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, []);

  const previousGlobalVariables = usePreviousValue(globalVariables);
  const previousGlobalVariablesRef = useRef<GlobalVariables | undefined>(previousGlobalVariables);
  previousGlobalVariablesRef.current = previousGlobalVariables;

  const [changedVariables, setChangedVariables] = useState<string[]>([]);
  useEffect(() => {
    if (skipAnimation.current || isActiveElementEditable()) {
      return;
    }
    const newChangedVariables = union(
      Object.keys(globalVariables),
      Object.keys(previousGlobalVariablesRef.current ?? {}),
    ).filter((name) => {
      const previousValue = previousGlobalVariablesRef.current?.[name];
      return previousValue !== globalVariables[name];
    });

    setChangedVariables(newChangedVariables);
    const timerId = setTimeout(() => setChangedVariables([]), ANIMATION_RESET_DELAY_MS);
    return () => clearTimeout(timerId);
  }, [globalVariables, skipAnimation]);

  return (
    <SGlobalVariablesTable>
      <table>
        <thead>
          <tr>
            <th>Variable</th>
            <th>Value</th>
            <th>Topic(s)</th>
          </tr>
        </thead>
        <tbody>
          {linked.map((name, idx) => (
            <SAnimatedRow
              key={`linked-${idx}`}
              skipAnimation={skipAnimation.current}
              animate={changedVariables.includes(name)}
            >
              <LinkedGlobalVariableRow name={name} />
            </SAnimatedRow>
          ))}
          {unlinked.map((name, idx) => (
            <SAnimatedRow
              key={`unlinked-${idx}`}
              skipAnimation={skipAnimation}
              animate={changedVariables.includes(name)}
            >
              <td data-test="global-variable-key">
                <ValidatedResizingInput
                  value={name}
                  dataTest={`global-variable-key-input-${name}`}
                  onChange={(newKey) =>
                    changeGlobalKey(
                      newKey,
                      name,
                      globalVariables,
                      linked.length + idx,
                      overwriteGlobalVariables,
                    )
                  }
                  invalidInputs={without(globalVariableNames, name).concat("")}
                />
              </td>
              <td width="100%">
                <JSONInput
                  dataTest={`global-variable-value-input-${JSON.stringify(
                    globalVariables[name] ?? "",
                  )}`}
                  value={JSON.stringify(globalVariables[name] ?? "")}
                  onChange={(newVal) => setGlobalVariables({ [name]: newVal })}
                />
              </td>
              <td width="100%">
                <Flex center style={{ justifyContent: "space-between" }}>
                  --
                  <SIconWrapper onClick={() => setGlobalVariables({ [name]: undefined })}>
                    <Icon small>
                      <CloseIcon />
                    </Icon>
                  </SIconWrapper>
                </Flex>
              </td>
            </SAnimatedRow>
          ))}
        </tbody>
      </table>
      <Flex style={{ marginTop: 20 }}>
        <DefaultButton
          text="Add variable"
          disabled={globalVariables[""] != undefined}
          onClick={() => setGlobalVariables({ "": "" })}
        />
      </Flex>
    </SGlobalVariablesTable>
  );
}

export default GlobalVariablesTable;
