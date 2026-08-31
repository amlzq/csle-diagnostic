// Minimal vscode API mock for pure unit tests (no VS Code runtime required).
// Provides just enough surface area for utils/excludeNames.ts, utils/utils.ts, etc.

export class Position {
    constructor(public line: number, public character: number) {}
}

export class Range {
    readonly start: Position;
    readonly end: Position;

    constructor(start: Position, end: Position);
    constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
    constructor(...args: any[]) {
        if (args.length >= 4) {
            this.start = new Position(args[0], args[1]);
            this.end = new Position(args[2], args[3]);
        } else {
            this.start = args[0] as Position;
            this.end = args[1] as Position;
        }
    }
}

/** Factory that returns `any` so the mock Range is assignable to vscode.Range at call sites. */
export function makeRange(startLine: number, startChar: number, endLine: number, endChar: number): any {
    return new Range(startLine, startChar, endLine, endChar);
}

export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3,
}

export class Diagnostic {
    code?: string;
    source?: string;
    constructor(
        public range: Range,
        public message: string,
        public severity?: DiagnosticSeverity
    ) {}
}

export const l10n = {
    t(template: string, ...args: any[]): string {
        if (args.length === 0) {return template;}
        return template.replace(/\{(\d+)\}/g, (_, idx) => String(args[Number(idx)] ?? ''));
    },
};

export interface TextLine {
    text: string;
}

export interface TextDocument {
    readonly uri?: any;
    readonly languageId?: string;
    readonly version?: number;
    getText(range?: Range): string;
    lineAt(line: number): TextLine;
    offsetAt(position: Position): number;
    positionAt(offset: number): Position;
}

/** Creates a lightweight TextDocument mock from raw text. */
// Return type is `any` so the mock is assignable to vscode.TextDocument at call sites.
export function createTextDocument(text: string, languageId = 'plaintext'): any {
    const lines = text.split('\n');

    const offsetAt = (pos: Position): number => {
        let offset = 0;
        for (let i = 0; i < pos.line && i < lines.length; i++) {
            offset += lines[i].length + 1;
        }
        return offset + Math.min(pos.character, (lines[pos.line] ?? '').length);
    };

    const positionAt = (offset: number): Position => {
        let remaining = Math.max(0, offset);
        for (let i = 0; i < lines.length; i++) {
            if (remaining <= lines[i].length) {
                return new Position(i, remaining);
            }
            remaining -= lines[i].length + 1;
        }
        return new Position(Math.max(0, lines.length - 1), (lines[lines.length - 1] ?? '').length);
    };

    const getText = (range?: Range): string => {
        if (!range) {return text;}
        return text.slice(offsetAt(range.start), offsetAt(range.end));
    };

    const lineAt = (line: number): TextLine => ({
        text: lines[line] ?? '',
    });

    return {
        languageId,
        version: 1,
        getText,
        lineAt,
        offsetAt,
        positionAt,
    };
}
