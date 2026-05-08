/**
 * questEngine.js — Phase 2 quest system
 *
 * Events:   trigger(event, payload)
 * Panels:   openPanel() / closePanel() / ensurePanelDOM()
 * Notify:   showNotification(msg)
 *
 * All quest data persisted via storage.js (localStorage).
 * Quests are defined in QUESTS below — each has trigger logic,
 * completion conditions, and an educational completion message.
 */

import { getRaw, saveRaw, addXp, calcLevel } from './storage.js';

// ── Quest definitions ──────────────────────────────────────────────────

const QUESTS = [
    // ── Main line: 01–09 ──
    {
        id: 'quest_init',
        name: '🌟 初识太阳系',
        desc: '找到并点击太阳和所有 8 颗行星',
        branch: 'main',
        order: 1,
        xp: 50,
        trigger: 'click_body',
        check(payload, state) {
            const bodyIds = ['sun', 'mercury', 'venus', 'earth', 'mars',
                'jupiter', 'saturn', 'uranus', 'neptune'];
            const clicked = state.progress?.clicked || [];
            if (payload.bodyId && !clicked.includes(payload.bodyId)) {
                clicked.push(payload.bodyId);
            }
            const unique = [...new Set(clicked)];
            const complete = bodyIds.every(id => unique.includes(id));
            return {
                progress: { clicked: unique, found: unique.length, total: 9 },
                complete,
            };
        },
        completeMsg: '太阳是太阳系的中心，包含了 99.86% 的质量。八大行星从近日的水星到远日的海王星各具特色。记住它们的名字和顺序，是认识太阳系的第一步。',
    },
    {
        id: 'quest_size_sort',
        name: '📏 谁最大？',
        desc: '按半径从大到小排列 5 颗行星',
        branch: 'main',
        order: 2,
        xp: 80,
        trigger: 'size_sort',
        check(payload) {
            return {
                progress: payload.correct ? { done: 1, total: 1 } : undefined,
                complete: payload.correct === true,
            };
        },
        completeMsg: '木星是太阳系最大的行星，直径约 139,820 km，是地球的 11 倍。土星紧随其后，而水星最小。行星间的体型差异远超你的想象。',
    },
    {
        id: 'quest_eccentric',
        name: '🛤️ 古怪的轨道',
        desc: '将偏心率滑杆拉到 ×4，观察水星 3 秒',
        branch: 'main',
        order: 3,
        xp: 80,
        trigger: 'eccentric_change',
        check(payload, state) {
            const t = state.progress?.holdTime || 0;
            const newT = payload.value >= 4 ? t + payload.dt : 0;
            return {
                progress: { holdTime: +newT.toFixed(1), target: 3 },
                complete: newT >= 3,
            };
        },
        completeMsg: '行星轨道并非完美的圆。水星的偏心率最大（0.2056），近日点比远日点近约 2300 万公里。把偏心率调到 ×4，水星的椭圆就很明显了。',
    },
    {
        id: 'quest_retrograde',
        name: '🔄 逆向旋转',
        desc: '找到并点击逆向自转的行星（金星、天王星各一次）',
        branch: 'main',
        order: 4,
        xp: 80,
        trigger: 'click_body',
        check(payload, state) {
            const clicked = state.progress?.clicked || [];
            if (payload.bodyId === 'venus' && !clicked.includes('venus')) {
                clicked.push('venus');
            }
            if (payload.bodyId === 'uranus' && !clicked.includes('uranus')) {
                clicked.push('uranus');
            }
            const complete = clicked.includes('venus') && clicked.includes('uranus');
            return {
                progress: { clicked, found: clicked.length, total: 2 },
                complete,
            };
        },
        completeMsg: '大多数行星自西向东自转，但金星和天王星是个例外。金星自转极慢且方向相反——在那里太阳从西方升起。天王星则是躺着自转，倾角达 97.77°。',
    },
    {
        id: 'quest_earth_scale',
        name: '🌍 寻找家园',
        desc: '将星体缩放调至 ×1（真实比例），保持 3 秒',
        branch: 'main',
        order: 5,
        xp: 80,
        trigger: 'scale_change',
        check(payload, state) {
            const t = state.progress?.holdTime || 0;
            const newT = payload.value <= 1 ? t + payload.dt : 0;
            return {
                progress: { holdTime: +newT.toFixed(1), target: 3 },
                complete: newT >= 3,
            };
        },
        completeMsg: '这就是行星在宇宙中的真实大小。在 ×1 比例下，即便是木星也不过是一个小点，地球几乎不可见。正因为如此，场景默认才采用了 ×1200 的缩放，否则你根本无法操作。宇宙的尺度远超想象。',
    },
    {
        id: 'quest_saturn',
        name: '🪐 土星之环',
        desc: '拉近观察土星，让它停留在画面中心 3 秒',
        branch: 'main',
        order: 6,
        xp: 100,
        trigger: 'body_proximity',
        check(payload, state) {
            const t = state.progress?.holdTime || 0;
            const newT = payload.bodyId === 'saturn' && payload.distance < 80
                ? t + payload.dt : 0;
            return {
                progress: { holdTime: +newT.toFixed(1), target: 3 },
                complete: newT >= 3,
            };
        },
        completeMsg: '土星环主要由冰粒和岩石碎片组成，宽度约 28 万公里（相当于地球到月球距离的 3/4），但厚度只有约 10 米。这是一个巨大而极薄的盘状结构。',
    },
    {
        id: 'quest_asteroid',
        name: '💫 小行星带穿越',
        desc: '点击小行星带区域',
        branch: 'main',
        order: 7,
        xp: 100,
        trigger: 'click_asteroid_belt',
        check() {
            return {
                progress: { done: 1, total: 1 },
                complete: true,
            };
        },
        completeMsg: '小行星带位于火星和木星之间（2.2~3.2 AU），包含数百万颗小行星。但它们的总质量加起来还不到月球的 4%——看起来密密麻麻，实际上非常空旷。',
    },
    {
        id: 'quest_comet',
        name: '☄️ 彗星猎人',
        desc: '将时间流速拉到 ×200 以上，观察天体尾迹 5 秒',
        branch: 'main',
        order: 8,
        xp: 120,
        trigger: 'time_speed',
        check(payload, state) {
            const t = state.progress?.holdTime || 0;
            const newT = payload.value >= 200 ? t + payload.dt : 0;
            return {
                progress: { holdTime: +newT.toFixed(1), target: 5 },
                complete: newT >= 5,
            };
        },
        completeMsg: '彗星来自太阳系边缘的柯伊伯带和奥尔特云，轨道极扁。当它们靠近太阳时，表面冰物质升华形成彗发和彗尾——尾巴总是指向背离太阳的方向。',
    },
    {
        id: 'quest_graduate',
        name: '🏆 毕业考核',
        desc: '连续答对 5 道中级题目',
        branch: 'main',
        order: 9,
        xp: 200,
        trigger: 'quiz_answer',
        check(payload, state) {
            const streak = state.progress?.streak || 0;
            const newStreak = payload.correct ? streak + 1 : 0;
            return {
                progress: { streak: newStreak, target: 5 },
                complete: newStreak >= 5,
            };
        },
        completeMsg: '恭喜完成了整个探索之旅！你现在已经认识了太阳系的组成、行星的尺度、轨道的形状、自转的多样性。宇宙很大，但你已经迈出了探索的第一步。',
    },

    // ── Side quests: A–D ──
    {
        id: 'quest_quiz_master',
        name: '🧠 知识达人',
        desc: '累计答对 10 道题',
        branch: 'side',
        order: 'A',
        unlockMain: 3, // unlock after 3 main quests done
        xp: 100,
        trigger: 'quiz_answer',
        check(payload, state) {
            const total = (state.progress?.total || 0) + (payload.correct ? 1 : 0);
            return {
                progress: { total, target: 10 },
                complete: total >= 10,
            };
        },
        completeMsg: '知识积累从一点一滴开始。你已经掌握了太阳系的基本知识，继续挑战更多题目吧。',
    },
    {
        id: 'quest_speedster',
        name: '⏱️ 时光旅者',
        desc: '将时间流速拉到 ×100 以上并保持 3 秒',
        branch: 'side',
        order: 'B',
        unlockMain: 3, // unlock after quest_eccentric (main #3)
        xp: 60,
        trigger: 'time_speed',
        check(payload, state) {
            const t = state.progress?.holdTime || 0;
            const newT = payload.value >= 100 ? t + payload.dt : 0;
            return {
                progress: { holdTime: +newT.toFixed(1), target: 3 },
                complete: newT >= 3,
            };
        },
        completeMsg: '时间流速改变了，行星的运动节奏也随之变化。这个功能让你能俯瞰行星的长期运动——一年的旅程浓缩在一瞬间。',
    },
    {
        id: 'quest_moon',
        name: '🌙 月球漫步',
        desc: '靠近月球，让它进入视野',
        branch: 'side',
        order: 'C',
        unlockMain: 1, // unlock after quest_init
        xp: 60,
        trigger: 'body_proximity',
        check(payload, state) {
            return {
                progress: payload.bodyId === 'moon' && payload.distance < 30
                    ? { close: 1, total: 1 } : undefined,
                complete: payload.bodyId === 'moon' && payload.distance < 30,
            };
        },
        completeMsg: '月球是地球唯一的天然卫星，直径 3,474 km，平均距离约 38.4 万公里。这个距离足以容纳下太阳系所有行星排成一列。',
    },
    {
        id: 'quest_neptune',
        name: '🌌 天涯海角',
        desc: '移动到海王星附近',
        branch: 'side',
        order: 'D',
        unlockMain: 4, // unlock after quest_retrograde
        xp: 80,
        trigger: 'body_proximity',
        check(payload, state) {
            return {
                progress: payload.bodyId === 'neptune' && payload.distance < 100
                    ? { close: 1, total: 1 } : undefined,
                complete: payload.bodyId === 'neptune' && payload.distance < 100,
            };
        },
        completeMsg: '海王星是太阳系最远的行星，平均距离太阳 30.1 AU。它发蓝色的光芒，风速可达 2,100 km/h，是太阳系中风速最快的行星。',
    },
];

