// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { EventEmitter } from "eventemitter3";

import { HttpServer, XmlRpcServer, XmlRpcValue } from "@foxglove/xmlrpc";

import { RosXmlRpcResponse } from "./XmlRpcTypes";

function CheckArguments(args: XmlRpcValue[], expected: string[]): Error | undefined {
  if (args.length !== expected.length) {
    return new Error(`Expected ${expected.length} arguments, got ${args.length}`);
  }

  for (let i = 0; i < args.length; i++) {
    if (expected[i] !== "*" && typeof args[i] !== expected[i]) {
      return new Error(`Expected "${expected[i]}" for arg ${i}, got "${typeof args[i]}"`);
    }
  }

  return undefined;
}

export class RosMaster extends EventEmitter {
  private _server: XmlRpcServer;
  private _url?: string;
  private _nodes = new Map<string, string>();
  private _services = new Map<string, Map<string, string>>();
  private _topics = new Map<string, string>();
  private _publications = new Map<string, Set<string>>();
  private _subscriptions = new Map<string, Set<string>>();

  constructor(httpServer: HttpServer) {
    super();
    this._server = new XmlRpcServer(httpServer);
  }

  async start(hostname: string, port?: number): Promise<void> {
    await this._server.listen(port, undefined, 10);
    this._url = `http://${hostname}:${this._server.port()}/`;

    this._server.setHandler("registerService", this.registerService);
    this._server.setHandler("unregisterService", this.unregisterService);
    this._server.setHandler("registerSubscriber", this.registerSubscriber);
    this._server.setHandler("unregisterSubscriber", this.unregisterSubscriber);
    this._server.setHandler("registerPublisher", this.registerPublisher);
    this._server.setHandler("unregisterPublisher", this.unregisterPublisher);
    this._server.setHandler("lookupNode", this.lookupNode);
    this._server.setHandler("getPublishedTopics", this.getPublishedTopics);
    this._server.setHandler("getTopicTypes", this.getTopicTypes);
    this._server.setHandler("getSystemState", this.getSystemState);
    this._server.setHandler("getUri", this.getUri);
    this._server.setHandler("lookupService", this.lookupService);
  }

  close(): void {
    this._server.close();
  }

  url(): string | undefined {
    return this._url;
  }

