const STORAGE_KEY = 'solar-system-data';

// ── Default data schema (Phase 2) ─────────────────────────────────────
const DEFAULT_DATA = {
    explored: [],
    answered: 0,
    correct: 0,
    xp: 0,
    quests: {},
    achievements: {},
    quizSession: {
        streak: 0,
        bestStreak: 0,
        todayAnswered: 0,
    },
    stats: {
        totalVisits: 0,
        lastVisit: 0,
        playTimeMs: 0,
    },
    guide: {
        firstGuideDone: false,
    },
};

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function ensure() {
    let data = load();
    // Migrate from old multi-user format (very old data)
    if (data && !Array.isArray(data.explored)) {
        localStorage.removeItem(STORAGE_KEY);
        data = null;
    }
    if (!data) {
        data = { ...DEFAULT_DATA, stats: { ...DEFAULT_DATA.stats } };
        save(data);
        return data;
    }

    // ── Phase 2 migration: add missing fields ─────────────────────────
    let changed = false;
    if (data.xp === undefined) { data.xp = 0; changed = true; }
    if (!data.quests) { data.quests = {}; changed = true; }
    if (!data.achievements) { data.achievements = {}; changed = true; }
    if (!data.quizSession) {
        data.quizSession = { streak: 0, bestStreak: 0, todayAnswered: 0 };
        changed = true;
    }
    if (!data.stats) {
        data.stats = { totalVisits: 0, lastVisit: 0, playTimeMs: 0 };
        changed = true;
    }
    if (!data.guide) {
        data.guide = { firstGuideDone: false };
        changed = true;
    }
    if (data.quizSession.bestStreak === undefined) {
        data.quizSession.bestStreak = 0;
        changed = true;
    }
    if (changed) save(data);
    return data;
}

// ── Legacy exports (unchanged behavior) ───────────────────────────────
export function markExplored(bodyId) {
    const data = ensure();
    if (!data.explored.includes(bodyId)) {
        data.explored.push(bodyId);
        save(data);
        return true; // new exploration
    }
    return false; // already explored
}

export function recordAnswer(isCorrect) {
    const data = ensure();
    data.answered++;
    if (isCorrect) data.correct++;
    // Update quiz session streak
    if (isCorrect) {
        data.quizSession.streak++;
        if (data.quizSession.streak > data.quizSession.bestStreak) {
            data.quizSession.bestStreak = data.quizSession.streak;
        }
    } else {
        data.quizSession.streak = 0;
    }
    data.quizSession.todayAnswered++;
    save(data);
}

export function getStats() {
    const data = ensure();
    return {
        explored: data.explored.length,
        answered: data.answered,
        correct: data.correct,
        rate: data.answered > 0
            ? Math.round(data.correct / data.answered * 100)
            : 0,
        xp: data.xp,
        streak: data.quizSession.streak,
        bestStreak: data.quizSession.bestStreak,
    };
}

export function resetData() {
    localStorage.removeItem(STORAGE_KEY);
}

// ── Phase 2 new exports ───────────────────────────────────────────────

/** Get raw data store (for quest/achievement engines) */
export function getRaw() {
    return ensure();
}

/** Save external changes back (call after modifying raw data) */
export function saveRaw(data) {
    save(data);
}

/** Add XP and recalculate level */
export function addXp(amount) {
    const data = ensure();
    data.xp += amount;
    save(data);
    return { xp: data.xp, level: calcLevel(data.xp) };
}

/** Calculate level from xp (100 × level² cumulative) */
export function calcLevel(xp) {
    let lv = 1;
    while (true) {
        const next = 100 * lv * lv;
        if (xp < next) break;
        lv++;
    }
    return lv;
}

/** XP needed to reach the next level */
export function isFirstGuideDone() {
    const data = ensure();
    return data.guide ? data.guide.firstGuideDone : false;
}

export function markGuideDone() {
    const data = ensure();
    if (data.guide) data.guide.firstGuideDone = true;
    save(data);
}

export function xpToNextLevel(xp) {
    const lv = calcLevel(xp);
    const currentThreshold = 100 * (lv - 1) * (lv - 1);
    const nextThreshold = 100 * lv * lv;
    return {
        current: xp - currentThreshold,
        needed: nextThreshold - currentThreshold,
        level: lv,
    };
}
