---
name: game-godot
description: Create, extend and debug Godot 4.5.1 games with official engine references, the shared Kit build pipeline and the service's Web/native SDK adapters.
---

# Godot game development and service integration

Use when creating or changing a Godot game, or when an existing game has `manifest.godot`.
The shared game-design, art, controls and playtest requirements still apply. Implement engine-specific code with GDScript and Godot scenes rather than adding Phaser, Babylon or Rapier to this project.

## Official sources first

Read [official engine references](references/official-engine.md) for the feature being implemented and [implementation and validation](references/implementation.md) before changing gameplay. Prefer Godot's versioned official documentation and the installed editor's API signatures over third-party skills or remembered APIs. No Godot-maintained Agent Skill was found in the official site/organization search, rechecked on 2026-10-21; community packages listed on the official forum or Asset Library are not official Godot-maintained skills. This skill is a TOKOYO integration guide, not an official Godot skill. If an official skill becomes available, evaluate its pinned-engine compatibility before replacing generic guidance; keep service contracts here.

The pinned toolchain exposes official narrative text under `${GODOT_TOOLCHAIN_DIR:-/opt/godot}/manual/tutorials/` and XML method/type references under `${GODOT_TOOLCHAIN_DIR:-/opt/godot}/api/`. If online documentation cannot be reached, read the relevant local `.rst` chapter using the paths in [official engine references](references/official-engine.md); XML signatures alone do not explain behavior. The manual directory is a selected text subset, with provenance and licensing in `SOURCE.json` and `ATTRIBUTION.md`, not a complete rendered manual. Base API classes are in `doc/classes/`; language/module classes are under `modules/*/doc_classes/`. Read the needed class and inherited classes, not the whole tree. Never upgrade the engine to match a newer tutorial.

## Source and fixed toolchain

- Start from `<kit>/sample-godot/` (`/workspace/sdk/sample-godot/` in the hosted Sandbox). Keep `manifest.json`, `godot/project.godot`, `godot/export_presets.cfg` and `debug/` together in the game repository.
- The fixed editor is **Godot 4.5.1 stable**, matching the mobile LibGodot engine. Web uses Compatibility, single-threaded, no GDExtension. Do not install or compile an engine during a game build.
- Support fullscreen portrait and landscape without letterboxing or distortion: keep the starter's square `720×720` base, `canvas_items` stretch mode, `expand` stretch aspect, handheld `sensor` orientation and `manifest.orientation: "any"`. A fixed landscape rectangle with the default `keep` aspect adds bars on portrait; `ignore` instead distorts the image and is not a fix. The Host owns its full available surface; lay out the game inside the viewport it actually receives.
- Use Control anchors and Containers for HUDs, menus and touch controls; anchor bottom controls to the current viewport, not fixed landscape coordinates. Preserve safe-area insets for essential HUD/controls, using the Host-provided safe area or correctly transformed native safe-area coordinates; backgrounds and world rendering fill the surface. Recalculate viewport-dependent bounds and camera framing on resize. In 3D, choose an appropriate locked camera axis per orientation (the sample keeps horizontal FOV in portrait and vertical FOV in landscape) or fit the important play area explicitly; never scale 3D geometry nonuniformly to fill the screen.
- Keep source `.uid` files and scene UIDs under version control. Do not commit `.godot/`, `dist/` or `debug-dist/`.
- Replace the starter's cube scene with the requested playable game. Keep rules and tuning in separate GDScript files when needed; the shared design instructions' `src/rules.ts` / `src/tuning.ts` describe responsibilities, not mandatory TypeScript files for Godot.
- Do not change the Platform build scripts or generated runtime glue. The existing `kit build` detects `godot/project.godot`, imports in an isolated temporary project and exports Web and native packs. It then produces the same artifact indexes and separate development Artifact as other games.
- Run the normal profile build and source upload commands. Never submit an exported HTML document as the entrypoint. `app.bundle.js` is the fixed Platform bridge; `assets/godot/game.js`, `.wasm` and `.pck` are its web resources. `bundles/godot_native/game.pck` remains a demand bundle so the browser does not download the native pack.

## Embedded mobile viewport and safe area

The mobile Host publishes a JSON string on `get_tree().root.get_meta("tokoyo_host_viewport", "")`:

```json
{"width":393,"height":852,"safe":{"x":0,"y":59,"width":393,"height":759}}
```

All values use React Native points relative to the full Godot surface. Consume this metadata first on startup and each viewport `size_changed` signal; the Host refreshes metadata and emits that signal after layout or rotation. Validate finite positive frame dimensions, finite rectangle fields, positive safe area and full containment inside the frame. Map points into `get_viewport().get_visible_rect()` logical coordinates independently per axis; never apply RN points directly as Godot pixels. Keep world/background fullbleed and apply the resulting safe rectangle only to HUD/controls. Follow the sample implementation.

For missing or invalid metadata, retain the full visible viewport as the safe fallback. Embedded LibGodot's DisplayServer rectangle may use RN points while the viewport uses logical coordinates and the screen transform maps to physical pixels. Do not combine these units blindly or resize the game from that rectangle: this caused a one-pixel HUD despite a valid DisplayServer rectangle. The sample relies on Host metadata for mobile safe areas. A separate standalone export may use native DisplayServer information only if it is supported and validated in that standalone environment.

## SDK boundary

Keep the starter's `TokoyoApp` autoload (`res://tokoyo_app.gd`, `/root/TokoyoApp`). It provides a shared Web/native Store and lifecycle facade:

