# Godot 4.5.1 practices that generated games most often get wrong

Read before writing gameplay code for a new game or a changed core loop. Each rule was checked against the 4.5 manual or the 4.5.1-stable class reference/source; items marked *(unverified)* were not tested on a device. Research record (service repository, not in the sandbox): `docs/_research/2026-10-22-godot-best-practices-and-touch-controls.md`. Input and touch controls are in `$game-controls` references/godot-input.md.

## Scenes and references

- Design scenes without outside dependencies; the parent injects what a child needs. Children notify parents with signals; parents call children directly. Siblings never reach each other; their common ancestor mediates. Avoid `get_parent().get_parent()`, absolute `/root/...` paths and `current_scene.$Player`; inject references at spawn time or use groups (`get_tree().get_first_node_in_group(&"player")`).
- Keep autoloads to the starter's `TokoyoApp`, `TokoyoDevice`, `TokoyoSpace` plus at most a small settings/scene-flow node. Use `static func`, `static var` or a shared `Resource` instead of new globals.
- `%UniqueName` works only inside the same owner (saved scene). Nodes created in code have no owner: keep them in typed variables.
- `Resource` instances are shared by default. Per-instance mutable data (enemy HP stored in a Resource) must be `duplicate()`d or use `resource_local_to_scene`; otherwise hitting one enemy damages all.

## Types

- Type declarations, arguments, returns and collections (`Array[Enemy]`, `Dictionary[String, int]`; nested typed collections are not allowed). Set `debug/gdscript/warnings/untyped_declaration=1` (warn) in new projects.
- `x as T` silently yields `null` on mismatch: test with `is` first. `var v := dict["k"]` is `Variant`; JSON and bridge values must be validated before use.

## Frame loop, movement and smoothness

- Movement, collisions and rules run in `_physics_process`; visual-only follow and UI in `_process`.
- `move_and_slide()` takes no arguments and applies the physics delta itself: set `velocity = direction * speed`, accelerate with `velocity = velocity.move_toward(target, accel * delta)`. Never multiply velocity by `delta` before `move_and_slide()`.
- Top-down `CharacterBody2D`: `motion_mode = MOTION_MODE_FLOATING` (the default GROUNDED mode assumes a floor and slows on walls).
- **Enable physics interpolation for action games** (`physics/common/physics_interpolation=true`). With 60 physics ticks on 90/120 Hz displays (iOS allows 120 Hz by default), motion otherwise visibly stutters. Rules when enabled: move every world object (including parents) in `_physics_process`; run world Tweens with `set_process_mode(Tween.TWEEN_PROCESS_PHYSICS)` and AnimationPlayer with physics callback mode; call `reset_physics_interpolation()` after setting the transform of a teleported, respawned or pooled object; use `CPUParticles2D` for moving emitters (GPU particles are not interpolated). Camera2D switches itself to physics mode; Controls are excluded. Keep 60 ticks on mobile Web. *(Actual 120 Hz output in embedded LibGodot/Web is unverified.)*

## Juice with engine features

- Tweens: `create_tween()` is bound to the node. Keep the tween in a variable and `kill()` the previous one before tweening the same property again. Menu animations during pause need `set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)`.
- Hit-stop: set `Engine.time_scale` low (e.g. `0.05`, never `0`) for the stop and restore it with `get_tree().create_timer(seconds, true, false, true)` (the last argument ignores time scale). Time scale does not slow audio. UI tweens use `set_ignore_time_scale(true)`. In crowded fights stop only the two involved bodies instead. Never stop an authoritative online tick.
- Screen shake: shake `Camera2D.offset` (it may pass the limits), never `position` (fights smoothing and limits). Trauma 0–1 decays over 0.1–0.3 s; displacement = trauma² × a few to ~15 logical px; directional shake for directional events; a settings switch turns it off.
- Camera2D: `position_smoothing_enabled` with moderate speed, `drag_*` margins as a camera window, `offset` for lookahead toward movement, `limit_*` at world edges; decide what happens when the visible area (`expand` stretch) is larger than the world.
- One-shot particles: `one_shot` + `emitting=true` does not restart while particles live; call `restart()` or pool several emitters. `GPUParticles2D.emit_particle` is unavailable in Compatibility.
- `Timer` defaults to idle processing; gameplay timers use physics processing or a countdown inside `_physics_process`. After `await get_tree().create_timer(t).timeout`, check `is_instance_valid(self)`.

## Audio

- `AudioStreamPlayer.max_polyphony` defaults to 1: repeated sounds cut each other. Use 4–8 for shots, steps and pickups.
- Vary repeated sounds: set `pitch_scale = randf_range(0.92, 1.08)` before `play()` (works with Web sample playback). `AudioStreamRandomizer` under Web sample playback is *(unverified)*.
- Web defaults to sample playback: bus effects (reverb, filters), Doppler and generated streams do not play there. Don't rely on them for essential feedback. Forcing stream playback adds latency and crackling.
- Separate SFX and BGM buses with independent mute settings; start audio only after the first player input.

## Lifetime and performance

- `queue_free()` frees at the end of the frame and is safe to call repeatedly; check stale references with `is_instance_valid()`. Avoid `free()` inside physics callbacks.
- Share meshes/textures/materials/`PackedScene` with `preload`/`const`. Pool bullets/particles only after measuring; reset interpolation when reusing.
- Single-threaded WASM is slower than native and mobile GPUs are small: measure the affected scene (`$game-design` references/performance-risk.md) before and after.

## UI and text

- HUD lives under a `CanvasLayer` (layer ≥ 1). Full-screen `Control`, `ColorRect`, `Panel` and `PanelContainer` default to `MOUSE_FILTER_STOP` and swallow touches before `_unhandled_input`: set HUD roots, backgrounds and decoration to `MOUSE_FILTER_IGNORE`.
- `ThemeDB.fallback_font_size` is 16, about 9 pt on a phone at the 720 base. Put one project theme (`gui/theme/custom`) with `default_font_size` 28–32 for body text (≈ 16–17 pt); don't override every Label.
- **Bundle a Japanese font.** Web cannot fall back to system fonts, so Japanese text renders as missing glyphs without one; the restricted native runtime only reads `res://` *(system fallback unverified)*. Use an OFL font subset set as the theme/custom font; credit it in the listing.
  - Start from the two OFL Japanese fonts bundled with `$game-ux` (`<kit>/skills/game-ux/assets/fonts/`: M PLUS Rounded 1c Bold, DotGothic16), copied with their `OFL.txt` (`$game-ux` §3). Only when neither fits the art: the stock asset tools do not serve fonts. Locally, take one weight of an OFL font from the `google/fonts` repository at a fixed commit (`https://raw.githubusercontent.com/google/fonts/<commit>/ofl/<family>/<File>.ttf`), put it with that family's `OFL.txt` under `godot/assets/fonts/` (Git LFS), and record family, commit and licence in `design/asset-manifest.md`. Prefer one compact weight (pixel or rounded families are 1–3 MB); a full variable Noto CJK adds tens of MB to the initial download.- MSDF fonts suit large animated numbers; normal rasterization keeps small body text sharp.
- `canvas_items` + `expand` maps the short side to 720, so UI and touch controls grow physically on tablets. Check a tablet surface if the layout depends on finger size.
