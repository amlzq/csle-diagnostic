import * as vscode from 'vscode';
import * as OpenCC from 'opencc-js';
import { getUserConfig } from '../utils/config';
import { toLocale } from '../utils/utils';

export class CsleCodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        const { checkGlyph, convertGlyph, excludeMethods } = getUserConfig();
        const from: OpenCC.Locale = toLocale(checkGlyph);
        const to: OpenCC.Locale = toLocale(convertGlyph);
        const converter = OpenCC.Converter({ from: from, to: to });

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.code !== 'csle-convert') continue;

            const original = document.getText(diagnostic.range);
            const fixed = this.convertText(original, converter);
            if (!fixed) continue;

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

    private convertText(original: string, converter: (text: string) => string): string | null {
        let quote = original[0];
        let content = original;

        // 单引号 / 双引号
        if ((quote === '"' || quote === "'") && original.length >= 2 && original[0] === original[original.length - 1]) {
            content = original.slice(1, -1);
            return quote + converter(content) + quote;
        }

        // 原始字符串 r'...' 或 r"..." or r'''...''' (python)
        if ((original.startsWith('r"') && original.endsWith('"')) ||
            (original.startsWith("r'") && original.endsWith("'"))) {
            content = original.slice(2, -1);
            return original.slice(0, 2) + converter(content) + original.slice(-1);
        }

        // 反引号 (JS/TS)
        if (quote === '`' && original.endsWith('`')) {
            content = original.slice(1, -1);
            return '`' + converter(content) + '`';
        }

        // 三引号 (Dart/Python)
        if (original.startsWith('"""') || original.startsWith("'''") ||
            original.startsWith('r"""') || original.startsWith("r'''")) {
            const isRaw = original.startsWith('r');
            quote = isRaw ? original.slice(0, 4) : original.slice(0, 3);
            const suffix = isRaw ? original.slice(-4) : original.slice(-3);
            content = original.slice(quote.length, original.length - suffix.length);
            return quote + converter(content) + suffix;
        }

        // PHP Heredoc / Nowdoc
        if (original.startsWith('<<<')) {
            const lines = original.split('\n');
            if (lines.length >= 2) {
                const firstLine = lines[0];
                const endMarkerIndex = lines.findIndex((line, idx) => idx > 0 && line.trim().match(/^\w+;$/));
                if (endMarkerIndex > 0) {
                    const contentLines = lines.slice(1, endMarkerIndex);
                    const convertedLines = contentLines.map(line => converter(line));
                    return [firstLine, ...convertedLines, lines[endMarkerIndex]].join('\n');
                }
            }
        }

        return null; // fallback
    }
}
