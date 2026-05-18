/**
 * ambientMusic.js — 太空环境背景音乐
 *
 * 使用 Web Audio API 合成，产生富有未来感的太空氛围音乐。
 * 可随时开关，不影响游戏音效。
 *
 * 用法：
 *   import { ambientMusic } from './ambientMusic.js';
 *   ambientMusic.start();    // 开始播放
 *   ambientMusic.stop();     // 停止
 *   ambientMusic.toggle();   // 切换
 *   ambientMusic.setVolume(v); // 0~1
 */

let ctx = null;
let isPlaying = false;
let masterGain = null;
let volume = 0.12;
let bellTimer = null;
let gen = 0; // 自增版本号，防止 stop/start 异步竞态

const NODES = [];

function getCtx() {
    if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    return ctx;
}

// ── 工具：创建持续振荡器 ──────────────────────────────────────────────

function createDrone(freq, type, vol, detune = 0) {
    const c = getCtx();
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;

    const gain = c.createGain();
    gain.gain.value = 0;
    // 淡入
    gain.gain.linearRampToValueAtTime(vol, c.currentTime + 2);

    const lfo = c.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.05 + Math.random() * 0.03;
    const lfoGain = c.createGain();
    lfoGain.gain.value = vol * 0.3;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();

    // 第二条 LFO 调制频率
    const lfo2 = c.createOscillator();
    lfo2.type = 'sine';
    lfo2.frequency.value = 0.01 + Math.random() * 0.02;
    const lfoGain2 = c.createGain();
    lfoGain2.gain.value = 0.3;
    lfo2.connect(lfoGain2);
    lfoGain2.connect(osc.frequency);
    lfo2.start();

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start();
    // lfo 已在前面 start，无需重复

    NODES.push({ osc, gain, lfo, lfo2, lfoGain, lfoGain2 });
}

// ── 工具：创建定音钟声（每隔一段时间响一次） ─────────────────────────

function scheduleBells() {
    if (!isPlaying) return;

    const c = getCtx();
    const notes = [
        523.25, 659.25, 783.99, 1046.50,  // C5 E5 G5 C6
        587.33, 739.99, 880.00,            // D5 F#5 A5
        493.88, 622.25, 739.99,            // B4 D#5 F#5
    ];

    const interval = 6 + Math.random() * 4; // 6~10 秒
    const noteCount = 2 + Math.floor(Math.random() * 3); // 2~4 个音

    for (let i = 0; i < noteCount; i++) {
        const delay = i * (0.15 + Math.random() * 0.1);
        const freq = notes[Math.floor(Math.random() * notes.length)];
        const gain = c.createGain();
        gain.gain.value = 0;

        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        // 淡入淡出
        const start = c.currentTime + delay;
        const dur = 1.5 + Math.random() * 1.0;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume * 0.4, start + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        // 颤音（慢速 vibrato）
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.linearRampToValueAtTime(freq * 0.995, start + 0.5);
        osc.frequency.linearRampToValueAtTime(freq * 1.005, start + dur * 0.6);
        osc.frequency.linearRampToValueAtTime(freq * 0.998, start + dur);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(start + dur);
    }

    // 递归安排下一组
    if (!masterGain || !isPlaying) return;
    bellTimer = setTimeout(() => scheduleBells(), interval * 1000);
}

// ── 工具：创建低频脉冲（心跳感） ─────────────────────────────────────

function schedulePulse() {
    if (!isPlaying) return;

    const c = getCtx();
    const interval = 30 + Math.random() * 15;

    setTimeout(() => {
        if (!isPlaying || !masterGain) return;
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 40 + Math.random() * 10;

        const gain = c.createGain();
        gain.gain.value = 0;
        const start = c.currentTime + 0.1;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume * 0.5, start + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 3);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(start + 3);

        schedulePulse();
    }, interval * 1000);
}

export const ambientMusic = {
    start() {
        if (isPlaying) return;
        gen++;
        isPlaying = true;

        const c = getCtx();
        masterGain = c.createGain();
        masterGain.gain.value = volume;
        masterGain.connect(c.destination);

        // 1. 深空低音 drone (55 Hz, A1 附近)
        createDrone(55, 'sine', volume * 0.3);
        // 2. 次低音 drone (略微不协和)
        createDrone(53.5, 'sine', volume * 0.15, -5);
        // 3. 中频 pad (三角波，温暖感)
        createDrone(220, 'triangle', volume * 0.2);
        // 4. 高频 shimmer (锯齿波，太空感)
        createDrone(880, 'sawtooth', volume * 0.06);
        createDrone(440, 'sawtooth', volume * 0.05, 7);

        // 5. 定时钟声
        scheduleBells();

        // 6. 低频脉冲
        schedulePulse();
    },

    stop() {
        isPlaying = false;
        gen++;
        if (bellTimer) {
            clearTimeout(bellTimer);
            bellTimer = null;
        }

        // 淡出所有节点
        if (masterGain) {
            const c = getCtx();
            masterGain.gain.linearRampToValueAtTime(0, c.currentTime + 0.5);
        }

        const myGen = gen;
        setTimeout(() => {
            if (gen !== myGen) return; // 已被重新 start
            for (const n of NODES) {
                try { n.osc.stop(); } catch (e) { /* 可能已停止 */ }
                try { n.lfo.stop(); } catch (e) { /* 可能已停止 */ }
                try { n.lfo2.stop(); } catch (e) { /* 可能已停止 */ }
            }
            NODES.length = 0;
            masterGain = null;
        }, 600);
    },

    toggle() {
        if (isPlaying) this.stop();
        else this.start();
    },

    setVolume(v) {
        volume = Math.max(0, Math.min(1, v));
        if (masterGain) {
            masterGain.gain.linearRampToValueAtTime(volume, getCtx().currentTime + 0.3);
        }
    },

    isPlaying() {
        return isPlaying;
    },
};
