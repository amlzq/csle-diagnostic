// opencc-js 自 1.4.x 起为 ESM-only 包：其 CJS 入口（package.json 的 exports
// 通配符 `"./*"`）在 Node 下无法被 require 加载。因此在扩展激活时通过动态
// import() 一次性加载其 ESM 构建并缓存，之后以同步方式创建转换器，供诊断与
// 快速修复逻辑使用。
type ConverterFunction = (text: string) => string;

interface TrieLike {
    loadDict(dict: Array<[string, string]>): void;
    matchPrefix(s: string, i: number): { end: number; value: string } | null;
}

interface OpenCCModule {
    Converter: (options: { from?: string; to: string }) => ConverterFunction;
    Trie: new () => TrieLike;
}

let openccModule: OpenCCModule | null = null;

export type Locale = string;

export async function ensureOpenCC(): Promise<void> {
    if (openccModule === null) {
        const mod = await import('opencc-js');
        openccModule = mod as unknown as OpenCCModule;
    }
}

/**
 * 创建转换器。若提供 customEntries，则用户词条优先：先按最长匹配在原文上切出
 * 命中片段并直接替换为用户值（不再经过 OpenCC），其余片段交给 OpenCC 转换。
 * 不能直接把用户词典塞进 ConverterFactory：放在后面时 key 须是转换后的形态，
 * 放在前面则其输出会被后续阶段再次转换。
 */
export function createConverter(
    from: Locale,
    to: Locale,
    customEntries: ReadonlyArray<[string, string]> = []
): ConverterFunction {
    if (openccModule === null) {
        throw new Error('opencc-js is not initialized. Call ensureOpenCC() during extension activation.');
    }
    const base = openccModule.Converter({ from, to });
    if (customEntries.length === 0) {
        return base;
    }
    const trie = new openccModule.Trie();
    trie.loadDict(customEntries.map(([k, v]) => [k, v]));
    return (text: string): string => {
        let out = '';
        let pending = 0; // 尚未转换的原文片段起点
        let i = 0;
        while (i < text.length) {
            const m = trie.matchPrefix(text, i);
            if (m) {
                out += base(text.slice(pending, i)) + m.value;
                i = pending = m.end;
            } else {
                i += text.codePointAt(i)! > 0xffff ? 2 : 1;
            }
        }
        return out + base(text.slice(pending));
    };
}
