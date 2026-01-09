import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface FunctionCall {
    functionName: string;
    line: number;
    isConditional: boolean;
}

export interface ScoreChange {
    target: string;
    objective: string;
    operation: "set" | "add" | "remove" | "reset" | "unknown";
    value: number | null;
    line: number;
    isConditional: boolean;
}

export interface FunctionInfo {
    namespace: string;
    path: string;
    fullPath: string;
    filePath: string;
    calls: FunctionCall[];
    scoreChanges: ScoreChange[];
}

interface DatapackRoot {
    rootPath: string;
    namespace: string;
    functionsPath: string;
}

interface CallerInfo {
    callerPath: string;
    line: number;
    isConditional: boolean;
}

let functionIndex: Map<string, FunctionInfo> = new Map();
let callerGraph: Map<string, CallerInfo[]> = new Map();
let fileToFunction: Map<string, string> = new Map();
let initialized = false;
let indexing = false;

export function isIndexInitialized(): boolean {
    return initialized;
}

export function getFunctionInfo(functionPath: string): FunctionInfo | undefined {
    return functionIndex.get(functionPath);
}

export function getFunctionInfoByFile(filePath: string): FunctionInfo | undefined {
    const normalizedPath = normalizePath(filePath);
    const funcPath = fileToFunction.get(normalizedPath);
    if (funcPath) {
        return functionIndex.get(funcPath);
    }
    return undefined;
}

export function getCallers(functionPath: string): CallerInfo[] {
    const callers = callerGraph.get(functionPath);
    return callers ? callers : [];
}

function normalizePath(p: string): string {
    return p.replace(/\\/g, "/").toLowerCase();
}

function findDatapackRoots(): DatapackRoot[] {
    const roots: DatapackRoot[] = [];
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        return roots;
    }

    for (const folder of workspaceFolders) {
        const rootPath = folder.uri.fsPath;
        const dataPath = path.join(rootPath, "data");

        if (!fs.existsSync(dataPath)) {
            continue;
        }

        try {
            const namespaces = fs.readdirSync(dataPath, { withFileTypes: true });
            for (const ns of namespaces) {
                if (!ns.isDirectory()) {
                    continue;
                }

                const functionsPath = path.join(dataPath, ns.name, "function");
                const functionsPath2 = path.join(dataPath, ns.name, "functions");

                if (fs.existsSync(functionsPath)) {
                    roots.push({
                        rootPath: rootPath,
                        namespace: ns.name,
                        functionsPath: functionsPath,
                    });
                } else if (fs.existsSync(functionsPath2)) {
                    roots.push({
                        rootPath: rootPath,
                        namespace: ns.name,
                        functionsPath: functionsPath2,
                    });
                }
            }
        } catch (e) {
            console.error("[functionIndex] Error reading data directory:", e);
        }
    }

    return roots;
}

function findMcfunctionFiles(dir: string): string[] {
    const files: string[] = [];

    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...findMcfunctionFiles(fullPath));
            } else if (entry.isFile() && entry.name.endsWith(".mcfunction")) {
                files.push(fullPath);
            }
        }
    } catch (e) {
        console.error("[functionIndex] Error reading directory:", dir, e);
    }

    return files;
}

function filePathToFunctionPath(filePath: string, root: DatapackRoot): string {
    const relativePath = path.relative(root.functionsPath, filePath);
    const withoutExt = relativePath.replace(/\.mcfunction$/, "");
    const normalized = withoutExt.replace(/\\/g, "/");
    return `${root.namespace}:${normalized}`;
}

