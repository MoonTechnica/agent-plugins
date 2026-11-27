# 物語もの以外の段取り（MV / 撮影済み / 説明もの）と、静止画・3D のシーンの関門

`director` §1 の表が指す 3 本。**④ シーンをレーンへ → ⑧ タイムライン → ⑨ 書き出し**は
物語ものと共通で、違うのはその前の段だけ。作法（何が良いか）は `genre-playbook`
（mv.md / explainer.md）と `screenwriter` の references/other-formats.md が持ち、
ここは**誰が・どの順で・どの tool を叩くか**だけ。

### 1.2 MV（`mv`）— 曲が先

| 段 | 何をするか | 道具 | 担当 |
|---|---|---|---|
| M1 | 曲を確定（持ち込み or `text_to_music`） | `search_assets` / `generate_asset` | audio-engineer |
| M2 | **曲の地図**: 機械が拍・小節頭・**鳴っている楽器**を測り、あなたが表から区間・**編成の帯**・**出来事**（全員が入る・引き算・キメ…）を名付け、歌詞とフレーズは文字起こしから取り、**分割の設計（`scene_plan`）はあなたが決める**。歌のある曲は続けて**歌詞の時刻**（行ごとの開始・終了 → 地図の `lyric_lines[]`）。**地図を手で書かない**（検査に落ちたら理由を読んで直す） | `measure_music` → `write_music_map` → `audio_map.v2`（`get_document` で読む）→ `speech_to_text` + `read_transcript` | audio-engineer |
| M3 | 企画（トリートメント・差し替えテスト・6 つの型・**歌詞を画面に出すか**） | `put_document(series_bible.v1)` | screenwriter（`genre-playbook` の mv.md §2） |
| M4 | **小節の表（`mv_check.py --sheet`）の上で**、`scene_plan` をカットに写し（尺は小節数で、シーンの合計と一致させる。**カットごとに受け持つ歌詞の行を決める** —— A メロは行の頭 / 終わりで切り、歌唱カットは行のある小節だけ。**ビート分割は使わない**。**短いシーンを束ねない** —— 編成の変化が境目。画は `genre-playbook` の mv-dynamics.md §7 で誰を映すか決める）、**下書きを区間・フレーズの頭に置く**（`boundaries_sec` = 各シーンの `start_sec` + 最後の `end_sec`。尺で順に並べると整数秒の積み上げで切り替わりが拍から外れる） | `mv_check.py --sheet` → `plan_scenes(starts_scene をフレーズの頭に)` → **`mv_check.py` の所見 0** → `apply_scene_proposal(boundaries_sec=…, audio_map_asset_id=…)` | screenwriter |
| ④〜⑨ | 物語ものと同じ。**確定動画が入ったシーンは `align_scene_cuts` で中のカットを拍に置く**（`compositor`）。歌唱カットは**全区間を `slice_media(ranges=[…], media_type="audio")` で 1 回に切り**、`generate_scene` の `reference_audio` へ。カットの境界は地図の時刻に合わせる | | storyboard / cinematographer / compositor |

物語の型（三幕・ビートシート）は当てない —— MV の構成は曲の区間がそのまま決める
（`genre-playbook` §1「MV だけは尺で選ばない」）。

### 1.3 撮影済み（`footage_edit`）— 素材が先

| 段 | 何をするか | 道具 | 担当 |
|---|---|---|---|
| F1 | 素材を取り込む（尺・ポスター・コンタクトシートは自動） | 人がアップロード | — |
| F2 | **文字起こし**（語ごとの時刻） | `generate_asset(task=speech_to_text, media=[{slot: source_audio, asset_id: <動画>}], canvas_node_id: <document の空ノード>)`（素材から作るので盤面必須） | screenwriter |
| F3 | 内容を把握する | `read_transcript`（窓で読む）/ `get_asset_preview`（コンタクトシート）（誰が何を言うかは文字起こしの時刻つきの行で） | screenwriter |
| F4 | **使う区間を選んでシーンにする** | `plan_footage_scenes(asset_id, segments)` | screenwriter |
| ④ | レーンへ（クリップは区間だけ再生する） | `propose_scenes` / `apply_scene_proposal` | |
| F5 | 字幕・テロップ（`read_transcript` の行頭の時刻がそのまま `data-start`） | `put_composition_bundle` | compositor |
| ⑦⑧⑨ | BGM・整音（素材の音はそのまま）→ タイムライン → 書き出し | 現行 | audio-engineer / compositor |

②b④'⑤⑥ は無い。**生成しないので、費用は文字起こしと書き出しだけ。**
素材の一部を単体の素材として使いたいときだけ切り出す（手元に落として ffmpeg で切り、
`register_upload(source_asset_id=元)` で戻す。タイムラインに区間を置くだけなら要らない）。

