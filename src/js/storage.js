const STORAGE_KEY = 'solar-system-data';

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
    // Migrate from old multi-user format
    if (data && !Array.isArray(data.explored)) {
        localStorage.removeItem(STORAGE_KEY);
        data = null;
    }
    if (!data) {
        data = { explored: [], answered: 0, correct: 0 };
        save(data);
    }
    return data;
}

export function markExplored(bodyId) {
    const data = ensure();
    if (!data.explored.includes(bodyId)) {
        data.explored.push(bodyId);
        save(data);
    }
}

export function recordAnswer(isCorrect) {
    const data = ensure();
    data.answered++;
    if (isCorrect) data.correct++;
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
    };
}

export function resetData() {
    localStorage.removeItem(STORAGE_KEY);
}
