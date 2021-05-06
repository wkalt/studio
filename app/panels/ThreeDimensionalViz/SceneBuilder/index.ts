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
import _, { flatten, groupBy, isEqual, keyBy, mapValues, some, xor } from "lodash";
import { Time } from "rosbag";
import shallowequal from "shallowequal";

import { GlobalVariables } from "@foxglove-studio/app/hooks/useGlobalVariables";
import MessageCollector from "@foxglove-studio/app/panels/ThreeDimensionalViz/SceneBuilder/MessageCollector";
import { MarkerMatcher } from "@foxglove-studio/app/panels/ThreeDimensionalViz/ThreeDimensionalVizContext";
import Transforms from "@foxglove-studio/app/panels/ThreeDimensionalViz/Transforms";
import VelodyneCloudConverter from "@foxglove-studio/app/panels/ThreeDimensionalViz/VelodyneCloudConverter";
import { Topic, Frame, MessageEvent } from "@foxglove-studio/app/players/types";
import {
  Color,
  Marker,
  Namespace,
  NavMsgs$OccupancyGrid,
  NavMsgs$Path,
  MutablePose,
  Pose,
  StampedMessage,
  MutablePoint,
  BaseMarker,
  PoseStamped,
  VelodyneScan,
  GeometryMsgs$PolygonStamped,
} from "@foxglove-studio/app/types/Messages";
import { MarkerProvider, MarkerCollector, Scene } from "@foxglove-studio/app/types/Scene";
import Bounds from "@foxglove-studio/app/util/Bounds";
import { emptyPose } from "@foxglove-studio/app/util/Pose";
import {
  POSE_MARKER_SCALE,
  LINED_CONVEX_HULL_RENDERING_SETTING,
  MARKER_ARRAY_DATATYPES,
  STUDIO_MARKER_DATATYPE,
  STUDIO_MARKER_ARRAY_DATATYPE,
  VISUALIZATION_MSGS_MARKER_DATATYPE,
  VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE,
  POSE_STAMPED_DATATYPE,
  NAV_MSGS_OCCUPANCY_GRID_DATATYPE,
  NAV_MSGS_PATH_DATATYPE,
  POINT_CLOUD_DATATYPE,
  VELODYNE_SCAN_DATATYPE,
  COLOR_RGBA_DATATYPE,
  SENSOR_MSGS_LASER_SCAN_DATATYPE,
  GEOMETRY_MSGS_POLYGON_STAMPED_DATATYPE,
} from "@foxglove-studio/app/util/globalConstants";
import naturalSort from "@foxglove-studio/app/util/naturalSort";
import sendNotification from "@foxglove-studio/app/util/sendNotification";
import { fromSec } from "@foxglove-studio/app/util/time";

import { ThreeDimensionalVizHooks } from "./types";

export type TopicSettingsCollection = {
  [topicOrNamespaceKey: string]: any;
};

// builds a syntehtic arrow marker from a geometry_msgs/PoseStamped
// these pose sizes were manually configured in rviz; for now we hard-code them here
const buildSyntheticArrowMarker = (
  { topic, message }: MessageEvent<unknown>,
  pose: Pose,
  getSyntheticArrowMarkerColor: (arg0: string) => Color,
) => ({
  type: 103,
  pose,
  scale: POSE_MARKER_SCALE,
  color: getSyntheticArrowMarkerColor(topic),
  interactionData: { topic, originalMessage: message },
});

// TODO(JP): looks like we might not actually use these fields in the new topic picker?
export type ErrorDetails = { frameIds: Set<string>; namespaces: Set<string> };

export type SceneErrors = {
  topicsMissingFrameIds: Map<string, ErrorDetails>;
  topicsMissingTransforms: Map<string, ErrorDetails>;
  topicsWithBadFrameIds: Map<string, ErrorDetails>;
  topicsWithError: Map<string, string>;
  rootTransformID: string;
};

type SceneErrorTopics = {
  topicsWithBadFrameIds: Set<string>;
};

type SelectedNamespacesByTopic = {
  [topicName: string]: string[];
};
// constructs a scene containing all objects to be rendered
// by consuming visualization topics from frames

type MarkerMatchersByTopic = {
  [key: string]: Array<MarkerMatcher>;
};

const missingTransformMessage = (
  rootTransformId: string,
  error: ErrorDetails,
  transforms: Transforms,
): string => {
  const frameIds = [...error.frameIds].sort().join(",");
  const s = error.frameIds.size === 1 ? "" : "s"; // for plural
  const msg =
    frameIds.length > 0
      ? `missing transforms from frame${s} <${frameIds}> to root frame <${rootTransformId}>`
      : `missing transform <${rootTransformId}>`;
  if (transforms.empty) {
    return msg + ". No transforms found";
  }
  return msg;
};

