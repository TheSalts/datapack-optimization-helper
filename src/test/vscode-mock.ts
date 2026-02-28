/**
 * Minimal vscode mock for running unit tests outside VSCode context.
 * Only stubs the APIs that are transitively imported by tested modules.
 */

const vscode = {
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    CodeActionKind: { QuickFix: { value: "quickfix" } },
    Range: class Range {
        constructor(
            public startLine: number,
            public startCharacter: number,
            public endLine: number,
            public endCharacter: number,
        ) {}
    },
    Position: class Position {
        constructor(public line: number, public character: number) {}
    },
    Diagnostic: class Diagnostic {
        constructor(public range: any, public message: string, public severity?: number) {}
    },
    CodeAction: class CodeAction {
        diagnostics: any[] = [];
        edit: any;
        isPreferred = false;
        constructor(public title: string, public kind?: any) {}
    },
    WorkspaceEdit: class WorkspaceEdit {
        replace() {}
        delete() {}
        insert() {}
        createFile() {}
    },
    Uri: {
        file: (path: string) => ({ fsPath: path, scheme: "file" }),
    },
    workspace: {
        getConfiguration: () => ({
            get: () => undefined,
        }),
    },
    window: {
        showInformationMessage: () => {},
    },
    env: {
        language: "en",
    },
    languages: {},
    l10n: {
        t: (message: string) => message,
    },
};

// Register as module resolution
const Module = require("module");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...args: any[]) {
    if (request === "vscode") {
        return request;
    }
    return originalResolveFilename.call(this, request, ...args);
};

const originalLoad = Module._cache;
require.cache["vscode"] = {
    id: "vscode",
    filename: "vscode",
    loaded: true,
    exports: vscode,
} as any;

// Also register for ESM-style resolution
Module._cache["vscode"] = {
    id: "vscode",
    filename: "vscode",
    loaded: true,
    exports: vscode,
};
