# 手元で加工するか、サーバーの tool に任せるか

素材は `get_asset_preview(asset_id).url`（署名 URL、1 時間）で手元に落とせる。
加工した結果は `create_upload_ticket` → 返った `curl` で PUT → `register_upload` で
素材に戻せる。**この往復が使える仕事は、手元でやる。** サーバーの tool は
「鍵・課金・外部 API・DB の整合」を伴うものに限る。

## 判断の軸（上から順に当てる）

| 問い | はい → |
|---|---|
| 出力が**ファイル**（音・動画・画像）で、ffmpeg / ImageMagick / 自分のコードで作れるか | **手元**。落とす → 加工 → `register_upload(source_asset_id=元)` |
| 鍵・課金・外部 API（fal / Gemini / HyperFrames Cloud）を使うか | **サーバー**（`generate_*` / `ask_gemini` / `measure_music` / `hear_music` / `render_composition`） |
| DB の整合を伴うか（確定・束ね・シーン / カット・スロット・系譜の自動配線） | **サーバー**（`set_*` / `bind_*` / `split_board_sheet` …） |
| 入力も出力も**テキスト**か（脚本・字コンテ・タイムラインの HTML・JSON） | **tool の引数で渡す**（`put_document` / `put_composition_bundle`）。ファイルにして上げない |
| 区間を「タイムラインで再生したい」だけか | **切らない**。`data-media-start` / `plan_footage_scenes` の区間で足りる |
| 生成クリップの音を「タイムラインで鳴らさない」だけか | **剥がさない**。`data-has-audio` を書かなければ消音される（`compositor` §2） |

## 手元でやるもの（例）

結合・音の差し替え・変換・整音は `python3 <SKILL_DIR>/scripts/media.py <concat|remux|convert|loudnorm>`
（ffmpeg の引数を毎回組み立てない。`--dry-run` でコマンドだけ出る。ffmpeg が無ければ終了コード 3）。
`media.py probe` / `md5` は手元のファイルの確認用（上げた素材の実測は `get_asset` の `qc`）。

| 仕事 | やり方 | 戻し方 |
|---|---|---|
| 動画から**音だけ**取る / 音を差し替える | `ffmpeg -i v.mp4 -vn …` / `-i v.mp4 -i a.wav -map 0:v -map 1:a` | 同上（`params.type` は `extract` / `remux`） |
| **結合**（カットを繋ぐ・曲を繋ぐ） | `ffmpeg -f concat -safe 0 -i list.txt -c copy out` | `source_asset_id` は主素材、`params.sources` に残り |
| **変換**（m4a → wav、mov → mp4、png → jpg、解像度・fps） | `ffmpeg -i in … out` / `magick in -resize … out` | `params.type: "convert"` |
| 音の**整音**（音量正規化・フェード・無音のトリム） | `ffmpeg -af loudnorm` / `afade` / `silenceremove` | `params.type: "audio_edit"` |
| 画像の**切り抜き・リサイズ・合成・透過** | `magick in -crop … out` / `-composite` | `params.type: "crop"` / `"composite"` |
| **3D の演出**（物理・粒子・ジオメトリノード。Blender の `bpy`） | `uv run --python 3.13 --with bpy==5.3.0`（compositor の references/blender-by-hand.md。手元でもクラウドでも動く。速さは作業環境次第） | `params.type: "blender"`、`video/webm`（透過） |
| 字幕ファイル・簡単なタイトルカード | SRT を書く / `magick -size … label:…` | テキストは `put_document`、画像は `register_upload` |
| **確かめる**（尺・fps・音の有無・黒・無音・音量・カット数） | **手元で測らない** | 取り込みが全版を測っている。`get_asset` の `qc`（黒 / 凍結 / 無音の区間・LUFS・カットの開始秒）と `asset_versions[].meta`（寸法・fps・`has_audio`）を読む |

戻すときの約束:

- `content_type` は中身と一致させる（`audio/wav` / `audio/mpeg` / `video/mp4` / `image/png` …）
- **元の素材から作ったら `source_asset_id` を渡す**（盤面で線が繋がる。渡さないと孤児になる）
- `name` は人が一覧で見る名前（`<元の名前> (00:07.4-00:22.2)` のように何をしたかが分かる形）
- 戻ってきた素材の尺・黒・無音が狙いどおりか `get_asset`（`qc`）で確かめてから使う

## サーバーに任せるもの（手元に落とさない）

