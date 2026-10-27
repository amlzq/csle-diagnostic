import * as assert from 'assert';
import { convertLiteral } from '../../utils/convertLiteral';

const conv = (s: string) => s.replace(/简/g, '簡');

suite('convertLiteral', () => {
    test('单/双引号保留引号', () => {
        assert.strictEqual(convertLiteral('"简"', conv), '"簡"');
        assert.strictEqual(convertLiteral("'简'", conv), "'簡'");
    });
    test('反引号', () => {
        assert.strictEqual(convertLiteral('`简${a}`', conv), '`簡${a}`');
    });
    test('python 原始字符串', () => {
        assert.strictEqual(convertLiteral('r"简"', conv), 'r"簡"');
        assert.strictEqual(convertLiteral("r'''简'''", conv), "r'''簡'''");
    });
    test('三引号', () => {
        assert.strictEqual(convertLiteral('"""简"""', conv), '"""簡"""');
    });
    test('PHP heredoc 不转换标记行', () => {
        assert.strictEqual(convertLiteral('<<<EOT\n简\nEOT;', conv), '<<<EOT\n簡\nEOT;');
    });
    test('无包裹文本（JSX）直接转换', () => {
        assert.strictEqual(convertLiteral('简体', conv), '簡体');
    });
});
