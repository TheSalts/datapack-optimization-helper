import * as vscode from "vscode";

type MessageKey =
    | "unreachableCode"
    | "unreachableCodeFix"
    | "targetSelectorNoType"
    | "targetSelectorNoDimension"
    | "targetSelectorNoDimensionFix"
    | "targetSelectorTypeOrder"
    | "targetSelectorTypeOrderFix"
    | "executeGroup"
    | "executeGroupFix"
    | "executeRunRedundant"
    | "executeRunRedundantFix"
    | "executeDuplicate"
    | "executeDuplicateFix"
    | "executeAsSRedundant"
    | "executeAsSRedundantFix"
    | "executeAtChainRedundant"
    | "executeAtChainRedundantFix";

const messages: Record<string, Record<MessageKey, string>> = {
    ko: {
        unreachableCode: "이 코드는 실행되지 않습니다.",
        unreachableCodeFix: "도달할 수 없는 코드 삭제",
        targetSelectorNoType: "type 인자를 추가하세요.",
        targetSelectorNoDimension: "차원 제한(x, y, z, distance)을 추가하세요.",
        targetSelectorNoDimensionFix: "x=0 추가",
        targetSelectorTypeOrder: "type은 마지막에 배치하는 것이 성능에 좋습니다.",
        targetSelectorTypeOrderFix: "type을 맨 뒤로 이동",
        executeGroup: "동일한 execute 접두사를 가진 명령어들을 function으로 묶을 수 있습니다.",
        executeGroupFix: "function으로 추출",
        executeRunRedundant: "execute run은 불필요합니다.",
        executeRunRedundantFix: "execute run 삭제",
        executeDuplicate: "중복된 execute 속성이 있습니다.",
        executeDuplicateFix: "중복 속성 삭제",
        executeAsSRedundant: "as @s는 불필요합니다.",
        executeAsSRedundantFix: "as @s 삭제",
        executeAtChainRedundant: "연속된 at 중 앞의 at은 불필요합니다.",
        executeAtChainRedundantFix: "앞의 at 삭제",
    },
    en: {
        unreachableCode: "This code will never be executed.",
        unreachableCodeFix: "Remove unreachable code",
        targetSelectorNoType: "Add type argument.",
        targetSelectorNoDimension: "Add dimension limit (x, y, z, distance).",
        targetSelectorNoDimensionFix: "Add x=0",
        targetSelectorTypeOrder: "Placing type at the end improves performance.",
        targetSelectorTypeOrderFix: "Move type to end",
        executeGroup: "Commands with the same execute prefix can be grouped into a function.",
        executeGroupFix: "Extract to function",
        executeRunRedundant: "execute run is redundant.",
        executeRunRedundantFix: "Remove execute run",
        executeDuplicate: "Duplicate execute subcommand found.",
        executeDuplicateFix: "Remove duplicate",
        executeAsSRedundant: "as @s is redundant.",
        executeAsSRedundantFix: "Remove as @s",
        executeAtChainRedundant: "The first at in chained at is redundant.",
        executeAtChainRedundantFix: "Remove first at",
    },
};

function getLanguage(): string {
    const lang = vscode.env.language;
    return lang.startsWith("ko") ? "ko" : "en";
}

export function t(key: MessageKey): string {
    const lang = getLanguage();
    return messages[lang]?.[key] ?? messages["en"][key];
}
