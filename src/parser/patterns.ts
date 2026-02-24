/**
 * Common mcfunction regex patterns.
 *
 * Centralising these prevents the subtle inconsistencies that arise when
 * each file maintains its own copy (e.g. functionIndex.ts omitting the `$?`
 * macro-prefix that conditionDefinition.ts handles with `\$?`).
 */

/** Matches a fully-qualified function reference: `namespace:path/to/func` */
export const FUNCTION_REF_RE = /[a-z0-9_.-]+:[a-z0-9_./-]+/i;

/**
 * Matches an unconditional function call at the start of a (trimmed) line,
 * optionally preceded by `execute … run` (with optional `$` macro prefix).
 * Capture group 1 = function path.
 */
export const FUNCTION_CALL_RE = /^(?:\$?execute\s+.*\s+run\s+)?function\s+([a-z0-9_.-]+:[a-z0-9_./-]+)/i;

/**
 * Matches a conditional `if/unless function` call anywhere on a line.
 * Capture group 1 = "if"/"unless", group 2 = function path.
 */
export const IF_FUNCTION_CALL_RE = /\b(if|unless)\s+function\s+([a-z0-9_.-]+:[a-z0-9_./-]+)/i;

/** Matches `scoreboard players set <target> <objective> <value>` */
export const SCORE_SET_RE = /^(?:\$?execute\s+.*\s+run\s+)?scoreboard\s+players\s+set\s+(\S+)\s+(\S+)\s+(-?\d+)/;

/** Matches `scoreboard players add|remove <target> <objective> <amount>` */
export const SCORE_ADD_RE =
    /^(?:\$?execute\s+.*\s+run\s+)?scoreboard\s+players\s+(add|remove)\s+(\S+)\s+(\S+)\s+(-?\d+)/;

/** Matches `scoreboard players reset <target> [<objective>]` */
export const SCORE_RESET_RE = /^(?:\$?execute\s+.*\s+run\s+)?scoreboard\s+players\s+reset\s+(\S+)(?:\s+(\S+))?/;

/** Matches `scoreboard players operation <target> <objective> <op> <srcTarget> <srcObjective>` */
export const SCORE_OPERATION_RE =
    /^(?:\$?execute\s+.*\s+run\s+)?scoreboard\s+players\s+operation\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/;

/** Matches `execute store result|success score <target> <objective>` */
export const SCORE_STORE_RE = /\bstore\s+(?:result|success)\s+score\s+(\S+)\s+(\S+)/;

/** Matches a score condition: `if|unless score <target> <objective> matches <range>` */
export const SCORE_CONDITION_RE = /\b(if|unless)\s+score\s+(\S+)\s+(\S+)\s+matches\s+(\S+)/;
