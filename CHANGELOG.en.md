# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - 2026-06-19

### Added
- First-time guide — tutorial overlay, auto-hides after first visit (6 steps, bilingual)
- Click highlight — Sprite glow pulse, 1s fade animation
- 6 new satellite quiz questions (q069~q074)

### Changed
- Default scale: 700x → 1200x
- Default speed: 1 day/sec (unchanged)

### Fixed
- CSS2DRenderer labels no longer overlap quiz/help/stats panels (zIndex fix)
- 3 quiz corrections (q047 magnetic field, q056 magnetosphere, q043 rotation)
- Full code formatting (CSS/JS whitespace normalization)

## [1.2.0] - 2026-06-09

### Added
- Multi-moon system — 17 satellites orbiting 6 planets (real orbital elements)
  - Mars: Phobos, Deimos
  - Jupiter: Io, Europa, Ganymede, Callisto
  - Saturn: Titan, Rhea, Tethys, Enceladus
  - Uranus: Titania, Oberon, Umbriel, Ariel, Miranda
  - Neptune: Triton, Nereid
- Moon labels track position each frame via worldToLocal
- Moon orbits inherit parent's axial tilt (Saturn's rings and moons co-planar)

### Changed
- Default scale: 1200x → 700x
- Default speed: 20 days/sec → 1 day/sec
- MAX_SCALE: 3000 → 1999

### Fixed
- 5 quiz corrections (data updates + factual fixes + dedup)

## [1.1.0] - 2026-06-03

### Added
- Help panel — version, author, project links, keybindings; links switch between GitHub/Gitee by language
- Showcase mode — one-click fullscreen, hides all UI elements for immersive viewing (🎬 button)
- Real-time date display — HUD in top-left, J2000 epoch, updates with simulation (shows HH:MM at slow speed)
- Settings persistence — scale/speed/eccentricity sliders and 6 toggle states auto-saved to localStorage
- Asteroid belt randomization — C/S/M type color mix + per-point size + ShaderMaterial soft particles

### Changed
- Top-right buttons redesigned as icon-only (34×34 squares), hover tooltips adapt to language
- Button order: ❓ Quiz → 📋 Quest → 🏆 Ach → 📊 Stats → 🎬 Showcase → ℹ️ Help
- Double-click reset now only resets sliders and camera, preserves toggle preferences
- `data-i18n-title` attribute for unified hover tooltip translation management

## [1.0.0] - 2026-05-28

### Added
- 3D solar system scene — 8 planets + Sun, based on JPL HORIZONS orbital data
- Planet textures (NASA texture maps, Saturn ring, Moon)
- Atmospheric glow effects (Earth, Venus, Mars)
- Sun pulsing glow + self-rotation + 7.25° axial tilt
- Planetary axial tilt rendering (via tiltGroup)
- Lighting optimization + shadows
- Star background (8000 stars) + Milky Way band (2000 stars)
- Precise Kepler orbits (Newton's method for eccentric anomaly)
- Comet system (Halley's Comet, Hale-Bopp) + solid truncated-cone tail
- Moon high-precision orbit + texture
- Asteroid belt (5000 asteroids)
- Ecliptic plane reference disc
- Control panel — scale, time speed, eccentricity sliders
- Toggles — labels/orbits/distance/size/ecliptic/music
- Size comparison panel + distance data panel
- Camera focus (right-click fly-to + double-click reset)
- Label occlusion detection (labels hidden behind planets)
- Celestial body info cards — rich text + highlight tags + cross-body comparison
- Quiz system — 68 questions, filterable by body
- Quest system — 13 main + side quests (quest chain, drag-sort, event flow)
- Achievement system — 10 achievements (2 hidden)
- Sound effects — click/panel/quest/achievement/quiz/focus SFX
- Ambient space background music (Web Audio API synthesis)
- Data persistence (localStorage for exploration records and quiz progress)
- Bilingual support — Chinese / English toggle (full i18n framework + translations)
- Texture loading progress bar

### Infrastructure
- Build tool: Webpack 5
- GitHub Actions auto-deploy to GitHub Pages
- GitHub → Gitee auto-sync workflow
- MIT License
- Bilingual README (Chinese primary + English supplement)
- Page meta tags (OG / Twitter Card)
- Favicon SVG
- Version badge on page

[1.1.0]: https://github.com/q-jade/solar-system/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/q-jade/solar-system/releases/tag/v1.0.0
