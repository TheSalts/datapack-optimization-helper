export type ExprNode =
    | { kind: "var"; key: string }
    | { kind: "num"; value: number }
    | { kind: "bin"; op: string; left: ExprNode; right: ExprNode };

export function varNode(key: string): ExprNode {
    return { kind: "var", key };
}

export function numNode(value: number): ExprNode {
    return { kind: "num", value };
}

export function binNode(op: string, left: ExprNode, right: ExprNode): ExprNode {
    return { kind: "bin", op, left, right };
}

export function opPrecedence(op: string): number {
    if (op === "*" || op === "/" || op === "%") {
        return 2;
    }
    if (op === "+" || op === "-") {
        return 1;
    }
    return 0;
}

function needsParens(child: ExprNode, parentOp: string, side: "left" | "right"): boolean {
    if (child.kind !== "bin") {
        return false;
    }
    const childPrec = opPrecedence(child.op);
    const parentPrec = opPrecedence(parentOp);
    if (childPrec < parentPrec) {
        return true;
    }
    if (side === "right" && childPrec === parentPrec && (parentOp === "-" || parentOp === "/" || parentOp === "%")) {
        return true;
    }
    return false;
}

export function exprToString(node: ExprNode): string {
    if (node.kind === "num") {
        return String(node.value);
    }
    if (node.kind === "var") {
        return node.key;
    }
    const leftStr = needsParens(node.left, node.op, "left")
        ? `(${exprToString(node.left)})` : exprToString(node.left);
    const rightStr = needsParens(node.right, node.op, "right")
        ? `(${exprToString(node.right)})` : exprToString(node.right);
    return `${leftStr} ${node.op} ${rightStr}`;
}

// --- Simplification ---

interface Term {
    coeff: number;
    node: ExprNode;
}

function exprKey(node: ExprNode): string {
    if (node.kind === "var") {
        return `var:${node.key}`;
    }
    if (node.kind === "num") {
        return `num:${node.value}`;
    }
    return `expr:${exprToString(node)}`;
}

function collectAdditiveTerms(node: ExprNode, sign: number, terms: Term[]): void {
    if (node.kind === "bin" && (node.op === "+" || node.op === "-")) {
        collectAdditiveTerms(node.left, sign, terms);
        const rightSign = node.op === "-" ? -sign : sign;
        collectAdditiveTerms(node.right, rightSign, terms);
        return;
    }

    // Check for coefficient: num * expr or expr * num
    if (node.kind === "bin" && node.op === "*") {
        if (node.left.kind === "num") {
            terms.push({ coeff: sign * node.left.value, node: node.right });
            return;
        }
        if (node.right.kind === "num") {
            terms.push({ coeff: sign * node.right.value, node: node.left });
            return;
        }
    }

    if (node.kind === "num") {
        terms.push({ coeff: sign * node.value, node: numNode(1) });
        return;
    }

    terms.push({ coeff: sign, node });
}

function buildFromTerms(groups: { coeff: number; node: ExprNode }[]): ExprNode {
    if (groups.length === 0) {
        return numNode(0);
    }

    let result: ExprNode | null = null;

    for (const { coeff, node } of groups) {
        let term: ExprNode;
        if (node.kind === "num" && node.value === 1) {
            // Pure constant
            term = numNode(Math.abs(coeff));
        } else if (Math.abs(coeff) === 1) {
            term = node;
        } else {
            term = binNode("*", numNode(Math.abs(coeff)), node);
        }

        if (result === null) {
            if (coeff < 0) {
                if (node.kind === "num" && node.value === 1) {
                    result = numNode(coeff);
                } else {
                    result = binNode("*", numNode(coeff), node);
                }
            } else {
                result = term;
            }
        } else {
            if (coeff < 0) {
                result = binNode("-", result, term);
            } else {
                result = binNode("+", result, term);
            }
        }
    }

    return result!;
}

function simplifyAdditiveChain(node: ExprNode): ExprNode {
    const terms: Term[] = [];
    collectAdditiveTerms(node, 1, terms);

    // Group by canonical key
    const groupMap = new Map<string, { coeff: number; node: ExprNode }>();
    const order: string[] = [];
    let constSum = 0;
    let hasConst = false;

    for (const term of terms) {
        if (term.node.kind === "num" && term.node.value === 1) {
            // Pure constant term
            constSum += term.coeff;
            hasConst = true;
            continue;
        }

        const key = exprKey(term.node);
        const existing = groupMap.get(key);
        if (existing) {
            existing.coeff += term.coeff;
        } else {
            groupMap.set(key, { coeff: term.coeff, node: term.node });
            order.push(key);
        }
    }

    // Build result groups (preserving order, filtering zero coefficients)
    const groups: { coeff: number; node: ExprNode }[] = [];
    for (const key of order) {
        const group = groupMap.get(key)!;
        if (group.coeff !== 0) {
            groups.push(group);
        }
    }

    if (hasConst && constSum !== 0) {
        groups.push({ coeff: constSum, node: numNode(1) });
    }

    if (groups.length === 0) {
        return numNode(0);
    }

    return buildFromTerms(groups);
}

