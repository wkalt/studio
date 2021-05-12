// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";
import net from "net";

import { TcpAddress, TcpSocket } from "../TcpTypes";

type MaybeHasFd = {
  _handle?: {
    fd?: number;
  };
};

export class TcpSocketNode extends EventEmitter implements TcpSocket {
  private _host: string;
  private _port: number;
  private _socket: net.Socket;

  constructor(host: string, port: number, socket: net.Socket) {
    super();
    this._host = host;
    this._port = port;
    this._socket = socket;

    socket.on("connect", () => this.emit("connect"));
    socket.on("close", () => this.emit("close"));
    socket.on("data", (chunk) => this.emit("data", chunk));
    socket.on("end", () => this.emit("end"));
    socket.on("timeout", () => this.emit("timeout"));
    socket.on("error", (err) => this.emit("error", err));
  }

  remoteAddress(): Promise<TcpAddress | undefined> {
    return Promise.resolve({
      port: this._port,
      family: this._socket.remoteFamily,
      address: this._host,
    });
  }

  localAddress(): Promise<TcpAddress | undefined> {
    if (this._socket.destroyed) {
      return Promise.resolve(undefined);
    }
    const port = this._socket.localPort;
    const family = this._socket.remoteFamily; // There is no localFamily
    const address = this._socket.localAddress;
    return Promise.resolve(
      port !== undefined && family !== undefined && address !== undefined
        ? { port, family, address }
        : undefined,
    );
  }

  fd(): Promise<number | undefined> {
    // There is no public node.js API for retrieving the file descriptor for a
    // socket. This is the only way of retrieving it from pure JS, on platforms
    // where sockets have file descriptors. See
    // <https://github.com/nodejs/help/issues/1312>
    // eslint-disable-next-line no-underscore-dangle
    return Promise.resolve(((this._socket as unknown) as MaybeHasFd)._handle?.fd);
  }

  connected(): Promise<boolean> {
    return Promise.resolve(!this._socket.destroyed && this._socket.localAddress !== undefined);
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const KEEPALIVE_MS = 60 * 1000;

      this._socket.on("error", reject).connect(this._port, this._host, () => {
        this._socket.removeListener("error", reject);
        this._socket.setKeepAlive(true, KEEPALIVE_MS);
        resolve();
      });
    });
  }

  close(): Promise<void> {
    this._socket.destroy();
    return Promise.resolve();
  }

  write(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      this._socket.write(data, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  setNoDelay(noDelay?: boolean): Promise<void> {
    this._socket.setNoDelay(noDelay);
    return Promise.resolve();
  }

  static Create({ host, port }: { host: string; port: number }): Promise<TcpSocket> {
    return Promise.resolve(new TcpSocketNode(host, port, new net.Socket()));
  }
}
