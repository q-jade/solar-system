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
import { openSortPanel } from './sortPanel.js';
import { sfx } from './sfx.js';
import { t, onLangChange } from './i18n.js';

// ── Quest definitions ──────────────────────────────────────────────────

const QUESTS = [
    // ── Main line: 01–09 ──
    {
        id: 'quest_init',
        nameKey: 'quest_init',
        descKey: 'quest_init',
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
    },
    {
        id: 'quest_size_sort',
        nameKey: 'quest_size_sort',
        descKey: 'quest_size_sort',
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
    },
    {
        id: 'quest_eccentric',
        nameKey: 'quest_eccentric',
        descKey: 'quest_eccentric',
        branch: 'main',
        order: 3,
        xp: 80,
        trigger: 'eccentric_change',
        continuous: true,
        check(payload, state) {
            const t = state.progress?.holdTime || 0;
            const newT = payload.value >= 4 ? t + payload.dt : 0;
            return {
                progress: { holdTime: +newT.toFixed(1), target: 3 },
                complete: newT >= 3,
            };
        },
    },
    {
        id: 'quest_retrograde',
        nameKey: 'quest_retrograde',
        descKey: 'quest_retrograde',
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
    },
    {
        id: 'quest_earth_scale',
        nameKey: 'quest_earth_scale',
        descKey: 'quest_earth_scale',
        branch: 'main',
        order: 5,
        xp: 80,
        trigger: 'scale_change',
        continuous: true,
        check(payload, state) {
            const t = state.progress?.holdTime || 0;
            const newT = payload.value <= 1 ? t + payload.dt : 0;
            return {
                progress: { holdTime: +newT.toFixed(1), target: 3 },
                complete: newT >= 3,
            };
        },
    },
    {
        id: 'quest_saturn',
        nameKey: 'quest_saturn',
        descKey: 'quest_saturn',
        branch: 'main',
        order: 6,
        xp: 100,
        trigger: 'body_proximity',
        check(payload, state) {
            // Only update progress when bodyId matches our target
            if (payload.bodyId !== 'saturn') return { progress: undefined, complete: false };
            const t = state.progress?.holdTime || 0;
            const distOk = payload.distance < 300;
            const newT = distOk ? t + payload.dt : 0;
            return {
                progress: { holdTime: +newT.toFixed(1), target: 3 },
                complete: newT >= 3,
            };
        },
    },
    {
        id: 'quest_asteroid',
        nameKey: 'quest_asteroid',
        descKey: 'quest_asteroid',
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
    },
    {
        id: 'quest_comet',
        nameKey: 'quest_comet',
        descKey: 'quest_comet',
        branch: 'main',
        order: 8,
        xp: 120,
        trigger: 'time_speed',
        continuous: true,
        check(payload, state) {
            const t = state.progress?.holdTime || 0;
            const newT = payload.value >= 200 ? t + payload.dt : 0;
            return {
                progress: { holdTime: +newT.toFixed(1), target: 5 },
                complete: newT >= 5,
            };
        },
    },
    {
        id: 'quest_graduate',
        nameKey: 'quest_graduate',
        descKey: 'quest_graduate',
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
    },

    // ── Side quests: A–D ──
    {
        id: 'quest_quiz_master',
        nameKey: 'quest_quiz_master',
        descKey: 'quest_quiz_master',
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
    },
    {
        id: 'quest_speedster',
        nameKey: 'quest_speedster',
        descKey: 'quest_speedster',
        branch: 'side',
        order: 'B',
        unlockMain: 3, // unlock after quest_eccentric (main #3)
        xp: 60,
        trigger: 'time_speed',
        continuous: true,
        check(payload, state) {
            const t = state.progress?.holdTime || 0;
            const newT = payload.value >= 100 ? t + payload.dt : 0;
            return {
                progress: { holdTime: +newT.toFixed(1), target: 3 },
                complete: newT >= 3,
            };
        },
    },
    {
        id: 'quest_moon',
        nameKey: 'quest_moon',
        descKey: 'quest_moon',
        branch: 'side',
        order: 'C',
        unlockMain: 1, // unlock after quest_init
        xp: 60,
        trigger: 'body_proximity',
        check(payload, state) {
            if (payload.bodyId !== 'moon') return { progress: undefined, complete: false };
            const close = payload.distance < 40;
            return {
                progress: close ? { close: 1, total: 1 } : undefined,
                complete: close,
            };
        },
    },
    {
        id: 'quest_neptune',
        nameKey: 'quest_neptune',
        descKey: 'quest_neptune',
        branch: 'side',
        order: 'D',
        unlockMain: 4, // unlock after quest_retrograde
        xp: 80,
        trigger: 'body_proximity',
        check(payload, state) {
            if (payload.bodyId !== 'neptune') return { progress: undefined, complete: false };
            const close = payload.distance < 300;
            return {
                progress: close ? { close: 1, total: 1 } : undefined,
                complete: close,
            };
        },
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
    let lastTick = {};

    /** Which quests need continuous polling (hold-type tasks) */
    const CONTINUOUS_QUESTS = QUESTS.filter(q => q.continuous).map(q => q.id);

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
                showNotification(t('quest.newUnlock', { name: t('quest.names.' + q.nameKey) }));
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
            showNotification(t('quest.newUnlock', { name: t('quest.names.' + next.nameKey) }));
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
        sfx.questDone();
        showNotification('✅ ' + t('quest.names.' + q.nameKey) + ' +' + xp + ' XP', 'complete');

        // If there's a completion message, schedule the expanded info panel
        if (t('quest.msgs.' + q.nameKey)) {
            setTimeout(() => {
                showExpandableInfo(t('quest.names.' + q.nameKey), t('quest.msgs.' + q.nameKey), xp);
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
                    cursor:pointer;">${t('quest.knowIt')}</button>
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
            // Use bodyId as sub-key for proximity events so each body
            // gets its own dt tracking (avoiding same-frame dt=0 for all planets)
            const subKey = event === 'body_proximity' && payload.bodyId
                ? event + '_' + payload.bodyId : event;
            const last = lastTick[subKey] || now;
            const dt = Math.min((now - last) / 1000, 1);
            lastTick[subKey] = now;
            const enrichedPayload = { ...payload, dt };

            for (const q of QUESTS) {
                if (q.trigger === event) {
                    checkQuest(q, enrichedPayload);
                }
            }
        },

        /**
         * Continuous poll for hold-type quests.
         * Reads current DOM slider values and triggers the appropriate events.
         * Must be called periodically from the animation loop.
         */
        poll(realDt) {
            for (const qId of CONTINUOUS_QUESTS) {
                const state = questState[qId];
                if (!state || state.status !== STATUS.ACTIVE) continue;

                const def = getQuestDef(qId);
                if (!def || !def.continuous) continue;

                let value = null;
                if (def.trigger === 'eccentric_change') {
                    const el = document.getElementById('ecc-slider');
                    if (el) value = parseFloat(el.value) / 40 * 4;
                } else if (def.trigger === 'scale_change') {
                    const el = document.getElementById('scale-slider');
                    if (el) {
                        const v = parseFloat(el.value);
                        value = 1 + 2999 * (v / 100);
                    }
                } else if (def.trigger === 'time_speed') {
                    const el = document.getElementById('speed-slider');
                    if (el) {
                        const v = parseFloat(el.value);
                        value = Math.pow(365, v / 100);
                    }
                } else if (def.trigger === 'body_proximity') {
                    // handled separately in main.js animate loop
                    continue;
                }

                if (value !== null) {
                    // Replay this quest's check with current value + real dt
                    checkQuest(def, { value, dt: realDt });
                }
            }
        },


        /** Open/close quest panel */
        openPanel() {
            sfx.panelOpen();
            panelOpen = true;
            const panel = document.getElementById('qt-panel');
            if (panel) {
                this._renderPanel();
                panel.classList.add('visible');
            }
        },
        closePanel() {
            panelOpen = false;
            sfx.panelClose();
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
                    <span>${t('quest.panelTitle')}</span>
                    <button class="qt-panel-close">✕</button>
                </div>
                <div class="qt-panel-body"></div>
                <div class="qt-panel-footer"></div>
            `;
            document.body.appendChild(panel);

            // 语言切换时更新面板标题和内容
            onLangChange(() => {
                const titleEl = panel.querySelector('.qt-panel-header span');
                if (titleEl) titleEl.textContent = t('quest.panelTitle');
                this._renderPanel();
            });

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
            html += '<div class="qt-section-title">' + t('quest.sidebar.main') + '</div>';
            for (const q of mainQuests) {
                html += renderQuestItem(q, questState[q.id]);
            }

            // Side quests section
            const hasUnlockedSide = sideQuests.some(q => {
                const s = questState[q.id];
                return s && s.status !== STATUS.LOCKED;
            });

            if (hasUnlockedSide) {
                html += '<div class="qt-section-title">' + t('quest.sidebar.side') + '</div>';
                for (const q of sideQuests) {
                    const s = questState[q.id];
                    if (s && s.status !== STATUS.LOCKED) {
                        html += renderQuestItem(q, s);
                    }
                }
            }

            body.innerHTML = html || '<div style="padding:16px;color:#667;font-size:13px;">暂无可用任务</div>';

            // Click delegation: quest items with data-quest-click
            body.addEventListener('click', function onQuestItemClick(e) {
                const item = e.target.closest('[data-quest-click]');
                if (!item) return;
                const questId = item.dataset.questClick;
                if (questId === 'quest_size_sort') {
                    const s = questState['quest_size_sort'];
                    if (s && (s.status === STATUS.ACTIVE || s.status === STATUS.COMPLETED)) {
                        api.closePanel();
                        openSortPanel();
                    }
                }
            });

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
                    ${t('quest.progress', { done: mainDone, total: totalMain, level: level })}
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

        /** Reset all quest state (used after data reset) */
        resetQuests() {
            const data = getRaw();
            data.quests = createInitialState(QUESTS);
            data._questSchema = 2;
            saveRaw(data);
            questState = data.quests;
            lastTick = {};
            notificationQueue = [];
            isNotifying = false;
        },
    };

    instance = api;
    return api;
}

// ── Render a single quest item ──────────────────────────────────────────

function renderQuestItem(q, state) {
    if (!state) {
        return `<div class="qt-item qt-locked">🔒 ${t('quest.names.' + q.nameKey)}</div>`;
    }

    const status = state.status;

    if (status === STATUS.LOCKED || status === STATUS.HIDDEN) {
        return `<div class="qt-item qt-locked">🔒 ${t('quest.names.' + q.nameKey)}</div>`;
    }

    if (status === STATUS.COMPLETED) {
        const dataAttr = (q.id === 'quest_size_sort') ? ' data-quest-click="quest_size_sort"' : '';
        const cursorStyle = (q.id === 'quest_size_sort') ? ' style="cursor:pointer"' : '';
        return `<div class="qt-item qt-completed"${dataAttr}${cursorStyle}>✅ ${t('quest.names.' + q.nameKey)}</div>`;
    }

    // Active
    const p = state.progress;
    let progressHtml = '';
    if (p && (p.total || p.target)) {
        const done = p.found || p.holdTime || p.done || p.streak || p.total || 0;
        const total = p.target || p.total || 1;
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
            <div class="qt-progress-text">${p.holdTime.toFixed(1)}/${p.target}${t('unit.seconds')}</div>
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

    // Make quest_size_sort clickable to open sort panel
    const dataAttr = (q.id === 'quest_size_sort')
        ? ' data-quest-click="quest_size_sort"'
        : '';

    const cursorStyle = (q.id === 'quest_size_sort' && status === STATUS.ACTIVE)
        ? ' style="cursor:pointer"'
        : '';

    return `
        <div class="qt-item qt-active"${dataAttr}${cursorStyle}>
            <div class="qt-item-header">
                <span class="qt-item-name">🎯 ${t('quest.names.' + q.nameKey)}</span>
            </div>
            <div class="qt-item-desc">${t('quest.descs.' + q.descKey)}</div>
            ${progressHtml}
        </div>
    `;
}