### 1.4 説明もの（`explainer`）— 約束が先

サービス・製品・機能の紹介、使い方、会社紹介（採用 / IR）、概念や仕組みの説明。
**人物の動画生成を前提にしない。** 文字と図と**実物の画面**をナレーションに合わせて見せる。
作法の正本は `genre-playbook` の references/explainer.md（構成の型・フック・ナレーション・
1 ビートの文字・前倒ししない画面設計・継ぎ目・字幕・セーフゾーン）。

| 段 | 何をするか | 道具 | 担当 |
|---|---|---|---|
| X1 | **実物を集める。** 画面収録・スクショ・ロゴ・ブランド色・書体・実際の数字は**人に出してもらう**（無ければその枠にプレースホルダを置いて進め、**近似で描かない**）。対象・約束・CTA・尺・縦横を決める | 人がアップロード / `declare_deliverable` | director |
| X2 | **企画書とビート表。** 「誰に・何を約束するか」1 行、構成の型（PAS / 未来の先取り / デモ / BAB / 機能→便益、教えるなら 概念 / 手順 / 列挙 / 事例）、動画全体で 1 回だけ決めること（パレットの役割・動きの文法・止めるビートの配分・禁止リスト）。ビートごとに役・主張 1 文・ナレーション・画・根拠・尺を書く | `put_document(series_bible.v1)` → `put_document(storyboard.v1)`（**画 / ナレーション / 尺 / 音**の 4 列。1 行 = 1 ビート） | screenwriter |
| X3 | **デザインの方針と不足の画像。** ブランド色を役割（地・文字・強調）に割る、書体（日本語は Noto Sans JP が埋め込み済み。`hyperframes-creative` の typography.md）、トーン。ロゴ・製品画像・図版・アイコンの不足を数え、**画像だけ**作る（文字が読める図は `sunburst`） | `put_document(style_guide.v1)` / `generate_asset`（画像） | art-director |
| X4 | **下地（プレート）。** 各ビートの背景になる動画。実物の画面収録は**その区間**（`plan_footage_scenes` と同じ区間指定）。文字と図だけのビートは**ブランド色の背景動画 1 本を全シーンで使い回す**（`set_scene_confirmed` に同じ素材を渡す）。人物や製品の生成動画は「実物が無く、画で見せるしかない」ビートだけ | `plan_scenes` → `apply_scene_proposal` → `set_scene_confirmed` | cinematographer |
| X5 | **ナレーションと BGM。** 原稿は X2 のビート表のナレーション列（数字は読み方で書く。読みは `glossary.v1`）。語の時刻が要るときはナレーションを `speech_to_text` に通す。BGM は声の下で下げる（`compositor` §11） | `generate_asset(text_to_speech)` / `text_to_music` | audio-engineer |
| ⑧ | **重ねる。** 主張の文字・数字・図・端末のモックアップ・ロゴを `graphics` トラックのサブ composition として、**ナレーションの語に合わせて**出す（前倒しして凍らせない）。字幕は 1 トラック。セーフゾーンの中。束ねたら `hyperframes check` | `put_composition_bundle` → `record_check` | compositor |
| ⑨ | 書き出し | `render_composition` | compositor |

②b（キャラ・舞台）⑤（絵コンテ）⑥（人物の動画生成）は無い。
**費用は下地 1 本 + 画像数枚 + ナレーション + 書き出し**で、物語ものの 1 割に満たない。
マスター（絵コンテ用の静止画）も描かない（`wants_master` が false）。

## 2. 静止画を動かすシーン・3D のシーンが入るとき（形式を問わない）

どの形式でも、シーンごとに**作り方**を 1 つ選ぶ: `motion`（静止画を描いて動かす）/
`previz3d`（プリビズを完成の見た目で書き出す）/ `generate`（今の動画生成）。選び方と
形式ごとの既定（イラストが主役の MV・説明ものは `motion`、実写調 / アニメ調の MV と物語ものは `generate`、撮影済みは素材のまま）は
`genre-playbook` の references/motion-stills.md §1。作り方は**字コンテの `supply` 列**に書き、
V コン（G3）で決まったら `set_scene_supply(scene_id, supply)` でシーンに記録する（`None` = 形式の既定）。

**作り方が `motion` のシーンは、確定動画を作らない。** モーションのシーンを字コンテのシーンに結び（`create_previz_scene` の `scene_id`）、`set_scene_supply(scene_id, 'motion')` で記録し、`place_previz_clip` で本編に置けば**完了**（`set_scene_confirmed` は要らない。`resolve_scene_output` は `unrendered=false` と `motion_previz_scene_id` を返し、再生成の判定も撮り直し扱いになる）。mp4 が要るときだけ書き出して確定する。

