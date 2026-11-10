import * as assert from 'assert';
import { buildPanelHtml } from '../../view/dictionaryPanelHtml.js';

suite('词典管理面板页面', () => {
    const html = buildPanelHtml('abc123', 'vscode-webview://x');

    test('CSP 只允许带 nonce 的脚本与样式', () => {
        assert.ok(html.includes("default-src 'none'"));
        assert.ok(html.includes("script-src 'nonce-abc123'"));
        assert.ok(html.includes('<script nonce="abc123">'));
        assert.ok(html.includes('<style nonce="abc123">'));
    });

    test('不使用 innerHTML 渲染词条', () => {
        assert.ok(!html.includes('innerHTML'));
    });
});
