import * as OpenCC from 'opencc-js';
import * as vscode from 'vscode';
import { getUserConfig } from '../utils/config';
import { shouldExclude } from '../utils/excludeNames';
import { extractPHPStrings } from '../utils/stringExtractor';
import { toLabel, toLocale } from '../utils/utils';

export async function refreshPHPDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
    const docVersion = doc.version;
    const { checkGlyph, convertGlyph, excludeNames, checkLiteralExpression, checkDocComment } = getUserConfig(doc);
    const from: OpenCC.Locale = toLocale(checkGlyph);
    const to: OpenCC.Locale = toLocale(convertGlyph);
    const converter = OpenCC.Converter({ from: from, to: to });

    const diagnostics: vscode.Diagnostic[] = [];
    const matches = await extractPHPStrings(doc, {
        includeLiteralExpression: checkLiteralExpression,
        includeDocComment: checkDocComment,
    });

    const message = vscode.l10n.t('Contains {0} (expected {1})', toLabel(from), toLabel(to));

    for (const { content, range } of matches) {
        if (!/[一-龥]/.test(content)) continue;
        if (shouldExclude(doc, range, excludeNames)) continue;
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
    if (doc.version === docVersion) {
        collection.set(doc.uri, diagnostics);
    }
}