function parseFunctionFile(filePath: string, root: DatapackRoot): FunctionInfo {
    const funcPath = filePathToFunctionPath(filePath, root);
    const [namespace, funcName] = funcPath.split(":");

    const info: FunctionInfo = {
        namespace,
        path: funcName,
        fullPath: funcPath,
        filePath,
        calls: [],
        scoreChanges: [],
    };

    try {
        const content = fs.readFileSync(filePath, "utf-8");
        const rawLines = content.split(/\r?\n/);

        const lines: string[] = [];
        let accumulated = "";
        for (const rawLine of rawLines) {
            const trimmed = rawLine.trim();
            if (trimmed.endsWith("\\")) {
                accumulated += trimmed.slice(0, -1) + " ";
            } else {
                accumulated += trimmed;
                lines.push(accumulated);
                accumulated = "";
            }
        }
        if (accumulated) {
            lines.push(accumulated);
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === "" || trimmed.startsWith("#")) {
                continue;
            }

            const functionMatch = trimmed.match(/\bfunction\s+([a-z0-9_.-]+:[a-z0-9_./-]+)/i);
            if (functionMatch) {
                const isConditionalCall =
                    trimmed.startsWith("execute") &&
                    (/\b(if|unless)\b/.test(trimmed) ||
                        /\bon\s/.test(trimmed) ||
                        /\b(as|at|positioned\s+as|rotated\s+as|facing\s+entity)\s+@[aepnr]/.test(trimmed));
                info.calls.push({ functionName: functionMatch[1], line: i, isConditional: isConditionalCall });
            }

            const setMatch = trimmed.match(
                /^(?:execute\s+.*\s+run\s+)?scoreboard\s+players\s+set\s+(\S+)\s+(\S+)\s+(-?\d+)/
            );
            if (setMatch) {
                const isConditional = trimmed.startsWith("execute");
                info.scoreChanges.push({
                    target: setMatch[1],
                    objective: setMatch[2],
                    operation: "set",
                    value: parseInt(setMatch[3], 10),
                    line: i,
                    isConditional,
                });
                continue;
            }

            const addMatch = trimmed.match(
                /^(?:execute\s+.*\s+run\s+)?scoreboard\s+players\s+(add|remove)\s+(\S+)\s+(\S+)\s+(-?\d+)/
            );
            if (addMatch) {
                const isConditional = trimmed.startsWith("execute");
                info.scoreChanges.push({
                    target: addMatch[2],
                    objective: addMatch[3],
                    operation: addMatch[1] as "add" | "remove",
                    value: parseInt(addMatch[4], 10),
                    line: i,
                    isConditional,
                });
                continue;
            }

            const resetMatch = trimmed.match(
                /^(?:execute\s+.*\s+run\s+)?scoreboard\s+players\s+reset\s+(\S+)(?:\s+(\S+))?/
            );
            if (resetMatch) {
                const isConditional = trimmed.startsWith("execute");
                info.scoreChanges.push({
                    target: resetMatch[1],
                    objective: resetMatch[2] || "*",
                    operation: "reset",
                    value: null,
                    line: i,
                    isConditional,
                });
                continue;
            }

            const operationMatch = trimmed.match(
                /^(?:execute\s+.*\s+run\s+)?scoreboard\s+players\s+operation\s+(\S+)\s+(\S+)\s+/
            );
            if (operationMatch) {
                const isConditional = trimmed.startsWith("execute");
                info.scoreChanges.push({
                    target: operationMatch[1],
                    objective: operationMatch[2],
                    operation: "unknown",
                    value: null,
                    line: i,
                    isConditional,
                });
            }
        }
    } catch (e) {
        console.error("[functionIndex] Error parsing file:", filePath, e);
    }

    return info;
}

function buildCallerGraph() {
    callerGraph.clear();

    for (const [funcPath, info] of functionIndex) {
        for (const call of info.calls) {
            const calledFunc = call.functionName;
            if (!callerGraph.has(calledFunc)) {
                callerGraph.set(calledFunc, []);
            }
            callerGraph
                .get(calledFunc)!
                .push({ callerPath: funcPath, line: call.line, isConditional: call.isConditional });
        }
    }
}

export async function indexWorkspace(): Promise<void> {
    if (indexing) {
        return;
    }

    indexing = true;
    functionIndex.clear();
    fileToFunction.clear();
    callerGraph.clear();

    const roots = findDatapackRoots();

    for (const root of roots) {
        const files = findMcfunctionFiles(root.functionsPath);

        for (const filePath of files) {
            const info = parseFunctionFile(filePath, root);
            functionIndex.set(info.fullPath, info);
            fileToFunction.set(normalizePath(filePath), info.fullPath);
        }
    }

    buildCallerGraph();
    initialized = true;
    indexing = false;
}

export function reindexFile(filePath: string): void {
    const normalizedPath = normalizePath(filePath);
    const existingFuncPath = fileToFunction.get(normalizedPath);

    if (existingFuncPath) {
        const oldInfo = functionIndex.get(existingFuncPath);
        if (oldInfo) {
            for (const call of oldInfo.calls) {
                const callers = callerGraph.get(call.functionName);
                if (callers) {
                    const newCallers = callers.filter((c) => c.callerPath !== existingFuncPath);
                    if (newCallers.length === 0) {
                        callerGraph.delete(call.functionName);
                    } else {
                        callerGraph.set(call.functionName, newCallers);
                    }
                }
            }
        }
        functionIndex.delete(existingFuncPath);
        fileToFunction.delete(normalizedPath);
    }

    const roots = findDatapackRoots();
    for (const root of roots) {
        const normalizedFunctionsPath = normalizePath(root.functionsPath);
        if (normalizedPath.startsWith(normalizedFunctionsPath)) {
            if (fs.existsSync(filePath)) {
                const info = parseFunctionFile(filePath, root);
                functionIndex.set(info.fullPath, info);
                fileToFunction.set(normalizedPath, info.fullPath);

                for (const call of info.calls) {
                    const calledFunc = call.functionName;
                    if (!callerGraph.has(calledFunc)) {
                        callerGraph.set(calledFunc, []);
                    }
                    callerGraph
                        .get(calledFunc)!
                        .push({ callerPath: info.fullPath, line: call.line, isConditional: call.isConditional });
                }
            }
            break;
        }
    }
}

