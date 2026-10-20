---
name: game-godot
description: Build the approved Godot service-integration PoC using the fixed editor, existing kit build and Artifact pipeline.
---

# Godot service integration PoC

Use for an explicitly requested Godot PoC or an existing game with `manifest.godot`.
The shared game-design, art, controls and playtest requirements still apply. Implement engine-specific code with GDScript and Godot scenes rather than adding Phaser, Babylon or Rapier to this project.

## Source and fixed toolchain

- Start from `<kit>/sample-godot/` (`/workspace/sdk/sample-godot/` in the hosted Sandbox). Keep `manifest.json`, `godot/project.godot`, `godot/export_presets.cfg` and `debug/` together in the game repository.
- The fixed editor is **Godot 4.5.1 stable**, matching the mobile LibGodot engine. Web uses Compatibility, single-threaded, no GDExtension. Do not install or compile an engine during a game build.
- Keep source `.uid` files and scene UIDs under version control. Do not commit `.godot/`, `dist/` or `debug-dist/`.
- Replace the starter's cube scene with the requested playable game. Keep rules and tuning in separate GDScript files when needed; the shared design instructions' `src/rules.ts` / `src/tuning.ts` describe responsibilities, not mandatory TypeScript files for Godot.
- Do not change the Platform build scripts or generated runtime glue. The existing `kit build` detects `godot/project.godot`, imports in an isolated temporary project and exports Web and native packs. It then produces the same artifact indexes and separate development Artifact as other games.
- Run the normal profile build and source upload commands. Never submit an exported HTML document as the entrypoint. `app.bundle.js` is the fixed Platform bridge; `assets/godot/game.js`, `.wasm` and `.pck` are its web resources. `bundles/godot_native/game.pck` remains a demand bundle so the browser does not download the native pack.

## SDK boundary

The current PoC bridge in Web is `JavaScriptBridge.get_interface("__tokoyoGodotBridge")`:

- `isPaused()` gates simulation while the Host pauses the game.
- `load()` returns the SDK Store data as a JSON string.
- `save(json)` queues an SDK Store write with revision and request ID. `saveStatus()` reports `loading`, `loaded`, `saving`, `saved` or `failed`; show a failed save visibly.
- `report(json)` records measurements such as FPS, draw calls and static memory. These are measurements, not performance guarantees.

Declare `store.read` and `store.write` and a matching Store schema when using this adapter. Native SDK bridging is separate work: the Web JavaScript bridge does not exist in native execution. Do not claim native saves, isolation or store approval based on a browser test.

Acquire that optional Web bridge without a platform-specific type annotation:

```gdscript
var bridge
if OS.has_feature("web") and Engine.has_singleton("JavaScriptBridge"):
    bridge = Engine.get_singleton("JavaScriptBridge").get_interface("__tokoyoGodotBridge")
```

All bridge calls must be conditional on `bridge != null`. Keep local gameplay and its visible state functional on native without the bridge. The sample labels native progress `native session`; this deliberately does not claim persistent SDK saves. Handle `InputEventScreenTouch` / `InputEventScreenDrag` as well as real mouse input, and exclude `InputEvent.DEVICE_ID_EMULATION` mouse presses when already counting touches. Report native performance through stdout using the same JSON measurements sent to the Web bridge.

## PoC scope and verification

- No native extensions, C# or development resources inside the production Godot resource tree. The fixed builder rejects these. The first PoC uses one production scene and a development-only JS wrapper with the normal_start catalog case; its PCK contains no development code.
- Do not invent new SDK operations or network access. Current automatic Store bridge is for the sample schema; changing schema or adding game operations needs the Platform adapter updated and tested.
- Verify Web with the actual Shell, including save/restore, pause/resume and scene rendering. Verify mobile through the existing Expo player with the downloaded native pack. Linux headless export alone does not verify rendering or iPhone performance.
- Record initial download bytes, start time, frame time, draw calls and memory; compare the same scene and quality before/after optimization. Use shared mesh/material resources and bound their lifetime. Do not replace a visual test with a successful build.
- If fixed Godot or the approved runtime is absent from the Sandbox snapshot, report the missing infrastructure. Never silently switch to a different engine or fabricate successful native/Web testing.
