import planets from '../data/bodies.json';
import questions from '../data/questions.json';

// ── Planet lookup ──────────────────────────────────────────────────────

export function getAllPlanets() {
    return planets;
}

export function getPlanet(id) {
    return planets.find(p => p.id === id) || null;
}

export function getPlanetCount() {
    return planets.length;
}

// ── Question bank ─────────────────────────────────────────────────────

export function getQuestions(opts = {}) {
    // opts: { level?, relatedBody?, shuffle }
    let pool = questions;

    if (opts.level) {
        pool = pool.filter(q => q.level === opts.level);
    }
    if (opts.relatedBody) {
        pool = pool.filter(q => q.relatedBody === opts.relatedBody);
    }

    if (opts.shuffle) {
        pool = [...pool];
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
    }

    return pool;
}

export function getRandomQuestion(opts = {}) {
    const pool = getQuestions({ ...opts, shuffle: true });
    return pool.length > 0 ? pool[0] : null;
}

export function getQuestionCount() {
    return questions.length;
}