**`motion` / `previz3d` のシーンが 1 つでもあれば、下の関門を今の段取りに差し込む。**
費用の大半は「何枚描くか」で決まるので、それが決まる G3 より前に本番の絵を描かせない。
★ は人の承認。`report_work` で見るものを伝え、承認まで次へ進まない。

| 関門 | 何を作るか | 道具 | 担当 |
|---|---|---|---|
| G0 | **時刻の基準**（MV は曲の地図、それ以外は台詞・ナレーションの音声と文字起こし） | §1.2 M2 / `speech_to_text` + `read_transcript` | audio-engineer |
| G1（★ モーショングラフィックが主役なら） | 企画: 作品の型、区間ごとの作り方、パレット・書体・動きの文法、**スタイルフレーム 2〜3 枚**。モーショングラフィックが主役の作品（イラストが主役の MV・説明もの・広告・短尺）は、**HyperFrames で本番と同じ組みを作って決めどころのコマを撮り**（compositor の references/style-frames.md。本番の組みはモーション（previz）で 1 シーンにし、タイムラインには 1 本の層で置く）、色・図形・光・書体を人に承認してもらう | `put_document(series_bible.v1)` / `generate_asset`（画像）/ `hyperframes snapshot` + `register_upload` | screenwriter / art-director / compositor |
| G2 ★ | **キャラ・製品・キービジュアル** | 今の設定資料の段 | art-director |
| G3 ★ | **字コンテと V コン**。字コンテ（screenwriter の references/other-formats.md §4）を書き、`motion` のシーンは**ラフの段階からモーションのシーンを作り、`place_previz_clip` で本編の枠へ置く**（粗い絵・文字・ガイドの曲だけでよい。字コンテのシーンの下書きの枠があれば置き換わるので、下書きの動画を別に作らない。本番は同じシーンを直す。previz の `references/motion-graphics.md` §0.5・§2.9）。図形・光・文字で組むカットは**組んで撮ったコマ**をそのカットの絵コンテに貼る（compositor の references/style-frames.md。`generate` のカットには貼らない）、`generate` のシーンは今のグリッド絵コンテ、演出の文字・図は**モーションのシーンに仮組み**（読ませる字幕だけ本編のトラック）。Studio のプレビューで**音に乗せて流す**のが V コン | `put_document(storyboard.v1)` / `set_cut_board` / `put_composition_bundle` | screenwriter / storyboard / compositor |
| G4 | 本番の素材: 承認されたカットだけ本番の絵・層・差分を描く（art-director の references/motion-stills.md）。3D のシーンはプリビズを組む | `generate_asset` / layerize / プリビズ | art-director / previz |
| G5 ★ | **最初の山場**を完成の質で（下の表）。**大きな変更はここで締め切る** | compositor の references/motion-scene.md / 今の `generate_scene` | compositor / cinematographer |
| G6 | 全編 | 同上 | 同上 |
| G7 | 派生: 縦 9:16 / 横 16:9（組み直す）、サムネイル、短い切り出し | 今の書き出し | compositor |

形式ごとの読み替え:

| 形式 | 字コンテの 1 行 | G5「最初の山場」 |
|---|---|---|
| `mv` | 歌詞の 1 フレーズ | 1 コーラス（サビまで） |
| `explainer` | ナレーションの 1 文 | 冒頭のつかみ〜最初の要点（約 30 秒） |
| `anime` / `vertical_anime` | 台詞 1 つ（モーションコミックは漫画の 1 コマ） | 1 話の頭〜最初の引き |
| `short_drama` / `drama_film` / `footage_edit` | `motion` のシーンの区切り | `motion` のシーンを 1 つ完成させる |

- **今の段取り（§1.1〜§1.4）は置き換えない。** G0〜G2 と G4 の中身は今の段と同じで、
  差し込むのは G3（字コンテと V コン）と G5（最初の山場）の承認。
- シーンの確定は作り方を問わず**動画 1 本**。`motion` は**モーションのシーンで組んで 1 本の層で置く**のが既定（人が直せる）。
  確定動画が要るときだけ書き出し（`render_previz_scene`、または層を入れた composition を `render_scene_motion`）、終わった時点でプラットフォームがシーンの確定にする。
  音はシーンの動画に入れない（本編が持つ）。
- **シーンの中で混ぜる**（3D の背景 × 2D のキャラ、生成した芝居の上に歌詞・粒子）は
  `genre-playbook` の references/motion-stills.md §1.2。生成した動画を中ほどの層に置く案は
  縁が崩れやすいので、まず層の順を入れ替えて避けられないか考える。
- 見積り: `motion` のシーンは画像（ラフは 1 枚 1 セント前後、本番は寸法と `quality` で数セント〜数十セント。額は `estimate_asset_generation`）+
  layerize（1 層 $0.03〜）+ 書き出し。動画生成のシーンより 1 桁安い。
