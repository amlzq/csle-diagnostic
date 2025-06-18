import * as vscode from 'vscode';

export function getUserConfig() {
    const config = vscode.workspace.getConfiguration('cslediagnostic');
    return {
        checkGlyph: config.get<string>('checkGlyph', vscode.l10n.t('Simplified Chinese')),
        convertGlyph: config.get<string>('convertGlyph', vscode.l10n.t('Chinese (Taiwan)')),
        excludeMethods: config.get<string[]>('excludeMethods', []),
    };
}
