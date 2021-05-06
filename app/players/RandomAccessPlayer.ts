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
import { TimeUtil, Time } from "rosbag";
import { v4 as uuidv4 } from "uuid";

import { rootGetDataProvider } from "@foxglove-studio/app/dataProviders/rootGetDataProvider";
import {
  Connection,
  DataProvider,
  DataProviderDescriptor,
  DataProviderMetadata,
} from "@foxglove-studio/app/dataProviders/types";
import NoopMetricsCollector from "@foxglove-studio/app/players/NoopMetricsCollector";
import {
  AdvertisePayload,
  MessageEvent,
  Player,
  PlayerCapabilities,
  PlayerMetricsCollectorInterface,
  PlayerState,
  Progress,
  PublishPayload,
  SubscribePayload,
  Topic,
  ParsedMessageDefinitionsByTopic,
  PlayerPresence,
  ParameterValue,
  PlayerProblem,
} from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import debouncePromise from "@foxglove-studio/app/util/debouncePromise";
import delay from "@foxglove-studio/app/util/delay";
import filterMap from "@foxglove-studio/app/util/filterMap";
import { isRangeCoveredByRanges } from "@foxglove-studio/app/util/ranges";
import { getSanitizedTopics } from "@foxglove-studio/app/util/selectors";
import {
  clampTime,
  fromMillis,
  getSeekTimeFromSpec,
  percentOf,
  SEEK_ON_START_NS,
  subtractTimes,
  SeekToTimeSpec,
  TimestampMethod,
} from "@foxglove-studio/app/util/time";

// The number of nanoseconds to seek backwards to build context during a seek
// operation larger values mean more opportunity to capture context before the
// seek event, but are slower operations. We shouldn't make this number too big,
// otherwise we pull in too many unnecessary messages, making seeking slow. But
// we also don't want it to be too low, otherwise you don't see enough data when
// seeking.
// Unfortunately right now we need a pretty high number here, especially when
// using "synchronized topics" (e.g. in the Image panel) when one of the topics
// is publishing at a fairly low rate.
// TODO(JP): Add support for subscribers to express that we're only interested
// in the last message on a topic, and then support that in `getMessages` as
// well, so we can fetch pretty old messages without incurring the cost of
// fetching too many.
export const SEEK_BACK_NANOSECONDS =
  299 *
  /* ms */
  1e6;

if (SEEK_ON_START_NS >= SEEK_BACK_NANOSECONDS) {
  throw new Error(
    "SEEK_ON_START_NS should be less than SEEK_BACK_NANOSECONDS (otherwise we skip over messages at the start)",
  );
}

export const SEEK_START_DELAY_MS = 100;

const capabilities = [PlayerCapabilities.setSpeed, PlayerCapabilities.playbackControl];

export type RandomAccessPlayerOptions = {
  metricsCollector?: PlayerMetricsCollectorInterface;
  seekToTime: SeekToTimeSpec;
};

// A `Player` that wraps around a tree of `DataProviders`.
export default class RandomAccessPlayer implements Player {
  _provider: DataProvider;
  _isPlaying: boolean = false;
  _wasPlayingBeforeTabSwitch = false;
  _listener?: (arg0: PlayerState) => Promise<void>;
  _speed: number = 0.2;
  _start: Time = { sec: 0, nsec: 0 };
  _end: Time = { sec: 0, nsec: 0 };
  // next read start time indicates where to start reading for the next tick
  // after a tick read, it is set to 1nsec past the end of the read operation (preparing for the next tick)
  _nextReadStartTime: Time = { sec: 0, nsec: 0 };
  _lastTickMillis?: number;
  // The last time a "seek" was started. This is used to cancel async operations, such as seeks or ticks, when a seek
  // happens while they are ocurring.
  _lastSeekStartTime: number = Date.now();
  // This is the "lastSeekTime" emitted in the playerState. It is not the same as the _lastSeekStartTime because we can
  // start a seek and not end up emitting it, or emit something else while we are requesting messages for the seek. The
  // DataProvider's `progressCallback` can cause an emit at any time, for example.
  // We only want to set the "lastSeekTime" exactly when we emit the messages coming from the seek.
  _lastSeekEmitTime: number = this._lastSeekStartTime;
  _cancelSeekBackfill: boolean = false;
  _parsedSubscribedTopics: Set<string> = new Set();
  _providerTopics: Topic[] = [];
  _providerConnections: Connection[] = [];
  _providerDatatypes: RosDatatypes = {};
  _metricsCollector: PlayerMetricsCollectorInterface;
  _initializing: boolean = true;
  _initialized: boolean = false;
  _reconnecting: boolean = false;
  _progress: Progress = Object.freeze({});
  _id: string = uuidv4();
  _messages: MessageEvent<unknown>[] = [];
  _receivedBytes: number = 0;
  _messageOrder: TimestampMethod = "receiveTime";
  _hasError = false;
  _closed = false;
  _seekToTime: SeekToTimeSpec;
  _lastRangeMillis?: number;
  _parsedMessageDefinitionsByTopic: ParsedMessageDefinitionsByTopic = {};