export function getSceneErrorsByTopic(
  sceneErrors: SceneErrors,
  transforms: Transforms,
): {
  [topicName: string]: string[];
} {
  const res: any = {};
  const addError = (topic: any, message: any) => {
    if (!res[topic]) {
      res[topic] = [];
    }
    res[topic].push(message);
  };
  // generic errors
  for (const [topic, message] of sceneErrors.topicsWithError) {
    addError(topic, message);
  }
  // errors related to missing frame ids and transform ids
  sceneErrors.topicsMissingTransforms.forEach((err, topic) => {
    addError(topic, missingTransformMessage(sceneErrors.rootTransformID, err, transforms));
  });
  sceneErrors.topicsMissingFrameIds.forEach((_err, topic) => {
    addError(topic, "missing frame id");
  });
  return res;
}

// Only display one non-lifetime message at a time, so we filter to the last one.
export function filterOutSupersededMessages<T extends Pick<MessageEvent<unknown>, "message">>(
  messages: T[],
  datatype: string,
): T[] {
  // Later messages take precedence over earlier messages, so iterate from latest to earliest to
  // find the last one that matters.
  const reversedMessages = messages.slice().reverse();
  if (MARKER_ARRAY_DATATYPES.includes(datatype)) {
    // Many marker arrays begin with a command to "delete all markers on this topic". If we see
    // this, we can ignore any earlier messages on the topic.
    const earliestMessageToKeepIndex = reversedMessages.findIndex(({ message }: any) => {
      const markers = message.markers ?? message.allMarkers;
      return markers[0]?.action === 3;
    });
    if (earliestMessageToKeepIndex !== -1) {
      return reversedMessages.slice(0, earliestMessageToKeepIndex + 1).reverse();
    }
    return messages;
  }
  const filteredMessages = [];
  let hasSeenNonLifetimeMessage = false;
  for (const message of reversedMessages) {
    const hasLifetime = !!(message.message as any).lifetime;
    if (hasLifetime) {
      // Show all messages that have a lifetime.
      filteredMessages.unshift(message);
    } else if (!hasSeenNonLifetimeMessage) {
      // Only show the last non-lifetime message.
      filteredMessages.unshift(message);
      hasSeenNonLifetimeMessage = true;
    }
  }
  return filteredMessages;
}

export default class SceneBuilder implements MarkerProvider {
  topicsByName: {
    [topicName: string]: Topic;
  } = {};
  markers: Marker[] = [];
  transforms?: Transforms;
  rootTransformID?: string;
  selectionState: any = {};
  frame?: Frame;
  // TODO(JP): Get rid of these two different variables `errors` and `errorsByTopic` which we
  // have to keep in sync.
  errors: SceneErrors = {
    rootTransformID: "",
    topicsMissingFrameIds: new Map(),
    topicsMissingTransforms: new Map(),
    topicsWithBadFrameIds: new Map(),
    topicsWithError: new Map(),
  };
  errorsByTopic: {
    [topicName: string]: string[];
  } = {};
  reportedErrorTopics: SceneErrorTopics = {
    topicsWithBadFrameIds: new Set(),
  };
  maps = [];
  flattenedZHeightPose?: Pose;
  scene = {};
  collectors: {
    [key: string]: MessageCollector;
  } = {};
  _clock?: Time;
  _playerId?: string;
  _settingsByKey: TopicSettingsCollection = {};
  _onForceUpdate?: () => void;

  // When not-empty, fade any markers that don't match
  _highlightMarkerMatchersByTopic: MarkerMatchersByTopic = {};

  // When not-empty, override the color of matching markers
  _colorOverrideMarkerMatchersByTopic: MarkerMatchersByTopic = {};

  _hooks: ThreeDimensionalVizHooks;

  // Decodes `velodyne_msgs/VelodyneScan` ROS messages into
  // `VelodyneScanDecoded` objects that mimic `PointCloud2` and can be rendered
  // as point clouds
  _velodyneCloudConverter = new VelodyneCloudConverter();

  allNamespaces: Namespace[] = [];
  // TODO(Audrey): remove enabledNamespaces once we release topic groups
  enabledNamespaces: Namespace[] = [];
  selectedNamespacesByTopic?: { [topicName: string]: Set<string> };
  flatten: boolean = false;
  bounds: Bounds = new Bounds();

