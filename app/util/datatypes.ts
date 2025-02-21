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

import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import {
  FUTURE_VIZ_MSGS_DATATYPE,
  STUDIO_MARKER_DATATYPE,
  STUDIO_MARKER_ARRAY_DATATYPE,
} from "@foxglove-studio/app/util/globalConstants";

const markerFields = [
  { type: "uint8", name: "ARROW", isConstant: true, value: 0 },
  { type: "uint8", name: "CUBE", isConstant: true, value: 1 },
  { type: "uint8", name: "SPHERE", isConstant: true, value: 2 },
  { type: "uint8", name: "CYLINDER", isConstant: true, value: 3 },
  { type: "uint8", name: "LINE_STRIP", isConstant: true, value: 4 },
  { type: "uint8", name: "LINE_LIST", isConstant: true, value: 5 },
  { type: "uint8", name: "CUBE_LIST", isConstant: true, value: 6 },
  { type: "uint8", name: "SPHERE_LIST", isConstant: true, value: 7 },
  { type: "uint8", name: "POINTS", isConstant: true, value: 8 },
  { type: "uint8", name: "TEXT_VIEW_FACING", isConstant: true, value: 9 },
  { type: "uint8", name: "MESH_RESOURCE", isConstant: true, value: 10 },
  { type: "uint8", name: "TRIANGLE_LIST", isConstant: true, value: 11 },
  { type: "uint8", name: "ADD", isConstant: true, value: 0 },
  { type: "uint8", name: "MODIFY", isConstant: true, value: 0 },
  { type: "uint8", name: "DELETE", isConstant: true, value: 2 },
  { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
  { type: "string", name: "ns", isArray: false, isComplex: false },
  { type: "int32", name: "id", isArray: false, isComplex: false },
  { type: "int32", name: "type", isArray: false, isComplex: false },
  { type: "int32", name: "action", isArray: false, isComplex: false },
  { type: "geometry_msgs/Pose", name: "pose", isArray: false, isComplex: true },
  { type: "geometry_msgs/Vector3", name: "scale", isArray: false, isComplex: true },
  { type: "std_msgs/ColorRGBA", name: "color", isArray: false, isComplex: true },
  { type: "duration", name: "lifetime", isArray: false, isComplex: false },
  { type: "bool", name: "frame_locked", isArray: false, isComplex: false },
  {
    type: "geometry_msgs/Point",
    name: "points",
    isArray: true,
    arrayLength: undefined,
    isComplex: true,
  },
  {
    type: "std_msgs/ColorRGBA",
    name: "colors",
    isArray: true,
    arrayLength: undefined,
    isComplex: true,
  },
  { type: "string", name: "text", isArray: false, isComplex: false },
  { type: "string", name: "mesh_resource", isArray: false, isComplex: false },
  { type: "bool", name: "mesh_use_embedded_materials", isArray: false, isComplex: false },
];

export const basicDatatypes: RosDatatypes = {
  [FUTURE_VIZ_MSGS_DATATYPE]: {
    fields: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      {
        isArray: true,
        isComplex: true,
        name: "allMarkers",
        type: STUDIO_MARKER_DATATYPE,
        arrayLength: undefined,
      },
    ],
  },
  [STUDIO_MARKER_ARRAY_DATATYPE]: {
    fields: [
      {
        isArray: true,
        isComplex: true,
        arrayLength: undefined,
        name: "markers",
        type: STUDIO_MARKER_DATATYPE,
      },
      {
        isArray: false,
        isComplex: true,
        name: "header",
        type: "std_msgs/Header",
      },
    ],
  },
  "visualization_msgs/MarkerArray": {
    fields: [
      {
        isArray: true,
        isComplex: true,
        arrayLength: undefined,
        name: "markers",
        type: "visualization_msgs/Marker",
      },
    ],
  },
  "visualization_msgs/Marker": { fields: markerFields },
  // This is a special marker type that has a string instead of an int ID field and an additional JSON "metadata" field.
  // For use internally to Studio, when we need to add extra data to markers.
  [STUDIO_MARKER_DATATYPE]: {
    fields: markerFields
      .filter(({ name }) => name !== "id")
      .concat([
        { type: "string", name: "id", isArray: false, isComplex: false },
        { type: "json", name: "metadata", isArray: false, isComplex: false },
      ]),
  },
  "std_msgs/ColorRGBA": {
    fields: [
      { type: "float32", name: "r", isArray: false, isComplex: false },
      { type: "float32", name: "g", isArray: false, isComplex: false },
      { type: "float32", name: "b", isArray: false, isComplex: false },
      { type: "float32", name: "a", isArray: false, isComplex: false },
    ],
  },
  "std_msgs/Header": {
    fields: [
      { type: "uint32", name: "seq", isArray: false, isComplex: false },
      { type: "time", name: "stamp", isArray: false, isComplex: false },
      { type: "string", name: "frame_id", isArray: false, isComplex: false },
    ],
  },
  "geometry_msgs/Pose": {
    fields: [
      { type: "geometry_msgs/Point", name: "position", isArray: false, isComplex: true },
      { type: "geometry_msgs/Quaternion", name: "orientation", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/PoseStamped": {
    fields: [
      {
        isArray: false,
        isComplex: true,
        name: "header",
        type: "std_msgs/Header",
      },
      {
        isArray: false,
        isComplex: true,
        name: "pose",
        type: "geometry_msgs/Pose",
      },
    ],
  },

  "geometry_msgs/Vector3": {
    fields: [
      { type: "float64", name: "x", isArray: false, isComplex: false },
      { type: "float64", name: "y", isArray: false, isComplex: false },
      { type: "float64", name: "z", isArray: false, isComplex: false },
    ],
  },
  "geometry_msgs/Point": {
    fields: [
      { type: "float64", name: "x", isArray: false, isComplex: false },
      { type: "float64", name: "y", isArray: false, isComplex: false },
      { type: "float64", name: "z", isArray: false, isComplex: false },
    ],
  },
  "geometry_msgs/Quaternion": {
    fields: [
      { type: "float64", name: "x", isArray: false, isComplex: false },
      { type: "float64", name: "y", isArray: false, isComplex: false },
      { type: "float64", name: "z", isArray: false, isComplex: false },
      { type: "float64", name: "w", isArray: false, isComplex: false },
    ],
  },
};
