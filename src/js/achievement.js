/**
 * achievement.js — Phase 2 achievement system
 *
 * All achievements are evaluated globally via evaluate().
 * Called after any XP change, quest completion, or significant action.
 */

import { getRaw, saveRaw, addXp, calcLevel } from './storage.js';
import { sfx } from './sfx.js';
import { t, onLangChange } from './i18n.js';
import { createQuestEngine } from './questEngine.js';

// ── Achievement definitions ────────────────────────────────────────────

const ACHIEVEMENTS = [
    {
        id: 'ach_explorer',
        nameKey: 'ach_explorer',
        descKey: 'ach_explorer',
        icon: '🪐',
        xp: 200,
        category: '探索',
        check(data) {
            const required = ['mercury', 'venus', 'earth', 'mars',
                'jupiter', 'saturn', 'uranus', 'neptune'];
            return required.every(id => data.explored.includes(id));
        },
    },
    {
        id: 'ach_astronomer',
        nameKey: 'ach_astronomer',
        descKey: 'ach_astronomer',
        icon: '⭐',
        xp: 300,
        category: '学习',
        progress(data) { return { current: data.correct, target: 50 }; },
        check(data) { return data.correct >= 50; },
    },
    {
        id: 'ach_kepler',
        nameKey: 'ach_kepler',
        descKey: 'ach_kepler',
        icon: '📐',
        xp: 150,
        category: '任务',
        check(data) {
            return data.quests?.quest_eccentric?.status === 'completed';
        },
    },
    {
        id: 'ach_earthling',
        nameKey: 'ach_earthling',
        descKey: 'ach_earthling',
        icon: '🌍',
        xp: 150,
        category: '任务',
        check(data) {
            return data.quests?.quest_earth_scale?.status === 'completed';
        },
    },
    {
        id: 'ach_collector',
        nameKey: 'ach_collector',
        descKey: 'ach_collector',
        icon: '💎',
        xp: 250,
        category: '收集',
        progress(data) {
            const required = ['sun', 'mercury', 'venus', 'earth', 'mars',
                'jupiter', 'saturn', 'uranus', 'neptune'];
            const current = required.filter(id => data.explored.includes(id)).length;
            return { current, target: required.length };
        },
        check(data) {
            const required = ['sun', 'mercury', 'venus', 'earth', 'mars',
                'jupiter', 'saturn', 'uranus', 'neptune'];
            return required.every(id => data.explored.includes(id));
        },
    },
    {
        id: 'ach_moon',
        nameKey: 'ach_moon',
        descKey: 'ach_moon',
        icon: '🌙',
        xp: 100,
        category: '支线',
        check(data) {
            return data.quests?.quest_moon?.status === 'completed';
        },
    },
    {
        id: 'ach_speedster',
        nameKey: 'ach_speedster',
        descKey: 'ach_speedster',
        icon: '⚡',
        xp: 150,
        category: '实验',
        check(data) {
            // Handled via quest/time trigger — checked from evaluate()
            // We'll use a separate mechanism: check if quest_speedster is done
            return data.quests?.quest_speedster?.status === 'completed'
                || false;
        },
    },
    {
        id: 'ach_completionist',
        nameKey: 'ach_completionist',
        descKey: 'ach_completionist',
        icon: '🏆',
        xp: 500,
        category: '综合',
        progress(data) {
            const mainIds = ['quest_init', 'quest_size_sort', 'quest_eccentric',
                'quest_retrograde', 'quest_earth_scale', 'quest_saturn',
                'quest_asteroid', 'quest_comet', 'quest_graduate'];
            const done = mainIds.filter(id => data.quests?.[id]?.status === 'completed').length;
            return { current: done, target: 9 };
        },
        check(data) {
            const mainIds = ['quest_init', 'quest_size_sort', 'quest_eccentric',
                'quest_retrograde', 'quest_earth_scale', 'quest_saturn',
                'quest_asteroid', 'quest_comet', 'quest_graduate'];
            return mainIds.every(id => data.quests?.[id]?.status === 'completed');
        },
    },
    {
        id: 'ach_hidden_tiny',
        nameKey: 'ach_hidden_tiny',
        descKey: 'ach_hidden_tiny',
        icon: '🤏',
        xp: 80,
        category: '隐藏',
        hidden: true,
        resolveBy: 'custom',
        check(data) { return data._achTinyUnlocked === true; },
    },
    {
        id: 'ach_hidden_orbit',
        nameKey: 'ach_hidden_orbit',
        descKey: 'ach_hidden_orbit',
        icon: '🔄',
        xp: 100,
        category: '隐藏',
        hidden: true,
        resolveBy: 'custom',
        check(data) { return data._achOrbitUnlocked === true; },
    },
];