| 仕事 | tool | 理由 |
|---|---|---|
| 画像・動画・音・3D の**生成** | `generate_asset` / `generate_scene` | 鍵（`FAL_KEY`）と課金計測はサーバーにしか無い |
| **書き出し** | `render_composition` | HyperFrames Cloud。`npx hyperframes render` は打てない |
| **聴く / 見る**（曲の地図、口合わせの確認、素材の内容） | `ask_gemini` / `measure_music` / `hear_music` / `hear_lyrics` | Files API のキャッシュと課金計測 |
| **文字起こし** | `generate_asset(task=speech_to_text)` | 同上 |
| 絵コンテの**コマ切り分け** | `split_board_sheet` | 切るだけでなく**カットへ束ねる**まで一体。手元で切ると束ねが残る |
| テイクの**カットの差し替え**（切り出し → `video_edit` → 差し戻し） | `extract_cut` / `replace_cut` | コマ単位の切り方・長いカットの分割・継ぎ目の溶かし・コマ数の保証が決まった手順。テイクを落とす往復も要らない（`cinematographer` の references/partial-edit.md） |
| 文書・タイムラインの HTML | `put_document` / `put_composition_bundle` | テキストは引数で渡す。ファイルで上げると変数の同期が走らない |
| 確定・束ね・除外・スロット | `set_*` / `bind_*` / `set_asset_excluded` | DB のトリガが整合を守る |
| 動画の**指定した秒のコマ**（検品・継ぎ目の最終フレーム） | `get_asset_frames`（負の秒は末尾から。素材にするなら `as_asset`） | 素材を落とさずに見られる。抜いたコマを次のカットの先頭フレームにできる |
| 曲・動画の**区間の切り出し**（何区間でも 1 回）・動画の**音を外す** | `slice_media`（`ranges` / `mute`） | 元を 1 回だけ落とし、区間ごとに素材と系譜を作る。手元で区間の数だけ往復しない |

## 人の指定（プロジェクトの取り決め）があるときは、それに従う

**生成を始める前に `get_project_directives` を読む。** 「画像は手元の ComfyUI で作って。
クレジットは使わないで」のように、人がこのプロジェクトに指定したことが人の言葉のまま入っている
（次のスレッドでも、Claude Code や Codex から繋いだときでも同じに見える）。

| 取り決め | やること |
|---|---|
| 画像は手元の ComfyUI（`renderer: comfyui`） | `generate_asset` / `generate_material_sheet` は**サーバが断る**。`start_local_generation({ renderer: "comfyui", … })` で描く（下の ComfyUI の節） |
| 画像は手元の Codex（`renderer: codex`） | `start_local_generation` で自分の `image_gen` に描かせる（下の Codex の節） |
| 手元の道具が**使えない**（`comfy-mcp` が繋がっていない・ComfyUI が起動していない） | **クレジットに自分で回さない。** 人に「ローカルが使えない。クレジットで作ってよいか」と聞く |
| 人が「今回はクレジットでいい」と言った | その言葉を `statement` に、`record_project_directive({ scope: "image", value: { route: "server" }, this_thread_only: true })` で記録してから、同じ呼び出しをやり直す（**その会話だけ**通る） |

- **記録するのは、人がはっきり指定したときだけ。** `statement` は人の言葉をそのまま引く（要約しない・
  推測で書かない）。記録したら会話で「こう記録した」と 1 行伝える。人はプロジェクト設定の一覧で取り消せる
- 人が「ずっとローカルで」と言えば `value: { route: "local", renderer: … }`（`this_thread_only: false`）。
  「もうローカルでなくていい」と言えば `revoke_project_directive`
- **人の取り決めを自分の判断で `server` に書き換えない**（人の許可なしにクレジットを使うことになる）
- 動画・音声の指定も記録はできるが、手元の経路が今あるのは画像だけ。動画・音声は指定どおりに
  できないので、毎回人に聞く

## Codex で動いているときの画像は、自分の `image_gen` で描く

**Codex** で動いているとき（デスクトップの ACP でも、手元の Codex から Opusia の MCP に
繋いだときでも）は、画像（1 枚もの・設定資料シート・
グリッド絵コンテの**全部**）を `generate_asset` / `generate_material_sheet` ではなく
**Codex 組み込みの `image_gen`** で描く。費用は利用者の Codex に乗り、本サービスでは
課金しない。盤面・字コンテ・版面・系譜はサーバが人の生成と同じに残す。