  // list of topics that need to be rerendered because the frame has new values
  // or because a prop affecting its rendering was changed
  topicsToRender: Set<string> = new Set();

  // stored message arrays allowing used to re-render topics even when the latest
  // frame does not not contain that topic
  lastSeenMessages: {
    [key: string]: MessageEvent<unknown>[];
  } = {};

  constructor(hooks: ThreeDimensionalVizHooks) {
    this._hooks = hooks;
  }

  setTransforms = (transforms: Transforms, rootTransformID: string): void => {
    this.transforms = transforms;
    this.rootTransformID = rootTransformID;
    this.errors.rootTransformID = rootTransformID;
  };

  clear(): void {
    for (const topicName of Object.keys(this.topicsByName)) {
      const collector = this.collectors[topicName];
      if (collector) {
        collector.flush();
      }
    }
  }

  setPlayerId(playerId: string): void {
    if (this._playerId !== playerId) {
      this.reportedErrorTopics.topicsWithBadFrameIds.clear();
      this.errors = {
        rootTransformID: "",
        topicsMissingFrameIds: new Map(),
        topicsMissingTransforms: new Map(),
        topicsWithBadFrameIds: new Map(),
        topicsWithError: new Map(),
      };
      this._updateErrorsByTopic();
    }
    this._playerId = playerId;
  }

  setSettingsByKey(settings: TopicSettingsCollection): void {
    this._settingsByKey = settings;
  }

  // set the topics the scene builder should consume from each frame
  setTopics(topics: Topic[]): void {
    const topicsToFlush = Object.keys(this.topicsByName).filter(
      (topicName) => !topics.find((other) => other.name === topicName),
    );
    // Sort the topics by name so the render order is consistent.
    this.topicsByName = keyBy(topics.slice().sort(naturalSort("name")), "name");
    // IMPORTANT: when topics change, we also need to reset the frame so that
    // setFrame gets called correctly to set the topicsToRender and lastSeenMessages
    this.frame = {};
    // Delete message collectors we don't need anymore
    topicsToFlush.forEach((topicName) => {
      const collector = this.collectors[topicName];
      if (collector) {
        collector.flush();
        delete this.collectors[topicName];
      }
    });
  }

  setFrame(frame: Frame): void {
    if (this.frame === frame) {
      return;
    }
    this.frame = frame;
    for (const topicName of Object.keys(this.topicsByName)) {
      if (topicName in frame) {
        this.topicsToRender.add(topicName);
      }
    }

    // Note we save even topics that are not rendered since they may be used by non-rendered topics
    Object.assign(this.lastSeenMessages, frame);
  }

  setFlattenMarkers(_flatten: boolean): void {
    this.flatten = _flatten;
  }

  setEnabledNamespaces(namespaces: Namespace[]): void {
    this.enabledNamespaces = namespaces;
  }

  setSelectedNamespacesByTopic(selectedNamespacesByTopic: SelectedNamespacesByTopic): void {
    // We need to update topicsToRender here so changes to the selected namespaces will appear on the next render()
    Object.keys(selectedNamespacesByTopic).forEach((topicName) => {
      const newNamespaces = selectedNamespacesByTopic[topicName];
      const previousNamespaces = [...(this.selectedNamespacesByTopic?.[topicName] ?? [])];
      if (xor(newNamespaces, previousNamespaces).length > 0) {
        this._markTopicToRender(topicName);
      }
    });
    this.selectedNamespacesByTopic = mapValues(
      selectedNamespacesByTopic,
      (namespaces) => new Set(namespaces),
    );
  }

  setGlobalVariables = ({ globalVariables }: { globalVariables: GlobalVariables }): void => {
    const { getSelectionState, getTopicsToRender } = this._hooks;
    const prevSelectionState = this.selectionState;
    this.selectionState = getSelectionState(globalVariables);

    // Because setSelectedNamespacesByTopic is called before setGlobalVariables,
    // we need to add the topics here instead of overwriting them.
    const updatedTopics = getTopicsToRender(prevSelectionState, this.selectionState);
    updatedTopics.forEach((topicName) => this._markTopicToRender(topicName));
  };

  setHighlightedMatchers(markerMatchers: Array<MarkerMatcher>): void {
    const markerMatchersByTopic = groupBy<MarkerMatcher>(markerMatchers, ({ topic }) => topic);
    this._addTopicsToRenderForMarkerMatchers(this._highlightMarkerMatchersByTopic, markerMatchers);
    this._highlightMarkerMatchersByTopic = markerMatchersByTopic;
  }

