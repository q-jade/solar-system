/**
 * textureLoader.js — Phase 3 NASA texture loading
 *
 * Uses Solar System Scope CDN textures with local fallback.
 * CORS is handled by the CDN; if blocked, a proxy can be added
 * to webpack dev server config.
 */

import * as THREE from 'three';

// ── Texture URL definitions ────────────────────────────────────────────
// Use dev server proxy to avoid CORS + wrong Content-Type issues
const CDN_BASE = '/texture-proxy';

const TEXTURE_LIST = {
    // Sun
    sun: { url: `${CDN_BASE}/2k_sun.jpg`, type: 'jpeg' },

    // Planets (2k resolution for good quality / reasonable size)
    mercury: { url: `${CDN_BASE}/2k_mercury.jpg`, type: 'jpeg' },
    venus:   { url: `${CDN_BASE}/2k_venus_surface.jpg`, type: 'jpeg' },
    earth:   { url: `${CDN_BASE}/2k_earth_daymap.jpg`, type: 'jpeg' },
    earthClouds: { url: `${CDN_BASE}/2k_earth_clouds.jpg`, type: 'jpeg' },
    earthNight:  { url: `${CDN_BASE}/2k_earth_nightmap.jpg`, type: 'jpeg' },
    mars:    { url: `${CDN_BASE}/2k_mars.jpg`, type: 'jpeg' },
    jupiter: { url: `${CDN_BASE}/2k_jupiter.jpg`, type: 'jpeg' },
    saturn:  { url: `${CDN_BASE}/2k_saturn.jpg`, type: 'jpeg' },
    saturnRing: { url: `${CDN_BASE}/2k_saturn_ring_alpha.png`, type: 'png' },
    uranus:  { url: `${CDN_BASE}/2k_uranus.jpg`, type: 'jpeg' },
    neptune: { url: `${CDN_BASE}/2k_neptune.jpg`, type: 'jpeg' },

};
// Note: milky way texture not available on this CDN; skipped.

// ── Loading state ──────────────────────────────────────────────────────
let loadedTextures = null;
let onProgressFn = null;

export function setOnProgress(fn) {
    onProgressFn = fn;
}

/**
 * Load all textures asynchronously.
 * Returns a Promise that resolves to { key: THREE.Texture }.
 * On error, missing textures resolve to null (caller handles fallback).
 */
export function loadTextures() {
    if (loadedTextures) return Promise.resolve(loadedTextures);

    return new Promise((resolve) => {
        const manager = new THREE.LoadingManager();
        const loader = new THREE.TextureLoader(manager);
        const result = {};
        const entries = Object.entries(TEXTURE_LIST);
        let loaded = 0;
        let total = entries.length;

        const report = () => {
            if (onProgressFn) onProgressFn(loaded / total);
        };

        for (const [key, { url, type }] of entries) {
            loader.load(
                url,
                (tex) => {
                    // Configure texture
                    tex.anisotropy = 4;
                    if (type === 'png') tex.premultiplyAlpha = true;
                    // Uranus texture is extremely subtle; boost contrast
                    if (key === 'uranus') tex = enhanceContrast(tex, 1.8);
                    result[key] = tex;
                    loaded++;
                    report();
                },
                undefined,
                () => {
                    // Error: set null, use fallback color
                    console.warn('Texture load failed:', key, url);
                    result[key] = null;
                    loaded++;
                    report();
                }
            );
        }

        /** Enhance texture contrast by stretching brightness range */
        function enhanceContrast(tex, factor) {
            const img = tex.image;
            if (!img || !(img instanceof HTMLImageElement)) return tex;
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = imageData.data;
            const len = d.length;
            // Find min/max brightness across all pixels
            let minV = 255, maxV = 0;
            for (let i = 0; i < len; i += 4) {
                const b = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                if (b < minV) minV = b;
                if (b > maxV) maxV = b;
            }
            const range = maxV - minV;
            if (range < 1) return tex;
            // Stretch brightness range
            const mid = (minV + maxV) / 2;
            const halfRange = range / 2;
            const targetHalf = Math.min(halfRange * factor, 127);
            const scale = targetHalf / halfRange;
            for (let i = 0; i < len; i += 4) {
                const b = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                const delta = (b - mid) * scale;
                const newB = mid + delta;
                const adj = newB / (b || 1);
                d[i]     = Math.max(0, Math.min(255, Math.round(d[i] * adj)));
                d[i + 1] = Math.max(0, Math.min(255, Math.round(d[i + 1] * adj)));
                d[i + 2] = Math.max(0, Math.min(255, Math.round(d[i + 2] * adj)));
            }
            ctx.putImageData(imageData, 0, 0);
            const newTex = new THREE.CanvasTexture(canvas);
            newTex.anisotropy = tex.anisotropy;
            newTex.wrapS = tex.wrapS;
            newTex.wrapT = tex.wrapT;
            newTex.repeat.copy(tex.repeat);
            newTex.offset.copy(tex.offset);
            return newTex;
        }

        manager.onLoad = () => resolve(result);
    });
}

/** Get loaded textures (must call loadTextures first) */
export function getTextures() {
    return loadedTextures;
}
