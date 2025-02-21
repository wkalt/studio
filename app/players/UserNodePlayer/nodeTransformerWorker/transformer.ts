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

// @ts-nocheck
/* eslint-disable @typescript-eslint/strict-boolean-expressions */

import ts from "typescript/lib/typescript";

import { formatInterfaceName } from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/typegen";
import {
  constructDatatypes,
  findReturnType,
  findDefaultExportFunction,
  DatatypeExtractionError,
} from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/typescript/ast";
import { getNodeProjectConfig } from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/typescript/projectConfig";
import {
  baseCompilerOptions,
  transformDiagnosticToMarkerData,
} from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/utils";
import {
  DiagnosticSeverity,
  Sources,
  ErrorCodes,
  NodeData,
  Diagnostic,
  NodeDataTransformer,
} from "@foxglove-studio/app/players/UserNodePlayer/types";
import { Topic } from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import { DEFAULT_STUDIO_NODE_PREFIX } from "@foxglove-studio/app/util/globalConstants";

export const hasTransformerErrors = (nodeData: NodeData): boolean =>
  nodeData.diagnostics.some(({ severity }) => severity === DiagnosticSeverity.Error);

export const getInputTopics = (nodeData: NodeData): NodeData => {
  // Do not attempt to run if there were any previous errors.
  if (hasTransformerErrors(nodeData)) {
    return nodeData;
  }

  const { sourceFile, typeChecker } = nodeData;
  if (!sourceFile || !typeChecker) {
    throw new Error(
      "Either the 'sourceFile' or 'typeChecker' is absent. There is a problem with the `compile` step.",
    );
  }

  if (!sourceFile.symbol) {
    const error: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message: "Must export an input topics array. E.g. 'export const inputs = ['/some_topics']'",
      source: Sources.InputTopicsChecker,
      code: ErrorCodes.InputTopicsChecker.NO_INPUTS_EXPORT,
    };
    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  const inputsExport = typeChecker
    .getExportsOfModule(sourceFile.symbol)
    .find((node) => node.escapedName === "inputs");
  if (!inputsExport) {
    const error: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message: "Must export a non-empty inputs array.",
      source: Sources.InputTopicsChecker,
      code: ErrorCodes.InputTopicsChecker.EMPTY_INPUTS_EXPORT,
    };
    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  const inputTopicElements = inputsExport.declarations[0]?.initializer?.elements;
  if (
    !inputTopicElements ||
    inputTopicElements.some(({ kind }) => kind !== ts.SyntaxKind.StringLiteral)
  ) {
    const error: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message:
        "The exported 'inputs' variable must be an array of string literals. E.g. 'export const inputs = ['/some_topics']'",
      source: Sources.InputTopicsChecker,
      code: ErrorCodes.InputTopicsChecker.BAD_INPUTS_TYPE,
    };
    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  const inputTopics = inputTopicElements.map(({ text }) => text);
  if (!inputTopics.length) {
    const error: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message:
        'Must include non-empty inputs array, e.g. export const inputs = ["/some_input_topic"];',
      source: Sources.InputTopicsChecker,
      code: ErrorCodes.InputTopicsChecker.EMPTY_INPUTS_EXPORT,
    };

    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  return {
    ...nodeData,
    inputTopics,
  };
};

export const getOutputTopic = (nodeData: NodeData): NodeData => {
  const matches = /^\s*export\s+const\s+output\s*=\s*("([^"]+)"|'([^']+)')/gm.exec(
    nodeData.sourceCode,
  );
  // Pick either the first matching group or the second, which corresponds
  // to single quotes or double quotes respectively.
  const outputTopic = matches && (matches[2] || matches[3]);

  if (!outputTopic) {
    const error = {
      severity: DiagnosticSeverity.Error,
      message: `Must include an output, e.g. export const output = "${DEFAULT_STUDIO_NODE_PREFIX}your_output_topic";`,
      source: Sources.OutputTopicChecker,
      code: ErrorCodes.OutputTopicChecker.NO_OUTPUTS,
    };

    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  return {
    ...nodeData,
    outputTopic,
  };
};

