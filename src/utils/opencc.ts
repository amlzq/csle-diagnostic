// opencc-js 自 1.4.x 起为 ESM-only 包：其 CJS 入口（package.json 的 exports
// 通配符 `"./*"`）在 Node 下无法被 require 加载。因此在扩展激活时通过动态
// import() 一次性加载其 ESM 构建并缓存，之后以同步方式创建转换器，供诊断与
// 快速修复逻辑使用。
type ConverterFunction = (text: string) => string;

interface OpenCCModule {
    Converter: (options: { from?: string; to: string }) => ConverterFunction;
}

let openccModule: OpenCCModule | null = null;

export type Locale = string;

export async function ensureOpenCC(): Promise<void> {
    if (openccModule === null) {
        const mod = await import('opencc-js');
        openccModule = mod as unknown as OpenCCModule;
    }
}

export function createConverter(from: Locale, to: Locale): ConverterFunction {
    if (openccModule === null) {
        throw new Error('opencc-js is not initialized. Call ensureOpenCC() during extension activation.');
    }
    return openccModule.Converter({ from, to });
}
