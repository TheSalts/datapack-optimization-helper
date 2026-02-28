---
name: bench
description: Run performance benchmarks measuring function execution time and analysis pipeline throughput.
argument-hint: "[functions|pipeline]"
disable-model-invocation: true
allowed-tools: Bash(npx tsc *), Bash(npx mocha *), Bash(npm run *)
---

# Run Performance Benchmarks

Compile and run benchmarks for this project's parser, analyzer, and fix functions.

## Steps

1. Compile TypeScript:
   ```
   npx tsc -p . --outDir out
   ```

2. Run benchmarks based on arguments:
   - `functions` — individual function benchmarks only:
     ```
     npx mocha --ui tdd --require out/test/vscode-mock.js --timeout 30000 "out/test/benchmark/functions.bench.js"
     ```
   - `pipeline` — full analysis pipeline benchmarks only:
     ```
     npx mocha --ui tdd --require out/test/vscode-mock.js --timeout 30000 "out/test/benchmark/pipeline.bench.js"
     ```
   - No arguments — run all benchmarks:
     ```
     npm run test:bench
     ```

3. Analyze the results table and report:
   - Any individual function with avg > 0.01ms (potential bottleneck)
   - Pipeline throughput: if 500-line file analysis exceeds 5ms, flag as performance concern
   - Compare relative performance across functions to identify outliers

## Benchmark files

| File | What it measures |
|------|-----------------|
| `src/test/benchmark/functions.bench.ts` | Individual function execution time (tokenize, parseArgs, parseRange, fix functions, etc.) |
| `src/test/benchmark/pipeline.bench.ts` | End-to-end file analysis (10/100/500 lines) with tokenization + selector finding + score tracking + fixes |
| `src/test/fixtures/mcfunction.ts` | Test fixtures: SHORT (10 lines), MEDIUM (100 lines), LARGE (500 lines) |
