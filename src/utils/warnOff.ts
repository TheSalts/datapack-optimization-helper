import { RuleName } from "./config";

export const ALL_RULE_IDS: readonly RuleName[] = [
    "always-pass-condition",
    "execute-as-if-entity-s-convert",
    "execute-as-if-entity-s-merge",
    "execute-as-s-redundant",
    "execute-duplicate",
    "execute-group",
    "execute-run-redundant",
    "execute-run-redundant-run-execute",
    "execute-unnecessary",
    "infinite-recursion",
    "nbt-items-use-if-items",
    "return-run-duplicate",
    "scoreboard-fake-player-missing-hash",
    "target-selector-no-dimension",
    "target-selector-no-type",
    "target-selector-type-order",
    "unreachable-code",
    "unreachable-condition",
] as const;

const WARN_OFF_PATTERN = /^#\s*warn-off(?:\s+(.*))?$/i;
const WARN_OFF_FILE_PATTERN = /^#\s*warn-off-file(?:\s+(.*))?$/i;

function parseRuleList(content: string | undefined): Set<string> {
    const rules = new Set<string>();
    if (!content || content.trim() === "") {
        ALL_RULE_IDS.forEach((id) => rules.add(id));
        return rules;
    }
    const items = content.split(/\s+/).map((s) => s.trim().toLowerCase());
    for (const item of items) {
        if (item === "all") {
            ALL_RULE_IDS.forEach((id) => rules.add(id));
        } else if (item) {
            rules.add(item);
        }
    }
    return rules;
}

export function parseWarnOff(line: string): Set<string> | null {
    const match = line.match(WARN_OFF_PATTERN);
    if (!match) {
        return null;
    }
    return parseRuleList(match[1]);
}

export function parseWarnOffFile(lines: string[]): Set<string> {
    const disabledRules = new Set<string>();
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "" || (trimmed.startsWith("#") && !WARN_OFF_FILE_PATTERN.test(trimmed))) {
            continue;
        }
        if (!trimmed.startsWith("#")) {
            break;
        }
        const match = trimmed.match(WARN_OFF_FILE_PATTERN);
        if (match) {
            const rules = parseRuleList(match[1]);
            rules.forEach((r) => disabledRules.add(r));
        }
    }
    return disabledRules;
}

export function getDisabledRulesForLine(
    lines: string[],
    lineIndex: number,
    fileDisabledRules: Set<string>,
): Set<string> {
    const disabled = new Set(fileDisabledRules);
    for (let i = lineIndex - 1; i >= 0; i--) {
        const prevLine = lines[i].trim();
        if (prevLine === "") {
            continue;
        }
        if (!prevLine.startsWith("#")) {
            break;
        }
        const lineRules = parseWarnOff(prevLine);
        if (lineRules) {
            lineRules.forEach((r) => disabled.add(r));
        }
        break;
    }
    return disabled;
}

export function isRuleDisabled(ruleId: string, disabledRules: Set<string>): boolean {
    return disabledRules.has(ruleId.toLowerCase());
}
