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

import MenuDownIcon from "@mdi/svg/svg/menu-down.svg";
import cx from "classnames";
import { flatten, flatMap, partition } from "lodash";

import * as PanelAPI from "@foxglove-studio/app/PanelAPI";
import Autocomplete from "@foxglove-studio/app/components/Autocomplete";
import Dropdown from "@foxglove-studio/app/components/Dropdown";
import Icon from "@foxglove-studio/app/components/Icon";
import Tooltip from "@foxglove-studio/app/components/Tooltip";
import useGlobalVariables, { GlobalVariables } from "@foxglove-studio/app/hooks/useGlobalVariables";
import { Topic } from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import { getTopicNames, getTopicsByTopicName } from "@foxglove-studio/app/util/selectors";
import { TimestampMethod } from "@foxglove-studio/app/util/time";

import styles from "./MessagePathInput.module.scss";
import { RosPath, RosPrimitive } from "./constants";
import {
  StructureTraversalResult,
  traverseStructure,
  messagePathStructures,
  messagePathsForDatatype,
  validTerminatingStructureItem,
} from "./messagePathsForDatatype";
import parseRosPath from "./parseRosPath";

// To show an input field with an autocomplete so the user can enter message paths, use:
//
//  <MessagePathInput path={this.state.path} onChange={path => this.setState({ path })} />
//
// To limit the autocomplete items to only certain types of values, you can use
//
//  <MessagePathInput types={["message", "array", "primitives"]} />
//
// Or use actual ROS primitive types:
//
//  <MessagePathInput types={["uint16", "float64"]} />
//
// If you don't use timestamps, you might want to hide the warning icon that we show when selecting
// a topic that has no header: `<MessagePathInput hideTimestampWarning>`.
//
// If you are rendering many input fields, you might want to use `<MessagePathInput index={5}>`,
// which gets passed down to `<MessagePathInput onChange>` as the second parameter, so you can
// avoid creating anonymous functions on every render (which will prevent the component from
// rendering unnecessarily).

function topicHasNoHeaderStamp(topic: Topic, datatypes: RosDatatypes): boolean {
  const structureTraversalResult = traverseStructure(
    messagePathStructures(datatypes)[topic.datatype],
    [
      { type: "name", name: "header" },
      { type: "name", name: "stamp" },
    ],
  );

  return (
    !structureTraversalResult.valid ||
    !validTerminatingStructureItem(structureTraversalResult.structureItem, ["time"])
  );
}

export function tryToSetDefaultGlobalVar(
  variableName: string,
  setGlobalVariables: (arg0: GlobalVariables) => void,
): boolean {
  const defaultGlobalVars = new Map<string, GlobalVariables>();
  const defaultVar = defaultGlobalVars.get(variableName);
  if (defaultVar) {
    setGlobalVariables({ [variableName]: defaultVar });
    return true;
  }
  return false;
}

export function getFirstInvalidVariableFromRosPath(
  rosPath: RosPath,
  globalVariables: GlobalVariables,
  setGlobalVariables: (arg0: GlobalVariables) => void,
): { variableName: string; loc: number } | undefined {
  const { messagePath } = rosPath;
  const globalVars = Object.keys(globalVariables);
  return flatMap(messagePath, (path) => {
    const messagePathParts = [];
    if (
      path.type === "filter" &&
      typeof path.value === "object" &&
      !globalVars.includes(path.value.variableName)
    ) {
      const [variableName, loc] = [path.value.variableName, path.valueLoc];
      messagePathParts.push({ variableName, loc });
    } else if (path.type === "slice") {
      if (typeof path.start === "object" && !globalVars.includes(path.start.variableName)) {
        const [variableName, loc] = [path.start.variableName, path.start.startLoc];
        messagePathParts.push({ variableName, loc });
      }
      if (
        path.end != undefined &&
        typeof path.end === "object" &&
        !globalVars.includes(path.end.variableName)
      ) {
        const [variableName, loc] = [path.end.variableName, path.end.startLoc];
        messagePathParts.push({ variableName, loc });
      }
    }
    return messagePathParts;
  }).filter(({ variableName }) => !tryToSetDefaultGlobalVar(variableName, setGlobalVariables))[0];
}

