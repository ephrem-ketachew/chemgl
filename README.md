# ChemGL - Interactive Atomic Builder

An interactive web application for building and visualizing atoms. Drag-and-drop protons, neutrons, and electrons to construct elements from the periodic table and explore their properties.

## Features

- **3D Atomic Visualization**: Interactive canvas-based 3D rendering of atomic structures with customizable camera control
- **Drag-and-Drop Interface**: Add particles to build atoms by dragging from the particle bins or directly onto the canvas
- **Periodic Table Integration**: Click any element to instantly load the correct atomic structure
- **Educational Element Facts**: Each element includes unique scientific and historical facts
- **Theme Support**: Dark and light theme modes with automatic system preference detection
- **Electron Shell Animation**: Realistic orbital animation with customizable electron speeds
- **Real-Time Statistics**: Live updates showing protons, neutrons, electrons, atomic mass, and charge state
- **Element Categories**: Visual classification of elements (alkali metals, halogens, noble gases, lanthanides, etc.)

## Project Structure

```
chem_gl/
├── index.html              Main HTML entry point
├── css/
│   └── styles.css         Complete stylesheet (1,783 lines)
├── js/
│   ├── theme.js           Theme initialization (runs before DOM ready)
│   ├── data.js            Constants, element data, and facts for all 118 elements
│   └── app.js             Main application logic (particle classes, physics, rendering)
└── chemgl.html            Original monolithic file (kept as backup)
```

## File Descriptions

### `index.html`

Clean HTML markup referencing all external assets:

- Meta tags for character encoding and viewport
- Google Fonts imports (Nunito, Orbitron, Space Mono)
- Canvas element and UI components
- External stylesheet and script references

### `css/styles.css`

Complete stylesheet featuring:

- CSS variables for theming (colors, spacing, shadows)
- Light and dark theme implementations
- Canvas, panel, and control styling
- Periodic table grid layout
- Animation and transition effects
- Responsive design elements

### `js/theme.js`

Lightweight theme initialization (16 lines):

- Reads saved theme preference from localStorage
- Falls back to system dark mode preference
- Sets `data-theme` attribute before DOM renders to prevent flash of wrong theme

### `js/data.js`

Constants and reference data:

- **Physics Constants**: `PARTICLE_RADIUS`, `SHELL_CAPACITY`, `SHELL_RADII`, `MAX_PROTONS`
- **Element Data**: Array of 118 elements with names and symbols indexed by atomic number
- **Element Facts**: 118 objects containing educational facts about each element

### `js/app.js`

Main application logic (~2,037 lines):

- **Particle Classes**: `Proton`, `Neutron`, `Electron` with position, velocity, and rendering properties
- **Physics Engine**:
  - `arrangeNucleus()`: Golden spiral algorithm for nucleon arrangement
  - `assignElectronShells()`: Bohr model electron shell assignment with orbital mechanics
- **3D Rendering**:
  - 3D projection system with camera rotation
  - Particle drawing with gradients and highlights
  - Orbital ring visualization
  - Grid background and empty state hints
- **Interactions**:
  - Canvas drag-and-drop for particle manipulation
  - Particle bin click/drag for quick spawning
  - Periodic table element loading
  - Theme toggling with persistence
- **UI Updates**:
  - Element information panel
  - Charge state calculation (neutral, cation, anion)
  - Electron shell configuration display
  - Element category classification
  - "Did you know?" facts

## Usage

1. **Open** `index.html` in a modern web browser
2. **Build atoms** by:
   - Clicking proton/neutron bins to add to nucleus
   - Dragging particles to position them freely
   - Clicking periodic table elements to load pre-configured atoms
3. **Manipulate**:
   - Drag particles off the nucleus to remove them
   - Use the "Clear" button to reset
   - Adjust electron animation speed with the slider
4. **Explore**:
   - View element facts in the "Did you know?" panel
   - Switch between light/dark themes
   - Rotate the 3D view by dragging the empty canvas

## How It Works

### Atomic Structure

- **Nucleus**: Protons and neutrons arranged using a golden spiral algorithm to pack efficiently
- **Electron Shells**: Electrons populate shells according to the Bohr model (K: 2, L: 8, M: 18, etc.)
- **3D Projection**: Camera-based perspective projection with pitch and yaw rotation

### Particle Physics

- Particles smoothly animate toward target positions using linear interpolation
- Electrons orbit shells at speeds inversely proportional to shell distance
- Nucleons scale down in size as nucleus grows to maintain visual balance

### Element Categories

- **Alkali Metals**: Group 1
- **Alkaline Earth Metals**: Group 2
- **Transition Metals**: Groups 3-12
- **Post-Transition Metals**: Specific main group elements
- **Lanthanides**: Atomic numbers 57-71
- **Actinides**: Atomic numbers 89-103
- **Halogens**, **Noble Gases**, **Nonmetals**, **Metalloids**: Other classifications

## Browser Compatibility

Requires a modern browser supporting:

- HTML5 Canvas (2D context)
- ES6+ JavaScript
- CSS Grid and CSS Variables
- LocalStorage API
- Media Queries

Tested on Chrome, Firefox, Safari, and Edge (latest versions).

## Technical Details

### Canvas Rendering Pipeline

1. Clear canvas
2. Draw grid background
3. Draw orbital rings for occupied shells
4. Draw nucleus glow effect
5. Update electron positions (orbital animation)
6. Interpolate nucleon positions toward targets
7. Sort particles by depth (z-order)
8. Render all particles with proper layering
9. Request next animation frame

### Event Handling

- **Mouse/Touch Support**: All interactions work with mouse and touch events
- **Drag Detection**: 6px threshold to distinguish clicks from drags
- **Camera Control**: Right-click/no-particle drag rotates 3D view
- **Smooth Dragging**: Particles follow cursor with offset preservation

### Performance Optimizations

- Single canvas context reuse
- Efficient particle sorting by depth only when needed
- Lerp-based smooth animations instead of easing functions
- Minimal DOM updates (only when state changes)
- LocalStorage caching for theme preference

## Educational Value

ChemGL provides an interactive way to explore:

- Atomic structure and Bohr model principles
- Element properties and periodic table organization
- Atomic numbers, masses, and ionic charges
- Electron shell configurations
- Scientific facts about all 118 elements

Perfect for chemistry students, educators, and enthusiasts!
