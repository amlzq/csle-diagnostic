import * as assert from 'assert';
import { ensureOpenCC, createConverter } from '../../utils/opencc.js';
import { parseDictionary, selectEntries } from '../../utils/customDict.js';

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

        test('重复词条以后者为准', () => {
            const r = parseDictionary('软件\tA\n软件\tB\n');
            assert.deepStrictEqual(r.entries, [['软件', 'B']]);
        });
    });

    suite('目标字形列', () => {
        test('解析第三列并拒绝未知字形', () => {
            const r = parseDictionary('软件\t軟體\ttwp\n软件\t軟件\thk\n网络\t網絡\tzz\n');
            assert.deepStrictEqual(r.entries, [['软件', '軟體', 'twp'], ['软件', '軟件', 'hk']]);
            assert.deepStrictEqual(r.errors.map(e => e.line), [3]);
        });

        test('指定字形的词条优先于通用词条，其他字形的被忽略', () => {
            const { entries } = parseDictionary('软件\tA\n服务器\tS\n软件\tB\ttwp\n软件\tC\thk\n');
            assert.deepStrictEqual(selectEntries(entries, 'twp'), [['软件', 'B'], ['服务器', 'S']]);
            assert.deepStrictEqual(selectEntries(entries, 'cn'), [['软件', 'A'], ['服务器', 'S']]);
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
