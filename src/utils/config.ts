import * as vscode from 'vscode';

export function getUserConfig(scope?: vscode.TextDocument | vscode.Uri) {
    const uri = scope instanceof vscode.Uri ? scope : scope?.uri;
    const config = vscode.workspace.getConfiguration('cslediagnostic', uri);
    const excludeNames = config.get<string[]>('excludeNames', []);
    const byLanguage = config.get<Record<string, string>>('excludeNamesByLanguage', {});
    const languageId = scope instanceof vscode.Uri ? undefined : scope?.languageId;
    const languageNames = languageId ? parseNameList(byLanguage?.[languageId]) : [];
    return {
        checkGlyph: config.get<string>('checkGlyph', vscode.l10n.t('Simplified Chinese')),
        convertGlyph: config.get<string>('convertGlyph', vscode.l10n.t('Chinese (Taiwan)')),
        checkLiteralExpression: config.get<boolean>('checkLiteralExpression', true),
        checkDocComment: config.get<boolean>('checkDocComment', false),
        excludeNames: languageNames.length ? [...new Set([...excludeNames, ...languageNames])] : excludeNames,
    };
}

/** 解析以逗号（含中文逗号）分隔的名称列表 */
export function parseNameList(value: unknown): string[] {
    if (typeof value !== 'string') {return [];}
    return value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
}
