<div align="center">

# 🪐 3D Solar System Interactive Encyclopedia

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Three.js](https://img.shields.io/badge/Three.js-0.132-green)](https://threejs.org/)

*An explorable 3D solar system — wander through space and learn astronomy in your browser*

[🇨🇳 中文版](README.md) · [⭐ Upgrade to Pro](#)

</div>

---

## 📖 About

An interactive 3D solar system web application built with **Three.js**. Freely explore the solar system in 3D, observe planetary orbits, browse astronomical encyclopedias, complete exploration quests, and challenge yourself with astronomy quizzes.

## ✨ Features

| Screenshot | Description |
|---|---|
| ![](docs/images/main-view-en.png) | Default view — 8 planets orbiting the Sun |
| ![](docs/images/main-view.png) | Switch to Chinese interface with one click |

- **8 Planets + Sun** — Precise orbital simulation based on JPL HORIZONS data, with real eccentricity, inclination, and axial tilt
- **NASA Textures** — Real surface textures for planets, Saturn's rings, and the Moon
- **Atmospheric Effects** — Semi-transparent atmospheric glow for Earth, pulsing glow for the Sun
- **Bilingual** — Chinese / English, switch at any time
- **Info Cards** — Click any body to see radius, mass, atmosphere, etc., with cross-body comparisons
- **Quizzes** — 68 astronomy multiple-choice questions, filterable by body
- **Quests** — 13 main + side quests to guide your exploration
- **Achievements** — 10 achievements, including 2 hidden ones
- **Comets** — Halley's Comet and Hale-Bopp with dynamic tails
- **Sound & Music** — Ambient space music + interactive sound effects
- **Asteroid Belt** — 5000 asteroids with inclination distribution

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Rendering | Three.js 0.132.2 |
| CSS Labels | CSS2DRenderer |
| Build | Webpack 5 |
| i18n | Custom i18n module |
| Audio | Web Audio API |

## 🚀 Quick Start

```bash
git clone https://github.com/q-jade/solar-system.git
cd solar-system
npm install
npm start          # Dev mode with hot reload
# or
npm run build      # Production build
npm run serve      # Preview the build locally
```

The dev server runs at `http://localhost:8081`.

## 📂 Project Structure

```
solar-system/
├── src/
│   ├── js/          # JavaScript source
│   ├── data/        # Body & question data (JSON)
│   ├── locales/     # Language packs
│   ├── textures/    # Texture images
│   └── css/         # Styles
├── docs/images/     # Screenshots
├── dist/            # Build output (generated)
└── webpack.config.js
```

## 📷 More Screenshots

| | |
|---|---|
| ![](docs/images/quiz-panel.png) Quiz (68 questions) | ![](docs/images/quest-panel.png) Quest system (13 quests) |
| ![](docs/images/achievement-panel.png) Achievements (10) | ![](docs/images/stats-panel.png) Profile panel |

## 📄 License

This project is **MIT licensed** — see [LICENSE](LICENSE) for details.