function foldConstBin(op: string, left: number, right: number): ExprNode {
    switch (op) {
        case "+": return numNode(left + right);
        case "-": return numNode(left - right);
        case "*": return numNode(left * right);
        case "/": return right === 0 ? binNode(op, numNode(left), numNode(right)) : numNode(Math.trunc(left / right));
        case "%": return right === 0 ? binNode(op, numNode(left), numNode(right)) : numNode(left % right);
        default: return binNode(op, numNode(left), numNode(right));
    }
}

const COMPOUND_OPS: Record<string, string> = {
    "+": "+=",
    "-": "-=",
    "*": "*=",
    "/": "/=",
    "%": "%=",
};

/**
 * Detect `key = key op X` pattern and return compound assignment form.
 * Returns { op: "+=", rhs: ExprNode } or null.
 */
export function detectCompoundAssignment(
    key: string,
    expr: ExprNode,
): { op: string; rhs: ExprNode } | null {
    if (expr.kind !== "bin") {
        return null;
    }
    const compoundOp = COMPOUND_OPS[expr.op];
    if (!compoundOp) {
        return null;
    }
    // Check if left side is the key itself
    if (expr.left.kind === "var" && expr.left.key === key) {
        return { op: compoundOp, rhs: expr.right };
    }
    return null;
}

/**
 * Strip common objective from all var nodes if they share the same one.
 * e.g., "#a:var + 3 * #b:var" → "#a + 3 * #b" when all objectives are "var"
 */
export function stripCommonObjective(node: ExprNode): ExprNode {
    const objectives = new Set<string>();
    collectObjectives(node, objectives);
    if (objectives.size !== 1) {
        return node;
    }
    const commonObj = objectives.values().next().value!;
    return stripObjective(node, commonObj);
}

function collectObjectives(node: ExprNode, objectives: Set<string>): void {
    if (node.kind === "var") {
        const idx = node.key.lastIndexOf(":");
        if (idx >= 0) {
            objectives.add(node.key.substring(idx + 1));
        }
        return;
    }
    if (node.kind === "bin") {
        collectObjectives(node.left, objectives);
        collectObjectives(node.right, objectives);
    }
}

function stripObjective(node: ExprNode, obj: string): ExprNode {
    if (node.kind === "var") {
        const suffix = `:${obj}`;
        if (node.key.endsWith(suffix)) {
            return varNode(node.key.slice(0, -suffix.length));
        }
        return node;
    }
    if (node.kind === "bin") {
        return binNode(node.op, stripObjective(node.left, obj), stripObjective(node.right, obj));
    }
    return node;
}

function exprEquals(a: ExprNode, b: ExprNode): boolean {
    if (a.kind !== b.kind) {
        return false;
    }
    if (a.kind === "num" && b.kind === "num") {
        return a.value === b.value;
    }
    if (a.kind === "var" && b.kind === "var") {
        return a.key === b.key;
    }
    if (a.kind === "bin" && b.kind === "bin") {
        return a.op === b.op && exprEquals(a.left, b.left) && exprEquals(a.right, b.right);
    }
    return false;
}

function isNum(node: ExprNode, value: number): boolean {
    return node.kind === "num" && node.value === value;
}

function simplifyAlgebraic(node: ExprNode): ExprNode {
    if (node.kind !== "bin") {
        return node;
    }
    const { op, left, right } = node;

    // x / x = 1, x % x = 0
    if (op === "/" && exprEquals(left, right)) {
        return numNode(1);
    }
    if (op === "%" && exprEquals(left, right)) {
        return numNode(0);
    }

    // x * 1 = x, 1 * x = x
    if (op === "*") {
        if (isNum(right, 1)) { return left; }
        if (isNum(left, 1)) { return right; }
        if (isNum(right, 0) || isNum(left, 0)) { return numNode(0); }
    }

    // x / 1 = x, 0 / x = 0
    if (op === "/") {
        if (isNum(right, 1)) { return left; }
        if (isNum(left, 0)) { return numNode(0); }
    }

    // 0 % x = 0, x % 1 = 0, x % -1 = 0
    if (op === "%") {
        if (isNum(left, 0)) { return numNode(0); }
        if (isNum(right, 1) || isNum(right, -1)) { return numNode(0); }
    }

    return node;
}

export function simplifyExpr(node: ExprNode): ExprNode {
    if (node.kind !== "bin") {
        return node;
    }

    let simplified: ExprNode = {
        kind: "bin",
        op: node.op,
        left: simplifyExpr(node.left),
        right: simplifyExpr(node.right),
    };

    // Constant folding for any binary op
    if (simplified.left.kind === "num" && simplified.right.kind === "num") {
        return foldConstBin(simplified.op, simplified.left.value, simplified.right.value);
    }

    // Algebraic identities (x/x=1, x*1=x, etc.)
    simplified = simplifyAlgebraic(simplified);
    if (simplified.kind !== "bin") {
        return simplified;
    }

    // Flatten additive chains (combine like terms, sum constants)
    if (simplified.op === "+" || simplified.op === "-") {
        return simplifyAdditiveChain(simplified);
    }

    return simplified;
}
