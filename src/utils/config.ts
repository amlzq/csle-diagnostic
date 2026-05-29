import * as vscode from 'vscode';

export function getUserConfig(scope?: vscode.TextDocument | vscode.Uri) {
    const uri = scope instanceof vscode.Uri ? scope : scope?.uri;
    const config = vscode.workspace.getConfiguration('cslediagnostic', uri);
    const excludeNamesInspect = config.inspect<string[]>('excludeNames');
    const excludeNamesHasUserValue =
        excludeNamesInspect?.workspaceFolderValue !== undefined ||
        excludeNamesInspect?.workspaceValue !== undefined ||
        excludeNamesInspect?.globalValue !== undefined;
    const excludeNames = excludeNamesHasUserValue
        ? config.get<string[]>('excludeNames', [])
        : config.get<string[]>('excludeMethods', config.get<string[]>('excludeNames', []));
    return {
        checkGlyph: config.get<string>('checkGlyph', vscode.l10n.t('Simplified Chinese')),
        convertGlyph: config.get<string>('convertGlyph', vscode.l10n.t('Chinese (Taiwan)')),
        checkLiteralExpression: config.get<boolean>('checkLiteralExpression', true),
        checkDocComment: config.get<boolean>('checkDocComment', false),
        excludeNames,
    };
}
