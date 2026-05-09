import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import * as path from 'path';
import * as vscode from 'vscode';

const WebTreeSitter = require('web-tree-sitter') as any;
let treeSitterInitPromise: Promise<void> | null = null;
let dartParserPromise: Promise<any> | null = null;
let phpParserPromise: Promise<any> | null = null;
let pythonParserPromise: Promise<any> | null = null;

const getRootDir = (): string => path.resolve(__dirname, '../../');

const ensureTreeSitterInitialized = async (): Promise<void> => {
    if (treeSitterInitPromise) return treeSitterInitPromise;
    treeSitterInitPromise = (async () => {
        const rootDir = getRootDir();
        const treeSitterWasmPath = path.join(rootDir, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm');
        await WebTreeSitter.Parser.init({
            locateFile: () => treeSitterWasmPath,
        });
    })();
    return treeSitterInitPromise;
};

const getDartParser = async (): Promise<any> => {
    if (dartParserPromise) return dartParserPromise;
    dartParserPromise = (async () => {
        const rootDir = getRootDir();
        const dartLangWasmPath = path.join(rootDir, 'node_modules', 'tree-sitter-dart', 'tree-sitter-dart.wasm');

        await ensureTreeSitterInitialized();

        const lang = await WebTreeSitter.Language.load(dartLangWasmPath);
        const parser = new WebTreeSitter.Parser();
        parser.setLanguage(lang);
        return parser;
    })();
    return dartParserPromise;
};

const getPhpParser = async (): Promise<any> => {
    if (phpParserPromise) return phpParserPromise;
    phpParserPromise = (async () => {
        const rootDir = getRootDir();
        const phpLangWasmPath = path.join(rootDir, 'node_modules', 'tree-sitter-php', 'tree-sitter-php.wasm');

        await ensureTreeSitterInitialized();

        const lang = await WebTreeSitter.Language.load(phpLangWasmPath);
        const parser = new WebTreeSitter.Parser();
        parser.setLanguage(lang);
        return parser;
    })();
    return phpParserPromise;
};

const getPythonParser = async (): Promise<any> => {
    if (pythonParserPromise) return pythonParserPromise;
    pythonParserPromise = (async () => {
        const rootDir = getRootDir();
        const pythonLangWasmPath = path.join(rootDir, 'node_modules', 'tree-sitter-python', 'tree-sitter-python.wasm');

        await ensureTreeSitterInitialized();

        const lang = await WebTreeSitter.Language.load(pythonLangWasmPath);
        const parser = new WebTreeSitter.Parser();
        parser.setLanguage(lang);
        return parser;
    })();
    return pythonParserPromise;
};

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

export async function extractPHPStrings(doc: vscode.TextDocument): Promise<{ content: string; range: vscode.Range }[]> {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];

    let parser: any;
    try {
        parser = await getPhpParser();
    } catch {
        return result;
    }

    let tree: any;
    try {
        tree = parser.parse(text);
    } catch {
        return result;
    }

    const addNodeRange = (node: any) => {
        let start = node.startIndex;
        let end = node.endIndex;
        if (text[end] === ';') end += 1;

        const range = new vscode.Range(doc.positionAt(start), doc.positionAt(end));
        result.push({
            content: doc.getText(range),
            range,
        });
    };

    const shouldCaptureTypes = new Set(['string', 'encapsed_string', 'heredoc', 'nowdoc']);

    const walk = (node: any) => {
        if (!node) return;

        if (shouldCaptureTypes.has(node.type)) {
            addNodeRange(node);
            return;
        }

        for (const child of node.namedChildren ?? []) {
            walk(child);
        }
    };

    walk(tree.rootNode);
    return result;
}

export async function extractPythonStrings(doc: vscode.TextDocument): Promise<{ content: string; range: vscode.Range }[]> {
    const text = doc.getText();
    const result: { content: string; range: vscode.Range }[] = [];

    let parser: any;
    try {
        parser = await getPythonParser();
    } catch {
        return result;
    }

    let tree: any;
    try {
        tree = parser.parse(text);
    } catch {
        return result;
    }

    const addRange = (start: number, end: number) => {
        if (start >= end) return;
        const range = new vscode.Range(doc.positionAt(start), doc.positionAt(end));
        result.push({ content: doc.getText(range), range });
    };

    const walk = (node: any) => {
        if (!node) return;
        if (node.type === 'string_content') {
            addRange(node.startIndex, node.endIndex);
        }
        for (const child of node.namedChildren ?? []) {
            walk(child);
        }
    };

    walk(tree.rootNode);
    return result;
}