function getExamplePrimitive(primitiveType: RosPrimitive) {
  switch (primitiveType) {
    case "string":
      return '""';
    case "bool":
      return "true";
    case "float32":
    case "float64":
    case "uint8":
    case "uint16":
    case "uint32":
    case "uint64":
    case "int8":
    case "int16":
    case "int32":
    case "int64":
      return "0";
    case "duration":
    case "time":
    case "json":
      return "";
  }
}

type MessagePathInputBaseProps = {
  path: string; // A path of the form `/topic.some_field[:]{id==42}.x`
  index?: number; // Optional index field which gets passed to `onChange` (so you don't have to create anonymous functions)
  onChange: (value: string, index?: number) => void;
  validTypes?: string[]; // Valid types, like "message", "array", or "primitive", or a ROS primitive like "float64"
  noMultiSlices?: boolean; // Don't suggest slices with multiple values `[:]`, only single values like `[0]`.
  autoSize?: boolean;
  placeholder?: string;
  inputStyle?: any;
  disableAutocomplete?: boolean; // Treat this as a normal input, with no autocomplete.
  prioritizedDatatype?: string;

  timestampMethod?: TimestampMethod;
  onTimestampMethodChange?: (arg0: TimestampMethod, index?: number) => void;
};
type MessagePathInputProps = MessagePathInputBaseProps & {
  topics: readonly Topic[];
  datatypes: RosDatatypes;
  globalVariables: GlobalVariables;
  setGlobalVariables: (arg0: GlobalVariables) => void;
};
type MessagePathInputState = { focused: boolean };
class MessagePathInputUnconnected extends React.PureComponent<
  MessagePathInputProps,
  MessagePathInputState
