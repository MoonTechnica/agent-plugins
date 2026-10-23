# Official Godot references for the pinned engine

The service uses Godot **4.5.1 stable**, GDScript, Compatibility/WebGL 2 and embedded LibGodot. Use the **4.5** manual; `latest`/4.6/4.7 examples may use APIs unavailable here. This file routes to official sources rather than installing a community skill as if it were official.

## Find the relevant source

| Work | Official reference | Local API classes to inspect |
|---|---|---|
| GDScript syntax, types, inference and null checks | [GDScript basics](https://docs.godotengine.org/en/4.5/tutorials/scripting/gdscript/gdscript_basics.html), [static typing](https://docs.godotengine.org/en/4.5/tutorials/scripting/gdscript/static_typing.html) | `@GDScript`, `Object`, `RefCounted`, relevant built-in types |
| Scene composition, ownership and signals | [Scene organization](https://docs.godotengine.org/en/4.5/tutorials/best_practices/scene_organization.html) | `Node`, `PackedScene`, `Resource`, `Signal`, `SceneTree` |
| Movement, collisions and physics | [Physics introduction](https://docs.godotengine.org/en/4.5/tutorials/physics/physics_introduction.html) | `CharacterBody2D/3D`, `RigidBody2D/3D`, `Area2D/3D`, `PhysicsDirectSpaceState2D/3D` |
| Input and UI layout | [Multiple resolutions](https://docs.godotengine.org/en/4.5/tutorials/rendering/multiple_resolutions.html) | `Input`, `InputEventScreenTouch`, `InputEventScreenDrag`, `Control`, `Container`, `Camera2D/3D` |
| Renderer features, materials, environment, shadows, LOD | [Renderers](https://docs.godotengine.org/en/4.5/tutorials/rendering/renderers.html), [Standard Material 3D](https://docs.godotengine.org/en/4.5/tutorials/3d/standard_material_3d.html), [Environment and post-processing](https://docs.godotengine.org/en/4.5/tutorials/3d/environment_and_post_processing.html), [Lights and shadows](https://docs.godotengine.org/en/4.5/tutorials/3d/lights_and_shadows.html), [Visibility ranges](https://docs.godotengine.org/en/4.5/tutorials/3d/visibility_ranges.html), [Mesh LOD](https://docs.godotengine.org/en/4.5/tutorials/3d/mesh_lod.html), [Optimizing 3D](https://docs.godotengine.org/en/4.5/tutorials/performance/optimizing_3d_performance.html) | `Environment`, `BaseMaterial3D`, `DirectionalLight3D`, `GeometryInstance3D`, `ImporterMesh` |
| Shaders, vegetation and vertex animation | [Spatial shader](https://docs.godotengine.org/en/4.5/tutorials/shaders/shader_reference/spatial_shader.html), [CanvasItem shader](https://docs.godotengine.org/en/4.5/tutorials/shaders/shader_reference/canvas_item_shader.html), [Making trees](https://docs.godotengine.org/en/4.5/tutorials/shaders/making_trees.html), [Animating thousands of fish](https://docs.godotengine.org/en/4.5/tutorials/performance/vertex_animation/animating_thousands_of_fish.html). Outdoor/nature pitfalls on Compatibility: `$game-art-direction` references/nature.md | `ShaderMaterial`, `MultiMesh` |
| Profiling and rendering costs | [General optimization](https://docs.godotengine.org/en/4.5/tutorials/performance/general_optimization.html), [MultiMesh](https://docs.godotengine.org/en/4.5/tutorials/performance/using_multimesh.html) | `Performance`, `RenderingServer`, `MultiMesh`, `MultiMeshInstance3D`, `ImageTexture` |
| Web limits, audio activation, browser differences | [Web export](https://docs.godotengine.org/en/4.5/tutorials/export/exporting_for_web.html) | `OS`, `JavaScriptBridge`, `AudioServer` |
| Headless import, script checks and exports | [Command line](https://docs.godotengine.org/en/4.5/tutorials/editor/command_line_tutorial.html) | Installed editor `--help`; Kit build entrypoint |
| Device input | [Input reference](https://docs.godotengine.org/en/4.5/classes/class_input.html) plus the parent skill's `TokoyoDevice` contract | `Input`, `Image`, `ImageTexture`, `PackedByteArray`, `PackedFloat32Array` |

## Offline narrative text when the network is unavailable

Environment setup installs a checksum-verified selection of unmodified official 4.5 reStructuredText sources under `${GODOT_TOOLCHAIN_DIR:-/opt/godot}/manual/`. The source commit is `33e08e14c517541fac3d9069e82fb3ee2fc99a10` from `godotengine/godot-docs`. Read the relevant file directly:

- `tutorials/scripting/gdscript/gdscript_basics.rst`
- `tutorials/scripting/gdscript/static_typing.rst`
- `tutorials/best_practices/scene_organization.rst`
- `tutorials/rendering/multiple_resolutions.rst`
- `tutorials/physics/physics_introduction.rst`
- `tutorials/performance/general_optimization.rst`
- `tutorials/performance/using_multimesh.rst`
- `tutorials/export/exporting_for_web.rst`
- `tutorials/editor/command_line_tutorial.rst`
- `tutorials/rendering/renderers.rst`, `tutorials/3d/3d_rendering_limitations.rst`
- `tutorials/3d/standard_material_3d.rst`, `tutorials/3d/environment_and_post_processing.rst`, `tutorials/3d/high_dynamic_range.rst`
- `tutorials/3d/lights_and_shadows.rst`, `tutorials/3d/visibility_ranges.rst`, `tutorials/3d/mesh_lod.rst`, `tutorials/3d/occlusion_culling.rst`
- `tutorials/3d/using_multi_mesh_instance.rst`, `tutorials/performance/optimizing_3d_performance.rst`, `tutorials/performance/vertex_animation/animating_thousands_of_fish.rst`
- `tutorials/shaders/making_trees.rst`, `tutorials/shaders/shader_reference/spatial_shader.rst`, `tutorials/shaders/shader_reference/canvas_item_shader.rst`
- `tutorials/assets_pipeline/importing_3d_scenes/import_configuration.rst`

These files contain narrative explanations and inline examples. Image files and Sphinx cross-reference targets outside this subset are omitted; this is not a complete rendered manual. Preserve `LICENSE.txt`, upstream `README.md`, `SOURCE.json` and `ATTRIBUTION.md` when copying the subset. Attribution is to Juan Linietsky, Ariel Manzur and the Godot community under CC BY 3.0; the separately generated engine API XML has its own engine licensing. Local environment preparation uses `devenv shell -- godot-prepare-docs`; generation should read installed files rather than retrying downloads or changing the toolchain.

## Offline API signatures

The environment setup runs the official editor's `--headless --doctool` to generate class XML in `${GODOT_TOOLCHAIN_DIR:-/opt/godot}/api/`. Base engine classes are in `doc/classes/`; module/language types use `modules/*/doc_classes/`. Search the class name, read the method arguments, return value, inherited class, properties and signals. Descriptions may be empty in generated XML: it is not a replacement for the manual's explanations.

An engine-supported API can still be unavailable in the browser or embedded runtime. In particular, the service's `TokoyoDevice` facade owns device access; do not substitute direct native sensor calls, browser `getUserMedia`, file access or networking. The fixed Kit exporter and service validators remain authoritative for what may be shipped.

If documentation, installed signatures and a tutorial disagree, reproduce with the pinned editor and report the specific mismatch. Do not add a different engine, plug-in, MCP server or unpinned dependency to make an example run.