  setColorOverrideMatchers(markerMatchers: Array<MarkerMatcher>): void {
    const markerMatchersByTopic = groupBy<MarkerMatcher>(markerMatchers, ({ topic }) => topic);
    this._addTopicsToRenderForMarkerMatchers(
      this._colorOverrideMarkerMatchersByTopic,
      markerMatchers,
    );
    this._colorOverrideMarkerMatchersByTopic = markerMatchersByTopic;
  }

  _addTopicsToRenderForMarkerMatchers(
    previousMarkerMatchersByTopic: MarkerMatchersByTopic,
    newMarkerMatchers: Array<MarkerMatcher>,
  ): void {
    const matchersBefore = flatten(Object.keys(previousMarkerMatchersByTopic)).flatMap(
      (topic) => previousMarkerMatchersByTopic[topic],
    );
    // If any of the matchers have changed, we need to rerender all of the topics
    if (!shallowequal(matchersBefore, newMarkerMatchers)) {
      Object.keys(this.topicsByName).forEach((name) => this._markTopicToRender(name));
    }
  }

  _markTopicToRender(topicName: string): void {
    if (this.topicsByName[topicName]) {
      this.topicsToRender.add(topicName);
    }
  }

  hasErrors(): boolean {
    const {
      topicsMissingFrameIds,
      topicsMissingTransforms,
      topicsWithBadFrameIds,
      topicsWithError,
    } = this.errors;
    return (
      topicsMissingFrameIds.size !== 0 ||
      topicsMissingTransforms.size !== 0 ||
      topicsWithBadFrameIds.size !== 0 ||
      topicsWithError.size !== 0
    );
  }

  setOnForceUpdate(callback: () => void): void {
    this._onForceUpdate = callback;
  }

  _addError(map: Map<string, ErrorDetails>, topic: string): ErrorDetails {
    let values = map.get(topic);
    if (!values) {
      values = { namespaces: new Set(), frameIds: new Set() };
      map.set(topic, values);
    }
    this._updateErrorsByTopic();
    return values;
  }

  _setTopicError = (topic: string, message: string): void => {
    this.errors.topicsWithError.set(topic, message);
    this._updateErrorsByTopic();
  };

  // Update the field anytime the errors change in order to generate a new object to trigger TopicTree to rerender.
  _updateErrorsByTopic(): void {
    if (!this.transforms) {
      return;
    }

    const errorsByTopic = getSceneErrorsByTopic(this.errors, this.transforms);
    if (!isEqual(this.errorsByTopic, errorsByTopic)) {
      this.errorsByTopic = errorsByTopic;
      if (this._onForceUpdate) {
        this._onForceUpdate();
      }
    }
  }

  // keep a unique set of all seen namespaces
  _consumeNamespace(topic: string, name: string): void {
    if (some(this.allNamespaces, (ns) => ns.topic === topic && ns.name === name)) {
      return;
    }
    this.allNamespaces = this.allNamespaces.concat([{ topic, name }]);
    if (this._onForceUpdate) {
      this._onForceUpdate();
    }
  }

  // Only public for tests.
  namespaceIsEnabled(topic: string, name: string): boolean {
    if (this.selectedNamespacesByTopic) {
      // enable all namespaces under a topic if it's not already set
      return this.selectedNamespacesByTopic[topic]?.has(name) ?? true;
    }
    return some(this.enabledNamespaces, (ns) => ns.topic === topic && ns.name === name);
  }

  _reportBadFrameId(topic: string): void {
    if (!this.reportedErrorTopics.topicsWithBadFrameIds.has(topic)) {
      this.reportedErrorTopics.topicsWithBadFrameIds.add(topic);
      sendNotification(
        `Topic ${topic} has bad frame`,
        "Non-root transforms may be out of sync, since Studio uses the latest transform message instead of the one matching header.stamp",
        "user",
        "warn",
      );
    }
  }

  _transformMarkerPose = (topic: string, marker: BaseMarker): MutablePose | undefined => {
    const frame_id = marker.header.frame_id;

    if (frame_id.length === 0) {
      const error = this._addError(this.errors.topicsMissingFrameIds, topic);
      error.namespaces.add(marker.ns);
      return undefined;
    }

    if (frame_id === this.rootTransformID) {
      // Transforming is a bit expensive, and this (no transformation necessary) is the common-case
      // TODO: Need to deep-clone, callers mutate the result; fix this downstream.
      return marker.pose;
    }

    // frame_id !== this.rootTransformID.
    // We continue to render these, though they may be inaccurate
    this._reportBadFrameId(topic);
    const badFrameError = this._addError(this.errors.topicsWithBadFrameIds, topic);
    const namespace = marker.ns;
    badFrameError.namespaces.add(namespace);
    badFrameError.frameIds.add(frame_id);

    const pose = (this.transforms as Transforms).apply(
      emptyPose(),
      marker.pose,
      frame_id,
      this.rootTransformID as string,
    );
    if (!pose) {
      const topicMissingError = this._addError(this.errors.topicsMissingTransforms, topic);
      topicMissingError.namespaces.add(namespace);
      topicMissingError.frameIds.add(frame_id);
    }
    return pose;
  };

