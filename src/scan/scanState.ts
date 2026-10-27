/**
 * 批量扫描期间由扫描自身打开的文档 URI。
 * 这些文档不需要走实时诊断流程（否则会把整个工作区的结果灌进 Problems 面板）。
 */
export const scanOpenedUris = new Set<string>();