// ── Achievement Engine instance ────────────────────────────────────────

let instance = null;

export function createAchievement() {
    if (instance) return instance;

    let isPanelOpen = false;
    let lastEvalTime = 0;

    function save() {
        // achievements stored inside raw data
    }

    function showUnlockAnimation(ach, xp) {
        // Use quest engine's notification system for consistency
        let container = document.getElementById('qt-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'qt-toast-container';
            container.style.cssText = 'position:fixed;top:90px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
            document.body.appendChild(container);
        }

        const card = document.createElement('div');
        card.style.cssText = `
            background: linear-gradient(135deg, #2a1a3a, #1f1530);
            border: 2px solid rgba(255,200,50,0.3);
            border-radius: 10px;
            padding: 14px 18px;
            max-width: 360px;
            color: #f0e8d0;
            font-size: 13px;
            line-height: 1.5;
            box-shadow: 0 4px 24px rgba(255,200,50,0.15);
            pointer-events: auto;
            animation: qt-slide-in 0.4s ease-out;
        `;

        card.innerHTML = `
            <div style="text-align:center;font-size:28px;margin-bottom:4px;">${ach.icon}</div>
            <div style="font-weight:700;font-size:15px;text-align:center;color:#ffd966;margin-bottom:4px;">
                ${t('achievement.unlockTitle')}
            </div>
            <div style="text-align:center;font-weight:600;font-size:14px;margin-bottom:6px;">
                ${t('achievement.names.' + ach.nameKey)}
            </div>
            <div style="text-align:center;color:#b0a8c0;font-size:12px;margin-bottom:10px;">
                ${t('achievement.descs.' + ach.descKey)}
            </div>
            <div style="text-align:center;color:#4ade80;font-weight:600;font-size:14px;">
                +${xp} XP
            </div>
        `;

        container.appendChild(card);

        setTimeout(() => {
            card.style.animation = 'qt-slide-out 0.3s ease-in';
            setTimeout(() => card.remove(), 310);
        }, 4000);
    }

    const api = {
        /** Get all achievements with unlock state */
        getAll() {
            const data = getRaw();
            return ACHIEVEMENTS.map(ach => {
                const state = data.achievements[ach.id];
                const unlocked = state?.unlocked === true;
                // For hidden achievements, only reveal if unlocked
                if (ach.hidden && !unlocked) {
                    return { ...ach, hidden: true, unlocked: false };
                }
                const progress = ach.progress ? ach.progress(data) : null;
                return { ...ach, unlocked, progress, unlockedAt: state?.unlockedAt };
            });
        },

        /** Get only unlocked achievements */
        getUnlocked() {
            return this.getAll().filter(a => a.unlocked);
        },

        /** Get progress for a single achievement */
        getProgress(achId) {
            const ach = ACHIEVEMENTS.find(a => a.id === achId);
            if (!ach) return null;
            const data = getRaw();
            const state = data.achievements[achId];
            return {
                unlocked: state?.unlocked === true,
                progress: ach.progress ? ach.progress(data) : null,
            };
        },

        /** Evaluate all achievements — call after any meaningful action */
        evaluate() {
            const data = getRaw();
            let anyUnlocked = false;

            for (const ach of ACHIEVEMENTS) {
                const state = data.achievements[ach.id];
                if (state?.unlocked) continue;

                if (ach.check(data)) {
                    data.achievements[ach.id] = { unlocked: true, unlockedAt: Date.now() };
                    const { xp } = addXp(ach.xp);
                    saveRaw(data);
                    anyUnlocked = true;
                    sfx.achievement();

                    // Dispatch unlock animation (async, after current render)
                    setTimeout(() => showUnlockAnimation(ach, ach.xp), 100);
                }
            }
        },

        /** Custom flag setters (for hidden achievements resolved by main.js) */
        _setCustomFlag(flagName) {
            const data = getRaw();
            data[flagName] = true;
            saveRaw(data);
            this.evaluate();
        },

        /** Open/close achievement panel */
        openPanel() {
            isPanelOpen = true;
            const panel = document.getElementById('ach-panel');
            if (panel) {
                this._renderPanel();
                panel.classList.add('visible');
            }
        },
        closePanel() {
            isPanelOpen = false;
            const panel = document.getElementById('ach-panel');
            if (panel) panel.classList.remove('visible');
        },
        togglePanel() {
            if (isPanelOpen) this.closePanel();
            else this.openPanel();
        },

        /** Render the achievement panel DOM */
        ensurePanelDOM() {
            if (document.getElementById('ach-panel')) return;

            const panel = document.createElement('div');
            panel.id = 'ach-panel';
            panel.className = 'ach-panel';
            panel.innerHTML = `
                <div class="ach-panel-header">
                    <span>${t('achievement.title')}</span>
                    <button class="ach-panel-close">✕</button>
                </div>
                <div class="ach-panel-body"></div>
                <div class="ach-panel-footer"></div>
            `;
            document.body.appendChild(panel);

            // 语言切换时更新面板标题和内容
            onLangChange(() => {
                const titleEl = panel.querySelector('.ach-panel-header span');
                if (titleEl) titleEl.textContent = t('achievement.title');
                this._renderPanel();
            });

            panel.querySelector('.ach-panel-close').addEventListener('click', () => api.closePanel());

            // Click outside panel (or toggle button) → close
            document.addEventListener('click', function onAchDocClick(e) {
                const p = document.getElementById('ach-panel');
                const btn = document.getElementById('ach-btn');
                if (!p || !p.classList.contains('visible')) return;
                if (!p.contains(e.target) && (!btn || !btn.contains(e.target))) {
                    api.closePanel();
                }
            });

            this._renderPanel();
        },

        /** Re-render panel */
        _renderPanel() {
            const body = document.querySelector('.ach-panel-body');
            const footer = document.querySelector('.ach-panel-footer');
            if (!body) return;

            const all = this.getAll();
            const unlocked = all.filter(a => a.unlocked);
            const locked = all.filter(a => !a.hidden && !a.unlocked);

            let html = '';
            // Row: unlocked items first
            for (const ach of unlocked) {
                html += renderAchievementCard(ach, true);
            }
            for (const ach of locked) {
                html += renderAchievementCard(ach, false);
            }

            body.innerHTML = html || '<div style="padding:16px;color:#667;font-size:13px;">' + t('achievement.panelEmpty') + '</div>';

            // Footer
            const data = getRaw();
            const totalXp = data.xp || 0;
            const lv = calcLevel(totalXp);
            const next = 100 * lv * lv;
            const prev = 100 * (lv - 1) * (lv - 1);
            const pct = Math.min(100, Math.round((totalXp - prev) / (next - prev) * 100));

            footer.innerHTML = `
                <div style="font-size:12px;color:#889;margin-bottom:3px;">
                    ${t('achievement.unlocked', { done: unlocked.length, total: all.filter(a => !a.hidden || a.unlocked).length })}
                    · ${t('achievement.xpLevel', { xp: totalXp, level: lv })}
                </div>
                <div class="qt-progress-bar">
                    <div class="qt-progress-fill" style="width:${pct}%"></div>
                </div>
                <div style="font-size:11px;color:#667;text-align:right;margin-top:2px;">
                    ${totalXp - prev} / ${next - prev}
                </div>
            `;
        },
    };

    instance = api;
    return api;
}

