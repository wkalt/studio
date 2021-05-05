// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { join, resolve } from "path";

export interface PackageManifest {
  name: string;
  version: string;
}

export interface PackageOptions {
  readonly cwd?: string;
  readonly packagePath?: string;
}

export interface InstallOptions {
  readonly cwd?: string;
}

export async function packageCommand(options: PackageOptions = {}): Promise<void> {
  const extensionPath = options.cwd ?? process.cwd();

  const pkg = await readManifest(extensionPath);

  await prepublish(extensionPath, pkg);

  const files = await collect(extensionPath, pkg);

  const packagePath = options.packagePath ?? getPackagePath(extensionPath, pkg);

  await writeFgsx(files, resolve(packagePath));
}

export async function installCommand(options: InstallOptions = {}): Promise<void> {
  const extensionPath = options.cwd ?? process.cwd();

  const pkg = await readManifest(extensionPath);

  await prepublish(extensionPath, pkg);

  const files = await collect(extensionPath, pkg);

  await install(files, pkg);
}

async function readManifest(_extensionPath: string): Promise<PackageManifest> {
  throw new Error("Not implemented");
}

async function prepublish(_extensionPath: string, _pkg: PackageManifest): Promise<void> {
  throw new Error("Not implemented");
}

async function collect(_extensionPath: string, _pkg: PackageManifest): Promise<string[]> {
  throw new Error("Not implemented");
}

async function writeFgsx(_files: string[], _outputPath: string): Promise<void> {
  throw new Error("Not implemented");
}

async function install(_files: string[], _pkg: PackageManifest): Promise<void> {
  throw new Error("Not implemented");
}

function getPackagePath(extensionPath: string, { name, version }: PackageManifest): string {
  return join(extensionPath, `${name}-${version}.fgse`);
}
