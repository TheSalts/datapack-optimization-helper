import * as vscode from "vscode";
import { getDatapackConfig, RuleConfig } from "../utils/config";
import { createDiagnostic } from "../utils/diagnostic";

const PRESET_PATTERNS: Record<string, RegExp> = {
    camelCase: /^[a-z][a-zA-Z0-9]*$/,
    snake_case: /^[a-z][a-z0-9_]*$/,
    PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
    "kebab-case": /^[a-z][a-z0-9-]*$/,
    SCREAMING_SNAKE_CASE: /^[A-Z][A-Z0-9_]*$/,
};

function getPatternAndLabel(patternStr: string): { pattern: RegExp; label: string } | null {
    let pattern: RegExp | null;
    if (PRESET_PATTERNS[patternStr]) {
        pattern = PRESET_PATTERNS[patternStr];
    } else {
        try {
            pattern = new RegExp(patternStr);
        } catch {
            return null;
        }
    }

    const label = PRESET_PATTERNS[patternStr] ? patternStr : `/${patternStr}/`;
    return { pattern, label };
}

const SCOREBOARD_OBJ_ADD_RE = /\bscoreboard\s+objectives\s+add\s+(\S+)/;
const SCOREBOARD_PLAYERS_RE =
    /\bscoreboard\s+players\s+(?:set|add|remove|get|reset|operation)\s+(\S+)\s+(\S+)/;
const TAG_ADD_RE = /\btag\s+\S+\s+add\s+(\S+)/;
const TEAM_ADD_RE = /\bteam\s+add\s+(\S+)/;

function isSkippedName(name: string): boolean {
    return name.startsWith("#") || name.startsWith("@") || name === "*";
}

function pushNameDiagnostic(
    diagnostics: vscode.Diagnostic[],
    name: string,
    lineIndex: number,
    pattern: RegExp,
    label: string,
    findIndexFn: () => number,
): void {
    if (isSkippedName(name) || pattern.test(name)) {
        return;
    }
    const nameStart = findIndexFn();
    if (nameStart < 0) {
        return;
    }
    diagnostics.push(
        createDiagnostic(
            new vscode.Range(lineIndex, nameStart, lineIndex, nameStart + name.length),
            "namingConventionViolation",
            "naming-convention",
            vscode.DiagnosticSeverity.Warning,
            { name, expected: label },
        ),
    );
}

export function checkNamingConvention(lineIndex: number, line: string, config: RuleConfig): vscode.Diagnostic[] {
    if (!config.namingConvention) {
        return [];
    }
    const nc = getDatapackConfig()?.namingConvention;
    if (!nc) {
        return [];
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const trimmed = line.trim();

    if (nc.scoreboardObjective) {
        const result = getPatternAndLabel(nc.scoreboardObjective);
        if (result) {
            const { pattern, label } = result;
            const objAddMatch = SCOREBOARD_OBJ_ADD_RE.exec(trimmed);
            if (objAddMatch) {
                const name = objAddMatch[1];
                pushNameDiagnostic(diagnostics, name, lineIndex, pattern, label, () =>
                    line.indexOf(name, line.indexOf("add") + 3),
                );
            }

            const playersMatch = SCOREBOARD_PLAYERS_RE.exec(trimmed);
            if (playersMatch) {
                const objective = playersMatch[2];
                pushNameDiagnostic(diagnostics, objective, lineIndex, pattern, label, () => {
                    const searchFrom = line.indexOf(playersMatch[1]) + playersMatch[1].length;
                    return line.indexOf(objective, searchFrom);
                });
            }
        }
    }

    if (nc.tag) {
        const result = getPatternAndLabel(nc.tag);
        if (result) {
            const tagMatch = TAG_ADD_RE.exec(trimmed);
            if (tagMatch) {
                const name = tagMatch[1];
                pushNameDiagnostic(diagnostics, name, lineIndex, result.pattern, result.label, () =>
                    line.lastIndexOf(name),
                );
            }
        }
    }

    if (nc.team) {
        const result = getPatternAndLabel(nc.team);
        if (result) {
            const teamMatch = TEAM_ADD_RE.exec(trimmed);
            if (teamMatch) {
                const name = teamMatch[1];
                pushNameDiagnostic(diagnostics, name, lineIndex, result.pattern, result.label, () =>
                    line.lastIndexOf(name),
                );
            }
        }
    }

    return diagnostics;
}