// ── Quest status helpers ───────────────────────────────────────────────

const STATUS = { LOCKED: 'locked', HIDDEN: 'hidden', ACTIVE: 'active', COMPLETED: 'completed' };

function createInitialState(quests) {
    const map = {};
    for (const q of quests) {
        map[q.id] = {
            status: q.order === 1 ? STATUS.ACTIVE : STATUS.LOCKED,
            progress: q.branch === 'side' ? null : undefined,
        };
    }
    return map;
}

// ── Quest Engine instance ──────────────────────────────────────────────

let instance = null;

export function createQuestEngine() {
    if (instance) return instance;

    const data = getRaw();

    // Schema version bump when quest definitions change
    const SCHEMA_VERSION = 2; // bump when adding/removing/changing quests
    if (!data._questSchema || data._questSchema !== SCHEMA_VERSION) {
        data.quests = createInitialState(QUESTS);
        data._questSchema = SCHEMA_VERSION;
        saveRaw(data);
    }

    let questState = data.quests;
    let panelOpen = false;
    let notificationQueue = [];
    let isNotifying = false;
    let lastTick = {}; // per-quest tick accumulator for dt-based checks

    // ── Internal helpers ────────────────────────────────────────────

    function save() {
        const d = getRaw();
        d.quests = questState;
        saveRaw(d);
    }

    function getQuestDef(id) {
        return QUESTS.find(q => q.id === id);
    }

    function getMainCompleted() {
        return QUESTS.filter(
            q => q.branch === 'main' && questState[q.id]?.status === STATUS.COMPLETED
        ).length;
    }

    function getSideUnlocked() {
        return QUESTS.filter(q => {
            if (q.branch !== 'side') return false;
            const s = questState[q.id];
            return s && s.status !== STATUS.LOCKED;
        }).length;
    }

    /** Check and unlock side quests that depend on main quest count */
    function evaluateUnlocks() {
        const mainDone = getMainCompleted();
        for (const q of QUESTS) {
            if (q.branch !== 'side') continue;
            const s = questState[q.id];
            if (!s || s.status !== STATUS.LOCKED) continue;
            if (mainDone >= (q.unlockMain || 99)) {
                s.status = STATUS.ACTIVE;
                s.progress = null;
                save();
                showNotification('🔓 新任务解锁：' + q.name);
            }
        }
    }

    /** Unlock next main quest after current one completes */
    function unlockNextMain(completedId) {
        const idx = QUESTS.findIndex(q => q.id === completedId);
        if (idx === -1) return;
        const next = QUESTS[idx + 1];
        if (!next || next.branch !== 'main') return;
        const ns = questState[next.id];
        if (ns && ns.status === STATUS.LOCKED) {
            ns.status = STATUS.ACTIVE;
            save();
            showNotification('🔓 新任务解锁：' + next.name);
        }
    }

    // ── Check a single quest ────────────────────────────────────────

    function checkQuest(q, payload) {
        const state = questState[q.id];
        if (!state || state.status !== STATUS.ACTIVE) return false;

        const result = q.check(payload, state);

        // Always save progress if returned
        if (result && result.progress !== undefined) {
            state.progress = result.progress;
        }

        if (result && result.complete) {
            state.status = STATUS.COMPLETED;
            state.completedAt = Date.now();
            save();

            // Award XP
            const { xp, level } = addXp(q.xp);

            // Show notification & completion message
            showCompletion(q, xp, level);

            // Unlock chain
            if (q.branch === 'main') {
                unlockNextMain(q.id);
                evaluateUnlocks();
            }
            return true;
        }

        save();
        return false;
    }

    // ── Notification display (DOM-based) ─────────────────────────────

    function ensureToastContainer() {
        let el = document.getElementById('qt-toast-container');
        if (!el) {
            el = document.createElement('div');
            el.id = 'qt-toast-container';
            el.style.cssText = 'position:fixed;top:90px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
            document.body.appendChild(el);
        }
        return el;
    }

    function showNotification(text, type) {
        notificationQueue.push({ text, type: type || 'info' });
        processQueue();
    }

    function showCompletion(q, xp, level) {
        // First show a compact toast
        showNotification('✅ ' + q.name + ' 完成！ +' + xp + ' XP', 'complete');

        // If there's a completion message, schedule the expanded info panel
        if (q.completeMsg) {
            setTimeout(() => {
                showExpandableInfo(q.name, q.completeMsg, xp);
            }, 2200);
        }
    }

    function showExpandableInfo(title, body, xp) {
        const container = ensureToastContainer();

        const card = document.createElement('div');
        card.style.cssText = `
            background: linear-gradient(135deg, #1a1f3a, #0f1530);
            border: 1px solid rgba(100,150,255,0.2);
            border-radius: 10px;
            padding: 16px;
            max-width: 380px;
            color: #e0e5f0;
            font-size: 13px;
            line-height: 1.6;
            box-shadow: 0 4px 20px rgba(0,0,0,0.6);
            pointer-events: auto;
            animation: qt-slide-in 0.3s ease-out;
            position: relative;
        `;

        card.innerHTML = `
            <div style="font-weight:600;font-size:14px;margin-bottom:6px;">${title}</div>
            <div style="color:#aab4d0;font-size:12.5px;margin-bottom:12px;">${body}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:#4ade80;font-weight:600;font-size:13px;">+${xp} XP</span>
                <button class="qt-dismiss" style="
                    background:rgba(100,150,255,0.12);border:1px solid rgba(100,150,255,0.25);
                    color:#8ab4ff;border-radius:6px;padding:4px 14px;font-size:12px;
                    cursor:pointer;">知道了</button>
            </div>
        `;

        card.querySelector('.qt-dismiss').addEventListener('click', () => {
            card.style.animation = 'qt-slide-out 0.25s ease-in';
            setTimeout(() => card.remove(), 260);
        });

        container.appendChild(card);

        // Auto dismiss after 10s
        setTimeout(() => {
            if (card.parentNode) {
                card.style.animation = 'qt-slide-out 0.25s ease-in';
                setTimeout(() => card.remove(), 260);
            }
        }, 10000);
    }

    function processQueue() {
        if (isNotifying || notificationQueue.length === 0) return;
        isNotifying = true;

        const { text, type } = notificationQueue.shift();
        const container = ensureToastContainer();
        const toast = document.createElement('div');

        toast.style.cssText = `
            background: ${type === 'complete'
                ? 'linear-gradient(135deg,#1a3a2a,#0f3020)'
                : 'linear-gradient(135deg,#1a1f3a,#0f1530)'};
            border: 1px solid ${type === 'complete' ? 'rgba(74,222,128,0.25)' : 'rgba(100,150,255,0.15)'};
            border-radius: 8px;
            padding: 10px 16px;
            color: #e0e5f0;
            font-size: 13px;
            box-shadow: 0 3px 12px rgba(0,0,0,0.5);
            pointer-events: auto;
            animation: qt-slide-in 0.3s ease-out;
        `;
        toast.textContent = text;

        // Auto dismiss
        setTimeout(() => {
            toast.style.animation = 'qt-slide-out 0.25s ease-in';
            setTimeout(() => { toast.remove(); isNotifying = false; processQueue(); }, 260);
        }, 2000);

        container.appendChild(toast);
    }

    // ── Inject keyframes if not present ──────────────────────────────
    (function injectKeyframes() {
        if (document.getElementById('qt-keyframes')) return;
        const style = document.createElement('style');
        style.id = 'qt-keyframes';
        style.textContent = `
            @keyframes qt-slide-in {
                from { transform: translateX(120%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes qt-slide-out {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(120%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    })();

    // ── Public API ──────────────────────────────────────────────────

    const api = {
        /** Get current status of a quest */
        getState(id) {
            const s = questState[id];
            if (!s) return null;
            return { ...s, def: getQuestDef(id) };
        },

        /** Get all active quests */
        getActiveQuests() {
            return QUESTS
                .filter(q => questState[q.id]?.status === STATUS.ACTIVE)
                .map(q => ({ ...q, progress: questState[q.id]?.progress }));
        },

        /** Get number of completed main quests */
        getMainCompleted: getMainCompleted,

        /** Get all quests with their state */
        getAllQuests() {
            return QUESTS.map(q => ({
                ...q,
                state: questState[q.id] || { status: STATUS.LOCKED },
            }));
        },

        /** Fire an event to update quest state */
        trigger(event, payload) {
            // Ensure dt field for time-based progress
            const now = Date.now();
            const key = event;
            const last = lastTick[key] || now;
            const dt = Math.min((now - last) / 1000, 1);
            lastTick[key] = now;
            const enrichedPayload = { ...payload, dt };

            for (const q of QUESTS) {
                if (q.trigger === event) {
                    checkQuest(q, enrichedPayload);
                }
            }
        },

        /** Open/close quest panel */
        openPanel() {
            panelOpen = true;
            const panel = document.getElementById('qt-panel');
            if (panel) {
                this._renderPanel();
                panel.classList.add('visible');
            }
        },
        closePanel() {
            panelOpen = false;
            const panel = document.getElementById('qt-panel');
            if (panel) panel.classList.remove('visible');
        },
        togglePanel() {
            if (panelOpen) api.closePanel();
            else api.openPanel();
        },

        /** Render the quest panel DOM (called once by main.js) */
        ensurePanelDOM() {
            if (document.getElementById('qt-panel')) return;

            const panel = document.createElement('div');
            panel.id = 'qt-panel';
            panel.className = 'qt-panel';
            panel.innerHTML = `
                <div class="qt-panel-header">
                    <span>📋 任务</span>
                    <button class="qt-panel-close">✕</button>
                </div>
                <div class="qt-panel-body"></div>
                <div class="qt-panel-footer"></div>
            `;
            document.body.appendChild(panel);

            panel.querySelector('.qt-panel-close').addEventListener('click', () => api.closePanel());

            // Click outside panel (or toggle button) → close
            document.addEventListener('click', function onQuestDocClick(e) {
                const p = document.getElementById('qt-panel');
                const btn = document.getElementById('quest-btn');
                if (!p || !p.classList.contains('visible')) return;
                if (!p.contains(e.target) && (!btn || !btn.contains(e.target))) {
                    api.closePanel();
                }
            });

            this._renderPanel();
        },

        /** Re-render panel content */
        _renderPanel() {
            const body = document.querySelector('.qt-panel-body');
            const footer = document.querySelector('.qt-panel-footer');
            if (!body) return;

            const mainQuests = QUESTS.filter(q => q.branch === 'main');
            const sideQuests = QUESTS.filter(q => q.branch === 'side');

            let html = '';

            // Main quests
            for (const q of mainQuests) {
                html += renderQuestItem(q, questState[q.id]);
            }

            // Side quests section
            const hasUnlockedSide = sideQuests.some(q => {
                const s = questState[q.id];
                return s && s.status !== STATUS.LOCKED;
            });

            if (hasUnlockedSide) {
                html += '<div class="qt-section-title">支线任务</div>';
                for (const q of sideQuests) {
                    const s = questState[q.id];
                    if (s && s.status !== STATUS.LOCKED) {
                        html += renderQuestItem(q, s);
                    }
                }
            }

            body.innerHTML = html || '<div style="padding:16px;color:#667;font-size:13px;">暂无可用任务</div>';

            // Footer: progress bar
            const mainDone = getMainCompleted();
            const totalMain = mainQuests.length;
            const pct = Math.round(mainDone / totalMain * 100);
            const { xp, level } = (() => {
                const d = getRaw();
                const totalXp = d.xp || 0;
                return { xp: totalXp, level: calcLevel(totalXp) };
            })();

            footer.innerHTML = `
                <div style="font-size:12px;color:#889;margin-bottom:4px;">
                    主线进度：${mainDone}/${totalMain} · Lv.${level}
                </div>
                <div class="qt-progress-bar">
                    <div class="qt-progress-fill" style="width:${pct}%"></div>
                </div>
            `;
        },

        /** Show a notification (public) */
        showNotification(text) {
            showNotification(text);
        },

        /** Force check all active quests (used after loading) */
        evaluateAll() {
            // No-op: quests only progress via trigger()
        },
    };

    instance = api;
    return api;
}

// ── Render a single quest item ──────────────────────────────────────────

function renderQuestItem(q, state) {
    if (!state) {
        return `<div class="qt-item qt-locked">🔒 ${q.name}</div>`;
    }

    const status = state.status;

    if (status === STATUS.LOCKED || status === STATUS.HIDDEN) {
        return `<div class="qt-item qt-locked">🔒 ${q.name}</div>`;
    }

    if (status === STATUS.COMPLETED) {
        return `<div class="qt-item qt-completed">✅ ${q.name}</div>`;
    }

    // Active
    const p = state.progress;
    let progressHtml = '';
    if (p && (p.total || p.target)) {
        const done = p.found || p.holdTime || p.done || p.streak || p.total || 0;
        const total = p.total || p.target || 1;
        const pct = Math.min(100, Math.round(done / total * 100));
        progressHtml = `
            <div class="qt-progress-bar">
                <div class="qt-progress-fill" style="width:${pct}%"></div>
            </div>
            <div class="qt-progress-text">${done}/${total}</div>
        `;
    } else if (p && p.holdTime !== undefined) {
        const pct = Math.min(100, Math.round(p.holdTime / p.target * 100));
        progressHtml = `
            <div class="qt-progress-bar">
                <div class="qt-progress-fill" style="width:${pct}%"></div>
            </div>
            <div class="qt-progress-text">${p.holdTime.toFixed(1)}/${p.target}秒</div>
        `;
    } else if (p && p.clicked) {
        const pct = Math.min(100, Math.round(p.clicked.length / p.total * 100));
        progressHtml = `
            <div class="qt-progress-bar">
                <div class="qt-progress-fill" style="width:${pct}%"></div>
            </div>
            <div class="qt-progress-text">${p.clicked.length}/${p.total}</div>
        `;
    }

    return `
        <div class="qt-item qt-active">
            <div class="qt-item-header">
                <span class="qt-item-name">🎯 ${q.name}</span>
            </div>
            <div class="qt-item-desc">${q.desc}</div>
            ${progressHtml}
        </div>
    `;
}
