import * as vscode from "vscode";
import koData from "./i18n/ko.json";
import enData from "./i18n/en.json";

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
    | "executeDuplicateRemoveFix"
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
    | "unreachableCondition"
    | "unreachableConditionFix"
    | "alwaysPassCondition"
    | "alwaysPassConditionFix"
    | "returnRunDuplicate"
    | "returnRunDuplicateFix"
    | "executeRunRedundantRunExecute"
    | "executeRunRedundantRunExecuteFix"
    | "scoreboardFakePlayerMissingHash"
    | "scoreboardFakePlayerMissingHashFix"
    | "nbtItemsUseIfItems";

interface I18nData {
    message: Record<string, string>;
    fix: Record<string, string>;
}

const messages: Record<string, I18nData> = {
    ko: koData as I18nData,
    en: enData as I18nData,
};

function getLanguage(): string {
    const lang = vscode.env.language;
    return lang.startsWith("ko") ? "ko" : "en";
}

function getMessage(key: string, lang: string): string {
    const data = messages[lang];

    if (key.endsWith("Fix")) {
        const baseKey = key.replace("Fix", "");
        return data.fix[baseKey] || "";
    }

    return data.message[key] || "";
}

export function t(key: MessageKey): string {
    const lang = getLanguage();
    const message = getMessage(key, lang);

    if (!message) {
        const fallbackLang = lang === "ko" ? "en" : "ko";
        return getMessage(key, fallbackLang) || key;
    }

    return message;
}