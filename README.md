# Three.js Simple Shooting Game

This is a minimal Three.js shooting demo. Click to shoot spheres; each sphere disappears when hit and a new one spawns.

Files added:

- `index.html` — game entry, overlay, and crosshair
- `src/main.js` — main Three.js game logic

Run locally (recommended: use a simple HTTP server). From the project root run one of these commands in `cmd.exe`:

```cmd
python -m http.server 8000
rem # then open http://localhost:8000 in your browser
```

or, if you have Node.js installed:

```cmd
npx http-server -p 8000
```

Notes:

- The gun is a simple geometry attached to the camera so it's locked to the POV.
- Targets spawn in random positions in front of the camera. Press `N` to spawn an extra target.
- Controls: Pointer-drag to look around (desktop); click to shoot.

If you want more features (sound, multiple weapon types, UI, mobile touch look), tell me which one to add next.
