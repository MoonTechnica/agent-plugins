# Implement and verify a Godot game in this service

Use the official references linked in `official-engine.md` for engine behavior, and the parent skill for service contracts. This is an integration workflow, not an alternative engine manual.

## Adapt the existing project

Inspect `project.godot`, main scene, attached scripts, autoloads, imported resources and current gameplay before changing them. Start new Godot games from the shared sample. Keep scene node paths and resource references consistent with the saved `.tscn`/`.tres` files and preserve source `.uid` files. The engine's import step detects broken resources and missing scripts.

Use reusable scenes/resources for entities that share behavior or tuning. Keep UI, world simulation and platform adapters separate enough to test them independently. Avoid a global autoload for every object; use explicit references and signals where scene relationships call for them. Reuse the provided platform autoload instead of embedding service operations in gameplay scripts.

Use typed arguments/return values and typed collections where their values are known. JSON and optional JavaScript interfaces remain dynamic: validate their types before reading or casting. Do not infer a static type from an arbitrary `Variant` and assume it is safe. Check node/resource existence and report failures rather than silently disabling gameplay.

Physics movement belongs in `_physics_process`; visual interpolation and UI updates may use `_process`. Apply `delta` to rates, but follow the documented movement API rather than multiplying velocity twice. Keep screen-touch and mouse handling from counting emulated mouse events twice.

## Make rendering decisions from evidence

Measure the affected scene before optimizing and repeat under the same viewport, quality and runtime. Identify CPU, GPU, loading or memory pressure first. Share reusable meshes/materials, avoid allocating textures or rebuilding unchanged UI every frame, and release owned resources/stream listeners on exit.

Use MultiMesh for many compatible repeated instances when draw-call reduction is relevant. It changes culling behavior: divide large worlds into suitable groups instead of putting the entire world into one instance collection. Choose camera framing, lighting, shadows, transparency and texture sizes for the actual mobile workload. Do not impose an arbitrary low-quality preset on every game.

## Parse, build and run

Use the pinned editor already in the environment. For a changed standalone script, `godot --headless --path <game>/godot --script res://path.gd --check-only` checks parsing. It does not prove scene wiring or runtime behavior. Import the actual project and run the normal `kit build` command from the generation profile, which creates both Web and native packs and validates the normal/development Artifacts.

The hosted profile supplies the fixed SDK/Kit dependencies. Copying the starter to an arbitrary local directory does not install them: resolve the same pinned dependencies through the normal profile setup before building. In the service repository, use `devenv shell -- godot-exec <editor arguments>` and `devenv shell -- godot-build <game directory>`; the latter still requires the game's Kit dependencies to resolve. Do not install an unrelated latest SDK or editor to work around module resolution.

Run the game's affected path with the service Shell, including start/menu, input, pause/resume and any device permission allow/deny/stop path. Verify portrait and landscape on the same live instance. When a native host contract changes, verify the rebuilt native client as well as Web; do not infer native support from a browser screenshot. A headless run cannot establish camera images, touch hit targets or visible quality.

Inspect exported resources and generated logs for script errors, missing assets, invalid node paths and unsupported platform operations. Record what was actually executed, the artifact/version and any untested physical hardware. Do not claim all features are understood or tested because export succeeded.
