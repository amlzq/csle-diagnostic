import * as vscode from 'vscode';
import { getUserConfig } from '../utils/config';
import { createConverter } from '../utils/opencc';
import { convertLiteral } from '../utils/convertLiteral';
import { toLocale } from '../utils/utils';

export class CsleCodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext
    ): vscode.CodeAction[] {

        const actions: vscode.CodeAction[] = [];

        const { checkGlyph, convertGlyph } = getUserConfig(document);
        const from = toLocale(checkGlyph);
        const to = toLocale(convertGlyph);
        const converter = createConverter(from, to);

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.code !== 'csle-convert') {continue;}

            const original = document.getText(diagnostic.range);
            const fixed = convertLiteral(original, converter);
            if (!fixed) {continue;}

            const action = new vscode.CodeAction(
                vscode.l10n.t('Convert to {0}', convertGlyph),
                vscode.CodeActionKind.QuickFix
            );
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, diagnostic.range, fixed);
            action.diagnostics = [diagnostic];
            action.isPreferred = true;
            actions.push(action);
        }
        return actions;
    }
}
