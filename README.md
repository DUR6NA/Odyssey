# Odyssey

> A browser-based, AI-driven text adventure engine — build worlds, create characters, and shape your own story with any AI model you choose.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Node.js 14+](https://img.shields.io/badge/node-%3E%3D14-brightgreen.svg)](https://nodejs.org/)

## Why This Exists

Traditional text adventures are static — their stories are pre-written. Odyssey hands the narrative reins to a live AI model, letting every playthrough be genuinely unique. You define the world, the rules, and the character; the AI handles everything else — from combat consequences and inventory tracking to NPC interactions and dynamic world-building.

## Quick Start

```bash
# Clone & install
git clone https://github.com/DUR6NA/Odyssey.git
cd Odyssey
npm install

# Run
npm start
# → Open http://localhost:3001 in your browser
```

## Features

- **Dynamic AI Storytelling** — Powered by any OpenAI-compatible API (OpenRouter, Google AI, xAI Grok, LM Studio, and more). The AI acts as a living Game Master.
- **Multi-Phase Game Setup Wizard** — Step-by-step world creation (Real Universe or Custom Fantasy), character creation with attribute sliders, and AI-generated starting scenarios.
- **Built-in Universe Presets** — Jump into Harry Potter, Star Wars, Lord of the Rings, Narnia, or Game of Thrones with pre-configured world lore, factions, and calendar systems.
- **Character Preset System** — Save and load reusable character templates with full attribute profiles.
- **Game Codex** — A persistent NPC & Location ledger that auto-tracks everyone you meet and everywhere you visit.
- **Structured JSON Output** — The AI returns structured game state (time, inventory changes, NPC changes, location changes, stats) via JSON Schema enforcement for consistent gameplay.
- **Player Stats & Inventory** — Health, money, hunger, thirst, and energy are tracked and displayed in real-time. Items are dynamically managed by the AI.
- **AI Image Generation** — Generate character portraits and scene art using image models (Flux, Grok Image, Nano Banana / Gemini Flash Image).
- **RAG Integration** — Wikipedia API and Fandom wiki lookups inject real-world or IP-specific lore into the AI's context for accuracy.
- **Theming Engine** — Five visual themes (Dark, Light, Bliss, Starry Night, Matrix) with animated canvas backgrounds, custom scrollbars, and typography controls.
- **Custom System Prompts** — Full control over six different AI prompts (World Builder, Player Creator, Image Generator, Summarizer, Prompter, Game Master).
- **Reasoning Model Support** — Toggle extended-thinking mode for compatible models (Grok 4.1, Claude 3.7 Sonnet) with configurable reasoning effort levels.
- **Cross-Platform** — Install scripts for Windows (`install.cmd`), Linux (`install.sh`), and macOS (`install_macos.sh`).

## Prerequisites

- [Node.js](https://nodejs.org/) v14 or higher (includes npm)

## Installation

### Windows

1. Clone or download the repository.
2. Double-click `install.cmd` to install dependencies.
   *(Or run `npm install` from the terminal.)*
3. Double-click `start.cmd` or run `npm start` to launch.

### Linux

```bash
git clone https://github.com/DUR6NA/Odyssey.git
cd Odyssey
chmod +x install.sh run.sh
./install.sh
./run.sh
```

### macOS

```bash
git clone https://github.com/DUR6NA/Odyssey.git
cd Odyssey
chmod +x install_macos.sh run_macos.sh run_macos.command
./install_macos.sh
# Then either:
./run_macos.sh
# Or double-click run_macos.command in Finder
```

## Usage

Once the server is running, open your browser to:

```
http://localhost:3001
```

The server also prints LAN addresses so you can play on other devices on the same network.

### First-Time Setup

1. **Main Menu → Settings → API Settings**
2. Select your **AI Provider** (Google AI is free, OpenRouter is the most versatile)
3. Paste your **API Key** and click **Save Settings**
4. Click **Fetch Models** and select a text model
5. *(Optional)* Enable Image Features and select an image model
6. Return to the Main Menu and click **New Game**

### Supported AI Providers

| Provider | Best For | Cost |
|----------|----------|------|
| **Google AI Studio** | Free, high-quality Gemini models | Free tier |
| **OpenRouter** | Hundreds of models, single wallet | Pay-per-token |
| **xAI (Grok)** | Fast reasoning, less censored | Pay-per-token |
| **LM Studio** | 100% local/offline, total privacy | Free (your hardware) |
| **OpenAI Compatible** | Custom inference servers (vLLM, KoboldCPP, etc.) | Varies |

## Project Structure

```
Odyssey/
├── server.js            # Node.js HTTP server (API routes + static files)
├── setup.js             # Multi-phase game setup wizard (world + player + scenario)
├── game.html            # Main game interface (chat UI, stats, inventory, codex)
├── mainmenu.html        # Animated main menu with save/load
├── Welcome.html         # Cinematic intro sequence
├── settings.html        # Full settings panel (API, appearance, prompts)
├── presets.html          # Character preset manager
├── infowiki.html        # In-app documentation / wiki
├── style.css            # Global stylesheet (glassmorphism, responsive)
├── theme.js             # Theme engine (5 themes, canvas backgrounds, fonts)
├── ui-components.js     # Custom UI components (dropdowns, number spinners)
├── models.json          # Cached model data
├── assets/              # Static assets (favicon, backgrounds, audio)
├── jsons/               # JSON templates (gamestate, player, world, etc.)
├── presets/              # Saved character preset files
└── games/               # Saved game directories (auto-created)
    └── {id}/
        ├── worldinfo.json
        ├── player.json
        ├── gamestate.json
        ├── scenario.json
        ├── chat_history.json
        ├── npc-ledger.json
        ├── locationsledger.json
        └── mainoutput.json
```

## API Reference

The server exposes these endpoints on `http://localhost:3001`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/list-games` | List all saved game folders |
| `GET` | `/api/load-game?id={id}` | Load a saved game by ID |
| `POST` | `/api/save-new-game` | Create a new game save |
| `POST` | `/api/update-game` | Update an existing game's state |
| `GET` | `/api/list-presets` | List all character presets |
| `POST` | `/api/save-preset` | Save a character preset |
| `POST` | `/api/delete-preset` | Delete a character preset |
| `POST` | `/api/download-image` | Download/save a player image |
| `POST` | `/api/update-image` | Update a player's image URL |
| `GET` | `/api/get-base-image?id={id}` | Get a player's base image as data URI |
| `POST` | `/api/shutdown` | Gracefully shut down the server |
| `*` | `/api/xai-proxy/*` | CORS proxy for xAI API calls |

> For detailed developer documentation, run the server and visit [http://localhost:3001/devdocs.html](http://localhost:3001/devdocs.html).

## Configuration

All settings are stored in the browser's `localStorage` under keys prefixed with `jsonAdventure_`. Key settings include:

| Setting | localStorage Key | Default |
|---------|-----------------|---------|
| API Provider | `jsonAdventure_apiProvider` | `openrouter` |
| API Key | `jsonAdventure_openRouterApiKey` | — |
| Selected Model | `jsonAdventure_openRouterModel` | — |
| Temperature | `jsonAdventure_apiTemperature` | `0.7` |
| Max Tokens | `jsonAdventure_apiMaxTokens` | `2048` |
| Top P | `jsonAdventure_apiTopP` | `1.0` |
| Active Theme | `jsonAdventure_activeThemeId` | `dark` |
| Primary Font | `jsonAdventure_primaryFont` | `Cinzel` |
| Secondary Font | `jsonAdventure_secondaryFont` | `Merriweather` |

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/DUR6NA/Odyssey).

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to the branch and open a Pull Request

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).
