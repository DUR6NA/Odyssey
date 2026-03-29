# 🌟 Contributing to Odyssey

First off, thank you for considering contributing to Odyssey! It's people like you that make Odyssey such a great AI-driven adventure engine.

This document serves as the guide for contributing to this project. We value documentation, clean code, and intuitive UX.

## 📚 Table of Contents
1. [Open Source Principles](#-open-source-principles)
2. [Getting Started](#-getting-started)
3. [Project Architecture](#-project-architecture)
4. [Development Guidelines](#-development-guidelines)
5. [Pull Request Workflow](#-pull-request-workflow)
6. [Adding Features (Themes & Presets)](#-adding-features)

## 🤝 Open Source Principles
We believe in building software that is transparent, accessible, and community-driven. When contributing to Odyssey, please adhere to these core principles:
- **Build with Purpose:** Your contributions should aim to improve the experience for players and developers. Focus on meaningful fixes or structural enhancements rather than trivial nitpicks.
- **Value Quality:** Write clean, documented code that respects the existing vanilla JS architecture. Test your work thoroughly across multiple themes.
- **Collaborate Openly:** If you intend to change core mechanics or standard UI tokens, please open an issue to discuss it first. When reporting bugs, always provide clear context and actionable reproduction steps.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed

### Setup
1. **Fork** the repository and **clone** it locally.
2. Navigate into your cloned directory: `cd Odyssey`
3. Install dependencies: `npm install`
4. Start the local server: `npm start`
5. Open your browser to `http://localhost:3001`

> **Note:** Do not test using standard mobile resolutions; Odyssey officially routes mobile viewports to an interceptor page to focus on desktop experiences.

## 🏗️ Project Architecture
Odyssey is structured as a client-heavy web application with a lightweight Express/Node.js backend.
- **Backend (`server.js`)**: Handles local file I/O (saving/loading/exporting game json) and serves the static files. No API keys or game state logic are stored on the server.
- **Frontend**: Vanilla HTML/CSS/JS.
  - `setup.js` (The core game logic and AI orchestrator)
  - `style.css` (The global design system + utility classes)
  - `theme.js` (CSS variables and theme configuration)
  - `ui-components.js` (Custom inputs and interactive elements)

Check out `http://localhost:3001/devdocs.html` (after running the server) for comprehensive developer documentation.

## 💻 Development Guidelines

### Code Conventions
- **Client-Side Secrets**: API keys must *only* be stored in the client's `localStorage`. Never route API requests or keys through `server.js`.
- **Vanilla JS**: We use Vanilla JS without a build step or heavy framework. Keep it simple and dependency-free on the frontend.
- **Styling System**: Never use inline styles for colors or spacing. Always use the CSS variables declared in `theme.js` and `style.css` (e.g., `var(--accent-color)`).
- **Security First**: If making server modifications, ensure paths are sanitized and protected against Local File Inclusion (LFI) and Server-Side Request Forgery (SSRF).

### Documentation is a Feature
If you add a new API endpoint, theme, or feature, you **must** document it in both `README.md` and `devdocs.html`. Code without documentation is incomplete.

## 🔄 Pull Request Workflow
1. **Branch appropriately:** Create a descriptive branch (e.g., `fix/button-alignment`, `feat/new-fandom-wiki`).
2. **Commit clearly:** Write meaningful commit messages explaining *what* was changed and *why*.
3. **Test thoroughly:** Ensure no existing functionalities break. Please test your feature against all 5 visual themes.
4. **Submit PR:** Submit your Pull Request targeting the `main` branch using our established Pull Request template.

## 🎨 Adding Features

### Adding a New Theme
1. Open `theme.js` and add your new color palette to the `presetThemes` object.
2. In `style.css`, add any specific CSS overrides targeting `html[data-theme="your-theme"]`.
3. Document your theme in `devdocs.html`.

### Adding a World Preset
1. Open `setup.js` and add your preset to the `WORLD_PRESETS` object.
2. Include the `wikiUrl` if the preset supports Fandom RAG integration.
3. Document the preset in `devdocs.html`.

Thank you for helping Odyssey grow! 🚀
