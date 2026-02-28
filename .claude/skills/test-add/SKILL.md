---
name: test-add
description: Add unit tests for a specific source file or function. Use when the user asks to add tests, write tests, or improve test coverage.
argument-hint: "<source-file-path>"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(npx tsc *), Bash(npx mocha *)
---

# Add Unit Tests

Generate unit tests for a source file in this project.

## Steps

1. Read the source file at `$ARGUMENTS` to understand its exports and logic.

2. Determine which functions are **pure** (no VSCode API dependency) and testable without mocking.
   - Pure functions: take primitive types / plain objects, return computed results
   - VSCode-dependent: use `vscode.Range`, `vscode.Diagnostic`, `vscode.TextDocument`, etc.
   - Only write tests for pure functions. Skip VSCode-dependent functions.

3. Determine the test file path:
   - Source: `src/<module>/<file>.ts` → Test: `src/test/<module>/<file>.test.ts`
   - If the test file already exists, add new test cases to it instead of overwriting.

4. Write tests following these conventions:
   - Use Mocha TDD interface: `suite()` and `test()` (NOT `describe`/`it`)
   - Import `assert` from `"assert"`
   - Import source functions with relative path from test file
   - Test cases should cover: normal input, edge cases, null/empty input, error conditions
   - Keep test names descriptive and concise

5. Verify:
   ```
   npx tsc -p . --outDir out
   npx mocha --ui tdd --require out/test/vscode-mock.js "out/test/<module>/**/*.test.js"
   ```

## Project test structure

```
src/test/
├── vscode-mock.ts          # VSCode API mock (loaded via --require)
├── parser/                 # Tests for src/parser/
├── analyzer/               # Tests for src/analyzer/
├── codeActions/            # Tests for src/codeActions/
├── rules/                  # Tests for src/rules/
├── benchmark/              # Performance benchmarks
└── fixtures/               # Test data
```
