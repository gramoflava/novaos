# Nova OS

Nova OS is an experimental, browser-based operating system designed with a fundamentally novel layout paradigm: **The Infinite Space Desktop**.

Abandoning traditional rigid window boundaries and the standard "dock and top-bar" aesthetic, Nova OS leverages a deep-space glassmorphic UI integrated with an infinitely panning 2D canvas, giving users completely free rein over where they organize their workspace.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

## ✨ Key Features

### 🌌 Infinite Space Canvas
- **Limitless Desktop:** No more window clustering. Click and drag globally on the desktop to pan your workspace around infinitely.
- **Mac-Native Controls:** Panning and pinch-to-zoom is supported natively through smooth trackpad gestures.
- **Cosmic Layout & Interactive Physics:** The environment feels alive with gravity and mass. Apps deploy via organic chaotic scattering, and manipulate their surroundings dynamically. Maximizing a window aggressively pushes its neighbors out of bounds, while closing/minimizing creates a "black hole" effect that slides surrounding apps together to swiftly reclaim space.

### 🎨 Premium "Nova" Aesthetic
- **Fluid & Responsive Elements:** A mesmerizing animated mesh background dynamically shifts under heavily frosted glass overlays.
- **Light / Auto / Dark:** Uses the shared gramof theme switch; Auto follows the system while manual choices stay selected.
- **Purposeful Iconography:** Geometric marks identify apps; interface actions use the shared Tabler set.

### 💻 Included Workspace Applications
- **Files:** A `localStorage` backed virtual file system with folder navigation.
- **Calculator:** A refined, fully functional inline glass calculator.
- **Notes & Code:** Elegant markdown and code editors featuring `JetBrains Mono`.
- **2048:** A built-in iteration of the classic tile game, heavily stylized for the Nova theme.

## 🚀 Quick Start

Nova OS requires zero build steps or heavy node.js dependencies. It runs strictly on pure HTML, CSS, and Vanilla JavaScript.

1. Clone the repository.
2. Spin up a local static server inside the root directory:
   ```bash
   # Make sure you are in the project folder
   python3 -m http.server 8080
   ```
3. Visit `http://localhost:8080` in Chrome, Safari, or Firefox to enter Nova OS.

## 🏗️ Architecture

Nova is built around an internal singleton pattern for absolute zero-dependency simplicity:
- **Event Bus (`js/core/bus.js`)**: Decoupled pub/sub messaging.
- **Virtual FS (`js/core/fs.js`)**: Robust JSON manipulation bound via LocalStorage.
- **Space Window Manager (`js/core/window-manager.js`)**: The heart of the infinite geometric pan & scale interactions without clashing with structural CSS animations.

All application logic gracefully exists within atomic `js/apps/*` modules.

On phones Nova switches to one active window at a time and presents the shelf
as a bottom app bar. The infinite-space camera and window physics remain the
desktop interaction model.

## 📜 License

MIT License - feel free to fork, explore, and expand your own universe.