export const validateInputTopics = (nodeData: NodeData, topics: Topic[]): NodeData => {
  const badInputTopic = nodeData.inputTopics.find((topic) =>
    topic.startsWith(DEFAULT_STUDIO_NODE_PREFIX),
  );
  if (badInputTopic) {
    const error = {
      severity: DiagnosticSeverity.Error,
      message: `Input "${badInputTopic}" cannot equal another node's output.`,
      source: "InputTopicsChecker",
      code: ErrorCodes.InputTopicsChecker.CIRCULAR_IMPORT,
    };

    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  const { inputTopics } = nodeData;
  const activeTopics = topics.map(({ name }) => name);
  const diagnostics = [];
  for (const inputTopic of inputTopics) {
    if (!activeTopics.includes(inputTopic)) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        message: `Input "${inputTopic}" is not yet available`,
        source: Sources.InputTopicsChecker,
        code: ErrorCodes.InputTopicsChecker.NO_TOPIC_AVAIL,
      });
    }
  }

  return {
    ...nodeData,
    diagnostics: [...nodeData.diagnostics, ...diagnostics],
  };
};

export const validateOutputTopic = (nodeData: NodeData): NodeData => {
  const { outputTopic } = nodeData;
  if (!outputTopic.startsWith(DEFAULT_STUDIO_NODE_PREFIX)) {
    return {
      ...nodeData,
      diagnostics: [
        ...nodeData.diagnostics,
        {
          severity: DiagnosticSeverity.Error,
          message: `Output "${outputTopic}" must start with "${DEFAULT_STUDIO_NODE_PREFIX}"`,
          source: Sources.OutputTopicChecker,
          code: ErrorCodes.OutputTopicChecker.BAD_PREFIX,
        },
      ],
    };
  }
  return nodeData;
};

// The compile step is currently used for generating syntactic/semantic errors. In the future, it
// will be leveraged to:
// - Generate the AST
// - Handle external libraries
export const compile = (nodeData: NodeData): NodeData => {
  const { sourceCode, rosLib } = nodeData;

  // If a node name does not start with a forward slash, the compiler host will
  // not be able to match the correct filename.
  if (!nodeData.name.startsWith(DEFAULT_STUDIO_NODE_PREFIX)) {
    const error: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message: `The filename of your node "${nodeData.name}" must start with "/studio_node/."`,
      source: Sources.Other,
      code: ErrorCodes.Other.FILENAME,
    };
    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  const options: ts.CompilerOptions = baseCompilerOptions;
  const nodeFileName = `${nodeData.name}.ts`;
  const projectConfig = getNodeProjectConfig();
  const projectCode = new Map<string, string>();

  const sourceCodeMap = new Map<string, string>();
  sourceCodeMap.set(nodeFileName, sourceCode);
  sourceCodeMap.set(projectConfig.rosLib.filePath, rosLib);
  projectConfig.utilityFiles.forEach((file) => sourceCodeMap.set(file.filePath, file.sourceCode));
  projectConfig.declarations.forEach((lib) => sourceCodeMap.set(lib.filePath, lib.sourceCode));

  let transpiledCode: string = "";
  let codeEmitted: boolean = false;

  // The compiler host is basically the file system API Typescript is funneled
  // through. All we do is tell Typescript where it can locate files and how to
  // create source files for the time being.

  // Reference:
  // Using the compiler api: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
  // CompilerHost: https://github.com/microsoft/TypeScript/blob/v3.5.3/lib/typescript.d.ts#L2752
  // Architectual Overview: https://github.com/Microsoft/TypeScript/wiki/Architectural-Overview#overview-of-the-compilation-process

  const host: ts.CompilerHost = {
    getDefaultLibFileName: () => projectConfig.defaultLibFileName,
    getCurrentDirectory: () => "",
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => false,
    readFile: () => {
      return undefined;
    },
    fileExists: (fileName) => {
      for (const [key] of sourceCodeMap.entries()) {
        if (fileName === key || fileName.endsWith(key)) {
          return true;
        }
      }
      return false;
    },
    writeFile: (name: string, data: string) => {
      codeEmitted = true;
      if (name === `${nodeData.name}.js`) {
        transpiledCode = data;
      } else {
        // It's one of our utility files
        projectCode.set(name, data);
      }
    },
    getNewLine: () => "\n",
    getSourceFile: (fileName) => {
      let code = "";
      for (const [key, value] of sourceCodeMap.entries()) {
        if (fileName === key || fileName.endsWith(key)) {
          code = value;
          break;
        }
      }
      return ts.createSourceFile(fileName, code, baseCompilerOptions.target, true);
    },
  };

  const program = ts.createProgram(
    [...projectConfig.utilityFiles.map((file) => file.filePath), nodeFileName],
    options,
    host,
  );
  program.emit();
  if (!codeEmitted) {
    // TODO: Remove after this has been running in prod for a while, and we haven't seen anything in Sentry.
    throw new Error(
      "Program code was not emitted. This should never happen as program.emit() is supposed to be synchronous.",
    );
  }

  const diagnostics = [...program.getSemanticDiagnostics(), ...program.getSyntacticDiagnostics()];

  const newDiagnostics = diagnostics.map(transformDiagnosticToMarkerData);

  const sourceFile = program.getSourceFile(nodeFileName);
  const typeChecker = program.getTypeChecker();

  return {
    ...nodeData,
    sourceFile,
    typeChecker,
    transpiledCode,
    projectCode,
    diagnostics: [...nodeData.diagnostics, ...newDiagnostics],
  };
};

