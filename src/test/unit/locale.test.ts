import * as assert from 'assert';
import { toLocale, toLabel } from '../../utils/utils.js';

suite('toLocale / toLabel 单元测试', function () {
    this.timeout(5000);

    test('toLocale 应将简体标签转为 cn', () => {
        assert.strictEqual(toLocale('Simplified Chinese'), 'cn');
    });

    test('toLocale 应将台湾繁体标签转为 twp', () => {
        assert.strictEqual(toLocale('Chinese (Taiwan)'), 'twp');
    });

    test('toLocale 应将香港繁体标签转为 hk', () => {
        assert.strictEqual(toLocale('Chinese (Hong Kong)'), 'hk');
    });

    test('toLocale 应将通用繁体标签转为 t', () => {
        assert.strictEqual(toLocale('Traditional Chinese'), 't');
    });

    test('toLocale 未知标签应默认为 cn', () => {
        assert.strictEqual(toLocale('unknown'), 'cn');
    });

    test('toLabel 应将 cn 转为简体标签', () => {
        assert.strictEqual(toLabel('cn'), 'Simplified Chinese');
    });

    test('toLabel 应将 twp 转为台湾繁体标签', () => {
        assert.strictEqual(toLabel('twp'), 'Chinese (Taiwan)');
    });

    test('toLabel 应将 hk 转为香港繁体标签', () => {
        assert.strictEqual(toLabel('hk'), 'Chinese (Hong Kong)');
    });

    test('toLabel 应将 t 转为通用繁体标签', () => {
        assert.strictEqual(toLabel('t'), 'Traditional Chinese');
    });

    test('toLabel 未知 locale 应默认为简体标签', () => {
        assert.strictEqual(toLabel('unknown'), 'Simplified Chinese');
    });

    test('toLocale 与 toLabel 应可互逆', () => {
        const locales = ['cn', 'twp', 'hk', 't'];
        for (const loc of locales) {
            assert.strictEqual(toLocale(toLabel(loc)), loc);
        }
    });
});
