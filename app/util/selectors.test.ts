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
import {
  constantsByDatatype,
  getTopicNames,
  getTopicsByTopicName,
  enumValuesByDatatypeAndField,
  extractTypeFromStudioEnumAnnotation,
} from "@foxglove-studio/app/util/selectors";

describe("selectors", () => {
  describe("getTopicNames", () => {
    it("extracts the topic names", () => {
      expect(
        getTopicNames([
          { name: "/abc", datatype: "dummy" },
          { name: "/aBc/a", datatype: "dummy" },
          { name: "/aBc/c", datatype: "dummy" },
          { name: "/abc/b", datatype: "dummy" },
        ]),
      ).toEqual(["/abc", "/aBc/a", "/aBc/c", "/abc/b"]);
    });
  });

  describe("topicsByTopicName", () => {
    it("indexes the topics by topic name", () => {
      expect(
        getTopicsByTopicName([
          { name: "/some/topic", datatype: "dummy" },
          { name: "/another/topic", datatype: "dummy" },
        ]),
      ).toEqual({
        "/some/topic": { name: "/some/topic", datatype: "dummy" },
        "/another/topic": { name: "/another/topic", datatype: "dummy" },
      });
    });
  });

  describe("constantsByDatatype", () => {
    it("indexes constant names by value for each datatype", () => {
      expect(
        constantsByDatatype({
          "some/datatype": {
            fields: [
              { type: "uint32", name: "OFF", isConstant: true, value: 0 },
              { type: "uint32", name: "ON", isConstant: true, value: 1 },
            ],
          },
        }),
      ).toEqual({ "some/datatype": { "0": "OFF", "1": "ON" } });
    });

    it("marks duplicate constant names", () => {
      expect(
        constantsByDatatype({
          "some/datatype": {
            fields: [
              { type: "uint32", name: "OFF", isConstant: true, value: 0 },
              { type: "uint32", name: "DISABLED", isConstant: true, value: 0 },
            ],
          },
        }),
      ).toEqual({ "some/datatype": { "0": "<multiple constants match>" } });
    });
  });

  describe("enumValuesByDatatypeAndField", () => {
    it("handles multiple blocks of constants", () => {
      expect(
        enumValuesByDatatypeAndField({
          "some/datatype": {
            fields: [
              { type: "uint32", name: "OFF", isConstant: true, value: 0 },
              { type: "uint32", name: "ON", isConstant: true, value: 1 },
              { type: "uint32", name: "state", isArray: false, isComplex: false },
              { type: "uint8", name: "RED", isConstant: true, value: 0 },
              { type: "uint8", name: "YELLOW", isConstant: true, value: 1 },
              { type: "uint8", name: "GREEN", isConstant: true, value: 2 },
              { type: "uint8", name: "color", isArray: false, isComplex: false },
            ],
          },
        }),
      ).toEqual({
        "some/datatype": {
          state: { "0": "OFF", "1": "ON" },
          color: { "0": "RED", "1": "YELLOW", "2": "GREEN" },
        },
      });
    });

    it("only assigns constants to matching types", () => {
      expect(
        enumValuesByDatatypeAndField({
          "some/datatype": {
            fields: [
              { type: "uint8", name: "OFF", isConstant: true, value: 0 },
              { type: "uint8", name: "ON", isConstant: true, value: 1 },
              { type: "uint32", name: "state32", isArray: false, isComplex: false },
              { type: "uint8", name: "state8", isArray: false, isComplex: false },
            ],
          },
        }),
      ).toEqual({
        // getting empty result as the first type after constants doesn't match constant type
      });
    });

    it("handles enum annotation", () => {
      expect(
        enumValuesByDatatypeAndField({
          "some/datatype": {
            fields: [
              {
                type: "another/state/values",
                name: "state__foxglove_enum",
                isArray: false,
                isComplex: false,
              },
              { type: "uint32", name: "state", isArray: false, isComplex: false },
            ],
          },
          "another/state/values": {
            fields: [
              { type: "uint32", name: "OFF", isConstant: true, value: 0 },
              { type: "uint32", name: "ON", isConstant: true, value: 1 },
            ],
          },
        }),
      ).toEqual({
        "some/datatype": {
          state: { "0": "OFF", "1": "ON" },
        },
      });
    });
  });
});

describe("extractTypeFromStudioEnumAnnotation", () => {
  it("returns type for field matching pattern", () => {
    expect(extractTypeFromStudioEnumAnnotation("Foo__foxglove_enum")).toEqual("Foo");
    expect(extractTypeFromStudioEnumAnnotation("Foo__webviz_enum")).toEqual("Foo");
  });

  it("returns undefined for field not mathcing", () => {
    expect(extractTypeFromStudioEnumAnnotation("Foo__foxglove_enum_EXTRA")).toBeUndefined();
    expect(extractTypeFromStudioEnumAnnotation("Foo__webviz_enum_EXTRA")).toBeUndefined();
  });
});
