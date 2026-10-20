# Official Godot references for the pinned engine

The service uses Godot **4.5.1 stable**, GDScript, Compatibility/WebGL 2 and embedded LibGodot. Use the **4.5** manual; `latest`/4.6/4.7 examples may use APIs unavailable here. This file routes to official sources rather than installing a community skill as if it were official.

## Find the relevant source

| Work | Official reference | Local API classes to inspect |
|---|---|---|
| GDScript syntax, types, inference and null checks | [GDScript basics](https://docs.godotengine.org/en/4.5/tutorials/scripting/gdscript/gdscript_basics.html), [static typing](https://docs.godotengine.org/en/4.5/tutorials/scripting/gdscript/static_typing.html) | `@GDScript`, `Object`, `RefCounted`, relevant built-in types |
| Scene composition, ownership and signals | [Scene organization](https://docs.godotengine.org/en/4.5/tutorials/best_practices/scene_organization.html) | `Node`, `PackedScene`, `Resource`, `Signal`, `SceneTree` |
| Movement, collisions and physics | [Physics introduction](https://docs.godotengine.org/en/4.5/tutorials/physics/physics_introduction.html) | `CharacterBody2D/3D`, `RigidBody2D/3D`, `Area2D/3D`, `PhysicsDirectSpaceState2D/3D` |
| Input and UI layout | [Multiple resolutions](https://docs.godotengine.org/en/4.5/tutorials/rendering/multiple_resolutions.html) | `Input`, `InputEventScreenTouch`, `InputEventScreenDrag`, `Control`, `Container`, `Camera2D/3D` |
| Profiling and rendering costs | [General optimization](https://docs.godotengine.org/en/4.5/tutorials/performance/general_optimization.html), [MultiMesh](https://docs.godotengine.org/en/4.5/tutorials/performance/using_multimesh.html) | `Performance`, `RenderingServer`, `MultiMesh`, `MultiMeshInstance3D`, `ImageTexture` |
| Web limits, audio activation, browser differences | [Web export](https://docs.godotengine.org/en/4.5/tutorials/export/exporting_for_web.html) | `OS`, `JavaScriptBridge`, `AudioServer` |
| Headless import, script checks and exports | [Command line](https://docs.godotengine.org/en/4.5/tutorials/editor/command_line_tutorial.html) | Installed editor `--help`; Kit build entrypoint |
| Device input | [Input reference](https://docs.godotengine.org/en/4.5/classes/class_input.html) plus the parent skill's `TokoyoDevice` contract | `Input`, `Image`, `ImageTexture`, `PackedByteArray`, `PackedFloat32Array` |

## Offline signatures

The environment setup runs the official editor's `--headless --doctool` to generate class XML in `${GODOT_TOOLCHAIN_DIR:-/opt/godot}/api/`. Base engine classes are in `doc/classes/`; module/language types use `modules/*/doc_classes/`. Search the class name, read the method arguments, return value, inherited class, properties and signals. Descriptions may be empty in generated XML: it is not a replacement for the manual's explanations.

An engine-supported API can still be unavailable in the browser or embedded runtime. In particular, the service's `TokoyoDevice` facade owns device access; do not substitute direct native sensor calls, browser `getUserMedia`, file access or networking. The fixed Kit exporter and service validators remain authoritative for what may be shipped.

If documentation, installed signatures and a tutorial disagree, reproduce with the pinned editor and report the specific mismatch. Do not add a different engine, plug-in, MCP server or unpinned dependency to make an example run.
