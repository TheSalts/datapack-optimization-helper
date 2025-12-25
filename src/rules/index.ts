import * as vscode from "vscode";
import { checkPreferTellraw } from "./preferTellraw";

export function analyzeCommand(lineIndex: number, line: string): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];

    const tellrawDiag = checkPreferTellraw(lineIndex, line);
    if (tellrawDiag) {
        diagnostics.push(tellrawDiag);
    }

    // TODO: 여기에 추가 규칙을 등록하세요
    // 예시:
    // - execute 중첩 최적화
    // - 셀렉터 최적화 (@e[type=...] vs @e[type=!...])
    // - 불필요한 명령어 감지

    return diagnostics;
}