export function removeFileFromIndex(filePath: string): void {
    const normalizedPath = normalizePath(filePath);
    const funcPath = fileToFunction.get(normalizedPath);

    if (funcPath) {
        const info = functionIndex.get(funcPath);
        if (info) {
            for (const call of info.calls) {
                const callers = callerGraph.get(call.functionName);
                if (callers) {
                    const newCallers = callers.filter((c) => c.callerPath !== funcPath);
                    if (newCallers.length === 0) {
                        callerGraph.delete(call.functionName);
                    } else {
                        callerGraph.set(call.functionName, newCallers);
                    }
                }
            }
        }
        functionIndex.delete(funcPath);
        fileToFunction.delete(normalizedPath);
    }
}

export interface ScoreState {
    target: string;
    objective: string;
    value: number | null;
}

export function collectScoreStatesFromCallers(
    functionPath: string,
    visited: Set<string> = new Set()
): Map<string, ScoreState[]> {
    const result: Map<string, ScoreState[]> = new Map();

    if (visited.has(functionPath)) {
        return result;
    }
    visited.add(functionPath);

    const callers = getCallers(functionPath);

    if (callers.length === 0) {
        return result;
    }

    for (const caller of callers) {
        if (caller.isConditional) {
            continue;
        }
        const callerPath = caller.callerPath;
        const callLine = caller.line;
        const callerInfo = functionIndex.get(callerPath);
        if (!callerInfo) {
            continue;
        }

        const parentStates = collectScoreStatesFromCallers(callerPath, new Set(visited));

        const stateMap: Map<string, ScoreState> = new Map();

        for (const [key, states] of parentStates) {
            if (states.length > 0) {
                const firstVal = states[0].value;
                if (states.every((s) => s.value === firstVal)) {
                    stateMap.set(key, { ...states[0] });
                }
            }
        }

        for (const change of callerInfo.scoreChanges) {
            // Apply changes ONLY up to the call line
            if (change.line >= callLine) {
                break;
            }

            const key = `${change.target}:${change.objective}`;
            const existing = stateMap.get(key);

            if (change.isConditional) {
                stateMap.set(key, {
                    target: change.target,
                    objective: change.objective,
                    value: null,
                });
                continue;
            }

            if (change.operation === "set") {
                stateMap.set(key, {
                    target: change.target,
                    objective: change.objective,
                    value: change.value,
                });
            } else if (change.operation === "add" && existing && existing.value !== null) {
                existing.value += change.value!;
            } else if (change.operation === "remove" && existing && existing.value !== null) {
                existing.value -= change.value!;
            } else if (change.operation === "reset") {
                if (change.objective === "*") {
                    for (const [k] of stateMap) {
                        if (k.startsWith(`${change.target}:`)) {
                            const s = stateMap.get(k);
                            if (s) {
                                s.value = null;
                            }
                        }
                    }
                } else {
                    stateMap.set(key, {
                        target: change.target,
                        objective: change.objective,
                        value: null,
                    });
                }
            } else if (change.operation === "unknown") {
                stateMap.delete(key);
            }
        }

        for (const [key, state] of stateMap) {
            if (!result.has(key)) {
                result.set(key, []);
            }
            result.get(key)!.push(state);
        }
    }

    return result;
}

export function getConsensusScoreStates(functionPath: string): Map<string, ScoreState> {
    const allStates = collectScoreStatesFromCallers(functionPath);
    const consensus: Map<string, ScoreState> = new Map();

    for (const [key, states] of allStates) {
        if (states.length === 0) {
            continue;
        }

        const firstValue = states[0].value;
        const allSame = states.every((s) => s.value === firstValue);

        if (allSame) {
            consensus.set(key, states[0]);
        }
    }

    return consensus;
}

export function watchMcfunctionFiles(context: vscode.ExtensionContext) {
    const watcher = vscode.workspace.createFileSystemWatcher("**/*.mcfunction");

    watcher.onDidChange((uri) => {
        reindexFile(uri.fsPath);
    });

    watcher.onDidCreate((uri) => {
        reindexFile(uri.fsPath);
    });

    watcher.onDidDelete((uri) => {
        removeFileFromIndex(uri.fsPath);
    });

    context.subscriptions.push(watcher);
}
