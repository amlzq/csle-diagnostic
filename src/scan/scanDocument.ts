import * as vscode from 'vscode';
import { getUserConfig } from '../utils/config';
import { shouldExclude } from '../utils/excludeNames';
import { convertLiteral } from '../utils/convertLiteral';
import { createConverter, Locale } from '../utils/opencc';
import {
    extractCssStrings,
    extractDartStrings,
    extractHtmlStrings,
    extractJsonStrings,
    extractPHPStrings,
    extractPythonStrings,
    extractWebStrings,
    ExtractOptions,
} from '../utils/stringExtractor';
import { toLocale } from '../utils/utils';

export interface Finding {
    uri: vscode.Uri;
    range: vscode.Range;
    /** 文档中该范围的原文 */
    original: string;
    /** 转换后的文本（已含引号等包裹） */
    fixed: string;
}

export interface ScanResult {
    from: Locale;
    to: Locale;
    findings: Finding[];
}

type Extractor = (doc: vscode.TextDocument, options: ExtractOptions) =>
    Promise<{ content: string; range: vscode.Range }[]> | { content: string; range: vscode.Range }[];

/** 返回 undefined 表示该语言不受支持 */
function getExtractor(languageId: string): { extract: Extractor; docComment: boolean } | undefined {
    switch (languageId) {
        case 'dart': return { extract: extractDartStrings, docComment: true };
        case 'javascript':
        case 'typescript':
        case 'javascriptreact':
        case 'typescriptreact': return { extract: extractWebStrings, docComment: true };
        // HTML/CSS/JSON 没有文档注释语法
        case 'html': return { extract: extractHtmlStrings, docComment: false };
        case 'css': return { extract: extractCssStrings, docComment: false };
        case 'json': return { extract: extractJsonStrings, docComment: false };
        case 'php': return { extract: extractPHPStrings, docComment: true };
        case 'python': return { extract: extractPythonStrings, docComment: true };
        default: return undefined;
    }
}

/** 纯扫描：不写入 DiagnosticCollection，返回需要转换的字符串及其转换结果 */
export async function scanDocument(doc: vscode.TextDocument): Promise<ScanResult | undefined> {
    const target = getExtractor(doc.languageId);
    if (!target) {return undefined;}

    const { checkGlyph, convertGlyph, excludeNames, checkLiteralExpression, checkDocComment } = getUserConfig(doc);
    const from = toLocale(checkGlyph);
    const to = toLocale(convertGlyph);
    const converter = createConverter(from, to);

    const matches = await target.extract(doc, {
        includeLiteralExpression: checkLiteralExpression,
        includeDocComment: target.docComment && checkDocComment,
    });

    const findings: Finding[] = [];
    for (const { content, range } of matches) {
        if (!/[一-龥]/.test(content)) {continue;}
        if (shouldExclude(doc, range, excludeNames)) {continue;}
        if (converter(content) === content) {continue;}
        const original = doc.getText(range);
        const fixed = convertLiteral(original, converter);
        if (!fixed) {continue;}
        findings.push({ uri: doc.uri, range, original, fixed });
    }
    return { from, to, findings };
}
