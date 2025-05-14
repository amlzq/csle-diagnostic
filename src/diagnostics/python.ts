import * as vscode from 'vscode';
import * as OpenCC from 'opencc-js';
import { getUserConfig } from '../utils/config';
import { extractPythonStrings } from '../utils/stringExtractor';
import { shouldExclude } from '../utils/excludeMethods';
import { toLocale, toLabel } from '../utils/utils';

export function refreshPythonDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
    const { checkGlyph, convertGlyph, excludeMethods } = getUserConfig();
    const from: OpenCC.Locale = toLocale(checkGlyph);
    const to: OpenCC.Locale = toLocale(convertGlyph);
    const converter = OpenCC.Converter({ from: from, to: to });

    const diagnostics: vscode.Diagnostic[] = [];
    const matches = extractPythonStrings(doc);

    const message = vscode.l10n.t('Contains {0} (expected {1})', toLabel(from), toLabel(to));

    for (const { content, range } of matches) {
        if (!/[一-龥]/.test(content)) continue;
        if (shouldExclude(doc, range, excludeMethods)) continue;
        const converted = converter(content);
        if (converted !== content) {
            const diagnostic = new vscode.Diagnostic(
                range,
                message,
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.code = 'csle-convert';
            diagnostics.push(diagnostic);
        }
    }
    collection.set(doc.uri, diagnostics);
}