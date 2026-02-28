import { performance } from "perf_hooks";
import { tokenize } from "../../parser/tokenizer";
import { findSelectors } from "../../parser/selectorParser";
import { processScoreboardLine, ScoreState } from "../../analyzer/scoreTracker";
import { fixExecuteRunRedundant } from "../../codeActions/executeRunFix";
import { fixExecuteAsS } from "../../codeActions/executeAsSFix";
import { SHORT_FIXTURE, MEDIUM_FIXTURE, LARGE_FIXTURE } from "../fixtures/mcfunction";

interface PipelineResult {
    label: string;
    lines: number;
    iterations: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    linesPerSec: number;
}

/**
 * Simulates a full analysis pipeline for a file:
 * 1. Tokenize each line
 * 2. Find selectors
 * 3. Process scoreboard state tracking
 * 4. Attempt fix transformations
 */
function analyzeFile(lines: string[]): void {
    const scoreStates = new Map<string, ScoreState>();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === "" || trimmed.startsWith("#")) {
            continue;
        }

        // Tokenize
        tokenize(line);

        // Find selectors
        findSelectors(line);

        // Score tracking
        processScoreboardLine(trimmed, scoreStates, i);

        // Attempt fixes
        fixExecuteRunRedundant(line);
        fixExecuteAsS(line);
    }
}

function benchPipeline(label: string, lines: string[], iterations = 1000): PipelineResult {
    // Warmup
    for (let i = 0; i < 10; i++) { analyzeFile(lines); }

    const times: number[] = [];
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        analyzeFile(lines);
        times.push(performance.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    return {
        label,
        lines: lines.length,
        iterations,
        avgMs: avg,
        minMs: min,
        maxMs: max,
        linesPerSec: (lines.length * 1000) / avg,
    };
}

function printPipelineResults(results: PipelineResult[]) {
    const labelWidth = 20;
    const header = `${"Fixture".padEnd(labelWidth)} | ${"Lines".padStart(6)} | ${"Iters".padStart(6)} | ${"Avg (ms)".padStart(12)} | ${"Min (ms)".padStart(12)} | ${"Max (ms)".padStart(12)} | ${"lines/sec".padStart(12)}`;
    const separator = "-".repeat(header.length);

    console.log("\n" + separator);
    console.log(header);
    console.log(separator);

    for (const r of results) {
        console.log(
            `${r.label.padEnd(labelWidth)} | ${String(r.lines).padStart(6)} | ${String(r.iterations).padStart(6)} | ${r.avgMs.toFixed(4).padStart(12)} | ${r.minMs.toFixed(4).padStart(12)} | ${r.maxMs.toFixed(4).padStart(12)} | ${r.linesPerSec.toFixed(0).padStart(12)}`,
        );
    }
    console.log(separator + "\n");
}

suite("Pipeline Benchmarks", () => {
    test("full analysis pipeline", function () {
        this.timeout(30000);

        const results: PipelineResult[] = [];
        results.push(benchPipeline("Short (10 lines)", SHORT_FIXTURE, 5000));
        results.push(benchPipeline("Medium (100 lines)", MEDIUM_FIXTURE, 1000));
        results.push(benchPipeline("Large (500 lines)", LARGE_FIXTURE, 200));

        printPipelineResults(results);
    });
});
