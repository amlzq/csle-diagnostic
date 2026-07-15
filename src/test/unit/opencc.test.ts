import * as assert from 'assert';
import { ensureOpenCC, createConverter } from '../../utils/opencc.js';

suite('OpenCC 转换器单元测试', function () {
    this.timeout(15000);

    suiteSetup(async () => {
        await ensureOpenCC();
    });

    test('简体转台湾繁体', () => {
        const convert = createConverter('cn', 'twp');
        assert.strictEqual(convert('简体测试'), '簡體測試');
        assert.strictEqual(convert('网络'), '網路');
    });

    test('台湾繁体转简体', () => {
        const convert = createConverter('twp', 'cn');
        assert.strictEqual(convert('繁體測試'), '繁体测试');
    });

    test('简体转香港繁体', () => {
        const convert = createConverter('cn', 'hk');
        assert.strictEqual(convert('简体测试'), '簡體測試');
    });

    test('简体转通用繁体', () => {
        const convert = createConverter('cn', 't');
        assert.strictEqual(convert('简体测试'), '簡體測試');
    });

    test('通用繁体转简体', () => {
        const convert = createConverter('t', 'cn');
        assert.strictEqual(convert('簡體測試'), '简体测试');
    });

    test('无中文字符应原样返回', () => {
        const convert = createConverter('cn', 'twp');
        assert.strictEqual(convert('hello world'), 'hello world');
        assert.strictEqual(convert(''), '');
    });

    test('混合文本应只转换中文部分', () => {
        const convert = createConverter('cn', 'twp');
        assert.strictEqual(convert('hello 简体 world'), 'hello 簡體 world');
    });

    test('已是目标字形时应保持不变', () => {
        const convert = createConverter('cn', 'twp');
        assert.strictEqual(convert('繁體測試'), '繁體測試');
    });

    test('ensureOpenCC 多次调用应幂等', async () => {
        await ensureOpenCC();
        await ensureOpenCC();
    });
});