| 段 | やること |
|---|---|
| 受付 | `start_local_generation({ asset: <generate_asset と同じ指定> })` または `{ material_sheet: <generate_material_sheet と同じ指定> }`。返る `prompt` が**実際の本文**（字コンテ・版面の指示を前置き済み。書き写さない）、`image_size` が目標寸法、`references[].url` が参照画像、`upload` が置き場 |
| 参照を落とす | `references[].url` を `curl -L -o` で手元へ（1 時間で切れる）。`image_gen` の `referenced_image_paths` に渡す |
| 描く | `image_gen(prompt=<返った prompt そのまま + 寸法と向き>, referenced_image_paths=[...])`。`image_gen` に寸法の引数は無いので本文で伝える |
| 戻す | `$CODEX_HOME/generated_images/…` の PNG を `upload.curl` で PUT → `complete_local_generation(derivation_id, upload.storage_path, "image/png")`。着地・材料の線・会話への投稿はサーバ |
| 見て確定 | `get_asset_preview` → `bind_board_sheet` / `bind_material_sheet`（従来どおり） |
| やめる | `cancel_local_generation(derivation_id, reason)`。呼ばないと同じシーンの絵コンテを次に投げられない |

**サーバの生成（`generate_asset` / `generate_material_sheet`）は、Codex のスレッドでは断られる**
（画像を新しく描く仕事だけ。高画質化・背景除去・動画・音声・3D は今までどおり通る）。
断られたら、同じ指定を `start_local_generation` に渡す。`image_gen` で描けなかったときだけ
`cancel_local_generation` で閉じる —— **直近の画像生成がその cancel で終わっているとき、
次の 1 回に限って**サーバの生成が通る（使い切ったら、また手元から試す）。

**動画・音声・3D は従来どおりサーバーの tool**（Codex に描けるのは画像だけ）。
Claude / Gemini / Managed Agent で動いているときは `generate_*` のまま（次節の ComfyUI が
繋がっている場合を除く）。

## ローカルの ComfyUI が繋がっているときの画像は、ComfyUI で描く

デスクトップの ACP で、セッションに **`comfy-mcp`**（利用者の ComfyUI を comfy-cli 経由で
動かす MCP）が繋がっているときは、**エンジンを問わず**画像を ComfyUI で描く。繋がっているか
どうかは最初のプロンプトの `<tool_note tool="comfyui">` で分かる（無ければこの節は使わない）。
利用者の GPU とモデルで動くので費用はかからず、本サービスでは課金しない。Codex で動いていて
ComfyUI も繋がっているなら **ComfyUI を優先**し、`image_gen` は描けなかったときの逃げ道にする。

| 段 | やること |
|---|---|
| 受付 | `start_local_generation({ renderer: "comfyui", asset: <generate_asset と同じ指定> })` または `{ renderer: "comfyui", material_sheet: <generate_material_sheet と同じ指定> }`。返る `prompt` / `image_size` / `references[].url` / `upload` は Codex のときと同じ |
| 確かめる | `server_info` をセッションで 1 回（ComfyUI が起きているか、どの install か）。重い生成の前は `system_stats` で VRAM を見る |
| 描く（速い道） | `generate_image(prompt=<返った prompt そのまま + 寸法と向き>)`。既定テンプレートの text-to-image。参照画像が要らない 1 枚ものはこれで足りる |
| 描く（テンプレート） | 参照画像・特定のモデル・既定で出せない寸法が要るときは `search_templates` → `fetch_template` → `list_workflow_slots` → `set_workflow_slot`（プロンプト・寸法・seed）→ `run_workflow`。参照は `references[].url` を `curl -L -o` で手元へ落とし `upload_file` で ComfyUI の `input` に置く。長い生成は `run_workflow(wait=False)` → `job(action="wait")`。`fetch_template` の `local_check` / `validate_workflow` が通らないテンプレートは走らせない（足りない node は `workflow_deps` → `install_node` だが、第三者コードなので人に確認する） |
| 戻す | `fetch_outputs(prompt_id, out_dir=<作業フォルダ>)` で PNG を落とす → `upload.curl` で PUT → `complete_local_generation(derivation_id, upload.storage_path, "image/png")`。着地・材料の線・会話への投稿はサーバ |
| 見て確定 | `get_asset_preview` → `bind_board_sheet` / `bind_material_sheet`（従来どおり） |
| やめる | 描けない（モデルが無い・VRAM が足りない・テンプレートが通らない）なら `cancel_local_generation(derivation_id, reason)` してから、Codex なら `image_gen`、それ以外は `generate_asset` / `generate_material_sheet` に戻す |

**パートナー API の課金（`partner_generate` / `confirm_spend`）は人に確認せずに使わない。**
動画・音声・3D は従来どおりサーバーの tool。

## してはいけないこと

- **画面を操作しない。** Computer Use・ブラウザ自動操作・スクリーンショットからのクリックで
  Opusia の UI を触らない。アプリにできることは全部 MCP tool にある。**tool が無い・落ちる
  ときは、その旨を人に報告して止まる**（UI を操作して代替しない）
- 人に「アップロードしてください」と頼まない（自分で `register_upload` で戻す）
- 署名 URL を文書や HTML に焼かない（1 時間で切れる。素材は id で渡す）