// Currently we only look types matching the exact name "GlobalVariables". In the future,
// we should check the type of the 2nd arg passed to the publisher function in
// case users have renamed the GlobalVariables type.
export const extractGlobalVariables = (nodeData: NodeData): NodeData => {
  // Do not attempt to run if there were any compile time errors.
  if (hasTransformerErrors(nodeData)) {
    return nodeData;
  }

  const { sourceFile } = nodeData;
  if (!sourceFile) {
    throw new Error("'sourceFile' is absent'. There is a problem with the `compile` step.");
  }

  // If the GlobalVariables type isn't defined, that's ok.
  const globalVariablesTypeSymbol = sourceFile.locals.get("GlobalVariables");
  const memberSymbolsByName =
    globalVariablesTypeSymbol?.declarations[0]?.type?.symbol?.members ?? new Map();
  const globalVariables = [...memberSymbolsByName.keys()];

  return {
    ...nodeData,
    globalVariables,
  };
};

export const extractDatatypes = (nodeData: NodeData): NodeData => {
  // Do not attempt to run if there were any compile time errors.
  if (hasTransformerErrors(nodeData)) {
    return nodeData;
  }

  const { sourceFile, typeChecker, name, datatypes: sourceDatatypes } = nodeData;
  if (!sourceFile || !typeChecker) {
    throw new Error(
      "Either the 'sourceFile' or 'typeChecker' is absent'. There is a problem with the `compile` step.",
    );
  }

  // Keys each message definition like { 'std_msg__ColorRGBA': 'std_msg/ColorRGBA' }
  const messageDefinitionMap = {};
  Object.keys(sourceDatatypes).forEach((datatype) => {
    messageDefinitionMap[formatInterfaceName(datatype)] = datatype;
  });

  try {
    const exportNode = findDefaultExportFunction(sourceFile, typeChecker);
    const typeNode = findReturnType(typeChecker, 0, exportNode);

    const { outputDatatype, datatypes } = constructDatatypes(
      typeChecker,
      typeNode,
      name,
      messageDefinitionMap,
    );
    return { ...nodeData, datatypes, outputDatatype };
  } catch (error) {
    if (error instanceof DatatypeExtractionError) {
      return { ...nodeData, diagnostics: [...nodeData.diagnostics, error.diagnostic] };
    }

    throw err;
  }
};

/*
TODO:
  - what happens when the `register` portion of the node pipeline fails to instantiate the code? can we get the stack trace?
*/
export const compose = (...transformers: NodeDataTransformer[]): NodeDataTransformer => {
  return (nodeData: NodeData, topics: Topic[]) => {
    let newNodeData = nodeData;
    // TODO: try/catch here?
    for (const transformer of transformers) {
      newNodeData = transformer(newNodeData, topics);
    }
    return newNodeData;
  };
};

/*

  TRANSFORM

  Defines the pipeline with which user nodes are processed. Each
  'NodeDataTransformer' is a pure function that receives NodeData and returns
  NodeData. In this way, each transformer has the power to inspect previous
  diagnostics, compiled source code, etc. and to abort the pipeline if there
  is a fatal error, or continue to pass along information further downstream
  when errors are not fatal.

*/
const transform = ({
  name,
  sourceCode,
  topics,
  rosLib,
  datatypes,
}: {
  name: string;
  sourceCode: string;
  topics: Topic[];
  rosLib: string;
  datatypes: RosDatatypes;
}): NodeData & { sourceFile?: void; typeChecker?: void } => {
  const transformer = compose(
    getOutputTopic,
    validateOutputTopic,
    compile,
    getInputTopics,
    validateInputTopics,
    extractDatatypes,
    extractGlobalVariables,
  );

  const result = transformer(
    {
      name,
      sourceCode,
      rosLib,
      transpiledCode: "",
      projectCode: undefined,
      inputTopics: [],
      outputTopic: "",
      outputDatatype: "",
      diagnostics: [],
      globalVariables: [],
      datatypes,
      sourceFile: undefined,
      typeChecker: undefined,
    },
    topics,
  );
  // eslint-disable-next-line no-restricted-syntax
  return { ...result, sourceFile: null, typeChecker: null };
};

export default transform;