  registerService = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, service, serviceApi, callerApi]
    const err = CheckArguments(args, ["string", "string", "string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, service, serviceApi, callerApi] = args as [string, string, string, string];

    if (!this._services.has(service)) {
      this._services.set(service, new Map<string, string>());
    }
    const serviceProviders = this._services.get(service) as Map<string, string>;

    serviceProviders.set(callerId, serviceApi);
    this._nodes.set(callerId, callerApi);

    return Promise.resolve([1, "", 0]);
  };

  unregisterService = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, service, serviceApi]
    const err = CheckArguments(args, ["string", "string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, service, _serviceApi] = args as [string, string, string];
    const serviceProviders = this._services.get(service);
    if (serviceProviders == undefined) {
      return Promise.resolve([1, "", 0]);
    }

    const removed = serviceProviders.delete(callerId);
    if (serviceProviders.size === 0) {
      this._services.delete(service);
    }

    return Promise.resolve([1, "", removed ? 1 : 0]);
  };

  registerSubscriber = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, topic, topicType, callerApi]
    const err = CheckArguments(args, ["string", "string", "string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, topic, topicType, callerApi] = args as [string, string, string, string];

    const dataType = this._topics.get(topic);
    if (dataType != undefined && dataType !== topicType) {
      return Promise.resolve([
        0,
        `topic_type "${topicType}" for topic "${topic}" does not match "${dataType}"`,
        [],
      ]);
    }

    if (!this._subscriptions.has(topic)) {
      this._subscriptions.set(topic, new Set<string>());
    }
    const subscribers = this._subscriptions.get(topic) as Set<string>;
    subscribers.add(callerId);

    this._nodes.set(callerId, callerApi);

    const publishers = Array.from((this._publications.get(topic) ?? new Set<string>()).values());
    const publisherApis = publishers
      .map((p) => this._nodes.get(p))
      .filter((a) => a != undefined) as string[];
    return Promise.resolve([1, "", publisherApis]);
  };

  unregisterSubscriber = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, topic, callerApi]
    const err = CheckArguments(args, ["string", "string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, topic, _callerApi] = args as [string, string, string];

    const subscribers = this._subscriptions.get(topic);
    if (subscribers == undefined) {
      return Promise.resolve([1, "", 0]);
    }

    const removed = subscribers.delete(callerId);
    if (subscribers.size === 0) {
      this._subscriptions.delete(topic);
    }

    return Promise.resolve([1, "", removed ? 1 : 0]);
  };

  registerPublisher = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, topic, topicType, callerApi]
    const err = CheckArguments(args, ["string", "string", "string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, topic, topicType, callerApi] = args as [string, string, string, string];

    const dataType = this._topics.get(topic);
    if (dataType != undefined && dataType !== topicType) {
      return Promise.resolve([
        0,
        `topic_type "${topicType}" for topic "${topic}" does not match "${dataType}"`,
        [],
      ]);
    }

    if (!this._publications.has(topic)) {
      this._publications.set(topic, new Set<string>());
    }
    const publishers = this._publications.get(topic) as Set<string>;
    publishers.add(callerId);

    this._nodes.set(callerId, callerApi);

    const subscribers = Array.from((this._subscriptions.get(topic) ?? new Set<string>()).values());
    const subscriberApis = subscribers
      .map((p) => this._nodes.get(p))
      .filter((a) => a != undefined) as string[];
    return Promise.resolve([1, "", subscriberApis]);
  };

  unregisterPublisher = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, topic, callerApi]
    const err = CheckArguments(args, ["string", "string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, topic, _callerApi] = args as [string, string, string];

    const publishers = this._publications.get(topic);
    if (publishers == undefined) {
      return Promise.resolve([1, "", 0]);
    }

    const removed = publishers.delete(callerId);
    if (publishers.size === 0) {
      this._publications.delete(topic);
    }

    return Promise.resolve([1, "", removed ? 1 : 0]);
  };

  lookupNode = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, nodeName]
    const err = CheckArguments(args, ["string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [_callerId, nodeName] = args as [string, string];

    const nodeApi = this._nodes.get(nodeName);
    if (nodeApi == undefined) {
      return Promise.resolve([0, `node "${nodeName}" not found`, ""]);
    }
    return Promise.resolve([1, "", nodeApi]);
  };

  getPublishedTopics = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, subgraph]
    const err = CheckArguments(args, ["string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    // Subgraph filtering would need to be supported to become a fully compatible implementation
    const [_callerId, _subgraph] = args as [string, string];

    const entries: [string, string][] = [];
    for (const topic of this._publications.keys()) {
      const dataType = this._topics.get(topic);
      if (dataType != undefined) {
        entries.push([topic, dataType]);
      }
    }

    return Promise.resolve([1, "", entries]);
  };

  getTopicTypes = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId]
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    const entries = Array.from(this._topics.entries());
    return Promise.resolve([1, "", entries]);
  };

  getSystemState = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId]
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    const publishers: [string, string[]][] = Array.from(
      this._publications.entries(),
    ).map(([topic, nodeNames]) => [topic, Array.from(nodeNames.values()).sort()]);

    const subscribers: [string, string[]][] = Array.from(
      this._subscriptions.entries(),
    ).map(([topic, nodeNames]) => [topic, Array.from(nodeNames.values()).sort()]);

    const services: [string, string[]][] = Array.from(
      this._services.entries(),
    ).map(([service, nodeNamesToServiceApis]) => [
      service,
      Array.from(nodeNamesToServiceApis.keys()).sort(),
    ]);

    return Promise.resolve([1, "", [publishers, subscribers, services]]);
  };

  getUri = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId]
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    const url = this._url;
    if (url == undefined) {
      return Promise.resolve([0, "", "not running"]);
    }

    return Promise.resolve([1, "", url]);
  };

  lookupService = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, service]
    const err = CheckArguments(args, ["string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [_callerId, service] = args as [string, string];

    const serviceProviders = this._services.get(service);
    if (serviceProviders == undefined || serviceProviders.size === 0) {
      return Promise.resolve([0, `no providers for service "${service}"`, ""]);
    }

    const serviceUrl = serviceProviders.values().next().value as string;
    return Promise.resolve([1, "", serviceUrl]);
  };
}
