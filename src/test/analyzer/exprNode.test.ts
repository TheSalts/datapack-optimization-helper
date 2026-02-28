import * as assert from "assert";
import {
    varNode,
    numNode,
    binNode,
    opPrecedence,
    exprToString,
    simplifyExpr,
    toInt32,
    detectCompoundAssignment,
    stripCommonObjective,
} from "../../analyzer/exprNode";

suite("node constructors", () => {
    test("varNode", () => {
        const n = varNode("x:v");
        assert.strictEqual(n.kind, "var");
        assert.strictEqual(n.key, "x:v");
    });

    test("numNode", () => {
        const n = numNode(42);
        assert.strictEqual(n.kind, "num");
        assert.strictEqual(n.value, 42);
    });

    test("binNode", () => {
        const n = binNode("+", numNode(1), numNode(2));
        assert.strictEqual(n.kind, "bin");
        assert.strictEqual(n.op, "+");
    });
});

suite("opPrecedence", () => {
    test("+ and - are 1", () => {
        assert.strictEqual(opPrecedence("+"), 1);
        assert.strictEqual(opPrecedence("-"), 1);
    });

    test("*, /, % are 2", () => {
        assert.strictEqual(opPrecedence("*"), 2);
        assert.strictEqual(opPrecedence("/"), 2);
        assert.strictEqual(opPrecedence("%"), 2);
    });

    test("unknown op is 0", () => {
        assert.strictEqual(opPrecedence("??"), 0);
    });
});

suite("exprToString", () => {
    test("number", () => {
        assert.strictEqual(exprToString(numNode(42)), "42");
    });

    test("variable", () => {
        assert.strictEqual(exprToString(varNode("#a:v")), "#a:v");
    });

    test("simple binary", () => {
        assert.strictEqual(exprToString(binNode("+", numNode(1), numNode(2))), "1 + 2");
    });

    test("nested with parentheses", () => {
        // (1 + 2) * 3 — left needs parens
        const expr = binNode("*", binNode("+", numNode(1), numNode(2)), numNode(3));
        assert.strictEqual(exprToString(expr), "(1 + 2) * 3");
    });

    test("no unnecessary parens", () => {
        // 1 * 2 + 3 — no parens needed
        const expr = binNode("+", binNode("*", numNode(1), numNode(2)), numNode(3));
        assert.strictEqual(exprToString(expr), "1 * 2 + 3");
    });

    test("right associativity needs parens for subtraction", () => {
        // 10 - (5 - 3)
        const expr = binNode("-", numNode(10), binNode("-", numNode(5), numNode(3)));
        assert.strictEqual(exprToString(expr), "10 - (5 - 3)");
    });
});

suite("toInt32", () => {
    test("normal number", () => {
        assert.strictEqual(toInt32(42), 42);
    });

    test("overflow wraps", () => {
        assert.strictEqual(toInt32(2147483648), -2147483648);
    });

    test("negative", () => {
        assert.strictEqual(toInt32(-1), -1);
    });
});

suite("simplifyExpr", () => {
    test("constant folding addition", () => {
        const expr = binNode("+", numNode(3), numNode(4));
        const result = simplifyExpr(expr);
        assert.strictEqual(result.kind, "num");
        assert.strictEqual(result.value, 7);
    });

    test("constant folding multiplication", () => {
        const expr = binNode("*", numNode(3), numNode(4));
        const result = simplifyExpr(expr);
        assert.strictEqual(result.kind, "num");
        assert.strictEqual(result.value, 12);
    });

    test("x * 1 = x", () => {
        const expr = binNode("*", varNode("x"), numNode(1));
        const result = simplifyExpr(expr);
        assert.strictEqual(result.kind, "var");
        assert.strictEqual(result.key, "x");
    });

    test("x * 0 = 0", () => {
        const expr = binNode("*", varNode("x"), numNode(0));
        const result = simplifyExpr(expr);
        assert.strictEqual(result.kind, "num");
        assert.strictEqual(result.value, 0);
    });

    test("x / x = 1", () => {
        const expr = binNode("/", varNode("x"), varNode("x"));
        const result = simplifyExpr(expr);
        assert.strictEqual(result.kind, "num");
        assert.strictEqual(result.value, 1);
    });

    test("x % x = 0", () => {
        const expr = binNode("%", varNode("x"), varNode("x"));
        const result = simplifyExpr(expr);
        assert.strictEqual(result.kind, "num");
        assert.strictEqual(result.value, 0);
    });

    test("x / 1 = x", () => {
        const expr = binNode("/", varNode("x"), numNode(1));
        const result = simplifyExpr(expr);
        assert.strictEqual(result.kind, "var");
    });

    test("combines like terms: x + x = 2 * x", () => {
        const expr = binNode("+", varNode("x"), varNode("x"));
        const result = simplifyExpr(expr);
        assert.strictEqual(exprToString(result), "2 * x");
    });

    test("constant folding with division by zero preserved", () => {
        const expr = binNode("/", numNode(5), numNode(0));
        const result = simplifyExpr(expr);
        assert.strictEqual(result.kind, "bin");
    });

    test("nested simplification", () => {
        // (3 + 4) * 2 → 14
        const expr = binNode("*", binNode("+", numNode(3), numNode(4)), numNode(2));
        const result = simplifyExpr(expr);
        assert.strictEqual(result.kind, "num");
        assert.strictEqual(result.value, 14);
    });
});

suite("detectCompoundAssignment", () => {
    test("detects x = x + 5", () => {
        const expr = binNode("+", varNode("x"), numNode(5));
        const result = detectCompoundAssignment("x", expr);
        assert.ok(result);
        assert.strictEqual(result.op, "+=");
        assert.strictEqual(result.rhs.kind, "num");
        assert.strictEqual(result.rhs.value, 5);
    });

    test("detects x = x * 3", () => {
        const expr = binNode("*", varNode("x"), numNode(3));
        const result = detectCompoundAssignment("x", expr);
        assert.ok(result);
        assert.strictEqual(result.op, "*=");
    });

    test("returns null for non-compound", () => {
        const expr = binNode("+", varNode("y"), numNode(5));
        assert.strictEqual(detectCompoundAssignment("x", expr), null);
    });

    test("returns null for non-binary", () => {
        assert.strictEqual(detectCompoundAssignment("x", numNode(5)), null);
    });
});

suite("stripCommonObjective", () => {
    test("strips when all vars share objective", () => {
        const expr = binNode("+", varNode("#a:var"), varNode("#b:var"));
        const result = stripCommonObjective(expr);
        assert.strictEqual(exprToString(result), "#a + #b");
    });

    test("does not strip when objectives differ", () => {
        const expr = binNode("+", varNode("#a:var"), varNode("#b:obj"));
        const result = stripCommonObjective(expr);
        assert.strictEqual(exprToString(result), "#a:var + #b:obj");
    });

    test("does not strip single var (but strips objective)", () => {
        const result = stripCommonObjective(varNode("#a:var"));
        assert.strictEqual(exprToString(result), "#a");
    });
});
