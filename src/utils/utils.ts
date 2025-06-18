import * as vscode from 'vscode';
import * as OpenCC from 'opencc-js';

export function toLocale(glyph: string): OpenCC.Locale {
    let locale: OpenCC.Locale;
    switch (glyph) {
        case vscode.l10n.t('Simplified Chinese'):
            locale = 'cn';
            break;
        case vscode.l10n.t('Chinese (Taiwan)'):
            locale = 'twp';
            break;
        case vscode.l10n.t('Chinese (Hong Kong)'):
            locale = 'hk';
            break;
        case vscode.l10n.t('Traditional Chinese'):
            locale = 't';
            break;
        default:
            locale = 'cn';
            break;
    }
    return locale;
}

export function toLabel(locale: OpenCC.Locale): string {
    let label: string;
    switch (locale) {
        case 'cn':
            label = vscode.l10n.t('Simplified Chinese');
            break;
        case 'twp':
            label = vscode.l10n.t('Chinese (Taiwan)');
            break;
        case 'hk':
            label = vscode.l10n.t('Chinese (Hong Kong)');
            break;
        case 't':
            label = vscode.l10n.t('Traditional Chinese');
            break;
        default:
            label = vscode.l10n.t('Simplified Chinese');
            break;
    }
    return label;
}