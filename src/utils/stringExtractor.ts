import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { parser as pythonParser } from '@lezer/python';
import * as path from 'path';
import * as vscode from 'vscode';

const WebTreeSitter = require('web-tree-sitter') as any;
let dartParserPromise: Promise<any> | null = null;

const getDartParser = async (): Promise<any> => {
    if (dartParserPromise) return dartParserPromise;
    dartParserPromise = (async () => {
        const rootDir = path.resolve(__dirname, '../../');
        const treeSitterWasmPath = path.join(rootDir, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm');
        const dartLangWasmPath = path.join(rootDir, 'node_modules', 'tree-sitter-dart', 'tree-sitter-dart.wasm');

        await WebTreeSitter.Parser.init({
            locateFile: () => treeSitterWasmPath,
        });

        const lang = await WebTreeSitter.Language.load(dartLangWasmPath);
        const parser = new WebTreeSitter.Parser();
        parser.setLanguage(lang);
        return parser;
    })();
    return dartParserPromise;
};

const { Engine } = require('php-parser') as any;
const phpEngine = new Engine({
    parser: {
        php7: true,
        suppressErrors: true,
    },
    ast: {
        withPositions: true,
    },
});

export async function extractDartStrings(doc: vscode.TextDocument): Promise<{ content: string; range: vscode.Range }[]> {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];

    let parser: any;
    try {
        parser = await getDartParser();
    } catch {
        return result;
    }

    let tree: any;
    try {
        tree = parser.parse(text);
    } catch {
        return result;
    }

    const stripDartString = (raw: string): string => {
        if (!raw) return raw;
        const prefixLen = raw[0] === 'r' ? 1 : 0;
        const triple = raw.slice(prefixLen, prefixLen + 3);
        const quoteLen =
            triple === "'''" || triple === '"""'
                ? 3
                : raw[prefixLen] === "'" || raw[prefixLen] === '"'
                    ? 1
                    : 0;
        if (quoteLen === 0) return raw;
        if (raw.length < prefixLen + quoteLen * 2) return raw;
        return raw.slice(prefixLen + quoteLen, raw.length - quoteLen);
    };

    const walk = (node: any) => {
        if (!node) return;

        if (node.type === 'string_literal') {
            const start = node.startIndex;
            const end = node.endIndex;
            const range = new vscode.Range(doc.positionAt(start), doc.positionAt(end));
            const raw = doc.getText(range);
            result.push({
                content: stripDartString(raw),
                range,
            });
        }

        for (const child of node.namedChildren ?? []) {
            walk(child);
        }
    };

    walk(tree.rootNode);
    return result;
}

export function extractWebStrings(doc: vscode.TextDocument): { content: string; range: vscode.Range }[] {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];

    let ast: t.File;
    try {
        ast = parse(text, {
            sourceType: 'module',
            plugins: [
                'jsx',
                'typescript', // 支持 tsx
                'classProperties',
                'objectRestSpread',
                'decorators-legacy',
            ],
            ranges: true,
            errorRecovery: true,
        }) as unknown as t.File;
    } catch (e) {
        console.warn('AST parse error:', e);
        return result;
    }

    traverse(ast, {
        JSXText(path: NodePath<t.JSXText>) {
            const value = path.node.value.trim();
            if (value && /[一-龥]/.test(value)) {
                const [start, end] = path.node.range!;
                result.push({
                    content: value,
                    range: new vscode.Range(doc.positionAt(start), doc.positionAt(end)),
                });
            }
        },
        JSXAttribute(path: NodePath<t.JSXAttribute>) {
            const val = path.node.value;
            if (val && val.type === 'StringLiteral' && /[一-龥]/.test(val.value)) {
                const [start, end] = val.range!;
                result.push({
                    content: val.value,
                    range: new vscode.Range(doc.positionAt(start), doc.positionAt(end)),
                });
            }
        },
        TemplateElement(path: NodePath<t.TemplateElement>) {
            const nodeRange = path.node.range;
            if (!nodeRange) return;
            const [start, end] = nodeRange;
            const range = new vscode.Range(doc.positionAt(start), doc.positionAt(end));
            const value = doc.getText(range);
            if (value && /[一-龥]/.test(value)) {
                result.push({
                    content: value,
                    range,
                });
            }
        },
        StringLiteral(path: NodePath<t.StringLiteral>) {
            // 可选：提取 JSX 外部字符串
            const val = path.node.value;
            if (/[一-龥]/.test(val)) {
                const [start, end] = path.node.range!;
                result.push({
                    content: val,
                    range: new vscode.Range(doc.positionAt(start), doc.positionAt(end)),
                });
            }
        },
    });

    return result;
}

