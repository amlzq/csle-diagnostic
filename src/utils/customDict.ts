/**
 * 用户自定义词典：沿用 OpenCC 原生词典格式。
 * 每行 `源词<Tab>目标词[<Tab>目标字形]`，`#` 开头为注释，空行忽略。
 * 目标字形（cn / twp / hk / t）可选：省略则对所有转换目标生效，指定则仅在转换目标
 * 为该字形时生效，且优先于同名的未指定词条。
 * 目标词有多个候选（以空格分隔）时取第一个，与 OpenCC 行为一致。
 */
export const DICT_LOCALES = ['cn', 'twp', 'hk', 't'] as const;

export type DictEntry = [source: string, target: string, locale?: string];

export interface DictParseError {
    line: number;
    message: string;
}

export interface DictParseResult {
    entries: DictEntry[];
    errors: DictParseError[];
}

export function parseDictionary(text: string): DictParseResult {
    const map = new Map<string, DictEntry>();
    const errors: DictParseError[] = [];
    const lines = text.replace(/^﻿/, '').split(/\r?\n/);

    lines.forEach((raw, idx) => {
        const line = raw.trim();
        if (line === '' || line.startsWith('#')) {return;}
        const cols = raw.split('\t');
        if (cols.length < 2) {
            errors.push({ line: idx + 1, message: 'missing tab separator' });
            return;
        }
        const source = cols[0].trim();
        const target = cols[1].trim().split(/\s+/)[0] ?? '';
        const locale = cols[2]?.trim() || undefined;
        if (source === '' || target === '') {
            errors.push({ line: idx + 1, message: 'empty source or target' });
            return;
        }
        if (locale !== undefined && !(DICT_LOCALES as readonly string[]).includes(locale)) {
            errors.push({ line: idx + 1, message: `unknown locale: ${locale}` });
            return;
        }
        // 后出现的同名（同源词、同字形）词条覆盖先出现的
        map.set(`${source}\t${locale ?? ''}`, [source, target, locale]);
    });

    return { entries: [...map.values()].map(([s, t, l]) => (l === undefined ? [s, t] : [s, t, l])), errors };
}

/** 取出对指定转换目标生效的词条；同一源词下指定字形的词条优先于通用词条。 */
export function selectEntries(entries: ReadonlyArray<DictEntry>, to: string): Array<[string, string]> {
    const result = new Map<string, string>();
    for (const [s, t, l] of entries) {
        if (l === undefined) {result.set(s, t);}
    }
    for (const [s, t, l] of entries) {
        if (l === to) {result.set(s, t);}
    }
    return [...result];
}
