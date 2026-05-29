import * as OpenCC from 'opencc-js';
import * as vscode from 'vscode';
import { getUserConfig } from '../utils/config';
import { shouldExclude } from '../utils/excludeNames';
import { extractCssStrings, extractHtmlStrings, extractJsonStrings, extractWebStrings } from '../utils/stringExtractor';
import { toLabel, toLocale } from '../utils/utils';

export function refreshWebDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
    const { checkGlyph, convertGlyph, excludeNames, checkLiteralExpression, checkDocComment } = getUserConfig(doc);
    const from: OpenCC.Locale = toLocale(checkGlyph);
    const to: OpenCC.Locale = toLocale(convertGlyph);
    const converter = OpenCC.Converter({ from: from, to: to });

    const diagnostics: vscode.Diagnostic[] = [];
    const matches = extractWebStrings(doc, {
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
    collection.set(doc.uri, diagnostics);
}

export async function refreshHtmlDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
    const docVersion = doc.version;
    const { checkGlyph, convertGlyph, excludeNames, checkLiteralExpression, checkDocComment } = getUserConfig(doc);
    const from: OpenCC.Locale = toLocale(checkGlyph);
    const to: OpenCC.Locale = toLocale(convertGlyph);
    const converter = OpenCC.Converter({ from: from, to: to });

    const diagnostics: vscode.Diagnostic[] = [];
    const matches = await extractHtmlStrings(doc, {
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

export async function refreshCssDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
    const docVersion = doc.version;
    const { checkGlyph, convertGlyph, excludeNames, checkLiteralExpression, checkDocComment } = getUserConfig(doc);
    const from: OpenCC.Locale = toLocale(checkGlyph);
    const to: OpenCC.Locale = toLocale(convertGlyph);
    const converter = OpenCC.Converter({ from: from, to: to });

    const diagnostics: vscode.Diagnostic[] = [];
    const matches = await extractCssStrings(doc, {
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

export async function refreshJsonDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
    const docVersion = doc.version;
    const { checkGlyph, convertGlyph, excludeNames, checkLiteralExpression } = getUserConfig(doc);
    const from: OpenCC.Locale = toLocale(checkGlyph);
    const to: OpenCC.Locale = toLocale(convertGlyph);
    const converter = OpenCC.Converter({ from: from, to: to });

    const diagnostics: vscode.Diagnostic[] = [];
    const matches = await extractJsonStrings(doc, {
        includeLiteralExpression: checkLiteralExpression,
        includeDocComment: false,
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