export function extractPHPStrings(doc: vscode.TextDocument): { content: string; range: vscode.Range }[] {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];
    let ast: any;
    try {
        ast = phpEngine.parseCode(text, doc.fileName);
    } catch {
        return result;
    }

    const visited = new WeakSet<object>();

    const getRangeFromLoc = (loc: any): vscode.Range | null => {
        if (!loc?.start || !loc?.end) return null;

        const startOffset = loc.start.offset;
        const endOffset = loc.end.offset;
        if (typeof startOffset === 'number' && typeof endOffset === 'number') {
            return new vscode.Range(doc.positionAt(startOffset), doc.positionAt(endOffset));
        }

        const startLine = loc.start.line;
        const startColumn = loc.start.column;
        const endLine = loc.end.line;
        const endColumn = loc.end.column;
        if (
            typeof startLine === 'number' &&
            typeof startColumn === 'number' &&
            typeof endLine === 'number' &&
            typeof endColumn === 'number'
        ) {
            const start = new vscode.Position(Math.max(0, startLine - 1), Math.max(0, startColumn));
            const end = new vscode.Position(Math.max(0, endLine - 1), Math.max(0, endColumn));
            return new vscode.Range(start, end);
        }
        return null;
    };

    const visit = (node: any) => {
        if (!node) return;
        if (Array.isArray(node)) {
            for (const item of node) visit(item);
            return;
        }
        if (typeof node !== 'object') return;

        if (visited.has(node)) return;
        visited.add(node);

        const kind = (node as any).kind;
        if (kind === 'string' || kind === 'heredoc' || kind === 'nowdoc' || kind === 'encapsed') {
            const range = getRangeFromLoc((node as any).loc);
            if (range) {
                result.push({
                    content: doc.getText(range),
                    range,
                });
            }
        }

        for (const value of Object.values(node as Record<string, unknown>)) {
            if (value && (typeof value === 'object' || Array.isArray(value))) {
                visit(value);
            }
        }
    };

    visit(ast);
    return result;
}

export function extractPythonStrings(doc: vscode.TextDocument): { content: string; range: vscode.Range }[] {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];
    let tree: any;
    try {
        tree = pythonParser.parse(text);
    } catch {
        return result;
    }

    const addRange = (from: number, to: number) => {
        if (from >= to) return;
        const range = new vscode.Range(doc.positionAt(from), doc.positionAt(to));
        result.push({ content: doc.getText(range), range });
    };

    const collectFormatReplacements = (node: any): { from: number; to: number }[] => {
        const ranges: { from: number; to: number }[] = [];
        const c = node.cursor();
        const walkNode = () => {
            if (c.name === 'FormatReplacement') {
                ranges.push({ from: c.from, to: c.to });
            }
            if (c.firstChild()) {
                do {
                    walkNode();
                } while (c.nextSibling());
                c.parent();
            }
        };
        walkNode();
        return ranges;
    };

    const walk = (cursor: any) => {
        if (cursor.name === 'String') {
            addRange(cursor.from, cursor.to);
        } else if (cursor.name === 'FormatString') {
            const formatFrom = cursor.from;
            const formatTo = cursor.to;

            const repls = collectFormatReplacements(cursor.node).sort((a, b) => a.from - b.from);
            let prev = formatFrom;
            for (const r of repls) {
                addRange(prev, Math.min(r.from, formatTo));
                prev = Math.max(prev, Math.min(r.to, formatTo));
            }
            addRange(prev, formatTo);
        }

        if (cursor.firstChild()) {
            do {
                walk(cursor);
            } while (cursor.nextSibling());
            cursor.parent();
        }
    };

    walk(tree.cursor());
    return result;
}
