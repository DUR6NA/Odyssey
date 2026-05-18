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
- Rust stable toolchain installed
- Node.js 18+ installed
- Platform webview dependencies for Tauri 2.x (see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/))

### Setup
1. **Fork** the repository and **clone** it locally.
2. Navigate into your cloned directory: `cd Odyssey`
3. Install dependencies: `npm install`
4. Start the Tauri development app: `npm run dev`
5. Test in the native Odyssey window that Tauri opens.

> **Note:** Do not test using standard mobile resolutions; Odyssey officially routes mobile viewports to an interceptor page to focus on desktop experiences.

## 🏗️ Project Architecture
Odyssey is a desktop-first Tauri app with a vanilla HTML/CSS/JS frontend.
- **Tauri shell (`src-tauri/`)**: Provides the native desktop window, app configuration, and Tauri plugins for filesystem, dialog, shell, logging, and menu music commands.
- **Frontend (`public/`)**: Static vanilla HTML/CSS/JS served by Tauri.
  - `creation.js` (New game setup, character creation, and launch)
  - `chat.js` (AI prompting, in-game chat, image runtime, and TTS)
  - `saves.js` (Autosaves and chat history compaction)
  - `tauri-bridge.js` (Native filesystem operations for presets, saves, imports, and exports)
  - `style.css` (The global design system + utility classes)
  - `theme.js` (CSS variables and theme configuration)
  - `ui-components.js` (Custom inputs and interactive elements)

Check out `devdocs.html` in the repository, or open it from the running Tauri app, for comprehensive developer documentation.

## 💻 Development Guidelines

### Code Conventions
- **Client-Side Secrets**: API keys must *only* be stored locally in the client's `localStorage`. Never route API requests or keys through a custom backend or Tauri command.
- **Vanilla JS**: We use Vanilla JS without a build step or heavy framework. Keep it simple and dependency-free on the frontend.
- **Styling System**: Never use inline styles for colors or spacing. Always use the CSS variables declared in `theme.js` and `style.css` (e.g., `var(--accent-color)`).
- **Tauri First**: Use `public/tauri-bridge.js` and Tauri plugins for native filesystem, dialog, and shell work. Keep Rust-side commands narrow and document any new capability or permission.
- **Security First**: When changing filesystem or native integration code, sanitize paths, keep access scoped to app data or user-selected files, and avoid exposing broad filesystem permissions.

### Documentation is a Feature
If you add a new Tauri command, bridge method, theme, or feature, you **must** document it in both `README.md` and `devdocs.html`. Code without documentation is incomplete.

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
1. Open `creation.js` and add your preset to the `WORLD_PRESETS` object.
2. Include the `wikiUrl` if the preset supports Fandom RAG integration.
3. Document the preset in `devdocs.html`.

Thank you for helping Odyssey grow! 🚀
