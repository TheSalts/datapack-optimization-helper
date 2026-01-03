import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { t } from "../utils/i18n";
import { findExecuteGroups } from "../rules/executeGroup";
import { getPackFormat } from "../utils/packMeta";
import { getExecuteGroupOutputPath, getExecuteGroupOutputName } from "../utils/config";

export function createExecuteGroupFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
    const action = new vscode.CodeAction(t("executeGroupFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const lines = document.getText().split(/\r?\n/);
    const groups = findExecuteGroups(lines);
    const group = groups.find(
        (g) => g.startLine === diagnostic.range.start.line && g.endLine === diagnostic.range.end.line
    );

    if (!group) {
        return action;
    }

    const filePath = document.uri.fsPath;
    const currentDir = path.dirname(filePath);
    const baseFileName = path.basename(filePath, ".mcfunction");

    const outputPath = resolveOutputPath(filePath, currentDir);
    const newFunctionName = findAvailableName(outputPath, baseFileName, group.startLine);
    const newFilePath = path.join(outputPath, `${newFunctionName}.mcfunction`);
    const newFileUri = vscode.Uri.file(newFilePath);

    const { namespace, functionPath } = extractNamespaceAndPath(newFilePath);
    const newFunctionRef = namespace ? `${namespace}:${functionPath}${newFunctionName}` : `pack:${newFunctionName}`;

    const newFileContent = group.suffixes.join("\n") + "\n";

    let prefix = group.commonPrefix;
    if (!prefix.trim().endsWith("run")) {
        prefix += "run ";
    }
    const newLine = `${prefix}function ${newFunctionRef}`;

    action.edit = new vscode.WorkspaceEdit();

    action.edit.createFile(newFileUri, { ignoreIfExists: true });
    action.edit.insert(newFileUri, new vscode.Position(0, 0), newFileContent);

    const linesToDelete: number[] = [];
    for (let i = group.startLine; i <= group.endLine; i++) {
        const trimmed = lines[i].trim();
        if (trimmed !== "" && !trimmed.startsWith("#")) {
            linesToDelete.push(i);
        }
    }

    for (let i = linesToDelete.length - 1; i >= 1; i--) {
        const lineIndex = linesToDelete[i];
        const deleteRange = new vscode.Range(lineIndex, 0, lineIndex + 1, 0);
        action.edit.delete(document.uri, deleteRange);
    }

    if (linesToDelete.length > 0) {
        const firstLine = linesToDelete[0];
        const replaceRange = new vscode.Range(firstLine, 0, firstLine, lines[firstLine].length);
        action.edit.replace(document.uri, replaceRange, newLine);
    }

    return action;
}

function resolveOutputPath(filePath: string, currentDir: string): string {
    const template = getExecuteGroupOutputPath();

    if (template === "{dir}") {
        return currentDir;
    }

    const normalized = filePath.replace(/\\/g, "/");
    const packFormat = getPackFormat();
    const functionsFolder = packFormat !== null && packFormat < 32 ? "functions" : "function";

    // Find root (data/<namespace>/function(s)/)
    const match = normalized.match(new RegExp(`(.*?/data/[^/]+/${functionsFolder})/`));
    const rootPath = match ? match[1].replace(/\//g, path.sep) : currentDir;

    let resolved = template.replace(/\{root\}/g, rootPath).replace(/\{dir\}/g, currentDir);

    // Ensure directory exists
    if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true });
    }

    return resolved;
}

function findAvailableName(dirPath: string, baseFileName: string, startLine: number): string {
    const template = getExecuteGroupOutputName();
    const lineNumber = startLine + 1; // Convert 0-based to 1-based

    const baseName = template.replace(/\{name\}/g, baseFileName).replace(/\{line\}/g, String(lineNumber));

    let candidate = baseName;
    let counter = 1;

    while (fs.existsSync(path.join(dirPath, `${candidate}.mcfunction`))) {
        candidate = `${baseName}_${counter}`;
        counter++;
    }

    return candidate;
}

function extractNamespaceAndPath(filePath: string): { namespace: string | null; functionPath: string } {
    const normalized = filePath.replace(/\\/g, "/");

    const packFormat = getPackFormat();
    const functionsFolder = packFormat !== null && packFormat < 32 ? "functions" : "function";

    const match = normalized.match(new RegExp(`data/([^/]+)/${functionsFolder}/(.+)\\.mcfunction$`));
    if (!match) {
        return { namespace: null, functionPath: "" };
    }

    const namespace = match[1];
    const fullPath = match[2];
    const lastSlash = fullPath.lastIndexOf("/");
    const functionPath = lastSlash >= 0 ? fullPath.substring(0, lastSlash + 1) : "";

    return { namespace, functionPath };
}
