# Refactoring Checklist

Priority: medium (🟡) and above.

## 🔴 Immediate Bugs

- [ ] **#19** — Debounce timer not cleared on document close (`extension.ts`)
- [ ] **#12** — `line.indexOf(match)` position bug; use `match.index` + whitespace offset instead (`unreachableCondition.ts`, `alwaysPassCondition.ts`, `conditionDefinition.ts`)

## 🔴 High

- [ ] **#1** — Score tracking logic duplicated across 4 files → consolidate into `analyzer/scoreTracker.ts`

## 🟡 Medium-High

- [ ] **#17** — Execute tokenizer duplicated in `executeGroup.ts` / `executeRedundant.ts` → consolidate into `parser/tokenizer.ts`
- [ ] **#2** — `parseArgs` duplicated in `executeAsIfEntity.ts` / `executeAsIfEntityFix.ts`; `parseAllSelectors` near-duplicate of `parseSelectors` → consolidate into `parser/selectorParser.ts`
- [ ] **#10** — Regex patterns scattered across files → consolidate into `parser/patterns.ts`

## 🟡 Medium

- [ ] **#3** — CodeAction text-replace boilerplate in every fix file → extract `createLineReplaceFix` helper into `codeActions/utils.ts`
- [ ] **#4** — `provider.ts`'s `applyAllFixes` re-implements rule logic with regexes → have rule files export a `fix(line): string | null` pure function
- [ ] **#5** — Module-level mutable state in `functionIndex.ts` → wrap into `FunctionIndex` class, export singleton
- [ ] **#16** — `renameHandler.ts` re-scans all files on rename → use `callerGraph` to limit search scope
