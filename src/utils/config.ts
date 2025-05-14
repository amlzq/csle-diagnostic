import * as vscode from 'vscode';

export function getUserConfig() {
    const config = vscode.workspace.getConfiguration('cslediagnostic');
    return {
        checkGlyph: config.get<string>('checkGlyph', vscode.l10n.t('Simplified Chinese')),
        convertGlyph: config.get<string>('convertGlyph', vscode.l10n.t('Traditional Chinese (TW)')),
        excludeMethods: config.get<string[]>('excludeMethods', []),
    };
}
