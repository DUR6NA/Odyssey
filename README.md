# Odyssey 

A browser-based, AI-driven text adventure game powered by a AI of your choice. Explore unique worlds, interact with AI companions, manage your inventory, and shape your own story in an immersive environment.

## Features

- **Dynamic AI Storytelling:** Powered by the OpenRouter SDK to bring intelligent, responsive game mastering to your adventure.
- **Character & Attribute System:** Define your athleticism, intelligence, and other attributes to mold your unique role-playing experience.
- **Inventory Management:** Collect, inspect, and utilize items dynamically generated and managed by the game.
- **Custom UI & Theming:** A beautifully crafted, responsive UI with custom scrollbars, themed text areas, and dynamic attribute sliders.
- **Player Driven:** Image generation, customized settings, and adaptive prompting ensure no two adventures are the same.

## Prerequisites

Before running the project, you must have the following installed on your system:

- [Node.js](https://nodejs.org/) (Version 14 or higher recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)

## Installation

### For Windows Users

1. Clone the repository or download the source code.
2. Double-click the `install.cmd` script to automatically install all required dependencies.
   *(Alternatively, run `npm install` from the command line inside the project directory).*
3. Double-click `start.cmd` or run `npm start` to launch the server.

### For Linux Users

1. Clone the repository or download the source code.
2. Open a terminal and navigate to the project directory.
3. Make the installation script executable:
   ```bash
   chmod +x install.sh run.sh
   ```
4. Run the installation script:
   ```bash
   ./install.sh
   ```
5. Launch the game server:
   ```bash
   ./run.sh
   ```

### For macOS Users

1. Clone the repository or download the source code.
2. Open a terminal and navigate to the project directory.
3. Make the installation script executable:
   ```bash
   chmod +x install_macos.sh run_macos.sh run_macos.command
   ```
4. Run the installation script:
   ```bash
   ./install_macos.sh
   ```
5. Launch the game server:
   - Double-click `run_macos.command` in Finder (recommended)
   - OR run `./run_macos.sh` in the terminal.

## Usage

Once the server is running, open your web browser and navigate to:

```text
http://localhost:3001
```
*(Check your console output if a different port is specified).*

Configure your OpenRouter API settings within the game's settings menu `settings.html` (or via the UI) to connect to your preferred AI models.

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE). See the `LICENSE` file for more details.
