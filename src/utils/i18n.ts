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
    | "executeAtChainRedundantFix"
    | "executeReturnRedundant"
    | "executeReturnRedundantFix"
    | "executeReturnWithAs"
    | "executeReturnWithAsFix"
    | "executeAsIfEntitySMerge"
    | "executeAsIfEntitySMergeFix"
    | "executeAsIfEntitySConvert"
    | "executeAsIfEntitySConvertFix"
    | "executeAsIfEntityRemoveAs"
    | "executeAsIfEntityRemoveAsFix"
    | "unreachableCondition"
    | "unreachableConditionFix"
    | "alwaysPassCondition"
    | "alwaysPassConditionFix"
    | "selectorNbtToIfData"
    | "selectorNbtToIfDataFix"
    | "returnRunDuplicate"
    | "returnRunDuplicateFix";

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
        executeReturnRedundant: "if/unless 없이 return을 실행하는 execute는 불필요합니다.",
        executeReturnRedundantFix: "execute 제거",
        executeReturnWithAs: "as로 return을 실행하는 것은 if entity로 대체할 수 있습니다.",
        executeReturnWithAsFix: "if entity로 변환",
        executeAsIfEntitySMerge: "as와 if entity @s의 속성을 병합할 수 있습니다.",
        executeAsIfEntitySMergeFix: "속성 병합",
        executeAsIfEntitySConvert: "속성 충돌로 병합 불가. as를 if entity로 변환하세요.",
        executeAsIfEntitySConvertFix: "as를 if entity로 변환",
        executeAsIfEntityRemoveAs: "if entity가 @s가 아니면 as는 불필요합니다.",
        executeAsIfEntityRemoveAsFix: "as 제거",
        unreachableCondition: "이 조건은 절대 통과할 수 없습니다.",
        unreachableConditionFix: "해당 줄 삭제",
        alwaysPassCondition: "이 조건은 항상 통과합니다.",
        alwaysPassConditionFix: "조건 제거",
        selectorNbtToIfData: "nbt 속성은 if data entity로 사용하는 것이 성능에 좋습니다.",
        selectorNbtToIfDataFix: "if data entity로 변환",
        returnRunDuplicate: "return run 뒤에 return을 중복 사용할 수 없습니다.",
        returnRunDuplicateFix: "해당 줄 삭제",
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
        executeReturnRedundant: "execute with return without if/unless is redundant.",
        executeReturnRedundantFix: "Remove execute",
        executeReturnWithAs: "Using as with return can be replaced with if entity.",
        executeReturnWithAsFix: "Convert to if entity",
        executeAsIfEntitySMerge: "as and if entity @s properties can be merged.",
        executeAsIfEntitySMergeFix: "Merge properties",
        executeAsIfEntitySConvert: "Property conflict. Convert as to if entity.",
        executeAsIfEntitySConvertFix: "Convert as to if entity",
        executeAsIfEntityRemoveAs: "as is redundant when if entity is not @s.",
        executeAsIfEntityRemoveAsFix: "Remove as",
        unreachableCondition: "This condition will never pass.",
        unreachableConditionFix: "Remove this line",
        alwaysPassCondition: "This condition will always pass.",
        alwaysPassConditionFix: "Remove condition",
        selectorNbtToIfData: "Using nbt in selector is less performant than if data entity.",
        selectorNbtToIfDataFix: "Convert to if data entity",
        returnRunDuplicate: "Cannot use return after return run.",
        returnRunDuplicateFix: "Remove this line",
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