  private _consumeMarkerArray = (topic: string, message: any): void => {
    for (const marker of message.markers) {
      this._consumeMarker(topic, marker);
    }
  };

  _consumeMarker(topic: string, message: BaseMarker): void {
    const namespace = message.ns;
    if (namespace.length > 0) {
      // Consume namespaces even if the message is later discarded
      // Otherwise, the namespace won't be shown as available.
      this._consumeNamespace(topic, namespace);
      if (!this.namespaceIsEnabled(topic, namespace)) {
        return;
      }
    }

    // Marker names are used to identify previously rendered markers for "deletes" and over-writing
    // "adds".
    // In each topic, the namespace (`ns`) and identifier (`id`) uniquely identify the marker.
    // See https://github.com/ros-visualization/rviz/blob/4b6c0f4/src/rviz/default_plugin/markers/marker_base.h#L56
    // and https://github.com/ros-visualization/rviz/blob/4b6c0f4/src/rviz/default_plugin/marker_display.cpp#L422
    const name = `${topic}/${namespace}/${message.id}`;
    switch (message.action) {
      case 0:
        // add
        break;
      case 1:
        // deprecated in ros
        this._setTopicError(topic, "Marker.action=1 is deprecated");

        return;
      case 2:
        // delete
        this.collectors[topic]!.deleteMarker(name);
        return;
      case 3:
        this.collectors[topic]!.deleteAll();
        return;
      default:
        this._setTopicError(topic, `Unsupported action type: ${message.action}`);

        return;
    }

    const pose = this._transformMarkerPose(topic, message);
    if (!pose) {
      return;
    }

    const points = (message as any).points as MutablePoint[];
    const { position } = pose;

    let minZ = Number.MAX_SAFE_INTEGER;

    const parsedPoints = [];
    // if the marker has points, adjust bounds by the points. (Constructed markers sometimes don't
    // have points.)
    if (points.length > 0) {
      for (const point of points) {
        const x = point.x;
        const y = point.y;
        const z = point.z;
        minZ = Math.min(minZ, point.z);
        const transformedPoint = { x: x + position.x, y: y + position.y, z: z + position.z };
        this.bounds.update(transformedPoint);
        parsedPoints.push({ x, y, z });
      }
    } else {
      // otherwise just adjust by the pose
      minZ = Math.min(minZ, position.z);
      this.bounds.update(position);
    }

    // if the minimum z value of any point (or the pose) is exactly 0
    // then assume this marker can be flattened
    if (minZ === 0 && this.flatten && this.flattenedZHeightPose) {
      position.z = this.flattenedZHeightPose.position.z;
    }

    // HACK(jacob): rather than hard-coding this, we should
    //  (a) produce this visualization dynamically from a non-marker topic
    //  (b) fix translucency so it looks correct (harder)
    const color = this._hooks.getMarkerColor(topic, message.color as any);

    // Allow topic settings to override marker color (see MarkerSettingsEditor.js)
    let { overrideColor } =
      this._settingsByKey[`ns:${topic}:${namespace}`] || this._settingsByKey[`t:${topic}`] || {};

    // Check for matching colorOverrideMarkerMatchers for this topic
    const colorOverrideMarkerMatchers = this._colorOverrideMarkerMatchersByTopic[topic] ?? [];
    const matchingMatcher = colorOverrideMarkerMatchers.find(({ checks = [] }) =>
      checks.every(({ markerKeyPath = [], value }) => {
        // Get the item at the key path
        const markerValue = markerKeyPath.reduce(
          (item: any, key) => item?.[key] && item[key](),
          message as any,
        );
        return value === markerValue;
      }),
    );
    if (matchingMatcher) {
      overrideColor = matchingMatcher.color;
    }

    // Set later in renderMarkers so it be applied to markers generated in _consumeNonMarkerMessage
    const highlighted = false;
    const interactionData = {
      topic,
      highlighted,
      originalMessage: message,
    };
    const lifetime = message.lifetime;

    // This "marker-ish" thing is an unholy union of many drawable types...
    const marker: any = {
      type: (message as any).type,
      scale: message.scale,
      lifetime: lifetime,
      pose,
      interactionData,
      color: overrideColor || color,
      colors: overrideColor ? [] : message.colors,
      points: parsedPoints,
      id: message.id,
      ns: message.ns,
      header: message.header,
      action: message.action,
    };
    // Marker fields
    if ("text" in message) {
      marker.text = message.text;
    }
    // InstancedLineList fields. Check some fields, some fixtures do not include them all.
    if ("metadataByIndex" in message) {
      marker.poses = (message as any).poses;
      marker.metadataByIndex = (message as any).metadataByIndex;
      marker.closed = (message as any).closed;
    }
    this.collectors[topic]!.addMarker(marker, name);
  }

