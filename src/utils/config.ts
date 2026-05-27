import * as vscode from 'vscode';

export function getUserConfig(scope?: vscode.TextDocument | vscode.Uri) {
    const uri = scope instanceof vscode.Uri ? scope : scope?.uri;
    const config = vscode.workspace.getConfiguration('cslediagnostic', uri);
    return {
        checkGlyph: config.get<string>('checkGlyph', vscode.l10n.t('Simplified Chinese')),
        convertGlyph: config.get<string>('convertGlyph', vscode.l10n.t('Chinese (Taiwan)')),
        checkLiteralExpression: config.get<boolean>('checkLiteralExpression', true),
        checkDocComment: config.get<boolean>('checkDocComment', false),
        excludeMethods: config.get<string[]>('excludeMethods', []),
    };
}