> {
  _input?: HTMLInputElement;

  constructor(props: MessagePathInputProps) {
    super(props);
    this.state = { focused: false };
  }

  _onChange = (event: React.SyntheticEvent<HTMLInputElement>, value: string) => {
    // When typing a "{" character, also  insert a "}", so you get an
    // autocomplete window immediately for selecting a filter name.
    if ((event.nativeEvent as any).data === "{") {
      const newCursorPosition = (event.target as any).selectionEnd;
      value = `${value.slice(0, newCursorPosition)}}${value.slice(newCursorPosition)}`;

      const target = event.target;
      setImmediate(() => (target as any).setSelectionRange(newCursorPosition, newCursorPosition));
    }
    this.props.onChange(value, this.props.index);
  };

  _onTimestampMethodChange = (value: TimestampMethod) => {
    if (this.props.onTimestampMethodChange) {
      this.props.onTimestampMethodChange(value, this.props.index);
    }
  };

  _onSelect = (
    value: string,
    autocomplete: Autocomplete,
    autocompleteType: ("topicName" | "messagePath" | "globalVariables") | undefined,
    autocompleteRange: { start: number; end: number },
  ) => {
    // If we're dealing with a topic name, and we cannot validly end in a message type,
    // add a "." so the user can keep typing to autocomplete the message path.
    const keepGoingAfterTopicName =
      autocompleteType === "topicName" &&
      this.props.validTypes != undefined &&
      !this.props.validTypes.includes("message");
    if (keepGoingAfterTopicName) {
      value += ".";
    }
    this.props.onChange(
      this.props.path.substr(0, autocompleteRange.start) +
        value +
        this.props.path.substr(autocompleteRange.end),
      this.props.index,
    );
    // We want to continue typing if we're dealing with a topic name,
    // or if we just autocompleted something with a filter (because we might want to
    // edit that filter), or if the autocomplete already has a filter (because we might
    // have just autocompleted a name inside that filter).
    if (keepGoingAfterTopicName || value.includes("{") || this.props.path.includes("{")) {
      const newCursorPosition = autocompleteRange.start + value.length;
      setImmediate(() => autocomplete.setSelectionRange(newCursorPosition, newCursorPosition));
    } else {
      autocomplete.blur();
    }
  };

  render() {
    const {
      path,
      topics,
      datatypes,
      prioritizedDatatype,
      validTypes,
      autoSize,
      placeholder,
      noMultiSlices,
      timestampMethod,
      inputStyle,
      disableAutocomplete = false,
      globalVariables,
      setGlobalVariables,
    } = this.props;

    const rosPath = parseRosPath(path);
    let autocompleteType: ("topicName" | "messagePath" | "globalVariables") | undefined;
    let topic: Topic | undefined;
    let structureTraversalResult: StructureTraversalResult | undefined;
    if (rosPath) {
      const { topicName } = rosPath;
      topic = topics.find(({ name }) => name === topicName);

      if (topic) {
        structureTraversalResult = traverseStructure(
          messagePathStructures(datatypes)[topic.datatype],
          rosPath.messagePath,
        );
      }

      if (!topic) {
        autocompleteType = "topicName";
      } else if (
        !structureTraversalResult ||
        !structureTraversalResult.valid ||
        !validTerminatingStructureItem(structureTraversalResult.structureItem, validTypes)
      ) {
        autocompleteType = "messagePath";
      }
    } else {
      autocompleteType = "topicName";
    }

    let autocompleteItems = [];
    let autocompleteFilterText = "";
    let autocompleteRange = { start: 0, end: Infinity };
    if (disableAutocomplete) {
      autocompleteItems = [];
    } else if (autocompleteType === "topicName") {
      autocompleteItems = getTopicNames(topics);
      autocompleteFilterText = path;
    } else if (autocompleteType === "messagePath" && topic && rosPath) {
      if (
        structureTraversalResult &&
        !structureTraversalResult.valid &&
        structureTraversalResult.msgPathPart &&
        structureTraversalResult.msgPathPart.type === "filter" &&
        structureTraversalResult.structureItem &&
        structureTraversalResult.structureItem.structureType === "message"
      ) {
        const { msgPathPart } = structureTraversalResult;

        // Provide filter suggestions for primitive values, since they're the only kinds of values
        // that can be filtered on.
        // TODO: add support for nested paths to primitives, such as "/some_topic{foo.bar==3}".
        for (const name of Object.keys(structureTraversalResult.structureItem.nextByName)) {
          const item = structureTraversalResult.structureItem.nextByName[name];
          if (item?.structureType === "primitive") {
            autocompleteItems.push(`${name}==${getExamplePrimitive(item.primitiveType)}`);
          }
        }

        autocompleteFilterText = msgPathPart.path.join(".");
        autocompleteRange = {
          start: msgPathPart.nameLoc,
          end: msgPathPart.nameLoc + autocompleteFilterText.length,
        };
      } else {
        autocompleteItems = messagePathsForDatatype(
          topic.datatype,
          datatypes,
          validTypes,
          noMultiSlices,
          rosPath.messagePath,
        ).filter(
          // .header.seq is pretty useless but shows up everryyywhere.
          (msgPath) => msgPath !== "" && !msgPath.endsWith(".header.seq"),
        );

        // Exclude any initial filters ("/topic{foo=='bar'}") from the range that will be replaced
        // when the user chooses a new message path.
        let initialFilterLength = 0;
        for (const item of rosPath.messagePath) {
          if (item.type === "filter") {
            initialFilterLength += item.repr.length + 2; // add { and }
          } else {
            break;
          }
        }

        autocompleteRange = { start: topic.name.length + initialFilterLength, end: Infinity };
        // Filter out filters (hah!) in a pretty crude way, so autocomplete still works
        // when already having specified a filter and you want to see what other object
        // names you can complete it with. Kind of an edge case, and this doesn't work
        // ideally (because it will remove your existing filter if you actually select
        // the autocomplete item), but it's easy to do for now, and nice to have.
        autocompleteFilterText = path.substr(topic.name.length).replace(/\{[^}]*\}/g, "");
      }
    } else if (rosPath) {
      const invalidGlobalVariablesVariable = getFirstInvalidVariableFromRosPath(
        rosPath,
        globalVariables,
        setGlobalVariables,
      );

      if (invalidGlobalVariablesVariable) {
        autocompleteType = "globalVariables";
        autocompleteItems = Object.keys(globalVariables).map((key) => `$${key}`);
        autocompleteRange = {
          start: invalidGlobalVariablesVariable.loc,
          end:
            invalidGlobalVariablesVariable.loc +
            invalidGlobalVariablesVariable.variableName.length +
            1,
        };
        autocompleteFilterText = invalidGlobalVariablesVariable.variableName;
      }
    }

    const noHeaderStamp = topic ? topicHasNoHeaderStamp(topic, datatypes) : false;
    const orderedAutocompleteItems =
      prioritizedDatatype != undefined
        ? flatten(
            partition(
              autocompleteItems,
              (item) => getTopicsByTopicName(topics)[item]?.datatype === prioritizedDatatype,
            ),
          )
        : autocompleteItems;

    return (
      <div
        style={{ display: "flex", flex: "1 1 auto", minWidth: 0, justifyContent: "space-between" }}
      >
        <Autocomplete
          items={orderedAutocompleteItems}
          filterText={autocompleteFilterText}
          value={path}
          onChange={this._onChange}
          onSelect={(value: string, _item: unknown, autocomplete: Autocomplete) =>
            this._onSelect(value, autocomplete, autocompleteType, autocompleteRange)
          }
          hasError={autocompleteType != undefined && !disableAutocomplete && path.length > 0}
          autocompleteKey={autocompleteType}
          placeholder={
            placeholder != undefined && placeholder !== ""
              ? placeholder
              : "/some/topic.msgs[0].field"
          }
          autoSize={autoSize}
          inputStyle={inputStyle} // Disable autoselect since people often construct complex queries, and it's very annoying
          // to have the entire input selected whenever you want to make a change to a part it.
          disableAutoSelect
        />

        {timestampMethod != undefined && (
          <div className={styles.timestampMethodDropdownContainer}>
            <Dropdown
              onChange={this._onTimestampMethodChange}
              value={timestampMethod}
              toggleComponent={
                <Tooltip contents="Timestamp used for x-axis" placement="top">
                  <div
                    className={cx({
                      [styles.timestampMethodDropdown!]: true,
                      [styles.timestampMethodDropdownError!]:
                        timestampMethod === "headerStamp" && noHeaderStamp,
                    })}
                  >
                    {timestampMethod === "receiveTime" ? "(receive time)" : "(header.stamp)"}
                    <Icon style={{ position: "relative", top: 2, marginLeft: 2 }}>
                      <MenuDownIcon />
                    </Icon>
                  </div>
                </Tooltip>
              }
            >
              <Tooltip
                {
                  ...{
                    value: "receiveTime",
                  }
                  // weird spread syntax used to overcome error with "value" property.
                  // "value" is needed for Dropdown but does not exist on Tooltip
                }
                placement="right"
                contents="ROS-time at which the message was received and recorded"
              >
                <span>receive time</span>
              </Tooltip>
              <Tooltip
                {
                  ...{
                    value: "headerStamp",
                  }
                  // weird spread syntax used to overcome error with "value" property.
                  // "value" is needed for Dropdown but does not exist on Tooltip
                }
                placement="bottom"
                contents={
                  <div style={{ maxWidth: 200, lineHeight: "normal" }}>
                    Value of the header.stamp field. Can mean different things for different topics.
                    Be sure you know what this value means before using it.
                    {noHeaderStamp && (
                      <div className={styles.timestampItemError}>
                        (header.stamp is not present in this topic)
                      </div>
                    )}
                  </div>
                }
              >
                <span
                  className={cx({
                    [styles.timestampItemError!]: noHeaderStamp,
                  })}
                >
                  header.stamp
                </span>
              </Tooltip>
            </Dropdown>
          </div>
        )}
      </div>
    );
  }
}

export default React.memo<MessagePathInputBaseProps>(function MessagePathInput(
  props: MessagePathInputBaseProps,
) {
  const { globalVariables, setGlobalVariables } = useGlobalVariables();
  const { datatypes, topics } = PanelAPI.useDataSourceInfo();
  return (
    <MessagePathInputUnconnected
      {...props}
      topics={topics}
      datatypes={datatypes}
      globalVariables={globalVariables}
      setGlobalVariables={setGlobalVariables}
    />
  );
});