  _consumeOccupancyGrid = (topic: string, message: NavMsgs$OccupancyGrid): void => {
    const { frame_id } = message.header;

    if (frame_id.length === 0) {
      this._addError(this.errors.topicsMissingFrameIds, topic);
      return;
    }

    if (frame_id !== this.rootTransformID) {
      this._reportBadFrameId(topic);
      const error = this._addError(this.errors.topicsWithBadFrameIds, topic);
      error.frameIds.add(frame_id);
    }

    let pose: MutablePose | undefined = emptyPose();
    if (this.transforms) {
      if (this.rootTransformID === undefined) {
        throw new Error("missing rootTransformId");
      }
      pose = this.transforms.apply(pose, pose, frame_id, this.rootTransformID);
    }
    if (!pose) {
      const error = this._addError(this.errors.topicsMissingTransforms, topic);
      error.frameIds.add(frame_id);
      return;
    }

    const type = 101;
    const name = `${topic}/${type}`;

    // set ogrid texture & alpha based on current rviz settings
    // in the future these will be customizable via the UI
    const [alpha, map] = this._hooks.getOccupancyGridValues(topic);

    const mappedMessage = {
      ...message,
      alpha,
      map,
      type,
      name,
      pose,
      interactionData: { topic, originalMessage: message },
    };

    // if we neeed to flatten the ogrid clone the position and change the z to match the flattenedZHeightPose
    if (mappedMessage.info.origin.position.z === 0 && this.flattenedZHeightPose && this.flatten) {
      const originalInfo = mappedMessage.info;
      const originalPosition = originalInfo.origin.position;
      mappedMessage.info = {
        ...originalInfo,
        origin: {
          ...originalInfo.origin,
          position: { ...originalPosition, z: this.flattenedZHeightPose.position.z },
        },
      };
    }
    (this.collectors[topic] as any).addNonMarker(topic, mappedMessage);
  };

  _consumeColor = (msg: MessageEvent<Color>): void => {
    const color = msg.message;
    if (color.r == undefined || color.g == undefined || color.b == undefined) {
      return;
    }
    const newMessage: StampedMessage & { color: Color } = {
      header: { frame_id: "", stamp: msg.receiveTime, seq: 0 },
      color: { r: color.r / 255, g: color.g / 255, b: color.b / 255, a: color.a ?? 1 },
    };
    this._consumeNonMarkerMessage(msg.topic, newMessage, 110);
  };

  private _consumeNonMarkerMessage = (
    topic: string,
    drawData: StampedMessage,
    type: number,
    originalMessage?: any,
  ): void => {
    const sourcePose = emptyPose();
    let pose = this.transforms?.apply(
      sourcePose,
      sourcePose,
      drawData.header.frame_id,
      this.rootTransformID as any,
    );
    if (!pose) {
      // Don't error on frame_id="", interpret it as an identity transform
      if (drawData.header.frame_id.length > 0) {
        const error = this._addError(this.errors.topicsMissingTransforms, topic);
        error.frameIds.add(drawData.header.frame_id);
        return;
      }
      pose = sourcePose;
    }

    // some callers of _consumeNonMarkerMessage provide LazyMessages and others provide regular objects
    const obj = (("toJSON" in drawData) as any) ? (drawData as any).toJSON() : drawData;
    const mappedMessage = {
      ...obj,
      type,
      pose,
      interactionData: { topic, originalMessage: originalMessage ?? drawData },
    };

    // If a decay time is available, we assign a lifetime to this message
    // Do not automatically assign a 0 (zero) decay time since that translates
    // to an infinite lifetime. But do allow for 0 values based on user preferences.
    const decayTimeInSec = this._settingsByKey[`t:${topic}`]?.decayTime;
    const lifetime = decayTimeInSec ? fromSec(decayTimeInSec) : undefined;
    (<MessageCollector>this.collectors[topic]).addNonMarker(topic, mappedMessage, lifetime);
  };

