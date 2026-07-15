import * as assert from 'assert';
import { shouldExclude } from '../../utils/excludeNames.js';
import { createTextDocument, makeRange } from '../mock/vscode.js';

suite('shouldExclude 单元测试', function () {
    this.timeout(5000);

    test('函数调用名匹配时应排除', () => {
        const doc = createTextDocument("t('简体测试');");
        // range covers '简体测试' (including quotes, chars 2–8)
        const range = makeRange(0, 2, 0, 8);
        assert.strictEqual(shouldExclude(doc, range, ['t']), true);
    });

    test('点号函数名精确匹配时应排除', () => {
        const doc = createTextDocument("i18n.t('简体测试');");
        // '简体测试' chars 7–13
        const range = makeRange(0, 7, 0, 13);
        assert.strictEqual(shouldExclude(doc, range, ['i18n.t']), true);
    });

    test('函数调用仅匹配 last segment 时不应排除', () => {
        const doc = createTextDocument("i18n.t('简体测试');");
        const range = makeRange(0, 7, 0, 13);
        assert.strictEqual(shouldExclude(doc, range, ['t']), false);
    });

    test('JSON value 通过 quoted key 匹配时应排除', () => {
        const doc = createTextDocument('{ "title": "简体测试" }');
        // "简体测试" chars 11–17
        const range = makeRange(0, 11, 0, 17);
        assert.strictEqual(shouldExclude(doc, range, ['title']), true);
    });

    test('HTML 标签名匹配时应排除', () => {
        const doc = createTextDocument('<div>简体测试</div>');
        // 简体测试 chars 5–9
        const range = makeRange(0, 5, 0, 9);
        assert.strictEqual(shouldExclude(doc, range, ['div']), true);
    });

    test('HTML 标签名大小写不敏感', () => {
        const doc = createTextDocument('<DIV>简体测试</DIV>');
        const range = makeRange(0, 5, 0, 9);
        assert.strictEqual(shouldExclude(doc, range, ['div']), true);
    });

    test('赋值表达式左侧名称匹配时应排除', () => {
        const doc = createTextDocument("const title = '简体测试';");
        // '简体测试' chars 14–20
        const range = makeRange(0, 14, 0, 20);
        assert.strictEqual(shouldExclude(doc, range, ['title']), true);
    });

    test('PHP 数组 key 匹配时应排除', () => {
        const doc = createTextDocument("$a = array('key' => '简体测试');");
        // '简体测试' chars 20–26
        const range = makeRange(0, 20, 0, 26);
        assert.strictEqual(shouldExclude(doc, range, ['key']), true);
    });

    test('不匹配的函数名不应排除', () => {
        const doc = createTextDocument("foo('简体测试');");
        const range = makeRange(0, 4, 0, 10);
        assert.strictEqual(shouldExclude(doc, range, ['t']), false);
    });

    test('空 excludeNames 不应排除', () => {
        const doc = createTextDocument("t('简体测试');");
        const range = makeRange(0, 2, 0, 8);
        assert.strictEqual(shouldExclude(doc, range, []), false);
    });

    test('null excludeNames 不应排除', () => {
        const doc = createTextDocument("t('简体测试');");
        const range = makeRange(0, 2, 0, 8);
        assert.strictEqual(shouldExclude(doc, range, null as any), false);
    });
});
