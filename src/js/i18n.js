/**
 * i18n.js — 国际化核心模块
 *
 * 用法：
 *   import { t, setLang, getLang, onLangChange } from './i18n.js';
 *   t('panel.title')        // 翻译
 *   t('hello', { name })    // 带插值
 *   setLang('en-US')        // 切换语言
 *   getLang()               // 获取当前语言
 *   onLangChange(fn)        // 监听语言变更
 */

// ── 语言包 ─────────────────────────────────────────────────────────────
import zh from '../locales/zh-CN.json';
import en from '../locales/en-US.json';

const LOCALES = { 'zh-CN': zh, 'en-US': en };
const STORAGE_KEY = 'solar-system-lang';
const DEFAULT_LANG = 'zh-CN';

function resolveLang(code) {
    const base = (code || '').toLowerCase();
    if (base.startsWith('zh')) return 'zh-CN';
    if (base.startsWith('en')) return 'en-US';
    return null;
}

/** 跟随系统语言；非中英文时回退中文 */
function detectSystemLang() {
    const candidates = navigator.languages?.length
        ? navigator.languages
        : [navigator.language];
    for (const code of candidates) {
        const resolved = resolveLang(code);
        if (resolved) return resolved;
    }
    return DEFAULT_LANG;
}

function applyDocumentLang(lang) {
    document.documentElement.lang = lang === 'en-US' ? 'en' : 'zh-Hans';
}

let currentLang = localStorage.getItem(STORAGE_KEY) || detectSystemLang();
applyDocumentLang(currentLang);
const listeners = [];

/** 翻译函数 */
export function t(key, params = {}) {
    const locale = LOCALES[currentLang];
    let text = key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined) ? obj[k] : null, locale);
    if (text === null) {
        // fallback: 尝试英文
        text = key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined) ? obj[k] : null, LOCALES['en-US']);
    }
    if (text === null) return key; // fallback: 返回 key

    // 插值: {{name}}
    return text.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] !== undefined ? params[k] : '{{' + k + '}}');
}

/** 切换语言 */
export function setLang(lang) {
    if (!LOCALES[lang]) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    applyDocumentLang(lang);
    listeners.forEach(fn => fn(lang));
}

/** 获取当前语言 */
export function getLang() {
    return currentLang;
}

/** 监听语言变更：注册后立即用当前语言调用一次 fn */
export function onLangChange(fn) {
    fn(currentLang);
    listeners.push(fn);
    return () => {
        const idx = listeners.indexOf(fn);
        if (idx !== -1) listeners.splice(idx, 1);
    };
}
