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

import { last } from "lodash";
import { TimeUtil, Time } from "rosbag";

import {
  ExtensionPoint,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
  DataProvider,
  MessageDefinitions,
} from "@foxglove-studio/app/dataProviders/types";
import {
  Topic,
  MessageDefinitionsByTopic,
  ParsedMessageDefinitionsByTopic,
  MessageEvent,
} from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";

function filterMessages<T>(
  start: Time,
  end: Time,
  topics: readonly string[],
  messages: readonly MessageEvent<T>[] | undefined,
) {
  if (messages == undefined) {
    return undefined;
  }
  const ret = [];
  for (const message of messages) {
    if (TimeUtil.isGreaterThan(message.receiveTime, end)) {
      break;
    }
    if (TimeUtil.isLessThan(message.receiveTime, start)) {
      continue;
    }
    if (!topics.includes(message.topic)) {
      continue;
    }
    ret.push(message);
  }
  return ret;
}

type MemoryDataProviderOptions = {
  messages: GetMessagesResult;
  topics?: Topic[];
  datatypes?: RosDatatypes;
  messageDefinitionsByTopic?: MessageDefinitionsByTopic;
  parsedMessageDefinitionsByTopic?: ParsedMessageDefinitionsByTopic;
  initiallyLoaded?: boolean;
  providesParsedMessages?: boolean;
};

// in-memory data provider
export default class MemoryDataProvider implements DataProvider {
  messages: GetMessagesResult;
  topics?: Topic[];
  datatypes?: RosDatatypes;
  messageDefinitionsByTopic: MessageDefinitionsByTopic;
  parsedMessageDefinitionsByTopic?: ParsedMessageDefinitionsByTopic;
  extensionPoint?: ExtensionPoint;
  initiallyLoaded: boolean;
  providesParsedMessages: boolean;

  constructor({
    messages,
    topics,
    datatypes,
    initiallyLoaded = false,
    messageDefinitionsByTopic,
    parsedMessageDefinitionsByTopic,
    providesParsedMessages,
  }: MemoryDataProviderOptions) {
    this.messages = messages;
    this.topics = topics;
    this.datatypes = datatypes;
    this.messageDefinitionsByTopic = messageDefinitionsByTopic ?? {};
    this.parsedMessageDefinitionsByTopic = parsedMessageDefinitionsByTopic;
    this.initiallyLoaded = initiallyLoaded;
    this.providesParsedMessages = providesParsedMessages ?? messages.parsedMessages != undefined;
  }

  async initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    this.extensionPoint = extensionPoint;

    if (!this.initiallyLoaded) {
      // Report progress during `initialize` to state intention to provide progress (for testing)
      this.extensionPoint.progressCallback({
        fullyLoadedFractionRanges: [{ start: 0, end: 0 }],
      });
    }
    const { parsedMessages, rosBinaryMessages } = this.messages;
    const sortedMessages = [
      ...(parsedMessages ?? []),
      ...(rosBinaryMessages ?? []),
    ].sort((m1, m2) => TimeUtil.compare(m1.receiveTime, m2.receiveTime));

    let messageDefinitions: MessageDefinitions;
    if (this.datatypes || this.parsedMessageDefinitionsByTopic) {
      messageDefinitions = {
        type: "parsed",
        datatypes: this.datatypes ?? {},
        parsedMessageDefinitionsByTopic: this.parsedMessageDefinitionsByTopic ?? {},
        messageDefinitionsByTopic: this.messageDefinitionsByTopic,
      };
    } else {
      messageDefinitions = {
        type: "raw",
        messageDefinitionsByTopic: this.messageDefinitionsByTopic,
      };
    }

    const firstSortedMessage = sortedMessages[0];
    const lastReceiveTime = last(sortedMessages)?.receiveTime;
    if (!lastReceiveTime || !firstSortedMessage) {
      throw new Error("MemoryDataProvider invariant: no sorted messages");
    }

    return {
      start: firstSortedMessage.receiveTime,
      end: lastReceiveTime,
      topics: this.topics ?? [],
      connections: [],
      messageDefinitions,
      providesParsedMessages: this.providesParsedMessages,
    };
  }

  async close(): Promise<void> {
    // no-op
  }

  async getMessages(start: Time, end: Time, topics: GetMessagesTopics): Promise<GetMessagesResult> {
    return {
      parsedMessages: filterMessages(
        start,
        end,
        topics.parsedMessages ?? [],
        this.messages.parsedMessages,
      ),
      rosBinaryMessages: filterMessages(
        start,
        end,
        topics.rosBinaryMessages ?? [],
        this.messages.rosBinaryMessages,
      ),
    };
  }
}
