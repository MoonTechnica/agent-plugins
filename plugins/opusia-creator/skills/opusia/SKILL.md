---
name: opusia
description: Start here for any Opusia work. Opusia produces short films, animation, music videos and edited footage (script, design sheets, storyboards, video, audio, final render) through the Opusia MCP server. Read this before using any Opusia tool.
---

# Opusia

Opusia is a studio you drive through its MCP server (`opusia`). The project data lives there; this
folder is only scratch space.

## First steps (every session)

1. **Signed in?** If no Opusia tools are visible, the person has not signed in yet. Claude Code: run `/mcp`,
   pick `plugin:opusia-creator:opusia`, approve in the browser. Codex: `codex mcp login opusia`.
2. **Pick the project.** `list_projects`. If the person has none, or wants a new one, ask for a name and call
   `create_project` (it also makes the first timeline; it goes to their personal organization unless they name a team).
3. **Start a conversation.** `start_session(project_id, title, engine)` — `engine` is `claude` in Claude Code and
   `codex` in Codex. It returns a `session_id` and the project's `directives`.
   To continue earlier work, `resume_session(session_id)`.
4. **Pass `session_id`** to every tool that accepts it (deliverables, checks, budget, generation, directives).
   The work is recorded in that conversation and shows up in Opusia.
5. **Read the `directives` and follow them.** They are what the person told this project to do, in their own words
   (for example "draw images in my local ComfyUI, never with credits"). `get_project_directives` re-reads them.
6. **Read `references/operating-rules.md`** now: the standing rules Opusia gives its own agents. They apply here too.
   Then read the `director` skill for the order of work, and the skill of each stage as you reach it.

## Images and credits

Server-side generation spends the person's credits. Do not spend them when a free route exists.

- **In Codex, draw images yourself with `image_gen`.** Call `start_local_generation` with the same spec you would
  give `generate_asset` / `generate_material_sheet`, draw from the returned prompt and references, upload the PNG
  with the returned `curl`, then `complete_local_generation`. The server refuses `generate_asset` for Codex.
  If you truly cannot draw it, `cancel_local_generation` first; only then may the server route be used, once.
- **If a directive says to draw locally (for example in ComfyUI)**, use `start_local_generation` with
  `renderer: "comfyui"` and the ComfyUI MCP (`comfy-mcp`). It is not bundled: if its tools are missing, tell the
  person how to register it (Claude Code: `claude mcp add`; Codex: `[mcp_servers]` in `config.toml`) and stop.
  If its tools fail with a refused connection, ComfyUI is not running: do not retry, tell the person.
- **Never fall back to credits on your own** when the local route is unavailable. Tell the person and ask. Only if
  they agree, record their words with `record_project_directive` (`value: {route: "server"}`,
  `this_thread_only: true`) and repeat the call.

## Do not

- Drive the Opusia web UI (no browser automation or screen control). Everything the app does is an MCP tool; if a
  tool is missing or fails, say so and stop.
- Spend credits or change a person's standing instruction (directive) without their say.
- Ask the person to upload something you made: put it back with `create_upload_ticket` → the returned `curl` →
  `register_upload`.