  // The problem store holds problems based on keys (which may be hard-coded problem types or topics)
  // The overall player may be healthy, but individual topics may have warnings or errors.
  // These are set/cleared in the store to track the current set of problems
  _problems = new Map<string, PlayerProblem>();

  constructor(
    providerDescriptor: DataProviderDescriptor,
    { metricsCollector, seekToTime }: RandomAccessPlayerOptions,
  ) {
    if (process.env.NODE_ENV === "test" && providerDescriptor.name === "TestProvider") {
      this._provider = providerDescriptor.args.provider;
    } else {
      this._provider = rootGetDataProvider(providerDescriptor);
    }
    this._metricsCollector = metricsCollector ?? new NoopMetricsCollector();
    this._seekToTime = seekToTime;
    this._metricsCollector.playerConstructed();

    document.addEventListener("visibilitychange", this._handleDocumentVisibilityChange, false);
  }

  // If the user switches tabs, we won't actually play because no requestAnimationFrames will be called.
  // Make sure this is reflected in application state and in metrics as a pause and resume.
  _handleDocumentVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      if (this._isPlaying) {
        this.pausePlayback();
        this._wasPlayingBeforeTabSwitch = true;
      }
    } else if (document.visibilityState === "visible" && this._wasPlayingBeforeTabSwitch) {
      this._wasPlayingBeforeTabSwitch = false;
      this.startPlayback();
    }
  };

  private _setError(message: string, error?: Error): void {
    this._hasError = true;
    this._problems.set("global-error", {
      severity: "error",
      message,
      error,
    });
    this._isPlaying = false;
    if (!this._initializing) {
      this._provider.close();
    }
    this._emitState();
  }

  setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this._listener = listener;
    this._emitState();

    this._provider
      .initialize({
        progressCallback: (progress: Progress) => {
          this._progress = progress;
          // Don't emit progress when we are playing, because we will emit whenever we get new messages anyways and
          // emitting unnecessarily will reduce playback performance.
          if (!this._isPlaying) {
            this._emitState();
          }
        },
        reportMetadataCallback: (metadata: DataProviderMetadata) => {
          switch (metadata.type) {
            case "updateReconnecting":
              this._reconnecting = metadata.reconnecting;

              this._emitState();

              break;
            case "average_throughput":
              this._metricsCollector.recordDataProviderPerformance(metadata);

              break;
            case "initializationPerformance":
              this._metricsCollector.recordDataProviderInitializePerformance(metadata);

              break;
            case "received_bytes":
              this._receivedBytes += metadata.bytes;
              break;
            case "data_provider_stall":
              this._metricsCollector.recordDataProviderStall(metadata);

              break;
            default:
              break;
          }
        },
      })
      .then(({ start, end, topics, connections, messageDefinitions, providesParsedMessages }) => {
        if (!providesParsedMessages) {
          this._setError("Incorrect message format");
          return;
        }
        const parsedMessageDefinitions = messageDefinitions;
        if (parsedMessageDefinitions.type === "raw") {
          this._setError("Missing message definitions");
          return;
        }

        const initialTime = getSeekTimeFromSpec(this._seekToTime, start, end);

        this._start = start;
        this._nextReadStartTime = initialTime;
        this._end = end;
        this._providerTopics = topics;
        this._providerConnections = connections;
        this._providerDatatypes = parsedMessageDefinitions.datatypes;
        this._parsedMessageDefinitionsByTopic =
          parsedMessageDefinitions.parsedMessageDefinitionsByTopic;
        this._initializing = false;
        this._reportInitialized();

        // Wait a bit until panels have had the chance to subscribe to topics before we start
        // playback.
        setTimeout(() => {
          if (this._closed) {
            return;
          }
          // Only do the initial seek if we haven't started playing already.
          if (!this._isPlaying && TimeUtil.areSame(this._nextReadStartTime, initialTime)) {
            this.seekPlayback(initialTime);
          }
        }, SEEK_START_DELAY_MS);
      })
      .catch((error: Error) => {
        this._setError("Error initializing player", error);
      });
  }

  _emitState = debouncePromise(() => {
    if (!this._listener) {
      return Promise.resolve();
    }

    if (this._hasError) {
      return this._listener({
        presence: PlayerPresence.ERROR,
        progress: {},
        capabilities: [],
        playerId: this._id,
        activeData: undefined,
        problems: Array.from(this._problems.values()),
      });
    }

    const messages = this._messages;
    this._messages = [];
    if (messages.length > 0) {
      // If we're outputting any messages, we need to cancel any in-progress backfills. Otherwise
      // we'd be "traveling back in time".
      this._cancelSeekBackfill = true;
    }

    // _nextReadStartTime points to the start of the _next_ range we want to read
    // for our player state, we want to have currentTime represent the last time of the range we read
    // It would be weird to provide a currentTime outside the bounds of what we read
    let lastEnd = this._nextReadStartTime;
    if (lastEnd.sec > 0 || lastEnd.nsec > 0) {
      lastEnd = TimeUtil.add(lastEnd, { sec: 0, nsec: -1 });
    }

    const publishedTopics = new Map<string, Set<string>>();
    for (const conn of this._providerConnections) {
      let publishers = publishedTopics.get(conn.topic);
      if (publishers == undefined) {
        publishers = new Set<string>();
        publishedTopics.set(conn.topic, publishers);
      }
      publishers.add(conn.callerid);
    }

    const data: PlayerState = {
      presence: this._reconnecting
        ? PlayerPresence.RECONNECTING
        : this._initializing
        ? PlayerPresence.INITIALIZING
        : PlayerPresence.PRESENT,
      progress: this._progress,
      capabilities,
      playerId: this._id,
      problems: this._problems.size > 0 ? Array.from(this._problems.values()) : undefined,
      activeData: this._initializing
        ? undefined
        : {
            messages,
            totalBytesReceived: this._receivedBytes,
            messageOrder: this._messageOrder,
            currentTime: clampTime(lastEnd, this._start, this._end),
            startTime: this._start,
            endTime: this._end,
            isPlaying: this._isPlaying,
            speed: this._speed,
            lastSeekTime: this._lastSeekEmitTime,
            topics: this._providerTopics,
            datatypes: this._providerDatatypes,
            publishedTopics,
            parsedMessageDefinitionsByTopic: this._parsedMessageDefinitionsByTopic,
          },
    };

    return this._listener(data);
  });

  async _tick(): Promise<void> {
    if (this._initializing || !this._isPlaying || this._hasError) {
      return;
    }

    // compute how long of a time range we want to read by taking into account
    // the time since our last read and how fast we're currently playing back
    const tickTime = performance.now();
    const durationMillis =
      this._lastTickMillis != undefined && this._lastTickMillis !== 0
        ? tickTime - this._lastTickMillis
        : 20;
    this._lastTickMillis = tickTime;

    // Read at most 300ms worth of messages, otherwise things can get out of control if rendering
    // is very slow. Also, smooth over the range that we request, so that a single slow frame won't
    // cause the next frame to also be unnecessarily slow by increasing the frame size.
    let rangeMillis = Math.min(durationMillis * this._speed, 300);
    if (this._lastRangeMillis != undefined) {
      rangeMillis = this._lastRangeMillis * 0.9 + rangeMillis * 0.1;
    }
    this._lastRangeMillis = rangeMillis;

    // read is past end of bag, no more to read
    if (TimeUtil.compare(this._nextReadStartTime, this._end) > 0) {
      return;
    }

    const seekTime = this._lastSeekStartTime;
    const start: Time = clampTime(this._nextReadStartTime, this._start, this._end);
    const end: Time = clampTime(
      TimeUtil.add(this._nextReadStartTime, fromMillis(rangeMillis)),
      this._start,
      this._end,
    );

    const { parsedMessages: messages } = await this._getMessages(start, end);
    await this._emitState.currentPromise;

    // if we seeked while reading then do not emit messages
    // just start reading again from the new seek position
    if (this._lastSeekStartTime !== seekTime) {
      return;
    }

    // our read finished and we didn't seed during the read, prepare for the next tick
    // we need to do this after checking for seek changes since seek time may have changed
    this._nextReadStartTime = TimeUtil.add(end, { sec: 0, nsec: 1 });

    // if we paused while reading then do not emit messages
    // and exit the read loop
    if (!this._isPlaying) {
      return;
    }

    this._messages = this._messages.concat(messages);
    this._emitState();
  }

  _read = debouncePromise(async () => {
    try {
      while (this._isPlaying && !this._hasError) {
        const start = Date.now();
        await this._tick();
        const time = Date.now() - start;
        // make sure we've slept at least 16 millis or so (aprox 1 frame)
        // to give the UI some time to breathe and not burn in a tight loop
        if (time < 16) {
          await delay(16 - time);
        }
      }
    } catch (err) {
      this._setError(err.message, err);
    }
  });

  async _getMessages(start: Time, end: Time): Promise<{ parsedMessages: MessageEvent<unknown>[] }> {
    const parsedTopics = getSanitizedTopics(this._parsedSubscribedTopics, this._providerTopics);
    if (parsedTopics.length === 0) {
      return { parsedMessages: [] };
    }
    if (!this.hasCachedRange(start, end)) {
      this._metricsCollector.recordUncachedRangeRequest();
    }
    const messages = await this._provider.getMessages(start, end, {
      parsedMessages: parsedTopics,
    });
    const { parsedMessages } = messages;
    if (parsedMessages == undefined) {
      this._problems.set("bad-messages", {
        severity: "error",
        message: `Bad set of messages`,
        tip: `Restart the app or contact support if the issue persists.`,
      });
      return { parsedMessages: [] };
    }
    this._problems.delete("bad-messages");

    // It is very important that we record first emitted messages here, since
    // `_emitState` is awaited on `requestAnimationFrame`, which will not be
    // invoked unless a user's browser is focused on the current session's tab.
    // Moreover, there is a disproportionally small amount of time between when we procure
    // messages here and when they are set to playerState.
    if (parsedMessages.length > 0) {
      this._metricsCollector.recordTimeToFirstMsgs();
    }
    const filterMessages = (msgs: MessageEvent<unknown>[], topics: string[]) =>
      filterMap(msgs, (message) => {
        this._problems.delete(message.topic);

        if (!topics.includes(message.topic)) {
          this._problems.set(message.topic, {
            severity: "warning",
            message: `Unexpected topic encountered: ${message.topic}. Skipping message`,
          });
          return undefined;
        }
        const topic = this._providerTopics.find((t) => t.name === message.topic);
        if (!topic) {
          this._problems.set(message.topic, {
            severity: "warning",
            message: `Unexpected message on topic: ${message.topic}. Skipping message`,
          });
          return undefined;
        }
        if (topic.datatype === "") {
          this._problems.set(message.topic, {
            severity: "warning",
            message: `Missing datatype for topic: ${message.topic}. Skipping message`,
          });
          return undefined;
        }

        return {
          topic: message.topic,
          receiveTime: message.receiveTime,
          message: message.message,
        };
      });
    return {
      parsedMessages: filterMessages(parsedMessages as any, parsedTopics),
    };
  }

  startPlayback(): void {
    if (this._isPlaying) {
      return;
    }
    this._metricsCollector.play(this._speed);
    this._isPlaying = true;
    this._emitState();
    this._read();
  }

  pausePlayback(): void {
    if (!this._isPlaying) {
      return;
    }
    this._metricsCollector.pause();
    // clear out last tick millis so we don't read a huge chunk when we unpause
    this._lastTickMillis = undefined;
    this._isPlaying = false;
    this._emitState();
  }

  setPlaybackSpeed(speed: number): void {
    delete this._lastRangeMillis;
    this._speed = speed;
    this._metricsCollector.setSpeed(speed);
    this._emitState();
  }

  _reportInitialized(): void {
    if (this._initializing || this._initialized) {
      return;
    }
    this._metricsCollector.initialized();
    this._initialized = true;
  }

  _setNextReadStartTime(time: Time): void {
    this._metricsCollector.recordPlaybackTime(time, !this.hasCachedRange(this._start, this._end));
    this._nextReadStartTime = clampTime(time, this._start, this._end);
  }

  _seekPlaybackInternal = debouncePromise(async (backfillDuration?: Time) => {
    const seekTime = Date.now();
    this._lastSeekStartTime = seekTime;
    this._cancelSeekBackfill = false;
    // cancel any queued _emitState that might later emit messages from before we seeked
    this._messages = [];

    // backfill includes the current time we've seek'd to
    // playback after backfill will load messages after the seek time
    const backfillEnd = clampTime(this._nextReadStartTime, this._start, this._end);

    // Backfill a few hundred milliseconds of data if we're paused so panels have something to show.
    // If we're playing, we'll give the panels some data soon anyway.
    const internalBackfillDuration = { sec: 0, nsec: this._isPlaying ? 0 : SEEK_BACK_NANOSECONDS };
    // Add on any extra time needed by the OrderedStampPlayer.
    const totalBackfillDuration = TimeUtil.add(
      internalBackfillDuration,
      backfillDuration ?? { sec: 0, nsec: 0 },
    );
    const backfillStart = clampTime(
      subtractTimes(this._nextReadStartTime, totalBackfillDuration),
      this._start,
      this._end,
    );

    // Only getMessages if we have some messages to get.
    if (backfillDuration || !this._isPlaying) {
      const { parsedMessages: messages } = await this._getMessages(backfillStart, backfillEnd);
      // Only emit the messages if we haven't seeked again / emitted messages since we
      // started loading them. Note that for the latter part just checking for `isPlaying`
      // is not enough because the user might have started playback and then paused again!
      // Therefore we really need something like `this._cancelSeekBackfill`.
      if (this._lastSeekStartTime === seekTime && !this._cancelSeekBackfill) {
        // similar to _tick(), we set the next start time past where we have read
        // this happens after reading and confirming that playback or other seeking hasn't happened
        this._nextReadStartTime = TimeUtil.add(backfillEnd, { sec: 0, nsec: 1 });

        this._messages = messages;
        this._lastSeekEmitTime = seekTime;
        this._emitState();
      }
    } else {
      // If we are playing, make sure we set this emit time so that consumers will know that we seeked.
      this._lastSeekEmitTime = seekTime;
    }
  });

  seekPlayback(time: Time, backfillDuration?: Time): void {
    // Only seek when the provider initialization is done.
    if (!this._initialized) {
      return;
    }
    this._metricsCollector.seek(time);
    this._setNextReadStartTime(time);
    this._seekPlaybackInternal(backfillDuration);
  }

  setSubscriptions(newSubscriptions: SubscribePayload[]): void {
    // Anything we can get from the data providers will be in the blocks. Subscriptions for
    // preloading-fallback codepaths are only needed for other data sources without blocks (like
    // nodes and websocket.)
    const parsedSubscriptions = newSubscriptions.filter(
      ({ preloadingFallback }) => !(preloadingFallback ?? false),
    );

    this._parsedSubscribedTopics = new Set(parsedSubscriptions.map(({ topic }) => topic));
    this._metricsCollector.setSubscriptions(newSubscriptions);
  }

  requestBackfill(): void {
    if (this._isPlaying || this._initializing) {
      return;
    }
    this.seekPlayback(this._nextReadStartTime);
  }

  setPublishers(_publishers: AdvertisePayload[]): void {
    // no-op
  }

  setParameter(_key: string, _value: ParameterValue): void {
    throw new Error("Parameter editing is not supported by this data source");
  }

  publish(_payload: PublishPayload): void {
    throw new Error("Publishing is not supported by this data source");
  }

  close(): void {
    this._isPlaying = false;
    this._closed = true;
    if (!this._initializing && !this._hasError) {
      this._provider.close();
    }
    this._metricsCollector.close();
    document.removeEventListener("visibilitychange", this._handleDocumentVisibilityChange);
  }

  // Exposed for testing.
  hasCachedRange(start: Time, end: Time): boolean {
    const fractionStart = percentOf(this._start, this._end, start) / 100;
    const fractionEnd = percentOf(this._start, this._end, end) / 100;
    return isRangeCoveredByRanges(
      { start: fractionStart, end: fractionEnd },
      this._progress.fullyLoadedFractionRanges ?? [],
    );
  }

  setGlobalVariables(): void {
    // no-op
  }
}
