/**
 * sfx.js — 音效系统
 *
 * 使用 Web Audio API 生成合成音效，无需外部音频文件。
 * 所有音效通过 AudioContext 实时合成。
 *
 * 用法：
 *   import { sfx } from './sfx.js';
 *   sfx.click();       // 按钮点击
 *   sfx.panelOpen();   // 面板打开
 *   sfx.panelClose();  // 面板关闭
 *   sfx.questDone();   // 任务完成
 *   sfx.achievement(); // 成就解锁
 *   sfx.quizCorrect(); // 答题正确
 *   sfx.quizWrong();   // 答题错误
 *   sfx.focus();       // 聚焦星体
 *   sfx.setEnabled(v); // 启用/禁用
 */

let ctx = null;
let enabled = true;

function getCtx() {
    if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    return ctx;
}

// ── 工具函数 ───────────────────────────────────────────────────────────

// 播放一个频率
function tone(freq, duration, type = 'sine', volume = 0.15) {
    if (!enabled) return;
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
}

// 播放一个音阶
function arpeggio(notes, baseTime = 0, noteLen = 0.08) {
    if (!enabled) return;
    const c = getCtx();
    notes.forEach((freq, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, c.currentTime + baseTime + i * noteLen);
        gain.gain.setValueAtTime(0.12, c.currentTime + baseTime + i * noteLen);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + baseTime + (i + 1) * noteLen * 2);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(c.currentTime + baseTime + i * noteLen);
        osc.stop(c.currentTime + baseTime + (i + 1) * noteLen * 2);
    });
}

// 噪声（短促）
function noise(duration = 0.05, volume = 0.08) {
    if (!enabled) return;
    const c = getCtx();
    const bufSize = c.sampleRate * duration;
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    src.connect(gain);
    gain.connect(c.destination);
    src.start();
}

// ── 公开 API ───────────────────────────────────────────────────────────

export const sfx = {
    /** 按钮点击 */
    click() {
        noise(0.04, 0.06);
    },

    /** 面板打开 — 上升滑音 */
    panelOpen() {
        tone(300, 0.15, 'sine', 0.1);
        setTimeout(() => tone(500, 0.12, 'sine', 0.08), 40);
    },

    /** 面板关闭 — 下降滑音 */
    panelClose() {
        tone(500, 0.1, 'sine', 0.08);
        setTimeout(() => tone(300, 0.12, 'sine', 0.1), 30);
    },

    /** 任务完成 — 上行五声音阶 */
    questDone() {
        arpeggio([523, 659, 784, 1047], 0, 0.1);
    },

    /** 成就解锁 — 辉煌 fanfare */
    achievement() {
        arpeggio([523, 659, 784, 1047, 1319], 0.1, 0.12);
    },

    /** 答题正确 — 上升二音 */
    quizCorrect() {
        tone(660, 0.15, 'sine', 0.12);
        setTimeout(() => tone(880, 0.2, 'sine', 0.1), 80);
    },

    /** 答题错误 — 下降二音 */
    quizWrong() {
        tone(400, 0.15, 'sawtooth', 0.08);
        setTimeout(() => tone(300, 0.2, 'sawtooth', 0.06), 80);
    },

    /** 聚焦星体 — 柔和的低频风声 */
    focus() {
        tone(220, 0.3, 'sine', 0.05);
        noise(0.25, 0.03);
    },

    /** 开关音效 */
    setEnabled(v) {
        enabled = v;
    },

    /** 获取启用状态 */
    getEnabled() {
        return enabled;
    },
};