- `is_paused()` gates simulation while the Host pauses the game.
- Read `data` after `store_loaded(data)` or when `save_status()` becomes `loaded`. Never overwrite a save while the initial read is pending or failed.
- `save(value)` queues an SDK Store write with revision and request ID. `save_status()` reports `loading`, `loaded`, `saving`, `saved` or `failed`; show a failed save visibly. Listen for `store_saved` and `failed(code)` on native.
- `report(json)` records measurements such as FPS, draw calls and static memory. These are measurements, not performance guarantees.

Declare `store.read` and `store.write` and a matching Store schema. The native Host calls the existing SDK Store implementation and owns Launch credentials; never place credentials or direct HTTP persistence in GDScript. Revision conflicts remain visible failures. Unsupported SDK operations must fail explicitly. Multiplayer, arbitrary SDK operations and development commands are not implied by the Store adapter. Do not claim isolation, store approval or native save verification from a browser test.

Web uses the fixed JavaScript bridge internally; native uses Host signal requests. Generated gameplay consumes `TokoyoApp`, not platform-specific bridge internals. Handle `InputEventScreenTouch` / `InputEventScreenDrag` as well as real mouse input, and exclude `InputEvent.DEVICE_ID_EMULATION` mouse presses when already counting touches.

## PoC scope and verification

- No native extensions, C# or development resources inside the production Godot resource tree. The fixed builder rejects these. The first PoC uses one production scene and a development-only JS wrapper with the normal_start catalog case; its PCK contains no development code.
- Do not invent new SDK operations or network access. Use the declared Store schema and supported facade. Additional game operations need the Platform adapter updated and tested.
- Verify Web with the actual Shell, including save/restore, pause/resume and scene rendering. Verify mobile through the existing Expo player with the downloaded native pack. Linux headless export alone does not verify rendering or iPhone performance.
- Check a tall portrait and a wide landscape surface, then resize/rotate the same live game. Confirm the world reaches every edge, subjects retain their proportions and important framing, text and controls remain visible, and pointer/touch still hits the intended targets after resizing. Record actual captures and input results; a successful export does not establish orientation support.
- Record initial download bytes, start time, frame time, draw calls and memory; compare the same scene and quality before/after optimization. Use shared mesh/material resources and bound their lifetime. Do not replace a visual test with a successful build.
- If fixed Godot or the approved runtime is absent from the Sandbox snapshot, report the missing infrastructure. Never silently switch to a different engine or fabricate successful native/Web testing.


## Permission-controlled devices (Web and embedded native)

Keep the starter's `TokoyoDevice` autoload (`res://tokoyo_device.gd`, node `/root/TokoyoDevice`). Use this facade rather than native Godot sensor/capture APIs or direct JavaScript browser APIs: embedded and Web runtimes have different device support and the Host owns consent.

- Declare `device.motion`, `device.camera`, or `device.microphone` capabilities plus matching `manifest.device` entries with a concrete `purpose` and `required`. Optional devices must retain usable touch/mouse alternatives.
- Call `TokoyoDevice.start_motion()`, `start_camera({"width":320,"height":240,"fps":15,"facing":"user"})`, or `start_microphone({"sampleRate":16000})` from an explicit player action. Calls return a request ID; results arrive through `started(kind)`, `failed(kind,code,message)` and `stopped(kind,reason)` signals. A call is not permission approval. Show rejection/unavailability and retain fallback controls.
- `motion_sample(sample)` carries `alpha`, `beta`, `gamma` in degrees, nullable gravity-inclusive `acceleration` in m/s², and `screenAngle` (0/90/180/270). Account for screen orientation and missing axes. This is not raw gyro angular velocity.
- `camera_frame(texture)` supplies a reusable `ImageTexture`; display it locally without accumulating frame copies. `microphone_chunk(samples,sample_rate,seq,dropped)` supplies mono `PackedFloat32Array`; `microphone_level(rms)` provides volume. Treat dropped chunks as a discontinuity. Do not retain unbounded histories or send capture outside the device.
- `stop(kind)` / `stop_all()` release devices. The Host stops capture on pause/background/disposal; restarting requires a fresh explicit request. Never bypass per-game explanation, OS consent, usage indicators or stop controls.
- Web uses SDK streams and binary JavaScriptBridge copies. Native uses the same facade and request IDs through the approved Host provider. No device APIs are exposed as arbitrary OS access. Camera/audio bytes never travel as JSON or base64. The transport retains only the latest camera/motion sample and at most five audio chunks; older audio is counted in `dropped`.

The native Host connects `request(json)` then calls `attach_host()` once and handles the returned JSON command array. Commands are `{id,action,kind,options}`. Deliver `{type,id,kind,...}` through `receive_event(json)` (`started`, `error` with `code/message`, `stopped` with `reason`, or `motion` with `sample`). Binary receivers are `receive_camera(id,rgba,width,height,seq)` and `receive_microphone(id,pcm_float32_le,sample_rate,seq,dropped,rms)`, both using `PackedByteArray`. Never reuse IDs across a stopped/restarted stream. Receivers discard stale IDs. This Host ABI is platform infrastructure; generated games consume the facade, not the Host internals.

Verify permission denial and optional fallback, start/stop/restart, background/pause disposal, live orientation, and a visible camera frame/volume/motion result. Simulator/headless synthetic inputs verify decoding and lifecycle only; record real-device sensor/capture checks separately.