  setCurrentTime = (currentTime: { sec: number; nsec: number }): void => {
    this.bounds.reset();

    this._clock = currentTime;
    // set the new clock value in all existing collectors
    // including those for topics not included in this frame,
    // so each can expire markers if they need to
    for (const collector of Object.values(this.collectors)) {
      collector.setClock(this._clock);
    }
  };

  // extracts renderable markers from the ros frame
  render(): void {
    this.flattenedZHeightPose =
      this._hooks.getFlattenedPose(this.frame as any) ?? this.flattenedZHeightPose;

    if (this.flattenedZHeightPose?.position) {
      this.bounds.update(this.flattenedZHeightPose.position);
    }
    for (const topic of this.topicsToRender) {
      try {
        this._consumeTopic(topic);
      } catch (error) {
        this._setTopicError(topic, error.toString());
      }
    }
    this.topicsToRender.clear();
  }

  _consumeMessage = (topic: string, datatype: string, msg: MessageEvent<unknown>): void => {
    const { message } = msg;
    switch (datatype) {
      case STUDIO_MARKER_DATATYPE:
      case VISUALIZATION_MSGS_MARKER_DATATYPE:
        this._consumeMarker(topic, message as BaseMarker);

        break;
      case STUDIO_MARKER_ARRAY_DATATYPE:
      case VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE:
        this._consumeMarkerArray(topic, message);

        break;
      case POSE_STAMPED_DATATYPE: {
        // make synthetic arrow marker from the stamped pose
        const pose = (msg.message as PoseStamped).pose;
        (this.collectors[topic] as any).addNonMarker(
          topic,
          buildSyntheticArrowMarker(msg, pose, this._hooks.getSyntheticArrowMarkerColor),
        );
        break;
      }
      case NAV_MSGS_OCCUPANCY_GRID_DATATYPE:
        // flatten btn: set empty z values to be at the same level as the flattenedZHeightPose
        this._consumeOccupancyGrid(topic, message as NavMsgs$OccupancyGrid);

        break;
      case NAV_MSGS_PATH_DATATYPE: {
        const topicSettings = this._settingsByKey[`t:${topic}`];

        const pathStamped = message as NavMsgs$Path;
        if (pathStamped.poses.length === 0) {
          break;
        }
        const newMessage = {
          header: pathStamped.header,
          // Future: display orientation of the poses in the path
          points: pathStamped.poses.map((pose: any) => pose.pose.position),
          closed: false,
          scale: { x: 0.2 },
          color: topicSettings?.overrideColor ?? { r: 0.5, g: 0.5, b: 1, a: 1 },
        };
        this._consumeNonMarkerMessage(topic, newMessage, 4 /* line strip */, message);
        break;
      }
      case POINT_CLOUD_DATATYPE:
        this._consumeNonMarkerMessage(topic, message as StampedMessage, 102);
        break;
      case VELODYNE_SCAN_DATATYPE: {
        const converted = this._velodyneCloudConverter.decode(message as VelodyneScan);
        if (converted) {
          this._consumeNonMarkerMessage(topic, converted, 102);
        }
        break;
      }
      case SENSOR_MSGS_LASER_SCAN_DATATYPE:
        this._consumeNonMarkerMessage(topic, message as StampedMessage, 104);
        break;
      case COLOR_RGBA_DATATYPE:
        this._consumeColor(msg as MessageEvent<Color>);
        break;
      case GEOMETRY_MSGS_POLYGON_STAMPED_DATATYPE: {
        // convert Polygon to a line strip
        const polygonStamped = message as GeometryMsgs$PolygonStamped;
        const polygon = polygonStamped.polygon;
        if (polygon.points.length === 0) {
          break;
        }
        const newMessage = {
          header: polygonStamped.header,
          points: polygon.points,
          closed: true,
          scale: { x: 0.2 },
          color: { r: 0, g: 1, b: 0, a: 1 },
        };
        this._consumeNonMarkerMessage(
          topic,
          newMessage,
          4,
          /* line strip */
          message,
        );
        break;
      }
      default: {
        if (datatype.endsWith("/Color") || datatype.endsWith("/ColorRGBA")) {
          this._consumeColor(msg as MessageEvent<Color>);
          break;
        }
      }
    }
  };