// ── Render a single achievement card ────────────────────────────────────

function renderAchievementCard(ach, unlocked) {
    if (unlocked) {
        return `
            <div class="ach-card ach-card-unlocked">
                <div class="ach-card-icon" style="font-size:24px;">${ach.icon}</div>
                <div class="ach-card-info">
                    <div class="ach-card-name">${t('achievement.names.' + ach.nameKey)}</div>
                    <div class="ach-card-desc">${t('achievement.descs.' + ach.descKey)}</div>
                    <div class="ach-card-xp">+${ach.xp} XP</div>
                </div>
            </div>
        `;
    }

    const p = ach.progress;
    let progressHtml = '';
    if (p) {
        const pct = Math.min(100, Math.round(p.current / p.target * 100));
        progressHtml = `
            <div class="ach-card-progress">
                <div class="qt-progress-bar" style="margin-top:4px;">
                    <div class="qt-progress-fill" style="width:${pct}%"></div>
                </div>
                <div style="font-size:11px;color:#667;">${p.current}/${p.target}</div>
            </div>
        `;
    }

    return `
        <div class="ach-card ach-card-locked">
            <div class="ach-card-icon" style="font-size:24px;filter:grayscale(1);opacity:0.4;">${ach.icon}</div>
            <div class="ach-card-info">
                <div class="ach-card-name" style="color:#556;">${t('achievement.names.' + ach.nameKey)}</div>
                <div class="ach-card-desc" style="color:#445;">${t('achievement.descs.' + ach.descKey)}</div>
                ${progressHtml}
            </div>
        </div>
    `;
}
