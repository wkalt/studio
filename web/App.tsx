// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { ReactElement, useState, useMemo, Suspense, PropsWithChildren } from "react";
import { DndProvider } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import { Provider as ReduxProvider } from "react-redux";

import ErrorBoundary from "@foxglove-studio/app/components/ErrorBoundary";
import LayoutStorageReduxAdapter from "@foxglove-studio/app/components/LayoutStorageReduxAdapter";
import { NativeFileMenuPlayerSelection } from "@foxglove-studio/app/components/NativeFileMenuPlayerSelection";
import PlayerManager from "@foxglove-studio/app/components/PlayerManager";
import StudioToastProvider from "@foxglove-studio/app/components/StudioToastProvider";
import AnalyticsProvider from "@foxglove-studio/app/context/AnalyticsProvider";
import { AssetsProvider } from "@foxglove-studio/app/context/AssetContext";
import ExperimentalFeaturesLocalStorageProvider from "@foxglove-studio/app/context/ExperimentalFeaturesLocalStorageProvider";
import ModalHost from "@foxglove-studio/app/context/ModalHost";
import OsContextAppConfigurationProvider from "@foxglove-studio/app/context/OsContextAppConfigurationProvider";
import OsContextLayoutStorageProvider from "@foxglove-studio/app/context/OsContextLayoutStorageProvider";
import { PlayerSourceDefinition } from "@foxglove-studio/app/context/PlayerSelectionContext";
import WindowGeometryContext from "@foxglove-studio/app/context/WindowGeometryContext";
import experimentalFeatures from "@foxglove-studio/app/experimentalFeatures";
import URDFAssetLoader from "@foxglove-studio/app/services/URDFAssetLoader";
import getGlobalStore from "@foxglove-studio/app/store/getGlobalStore";
import ThemeProvider from "@foxglove-studio/app/theme/ThemeProvider";

const BuiltinPanelCatalogProvider = React.lazy(
  () => import("@foxglove-studio/app/context/BuiltinPanelCatalogProvider"),
);

const Workspace = React.lazy(() => import("@foxglove-studio/app/Workspace"));

function AllProviders({ providers, children }: PropsWithChildren<{ providers: JSX.Element[] }>) {
  return (
    <>
      {providers.reduceRight(
        (wrappedChildren, provider) => React.cloneElement(provider, undefined, wrappedChildren),
        children,
      )}
    </>
  );
}

export default function App(): ReactElement {
  const globalStore = getGlobalStore();

  const playerSources: PlayerSourceDefinition[] = [
    {
      name: "Rosbridge (WebSocket)",
      type: "ws",
    },
    {
      name: "Bag File (local)",
      type: "file",
    },
    {
      name: "Bag File (HTTP)",
      type: "http",
    },
  ];

  const windowGeometry = useMemo(() => ({ insetToolbar: false }), []);

  const [assetLoaders] = useState(() => [new URDFAssetLoader()]);

  const providers = [
    /* eslint-disable react/jsx-key */
    <OsContextAppConfigurationProvider />,
    <OsContextLayoutStorageProvider />,
    <ThemeProvider />,
    <ModalHost />, // render modal elements inside the ThemeProvider
    <WindowGeometryContext.Provider value={windowGeometry} />,
    <StudioToastProvider />,
    <ReduxProvider store={globalStore} />,
    <AnalyticsProvider />,
    <ExperimentalFeaturesLocalStorageProvider features={experimentalFeatures} />,
    <PlayerManager playerSources={playerSources} />,
    <AssetsProvider loaders={assetLoaders} />,
    /* eslint-enable react/jsx-key */
  ];

  return (
    <AllProviders providers={providers}>
      <ErrorBoundary>
        <LayoutStorageReduxAdapter />
        <NativeFileMenuPlayerSelection />
        <DndProvider backend={HTML5Backend}>
          <Suspense fallback={<></>}>
            <BuiltinPanelCatalogProvider>
              <Workspace />
            </BuiltinPanelCatalogProvider>
          </Suspense>
        </DndProvider>
      </ErrorBoundary>
    </AllProviders>
  );
}
