import * as vscode from 'vscode';
import * as OpenCC from 'opencc-js';
import { getUserConfig } from '../utils/config';
import { extractDartStrings } from '../utils/stringExtractor';
import { shouldExclude } from '../utils/excludeMethods';
import { toLocale, toLabel } from '../utils/utils';

export function refreshDartDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
    const { checkGlyph, convertGlyph, excludeMethods } = getUserConfig();
    const from: OpenCC.Locale = toLocale(checkGlyph);
    const to: OpenCC.Locale = toLocale(convertGlyph);
    const converter = OpenCC.Converter({ from: from, to: to });

    const diagnostics: vscode.Diagnostic[] = [];
    const matches = extractDartStrings(doc);

    const message = vscode.l10n.t('Contains {0} characters (expected {1})', toLabel(from), toLabel(to));

    for (const { content, range } of matches) {
        if (!/[一-龥]/.test(content)) continue; // 判断是否包含中文
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