  private _consumeTopic = (topic: string) => {
    if (!this.frame) {
      return;
    }
    const messages = this.frame[topic] ?? this.lastSeenMessages[topic];
    if (!messages) {
      return;
    }

    this.errors.topicsMissingFrameIds.delete(topic);
    this.errors.topicsMissingTransforms.delete(topic);
    this.errors.topicsWithBadFrameIds.delete(topic);
    this.errors.topicsWithError.delete(topic);
    this.collectors[topic] ??= new MessageCollector();
    (<MessageCollector>this.collectors[topic]).setClock(this._clock ?? { sec: 0, nsec: 0 });
    (<MessageCollector>this.collectors[topic]).flush();

    const datatype = (<Topic>this.topicsByName[topic]).datatype;
    // If topic has a decayTime set, markers with no lifetime will get one
    // later on, so we don't need to filter them. Note: A decayTime of zero is
    // defined as an infinite lifetime
    const decayTime = this._settingsByKey[`t:${topic}`]?.decayTime;
    const filteredMessages =
      decayTime === undefined ? filterOutSupersededMessages(messages, datatype) : messages;
    for (const message of filteredMessages) {
      this._consumeMessage(topic, datatype, message);
    }
  };

  getScene(): Scene {
    return {
      bounds: this.bounds,
      flattenedZHeightPose: this.flattenedZHeightPose,
    };
  }

  renderMarkers(add: MarkerCollector): void {
    for (const topic of Object.values(this.topicsByName)) {
      const collector = this.collectors[topic.name];
      if (!collector) {
        continue;
      }
      const topicMarkers = collector.getMessages();
      for (const message of topicMarkers) {
        const marker: any = message;
        if (marker.ns) {
          if (!this.namespaceIsEnabled(topic.name, marker.ns)) {
            continue;
          }
        }

        // Highlight if marker matches any of this topic's highlightMarkerMatchers; dim other markers
        // Markers that are not re-processed on this frame (i.e. older markers whose lifetime has
        // not expired) do not get a new copy of interactionData, so they always need to be reset.
        const markerMatches = (this._highlightMarkerMatchersByTopic[topic.name] ?? []).some(
          ({ checks = [] }) =>
            checks.every(({ markerKeyPath, value }) => {
              const markerValue = _.get(message, markerKeyPath as any);
              return value === markerValue;
            }),
        );
        marker.interactionData.highlighted = markerMatches;

        // TODO(bmc): once we support more topic settings
        // flesh this out to be more marker type agnostic
        const settings = this._settingsByKey[`t:${topic.name}`];
        if (settings) {
          marker.settings = settings;
        }
        this._addMarkerToCollector(add, topic, marker);
      }
    }
  }

  private _addMarkerToCollector(add: MarkerCollector, topic: Topic, originalMarker: any) {
    let marker = originalMarker;
    switch (marker.type) {
      case 1:
      case 2:
      case 3:
        marker = { ...marker, points: undefined };
        break;
      case 4:
        marker = { ...marker, primitive: "line strip" };
        break;
      case 6:
        marker = { ...marker, primitive: "lines" };
        break;
    }

    // allow topic settings to override renderable marker command (see MarkerSettingsEditor.js)
    const { overrideCommand } = this._settingsByKey[`t:${topic.name}`] || {};

    // prettier-ignore
    switch (marker.type) {
      case 0:
        return add.arrow(marker);
      case 1:
        return add.cube(marker);
      case 2:
        return add.sphere(marker);
      case 3:
        return add.cylinder(marker);
      case 4:
        if (overrideCommand === LINED_CONVEX_HULL_RENDERING_SETTING) {
          return add.linedConvexHull(marker);
        }

        return add.lineStrip(marker);
      case 5:
        if (overrideCommand === LINED_CONVEX_HULL_RENDERING_SETTING) {
          return add.linedConvexHull(marker);
        }

        return add.lineList(marker);
      case 6:
        return add.cubeList(marker);
      case 7:
        return add.sphereList(marker);
      case 8:
        return add.points(marker);
      case 9:
        return add.text(marker);
      // mesh resource not supported
      case 11:
        return add.triangleList(marker);
      case 101:
        return add.grid(marker);
      case 102:
        return add.pointcloud(marker);
      case 103:
        return add.poseMarker(marker);
      case 104:
        return add.laserScan(marker);
      case 107:
        return add.filledPolygon(marker);
      case 108:
        return add.instancedLineList(marker);
      case 109:
        return add.overlayIcon(marker);
      case 110:
        return add.color(marker);
      default:
        {
          if (!this._hooks.addMarkerToCollector(add, marker)) {
            this._setTopicError(topic.name, `Unsupported marker type: ${marker.type}`);
          }
        }

    }
  }
}
