---
name: tokoyo-new
description: TOKOYO.games のミニゲームを手元の Coding Agent で新しく作り始める。Platform MCP（tokoyo）で App を作り、Creator Kit の SDK を用意し、作業ディレクトリ（.tokoyo.json・git のリポジトリ source/）を作る。「新しいゲームを作って」「TOKOYO.games で〜を作りたい」のように、まだ Platform に無いゲームを作るときに使う。new game, create app, setup.
---

# 新しいゲームを作り始める

`<kit>` は Creator Kit の置き場で、この Skill のディレクトリの 2 つ上（`skills/tokoyo-new/` の上の上）。
分からなければ利用者に Kit の場所を聞く。git と Git LFS（`git lfs version`）が要る。無ければ入れてもらう。

1. **SDK を用意する**: `get_sdk()` → `node <kit>/scripts/kit.mjs setup --sdk-url <url> --sha256 <sha256>`（展開して、Kitの固定lockfileどおりに`npm ci`でSDKとサーバー物理の依存を入れる。npmとネットワークが要る）
   （同じ版なら何もしないので毎回呼んでよい）。
2. **持ち主を決める**: `whoami()` の `accounts` がチームを含むなら、どのアカウント（個人かチーム）の
   ゲームにするかを利用者に聞く。個人なら `owner_account_id` は省く。
3. **App を作る**: `create_app({ title, owner_account_id? })` → `app_id` / `session_id` / `editor_url`。
   `title` は遊びの説明から短く付ける。
4. **作業ディレクトリを作る**: 今のディレクトリの下に、題名を英数字にした新しいディレクトリを作って移り、
   `get_git_bundles({ app_id })` の結果の JSON をそのまま渡して
   `node <kit>/scripts/kit.mjs clone --bundles '<get_git_bundles の JSON>'` を実行する
   （`.tokoyo.json`・`source/`（git のリポジトリ。sample-godotのソースを写したもの）・`input/`・`outputs/`・`AGENTS.md` ができる）。
   ゲームの制作・export・実行は**Godot 4.5.1 stable**へ固定する。Godot実行ファイルと同版のWeb export templatesを事前に用意し、
   実行ファイルがPATHに無ければ`GODOT_BIN`へ絶対パスを指定する。`setup`のnpm処理だけではGodot本体は入らない。
   `source/godot/project.godot`を土台に、`$game-godot`と共有profileを読む。2D/3DともGDScriptとGodotシーンを使う。
   対戦には`<kit>/sdk/sample-godot-multiplayer/`を参照し、既存Spaceサーバーへ接続する。
5. **画像や音を使うなら一度だけ** `node <kit>/scripts/kit.mjs login`（ブラウザで許可する。Git LFS の資格情報）。
6. **作る**: `<kit>/profile/instructions.md` を読み、その約束（§4.1 と §8）どおりに `source/` で作り、`git commit` する。
7. **送る**: `$tokoyo-push`。送った版は制作画面（`editor_url`）で試遊できる。
