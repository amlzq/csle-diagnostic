import * as assert from 'assert';
import { ensureOpenCC, createConverter } from '../../utils/opencc.js';
import { parseDictionary, upsertEntry, removeEntry, validateSource, validateTarget, renderTemplate } from '../../utils/customDict.js';

suite('自定义词典', function () {
    suite('parseDictionary', () => {
        test('解析词条、注释、空行与 BOM', () => {
            const r = parseDictionary('﻿# 注释\n\n软件\t軟件\r\n网络\t網絡 網路\n');
            assert.deepStrictEqual(r.entries, [['软件', '軟件'], ['网络', '網絡']]);
            assert.deepStrictEqual(r.errors, []);
        });

        test('报告格式错误的行号', () => {
            const r = parseDictionary('软件\t軟件\n没有制表符\n\t空源词\n');
            assert.deepStrictEqual(r.entries, [['软件', '軟件']]);
            assert.deepStrictEqual(r.errors.map(e => e.line), [2, 3]);
        });

        test('多个候选取第一个，与 OpenCC 一致', () => {
            assert.deepStrictEqual(parseDictionary('软件\t軟體 軟件\n').entries, [['软件', '軟體']]);
        });

        test('重复词条以后者为准', () => {
            const r = parseDictionary('软件\tA\n软件\tB\n');
            assert.deepStrictEqual(r.entries, [['软件', 'B']]);
        });
    });

    suite('增删词条文本', () => {
        test('upsertEntry 追加新词条并保留注释', () => {
            assert.strictEqual(upsertEntry('# 注释\n软件\tA\n', '网络', 'N'), '# 注释\n软件\tA\n网络\tN\n');
            assert.strictEqual(upsertEntry('', '软件', 'A'), '软件\tA\n');
        });

        test('upsertEntry 替换同名词条且只留一条', () => {
            assert.strictEqual(upsertEntry('软件\tA\n网络\tN\n软件\tB\n', '软件', 'C'), '网络\tN\n软件\tC\n');
        });

        test('upsertEntry 保持 CRLF', () => {
            assert.strictEqual(upsertEntry('软件\tA\r\n', '网络', 'N'), '软件\tA\r\n网络\tN\r\n');
        });

        test('removeEntry 删除所有同名词条，不动注释', () => {
            assert.strictEqual(removeEntry('# 注释\n软件\tA\n网络\tN\n软件\tB\n', '软件'), '# 注释\n网络\tN\n');
        });

        test('removeEntry 源词不存在时内容不变', () => {
            assert.strictEqual(removeEntry('软件\tA\n', '网络'), '软件\tA\n');
        });
    });

    suite('模板渲染', () => {
        test('按字形替换英文与中文目标名', () => {
            const t = 'Target: {target} / 目标：{目标}\n';
            assert.strictEqual(renderTemplate(t, 'hk'), 'Target: Chinese (Hong Kong) / 目标：中文（香港）\n');
            assert.strictEqual(renderTemplate(t, 'cn'), 'Target: Simplified Chinese / 目标：简体中文\n');
        });
    });

    suite('输入校验', () => {
        test('validateSource', () => {
            assert.strictEqual(validateSource('  '), 'empty');
            assert.strictEqual(validateSource('a\tb'), 'tab');
            assert.strictEqual(validateSource('软件'), undefined);
            assert.strictEqual(validateSource('软 件'), undefined);
        });

        test('validateTarget', () => {
            assert.strictEqual(validateTarget(''), 'empty');
            assert.strictEqual(validateTarget('軟 體'), 'whitespace');
            assert.strictEqual(validateTarget(' 軟體 '), undefined);
        });
    });

    suite('createConverter 优先级', () => {
        suiteSetup(async () => { await ensureOpenCC(); });

        test('用户词条优先于 OpenCC（且不被二次转换）', () => {
            const c = createConverter('cn', 'twp', [['网络', '網絡'], ['软件', '軟體X']]);
            assert.strictEqual(c('软件网络服务器'), '軟體X網絡伺服器');
        });

        test('映射到自身可固定词语', () => {
            const c = createConverter('cn', 'twp', [['软件', '软件']]);
            assert.strictEqual(c('软件'), '软件');
        });

        test('最长匹配优先', () => {
            const c = createConverter('cn', 'twp', [['网', 'W'], ['网络', 'WL']]);
            assert.strictEqual(c('网络'), 'WL');
        });

        test('无词条时与原转换器一致', () => {
            assert.strictEqual(createConverter('cn', 'twp', [])('软件网络'), createConverter('cn', 'twp')('软件网络'));
        });
    });
});
