import * as vscode from 'vscode';
import * as OpenCC from 'opencc-js';

export function toLocale(glyph: string): OpenCC.Locale {
    let locale: OpenCC.Locale;
    switch (glyph) {
        case vscode.l10n.t('Simplified Chinese'):
            locale = 'cn';
            break;
        case vscode.l10n.t('Traditional Chinese (TW)'):
            locale = 'twp';
            break;
        case vscode.l10n.t('Traditional Chinese (HK)'):
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
            label = vscode.l10n.t('Traditional Chinese (TW)');
            break;
        case 'hk':
            label = vscode.l10n.t('Traditional Chinese (HK)');
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