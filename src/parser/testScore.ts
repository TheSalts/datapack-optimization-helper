import { ScoreState } from "../analyzer/scoreTracker";
import {
    SCORE_SET_RE,
    SCORE_ADD_RE,
    SCORE_RESET_RE,
    SCORE_OPERATION_RE,
    SCORE_STORE_RE,
    SCORE_CONDITION_RE,
} from "./patterns";

const TEST_SCORE_PATTERN = /^#\s*test-score\s+(\S+)\s+(\S+)\s+(-?\d+)\s*$/i;

export function processTestScoreLine(
    trimmed: string,
    scoreStates: Map<string, ScoreState>,
    lineIndex: number,
): boolean {
    const match = trimmed.match(TEST_SCORE_PATTERN);
    if (!match) {
        return false;
    }
    const [, target, objective, rawValue] = match;
    const value = parseInt(rawValue, 10);
    const key = `${target}:${objective}`;
    scoreStates.set(key, {
        target,
        objective,
        type: "known",
        value,
        line: lineIndex,
    });
    return true;
}

export interface ScoreReference {
    target: string;
    objective: string;
}

export function collectScoreReferences(lines: string[]): ScoreReference[] {
    const seen = new Set<string>();
    const refs: ScoreReference[] = [];

    function add(target: string, objective: string) {
        const key = `${target}:${objective}`;
        if (!seen.has(key)) {
            seen.add(key);
            refs.push({ target, objective });
        }
    }

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "" || trimmed.startsWith("#")) {
            continue;
        }

        let m;
        if ((m = SCORE_SET_RE.exec(trimmed))) {
            add(m[1], m[2]);
        }
        if ((m = SCORE_ADD_RE.exec(trimmed))) {
            add(m[2], m[3]);
        }
        if ((m = SCORE_RESET_RE.exec(trimmed)) && m[2]) {
            add(m[1], m[2]);
        }
        if ((m = SCORE_OPERATION_RE.exec(trimmed))) {
            add(m[1], m[2]);
            add(m[4], m[5]);
        }
        if ((m = SCORE_STORE_RE.exec(trimmed))) {
            add(m[2], m[3]);
        }

        const condRegex = new RegExp(SCORE_CONDITION_RE.source, "g");
        while ((m = condRegex.exec(trimmed)) !== null) {
            add(m[2], m[3]);
        }
    }

    return refs;
}
