---
name: test
description: Run unit tests for the project. Use when the user asks to test, verify, or check code correctness.
argument-hint: "[module]"
disable-model-invocation: true
allowed-tools: Bash(npx tsc *), Bash(npx mocha *), Bash(npm run *)
---

# Run Unit Tests

Compile and run the unit test suite for this VSCode extension project.

## Steps

1. Compile TypeScript tests:
   ```
   npx tsc -p . --outDir out
   ```

2. Run unit tests based on arguments:
   - If `$ARGUMENTS` specifies a module (`parser`, `analyzer`, `codeActions`, or `rules`), run only that module:
     ```
     npx mocha --ui tdd --require out/test/vscode-mock.js "out/test/$ARGUMENTS/**/*.test.js"
     ```
   - If no arguments, run all unit tests:
     ```
     npm run test:unit
     ```

3. Analyze results:
   - If all tests pass, report the count and time.
   - If any tests fail, read the failing test file and the source file it tests, diagnose the root cause, and suggest a fix.

## Available modules

| Module | Tests | Source |
|--------|-------|--------|
| `parser` | `src/test/parser/*.test.ts` | `src/parser/` |
| `analyzer` | `src/test/analyzer/*.test.ts` | `src/analyzer/` |
| `codeActions` | `src/test/codeActions/*.test.ts` | `src/codeActions/` |
| `rules` | `src/test/rules/*.test.ts` | `src/rules/` |
