---
name: compositor
description: >-
  素材を 1 本のタイムラインにまとめて書き出す担当。create_composition で書き出し単位を作り、
  put_composition_bundle で HyperFrames の HTML を版として置き、list_composition_variables で
  空枠と打ち間違いを潰し、bind_composition_variable で素材を束ね、render_composition で投入して
  get_render_status で追う。尺・トラック・並びは HTML が正本で DB には持たず、素材は data-var-src で
  受ける。HTML の書き方そのもの（data-* の契約・アニメーション）は HyperFrames 公式スキルが正本。
  画面の効果タブと同じトランジション / エフェクト（ディゾルブ・ワイプ・雨・雪・VHS・フィルム粒子ほか）、
  パララックスの動き、撮影済み素材の区間クリップと字幕の時刻、MV のカット境界（モーショングラフィックは previz で作り 1 本の層で置く）、
  音のミックス（data-fx-chain・data-automation・data-fx-carve）、静止画を動かすシーン、
  テンプレートの棚（list_templates / get_template / save_template）、クリップのモーション
  （data-motion）と人が詰められるつまみの宣言（data-composition-variables）も担当。
  「1 本にして」「書き出して」「枠が埋まらない」「字幕を入れて」「文字を動かして」「トランジション」「BGM がうるさい」「声が聞き取りにくい」「テンプレで」「ゆっくり寄って」「フェードして」で使う。
---

# タイムラインと書き出し

## 0. タイムラインは Premiere、モーションは After Effects
**置く前の問い: つなぐだけ（簡単な字幕程度の載せ物を含む）か、複雑な構成か。** 前者はタイムライン。複雑（映像や絵を画面の中で重ねる・動かす・連動させる）ならモーションの 1 シーンにして、タイムラインには 1 本のクリップとして置く。映像を重ねるための段をタイムラインに足さない。**⚠️ 絵・歌詞・光を動かすシーンを、別の composition に HTML で組まない（試作も）。** 最初から `create_previz_scene` で組み、`place_previz_clip` で 1 本置く。
ここは**クリップを並べて切ってつなぐ**場所。タイトル・図形・帯・演出の文字や歌詞・光と粒・3D は**モーション（`previz`）で 1 シーンに作り、`place_previz_clip` で 1 本のクリップ（シーンへの参照）として置く**（§9.3。部品をトラックに並べない）。
残るのはカット編集・尺・トランジション・音・色・字幕 / 読ませる歌詞の行・`data-motion`・つまみ（線引きは `docs/designs/2026-11-13-timeline-premiere-motion-ae.md` §1）。1 字ずつの文字・粒・光・図形ワイプは**モーションの 2D レイヤー**（previz の `references/motion-graphics.md` §2.7）。動きの作り方は下の手引きのまま（置き場所だけ違う）。

## 1. 正本はどこにあるか

| 持ち物 | 正本 |
|---|---|
| クリップの尺・トラック・並び・アニメーション | **バンドルの HTML**（DB には持たない） |
| どのクリップにどの素材が入るか | `composition_bindings`（DB） |

素材は HTML 側で **`data-var-src="<変数id>"`** として受ける。要素 id ではなく **変数 id** で渡る。ここを取り違えると、束ねたのに反映されない。

## 2. 手順

```
1. create_composition(spec)                     # 書き出し 1 本ぶん（本編は start_timeline が作ってある）
2. put_composition_bundle(spec)                 # 入口は index.html。変数が同期される。
                                                #   空の器への初版以外は base_seq（6 で得た
                                                #   head_seq）を渡す。書く前にサーバが lint を掛け、error なら
                                                #   何も書かずに指摘を返す → 直して置き直す。
                                                #   戻り値の warnings（CSS の禁じ手・空の
                                                #   クリップ・未使用の変数）も読んで直す
3. list_composition_variables(composition_id)   # ★ 空枠と打ち間違いを潰す
4. bind_composition_variable(binding)           # 変数に供給元を束ねる
5. list_composition_variables(...)              # 空枠が無いことを再確認
6. get_composition_bundle(composition_id)       # ★ いまの本文と head_seq を手元へ写す
   python3 <SKILL_DIR>/scripts/timeline_report.py <entry>  # 形と効果の素性を数行で見る（§2.5）
   python3 <SKILL_DIR>/scripts/mix_report.py <entry>       # 音の不変条件（§11.2）。--at <秒> で実効音量
   npx hyperframes check --json --at-transitions <entry>   # サンドボックスで回す
   record_check(composition_id, head_seq, report)          # 合格を残す（L1）
                                                #   本文を書き直したら 6 をやり直す
                                                #   （古い head_seq の合格は効かない）
7. estimate_render(composition_id)            # ★ 書き出しは課金される（見積もる）
8. render_composition(composition_id, title, executor)  # → render_id。**6 の ok=true が現在の
                                                #   head_seq に無いと断られる**。
                                                #   status='blocked' なら承認待ち（人が決める。
                                                #   投げ直さず report_work で伝えて終える）
9. get_render_status(render_id)                 # queued / running / succeeded / failed
```

`*.motion.json`（動きの期待値）はシーンごとに先に書いておく —— `check` が読む。

`put_composition_bundle` の `files` は「パス → テキスト」で渡す（署名 URL に
PUT する経路は無い）。公開 URL の**読み取り**は `web_fetch` でできる —
公式レジストリの取り込みに使う（§8）。書き込み系の HTTP は打てない。

## 2.5 本文は読まずに数える

手元に写した本文は数千行ある。**読むとその分だけトークンを食う**のに、知りたいのは
たいてい尺・クリップ数・トラックの埋まり方・どの枠がどこにあるか、の 4 つだけ。

```
python3 <SKILL_DIR>/scripts/timeline_report.py index.html
  → 42.0 s · 18 clips · 3 tracks · 5 variables
    ! no picture for 2.0 s at 12.0 s (the render shows the background there)

python3 <SKILL_DIR>/scripts/timeline_report.py index.html --json   # 中身が要るときだけ
```

`<SKILL_DIR>` はこの SKILL.md があるディレクトリ。**`python3` で呼ぶ**（実行ビットは
付いていないので `./` では動かない）。標準ライブラリだけで動く。

- 終了コード 0 = 所見なし / 1 = 所見あり / 2 = 読めなかった
- **画の穴は書き出す前に潰す**。絵が 1 枚も出ていない区間は背景（黒）になる。
  L2 の `no_black` でも見つかるが、それは**レンダー代を払ったあと**で、
  直すにはもう一度払うことになる
- 数えるのは `<video>` / `<img>` **だけ**。テロップ（`<div class="clip">`）と音は
  画を埋めないし、空いていても普通なので所見にしない。別のトラックに絵があれば
  黒くならないので、**トラックを跨いで**数える
- `data-start="intro + 2"` のようなクリップ参照が 1 本でもあれば隙間は数えない
  （どこに来るか決まらないものを推測で「隙間」と言わない）
- クリップの作法・CSS の禁じ手・同じトラックでの重なりは**見ない** ——
  `hyperframes check` と `put_composition_bundle` の warnings の担当

## 3. 空枠と打ち間違い

`list_composition_variables` が返す 2 つのフラグが要。

| フラグ | 意味 | 対処 |
|---|---|---|
| `is_placeholder` | HTML が宣言しているのに何も束ねていない**空枠** | 束ねる。放置すると**バンドルの authored src がそのまま出る** |
| `is_orphan` | 束ねてあるが HTML 側に宣言が無い（**打ち間違い**） | 変数 id を直すか束ねを外す |

**空枠のまま `render_composition` を投げない。** エラーにはならず、
プレースホルダの見た目のまま課金された成果物が出てくる。

## 4. 束ねられる供給元

`bind_composition_variable` は 1 つの変数に**次のうち 1 つ**を束ねる。

| 供給元 | いつ使うか |
|---|---|
| シーン | そのシーンの確定動画（`resolve_scene_output`） |
| 素材 | 個別のアセットを直接 |
| スロット | シリーズ共通の素材（差し替えが全話に伝播する） |
| キャンバス | **その盤面で作り込んだ成果物**。確定を差し替えるとこのクリップに伝播する |

**使い回すものはスロットかキャンバスで束ねる。** 素材を直接束ねると、
差し替えのたびに全話の束ねを張り直すことになる。

**タイムラインは並べる面で、ここでは何も生成しない。** クリップに載るのは
盤面（キャンバス）で作り込んで確定したものと、シーンの確定動画（`director` §0
「作る面と、並べる面」）。枠が埋まらないときに直す先は、たいていこのタイムライン
ではなく**供給元の盤面**のほう。

**絵コンテはクリップにしない。** 動画の無いシーンのクリップには、シーンに結んだ
シート（`bind_board_sheet`）のコマが自動で敷かれ、プレビューもそれで流れる。
シート画像を素材として直接束ねたり、絵コンテ用の `<img>` クリップを書き足したりすると
シーンとつながらない複製になり、シートを描き直しても古い絵が残る（`storyboard` §7）。
動画と予定尺の差やシーン間の空白も、絵コンテ画像で埋めない。既存 HTML を編集するときは、
独立したコンテ用クリップを残して動画で覆う方法を使わない（短い動画の終端で画像が露出する）。
絵コンテの表示区間は Studio がシーンのクリップから導出する。

外すのは `unbind_composition_variable(composition_id, variable_id)`。
枠は残り、バンドルの authored src が出る状態に戻る。

## 5. 書き出し

- `render_composition` は**クラウドだと課金される**。**デスクトップのローカルエージェントは
  既定で `executor="desktop"`**（無課金・進捗が見える。「クラウドで」と言われたら cloud）。
  投げる前に 3・6・7 を通す。**現在の `head_seq` の `record_check(ok=true)` が無いと断られる**。
- 投げずに **`status='blocked'`**（承認待ちの id つき）が返ることがある: プロジェクトが
  書き出しを毎回確認する設定か、見積が依頼の予算の残りに入らないとき。人が承認すれば
  プラットフォームが投入する。**自分で投げ直さない**（二重に課金される）。`report_work` で
  「書き出しの承認を待っている」と伝えて終える。
- 書き出しが終わると、プラットフォームが媒体 QC（黒・凍結・無音・音量・尺）と意図の
  判定（L3。コンタクトシートだけを見る視覚モデル。音は聴かない）を回し、`verifications` に残す。採点は reviewer 役（`director` が開く）。
- 解像度・fps は composition が持っているので**渡さない**
  （渡せる作りにすると、投入した設定と composition が食い違ったまま課金される）。
- 完了は `get_render_status(render_id)`。`failed` の理由はここに出る。
- **`running` が続くときは `progress` と `created_at` を見る**。status だけだと
  1 分でも 1 時間でも同じに見える。取りこぼした完了はプラットフォームが数分ごとに
  拾い直すので、待てば終端に変わる。それでも尺に対して不自然に長いなら、
  **待ち続けずに `report_work` で人へ上げる**（止める手段は役の側に無い）。

## 6. 版を積む

バンドルを直したら `put_composition_bundle` を呼び直す。**新しい版**として置かれ、
宣言された変数が同期される。composition を作り直さない
（作り直すと束ねが全部消える）。

**直す前に `get_composition_bundle` で読み、その `head_seq` を `base_seq` に渡す。**
読んだ後に誰か（人の編集・並列の依頼）が書いていれば、何も書かれずに断られ、
**人が触ったクリップの id が文に載る**。読み直し、そのクリップの変更を残したまま
自分の変更を載せて置き直す。人が本編を開いているだけでは断られない。

## 7. シーンの塊はサーバに置かせる（自分で束ねない）

シーンを作ったらレーンへ置くのが構成の段の締め（`screenwriter` §2）。**既定は
`apply_scene_proposal`** —— 画面の「適用」と同じ形（クリップ・変数の宣言・シーンの束ね・
ルートの尺）をサーバが書き、人はいつでも undo で戻せる。空きに収まらなければ `ripple`
（後続をずらす）か `truncate`（入るぶんだけ）。`propose_scenes`（差し出すだけ。並べるか
捨てるかは人がダイアログで決める）は**「提案だけして」と頼まれたとき**の道具。

（**レーンからの依頼（`<scene_request>`）は別扱い**。あちらは `complete_scene_request` を
呼ぶと画面が置くので、どちらも使わない。段取りは `director` §0.2。）

- **シーンの塊を `put_composition_bundle` で書き足さない・`bind_composition_variable` で
  束ねない。** 置くのはサーバ（`apply_scene_proposal`）で、patch は `origin = agent` で残り
  人が戻せる。丸ごと置換は人の編集を上書きする。
- 置く直前に読んだ本文の後に誰かが書いていたら `apply_scene_proposal` は断られる ——
  もう一度呼べば新しい本文の上に置く（人が開いているだけでは断られない）。

## 8. HTML の書き方そのものは公式スキルが持つ

composition の契約（`data-*` の意味・`class="clip"`・トラック・サブ
composition・変数・決定性の規則）は、**HyperFrames 公式スキルが正本**:

| 何を書くとき | 読むもの |
|---|---|
| composition の構造・`data-*`・変数・決定性 | `hyperframes-core` |
| アニメーション・トランジション・アダプタ | `hyperframes-animation` |
| キーフレーム | `hyperframes-keyframes` |
| 音声トラック・音量・尺合わせ | `hyperframes-audio` |
| サブ composition の配線（`data-composition-src`） | `hyperframes-core` の `references/sub-compositions.md` |
| 色・書体・ナレーション・データの見せ方・物語の背骨 | `hyperframes-creative`（`references/house-style.md` と `video-composition.md` を先に。Web ページのような画にしないための正本） |
| トラックの並べ方（シーンはサブ composition・字幕は 1 トラック・種類ごとに 1 トラック）とセーフゾーン | `hyperframes-studio` |

**Studio で読める形に組む**（実測）: クリップに必ず `data-name="種類_中身"`（`歌詞_叫べ`・`図形_斜めの帯`。無いと `hf-tgbx` と並ぶ）。
**1 レーンに 1 種類**: 文字だけ →「テロップ」、文字を持たない div / canvas / svg だけ →「グラフィック」、混ぜると「映像」。
入れ子の層は lint の `nested_structure_needs_subcomposition` に従いサブ composition に分ける。
| モーションの作法（継ぎ目の速度合わせ・前倒ししない・止める） | `genre-playbook` の references/explainer.md §5・§7（上流の内部スキル motion-doctrine からうちの作法へ写した） |

**ここに書き写さない。** 上流は契約の誤りをまとめて訂正することがあり
（2026-08-24 の #3468 で、コードと食い違っていた記述が一斉に直った）、
写しは黙って古くなる。

**うちだけの事情**（公式スキルが知らないこと）:

- 書き出しは CLI ではなく `render_composition`（`executor` でこの PC / クラウド）。透過が要る中間素材は `video_format="webm"`。
  **`npx hyperframes render` は使わない**（`check` / `lint` はサンドボックスで回せる。§1 の 6）。
  `hyperframes-cli` の書き出し手順はそのまま使えない
- ローカルにプロジェクトのディレクトリは無い。HTML は
  `put_composition_bundle` の `files`（パス → テキスト）で置く
- 素材はファイルではなく**変数**で受ける（`data-var-src="<変数id>"`）
- **クリップの作法はサーバが揃える。** 尺の 3 属性（`data-start` /
  `data-duration` / `data-end`）と、可視要素の `class="clip"`・`<video>` の
  `muted` + `playsinline`・`src` 属性は、保存前に
  `put_composition_bundle` が足す（`core.composition.contract`）。
  書き漏らしても直るので、そこを気にして書き方を歪めなくてよい。
  **音を持つ映像だけは `data-has-audio="true"` を自分で書く** —— 宣言があれば
  `muted` は足されない（無いと音が消える。宣言と `muted` の併記は lint の error）。
  **MV で原曲だけを鳴らすなら、生成クリップには書かない**（それだけで消音される。
  素材から音を剥がし直さない）
- **`src` に署名 URL を自分で入れない。** 保存時は空のままでよく、**投入の直前に
  サーバがその時点の署名 URL を `src` へ焼き込む**（`core.render.bake`）。
  署名 URL は 1 時間で切れるので、手で入れると投入までに腐る。
  `media_variable_src_no_fallback` の警告が出ても、これで塞がっている
- **composition ルートの `data-duration`（= 書き出される長さ）も保存時にサーバが
  最後のクリップの終端へ合わせる**（`core.composition.duration`。Final Cut Pro と
  同じで、尺は設定ではなくクリップから決まる）。ルートに大きめの値を書いても
  末尾に黒は残らないし、小さめに書いてもクリップが切れることはない。
  クリップが 1 本も無い・`data-start` が参照指定（`intro + 2`）のときは触らない
- **ただし可視クリップは composition ルートの直下に置くこと。** 入れ子は
  DOM の組み替えが要るので直せず、**422 で断られる**。装飾のラッパーは
  クリップの内側へ入れる（`<div class="clip">` の中に包む）。
  `<video>` / `<audio>` は framework が深さを問わず再生するので例外

## 9. 効果（トランジション / エフェクト / 入場アニメ）

Studio の効果タブと**同じ効果**を入れられる（全部 **CSS アニメーション**。ランタイムが seek するので GSAP timeline は要らない）。

| 種類 | 何 |
|---|---|
| トランジション | **`apply_transition` で当てる**（手で書かない）。`dissolve` / `wipe` / `mix` / `whiteFlash` / `zoomIn` / `motion` / `rgbShift` + 同梱 `x-iris` / `x-clock` / `x-blinds` + 自作 |
| エフェクト | `rain` / `snow` / `fog` / `vhs` / `filmGrain` / `afterimage` / `clone` |
| 入場アニメ | `fadeIn` / `slide` / `zoom` / `bounce` / `rotate` |

**トランジションは `apply_transition(composition_id, target, key)` を呼ぶ**（外すのは
`remove_transition`、使える key は `list_transitions`、**足りなければ `define_transition`** で
新しく作る）。複製クリップ・レーン・`z-index`・素材の開始位置・素性の属性は**画面と同じ変換**が組む。
自分で書くと黒に落ちる / 画面から外せない。選び方・作り方は film-grammar の
`references/transitions.md`（既定は**ただのカット**）。他の効果は下のとおり自分で書く。

**クラス名・keyframes 名・属性は変えない**（人が効果タブから外せなくなる）。CSS は使うぶんだけ貼る。

**エフェクトの複製・オーバーレイには `data-studio-fx-key` と `data-studio-fx-of`（持ち主の
`data-hf-id`）を必ず書く。** 無いと画面は**ただのクリップ**として扱い、人が外せない。

3 つだけ絶対に守る（守らないと**書き出しだけ**壊れて、プレビューでは気づけない）:

- **擬似要素（`::before` / `::after`）にアニメーションを置かない** — seek されない
- **`animation-iteration-count: infinite` を使わない** — 全体尺が無限に伸びる
- **`animation-fill-mode: forwards` を使わない** — クリップ自身の `filter` / `opacity` を潰す
  （例外: `data-motion` の `m-<hash>-…` は `clip_motion.py` が `forwards` で出す。`references/clip-motion.md`）

効果ごとの貼り方と CSS 本体は [references/effects.md](references/effects.md)
（**画面側の実装から自動生成**しているので、ここが唯一の正本）。

### 9.1 髪・服を揺らす（レイヤーで付ける二次運動）

「髪をなびかせて」「スカート / マント / リボン / 旗を揺らして」は動画生成ではなく、
**`seedream-5-layerize` で絵をパーツに分け、パーツだけを WebGL の網で曲げる**
（パペットツールと同じ考え方。絵が崩れず、書き出しが決定論になる）。
手順・パーツの種類・踏んだ罠は [references/layer-rig.md](references/layer-rig.md)、
型は [references/layer-rig.html](references/layer-rig.html)、設定は `scripts/rig_parts.py`。

### 9.2 静止画を動かしてシーンの確定にする（`motion` のシーン）
描いた絵（層・差分）を視差・寄り・揺れ・差分の切り替えで動かすシーンは、**モーション（`previz`）で 1 シーンに組み、
`place_previz_clip` の 1 本の層で置く**（§0・§9.3）。**書き出し専用の composition を別に作って HTML を組まない**
（試作でも同じ。人がモーションの画面で開けない）。歌詞・文字・光・図もそのシーンの 2D レイヤーに入れる。手順・相対時刻・
カメラの範囲・まばたきと口パク・混ぜ方は [references/motion-scene.md](references/motion-scene.md)。
層の視差・寄り・揺れ・ピント送り（2.5D のカメラ）は [references/parallax-camera.md](references/parallax-camera.md)（検算は `scripts/parallax_plan.py`）、
斜めの帯・図形・集中線・図形ワイプは [references/shape-motion.md](references/shape-motion.md)、持ち込みの 1 枚で文字を被写体の後ろへ回すのは [references/subject-text-layering.md](references/subject-text-layering.md)、光・粒・グロー・逆光は [references/light-particles.md](references/light-particles.md)。
本番の前に見た目を決めるときは、組んで決めどころのコマを撮る（[references/style-frames.md](references/style-frames.md)）。
まばたき・口パクの時刻は `scripts/face_cues.py`、型は [references/face-cues.html](references/face-cues.html)。

### 9.25 人が詰められる形で作る（モーションとつまみ）

クリップ 1 本の基本の動き（寄る・フェード・位置ずらし）は **`data-motion`**
（[references/clip-motion.md](references/clip-motion.md)。CSS は `scripts/clip_motion.py` が作る）。
数値・色・on/off になる見た目の値は **`data-composition-variables` で宣言**する
（[references/knobs.md](references/knobs.md)）。人が画面で詰めた値は消さない。

### 9.3 立体の 3D（キャラ・カメラ）に 2D を重ねる
**モーションを作ったら本編に置くまでが仕事**（`place_previz_clip` 1 回。手順は previz の `references/motion-graphics.md` §0.5。置かずに報告しない）。

立体のキャラ・小物・カメラワーク・3D の空間の看板や語の単位の文字（画像と文字の板）は**プリビズの文書で組み**
（previz スキル）、本編へは **`place_previz_clip` で置く。それだけ**（`get_previz_clip` はクリップの文字列を読むだけ。字コンテのシーンの下書きの枠があれば置き換わる）。
クリップはシーンへの**参照**（`data-previz-scene`）で、層のファイルもモデルの変数も `bind_composition_variable` も要らない
（プレビューも書き出しも、シーンの最新から層を組む）。`start` でシーンの途中から置け、同じシーンは何本でも並べられる
（id は重ねない）。**シーンを `patch_previz_scene` で直せば、置いたクリップはそのまま変わる**（置き直さない）。**直す前に `list_previz_scene_uses` で、同じシーンを置いた全タイムラインを確かめる**（そこ全部が変わる）。1 本だけ変えたいなら `detach_previz_clip`（複製して付け替えまで 1 回。詳しくは previz スキルの `references/motion-graphics.md` §5.1）。置いてあるモーションの一覧は `timeline_report.py` の `motion_layers`。**`get_composition_bundle` は層を展開して返す**ので、置いたら `hyperframes check` のあと各層の中間点を `hyperframes snapshot --at <秒>` で見る（展開した層のファイルは書き戻さない）。
**重なり順は器の `data-previz-z`（既定 10）**: 奥の 3D → 2D のカード → 手前の 3D（`front`）をプレイヤーが積む。
人が詰めたカメラのつまみは置き直しても消さない（previz の `references/motion-graphics.md` §5）。
2D を 3D の奥に置くなら z-index 10 未満（`transparent: true` にして 3D の背景を抜く）、全部の手前なら 110 以上。
器に z-index を書かない。パペットや歌詞の 2D を 3D の空間に並べる（イラスト MV・ステージの組み）のは [references/illustration-mv.md](references/illustration-mv.md)。three.js を自分で書くのは文書で作れないときだけ
（[references/three-by-hand.md](references/three-by-hand.md)）。物理・粒子・ジオメトリノードはエージェントが
Blender（bpy）で透過の動画にして重ねる（[references/blender-by-hand.md](references/blender-by-hand.md)）。

## 10. 撮影済みクリップ・字幕・MV の境界

### 撮影済み素材のクリップ（`footage_edit`）

`plan_footage_scenes` で起こしたシーンは**素材の区間**を指す（`media_start_ms` /
`media_end_ms`）。`apply_scene_proposal` と画面の適用は、その区間を
`data-media-start` に写し、尺を区間長にする。音を持つ映像は `data-has-audio="true"`
（`muted` を書かない）。自分でクリップを書くときも同じ形にする:

```html
<video data-var-src="<変数id>" data-start="12" data-duration="3.4"
       data-media-start="12.5" data-track-index="0" playsinline data-has-audio="true"></video>
```

### 説明もの（`explainer`）のレイヤー

下地（プレート）の動画は**シーンのクリップ**で、置くのはサーバ（§7。背景 1 本を
全シーンで使い回していてもクリップはシーンごと）。自分が書くのは**その上の層**:

| 層 | 書き方 |
|---|---|
| 文字・数字・図・端末のモックアップ・ロゴ | **ビートごとに 1 つのサブ composition**（`files` に `frames/NN-<役>.html` を置き、ルートからは `<div class="clip" data-composition-src="frames/NN-….html" data-track-kind="graphics" data-start=… data-duration=…>` で読む。配線は `hyperframes-core` の `references/sub-compositions.md`）。ルートに入れ子の markup を直接書くと、画面側で 1 行の不透明なクリップになり人が部分的に動かせない |
| 字幕 | **`data-track-kind="captions"` の 1 トラック**に全部（下の「字幕・テロップ」） |
| 実物のスクショ・ロゴ | 変数で受ける（`data-var-src`）。**文字が読める画像は元の比率のまま**（`object-fit: contain`）。`cover` で切ってよいのは装飾の背景だけ |

守ること（正本は `genre-playbook` の references/explainer.md §5・§7。ここは HTML 側の要点）:

- **ナレーションの語に合わせて出す。** 1 ビートの中で t=0 に全部出さない。出し終えたら
  止める（無意味な呼吸・パン・押し込みを足さない）。語の時刻は `read_transcript`
  （ナレーションを `speech_to_text` に通したもの）か、ビート表の尺配分から
- **継ぎ目は速度を合わせたカット。** 同じ軸・同じ向き・同じ速さで、両側とも動いている
  最中に切る。文字スケールのぼかしは最大 10px、全画面の面は 18〜20px、ラッパーに掛ける
- **文字は 40px 未満にしない**（1920×1080 で見出し 72〜96px、本文 48px）。日本語は
  `Noto Sans JP`（埋め込み済み。`hyperframes-creative` の `references/typography.md`）
- **セーフゾーン**: 見えるものはアクションセーフ（内側 90%）、字幕と主要な内容は
  タイトルセーフ（内側 80%）。ガイド線を HTML に入れない
- 効果（§9）は使ってよいが、`infinite` と `forwards` の禁止はここでも同じ。
  アニメーションは GSAP の 1 本の paused timeline か CSS で、seek できる形に
  （`hyperframes-animation`）

### 字幕・テロップ

原稿は `read_transcript` の行（`[MM:SS.s-MM:SS.s] 本文`）。**開始の時刻がそのまま
`data-start`**、終了までが尺。クリップの中で素材の途中から再生しているときは
「素材の時刻 − `data-media-start` + クリップの `data-start`」に読み替える。

書き方（上流 `embedded-captions` の字幕モデルと `hyperframes-studio` §2 を写した）:

| 決まり | 中身 |
|---|---|
| **1 トラック** | 字幕は `data-track-kind="captions"` の **1 トラック**に全部載せる（1 つのサブ composition のホストに字幕の塊を順に）。行ごとにトラックを増やさない。他の種類と同じトラックに混ぜない |
| **帯を空けない** | 字幕は映像の**上に重ねる層**で、下に帯を取って本編を上へずらすものではない。本編は画面の真ん中（y = H/2）に組む。字幕が座る下端 5〜8% の中央に URL や注記のような**小さな読ませる文字**だけ置かない |
| **rail が既定、embed は希少** | ふつうの台詞は読みやすい下段の字幕（rail）。見出しになる 1 語を画面中央に大きく出す（embed）のは **1 ビートに 1 回まで**、続けて 2 つ出さない。全部を embed にするのが一番多い失敗 |
| 置き場 | 横型はタイトルセーフ（内側 80%）の中、縦型は `vertical-shortform` のセーフゾーン |

### MV の歌詞

出すかどうか・どこまで出すかは企画が決めている（`genre-playbook` の mv.md
「歌詞を画面に出すか」）。**出さない企画なら何も置かない。** 時刻と文字の正本は
曲の地図の **`lyric_lines[]`**（`get_document(<地図>)`）。文字起こしの本文は使わない
（聴き取りの誤字が混ざる）。

| 決まり | 中身 |
|---|---|
| 出る・消える | 行の `start_sec` の **1〜2 コマ前**に出し、`end_sec` ＋ 0.2〜0.5 秒で消す。次の行まで出し続けない（間奏に文字が居残る） |
| 1 枚の量 | 1〜2 行。長い行はフレーズの切れ目で割る（語の途中で割らない） |
| 置き場 | 顔と口を覆わない。縦型はセーフゾーン（`vertical-shortform`） |
| 読める | 縁取りか影を付け、背景の明暗に負けない。日本語は縦組みも選べる |
| 動き | 拍で出す・語頭で 1 文字ずつ出す・サビ頭で大きく叩きつける、など演出として動かす。**全行を同じ出方にしない**（要所の行だけ強く） |
| `lyric_lines[].source` が `agent` | 文字起こしに無く、手元の歌詞から補った行。精度は保証できない。人に伝える |

**出入りの秒は手で測らない**: `python3 <SKILL_DIR>/scripts/lyric_check.py <歌詞の載ったファイル> --map <地図の doc>`
（遅れて出る・早すぎる・消えのずれ・次の行への居残り・載っていない行）。**輪・円弧・渦巻き・波に沿った文字は `scripts/text_path.py`**（references/kinetic-2d-recipes.md §0）。**歌詞を語に割って四隅・縦組みに面付けするのは `scripts/lyric_layers.py`**（references/lyric-composition.md）、**文字を散らす・幾何学的に並べるのは `scripts/glyph_layout.py`**（references/glyph-layout.md）。

書き方は上の「字幕・テロップ」の表（字幕的に出す）/ `hyperframes-animation`（文字を動かす）。
**演出として動かす文字・歌詞はモーションで作る（§0）。** 動きの作り方は先に [references/text-motion.md](references/text-motion.md)（動きの強さ・気持ちと意味からの選び方・
動きの語彙をここで何で作るか・計画の表・光の点滅）。歌詞以外の字幕・タイトル・説明動画の文字も同じ。
**見せる行は字幕にせず演出として組む**（明朝・筆の書体、縦組みと散らし組み、巨大な字の叩きつけ、
人物の後ろに回す、CSS 3D / three.js の奥行き）: [references/lyric-motion.md](references/lyric-motion.md)。

### MV のカット境界（拍に正確に置けるのはここだけ）

曲は 1 本のオーディオトラックに丸ごと置く（HyperFrames は曲側を伸縮できないので、
**音が先**で画を合わせる）。切る場所と作法の正本は `film-grammar` の
`references/beat-sync.md`。ここで守ること:

- **シーンとカットの切り替わりは必ず拍の上に置く**（MV の既定。拍から外れた切り替わりは違和感として
  目立つ）。シーンの頭は `apply_scene_proposal(boundaries_sec=…)` で小節頭に置いてある。**確定動画が
  入ったシーンは `align_scene_cuts` を呼ぶ** —— 実測したカット（`cut_starts_s`）ごとにクリップを割り、
  各カットの頭を `cut_starts_sec` に置く。`cut_starts_sec` = シーンの頭 + 字コンテの累積小節 × 小節秒で、
  **`screenwriter` の `scripts/mv_check.py` が `list_cuts` から `scenes[].cut_starts_sec` として出す**
  （手で掛け算しない）。キメに寄せるカットだけ、その要素を `hits_sec` の打点に差し替える。返りの `short_by` > 0 のカットはショットが枠より短い（次のショットが拍より
  先に出る）ので、そのカットを 1 秒長く撮り直すか、前後の小節配分を変えて呼び直す。実測のカット数が
  字コンテと合わない（閃光で余計に切れた等）ときは、見て数えた開始を `media_cut_starts_sec` に渡す
- **「機械的」は拍から外さずに避ける**: どの拍で切るかを散らす（小節頭 / 2・4 拍目 / キメの打点）。
  字コンテの切る根拠（`cut: beat / lyric "word" / action`）は**どの拍を選ぶか**に使う: `beat` → その拍、
  `lyric` → `speech_to_text` の語頭に最も近い拍、`action` → 動きのピークが拍に来るよう選ぶ。
  1〜2 コマ先行（0.04〜0.08 秒）させるなら全カット一律に引く
- **区間の頭 `sections[].start_sec` と境目の出来事 `events[].at_sec`（magnitude 2 以上）は根拠に関わらず
  最上位**。拍で切る区間でも**既定は 1〜2 小節**で、毎拍はサビの決め所だけ。ブリッジは拍から浮かせる
- **拍から外すのはユーザーが求めたときだけ**（区間先行などの技法は beat-sync.md §4）
- **拍は計測をそのまま使う**（`get_document(<analysis_asset_id>)` の doc を `beat_grid.py --analysis` に
  渡す。小節頭・拍は**実測**で、BPM から外挿しない）。毎拍コマに丸めて足し込まない。`data-start` は
  小数秒のまま書く。地図の時刻も計測の小節頭（コマへの丸めぶんの ±0.05 秒だけ許される）
- **キメ（`scene_plan[].hits_sec`。`events[]` の `kime` / `stop`）は格子ではなく打点に合わせる**:
  1 ヒット = 1 カット（または光・動作のピーク 1 つ）、`data-start = hit − 0.04〜0.08`。時刻は計測の
  打点。カットは生成し直さず**既にあるクリップを別アングル・別シーンから回す**。**1 パートだけのキメ
  （`parts` が 1 つ）はその奏者だけに光を当てる**（`genre-playbook` の mv-dynamics.md §7）
- 生成クリップは整数秒で**少し長く**できている。`data-duration` は小節の実秒（128 BPM 2 小節 =
  3.75）にし、余りは `data-media-start` で捨てる。**動きのピークが拍点に来るよう**
  `data-media-start` を調整する（ピークのコマは `get_asset_preview` のコンタクトシートで読む）
- **編成の帯（`arrangement[]`）が変わる小節で画も変える**: 誰が鳴っているかが変わったのに同じ画が
  続くと、曲が展開したのに映像が置いていかれる（mv-dynamics.md §7）
- 歌なしの区間に歌唱カットを置かない。参照音声は小節頭から小節頭まで切られているので、
  そのクリップの `data-start` はその小節頭

```
python3 <SKILL_DIR>/scripts/beat_grid.py grid --analysis <計測.json> --from 52.0 --to 80.0 \
  --bars 2 --lead 0.06            # 計測の小節頭から境界の時刻列（t_beat / t_cut）。--fps 24 でコマへ
python3 <SKILL_DIR>/scripts/beat_grid.py fit --analysis <計測.json> --bars 2 --fps 24
  → 2 bars = 3.75 s → generate 4 s, trim 0.25 s, 90.0 frames
python3 <SKILL_DIR>/scripts/beat_grid.py nearest --analysis <計測.json> --time 61.3
  → 計測の拍で最も近いものと、小節内の何拍目か（ピークをどの拍に寄せるか決めるとき）
```

## 11. 音のミックス（組むのは自分、触るのは人）

**画面には効果を選ぶ道具が無い。** プロパティパネルに出るのは
「いま何が効いているか」の読み取り専用の一覧で、**1 行 = 名前 + つまみ 1 本 +
切るスイッチ**しかない。効果を選ぶ・順番を決める・周波数や比を詰めるのは
**こちら側の仕事**で、人がやるのは「聞いて、強すぎたら弱める、要らなければ切る」。

書き方（`data-fx-chain` / `data-automation` / `data-fx-carve` の JSON、効果の
一覧と値域、症状 → 手当ての表）は **`hyperframes-audio` が正本**。ここに
書き写さない。以下は**うちの画面と噛み合わせるための約束**だけ。

### 11.1 きっかけ → やること

| きっかけ | やること |
|---|---|
| BGM を置いた / 置いてある BGM の下に声が入った | **カーブを書く**（`sources` / `strength: 0.25` / `enabled: true`）。**候補の声が複数なら書かずに人へ渡す**（間違った相手に道をあけたまま気づけない） |
| 声のクリップを置いた | ばらつきが大きければ `levellingResult`、素の録音なら `voice-clean`。**両方は当てない** |
| 声か BGM が動いた / 差し替わった / 尺が変わった | **解析し直す**（`fromCarve` のノードとレーンだけ差し替わり、手作りは残る） |
| 人が「こもる」「聞き取りにくい」と言った | 症状 → ジョブ / プリセットの表（`hyperframes-audio` の `references/presets.md`）で選ぶ |
| 効果が無いものを求められた（ディエッサー等） | **無いと言い、正直な代替を出してから当てる** |

### 11.2 守る不変条件（外すと画面側で表現できなくなる）

1・5・6・9 と `data-has-audio` + `muted` の併記は `scripts/mix_report.py` が本文から見る（書いたら回す）。

| # | 守ること | 外すと |
|---|---|---|
| 1 | **ノードに `label` を必ず付ける** | 画面は生パラメータを出さないので、**名前が無いと何のつまみか説明できない**。「名前のない処理」として並ぶだけになり、人は切ることしかできなくなる |
| 2 | **ワンノブを持つ効果（compressor / gate / saturate / reverb / bitcrush）は、ワンノブの曲線上の値で書く** | `audioFxProfileStrength` の逆算がずれ、**画面のつまみの位置が実際の音と合わなくなる** |
| 3 | **カーブは BGM に書く。声には書かない** | 自分を相手にしたカーブはバグ |
| 4 | **`fromCarve` / `fromLeveller` / `fromPreset` を手で付けない** | 次の解析で「自分が書いたもの」と見なされて消される |
| 5 | **`data-playback-rate ≠ 1` のクリップに fx / automation を付けない** | **プレビューで音が丸ごと消える**（ランタイムが `muted` にする） |
| 6 | **オートメーションは `AudioParam` のあるパラメータにだけ引く** | **黙って何も動かない**。worklet 系（compressor / limiter / gate / bitcrush）は 1 つも持たないので、時間で変えたいなら手前に `gain` を置いてそちらへ引く |
| 7 | **レーンで動かすノードのパラメータに、意味のある静的値を書かない** | 画面はレーンが乗った行のつまみを出さない（書いても再生の頭で上書きされるため）。`levellingResult` と同じく `0` を種にする |
| 8 | **チェーン / レーン / カーブ設定は 1 回の版でまとめて書く** | 版をまたぐと、**チェーンだけ新しくてレーンが古い状態**が人の手元に出る |
| 9 | **信号順を守る**（引く → 整える → 関係 → 色付け → 天井） | 画面は上から順に見せるだけなので、**順序の意味はこちらの責任**。天井（limiter）の後ろに何かを足すと、それは天井ではなくなる |

### 11.3 道具は足さない

**MCP に新しい tool は要らない。** composition の文書をまるごと書き戻すので、
属性を書けばプレビューにも書き出しにも届く。人からの直したい要望は、画面の
「相談する」からそのまま会話に乗る。

## 12. テンプレートの棚（引いてから書く、気に入られたら残す）

**タイトル・ローワーサード・字幕・転換を書く前に `list_templates` を引く。**
「いつもの」「前と同じ」「ブランドの」「テンプレで」と言われたときは必ず。
棚には人が選んで保存したものと、前のセッションの自分が残したものが並ぶ。

- 置くとき: **`place_template`**（画面のドロップと同じ展開。テンプレートのクリップが
  本編に普通のクリップとして並ぶ）。**自分で HTML を書き換えない** —— id・時刻・レーン・
  CSS の付け替えは機械の仕事で、手でやると間違えても画面だけが崩れる。`values` に変数 id →
  文言、`track_index` は省けば新しいレーン（重ならない）。戻りの `form` が `host` なら
  スクリプトで動くテンプレートで、サブ composition 1 つとして置いてある。
- 残す・作るとき: `<template>` 形の block を書いて `save_template`。文言と色は変数に、
  素材枠は作らない、`description` は場面。直しは `replaces`、後始末は `delete_template`。
- 動き: **既定は CSS アニメーション**（置くと普通のクリップに展開され、1 本ずつ直せる）。
  **GSAP は禁止ではない** —— 文字単位の演出や連鎖の振り付けなど CSS で足りない動きは GSAP で書いてよい。
  ただし host 形（ブロック 1 本）で置かれ、1 本ずつは直せない。GSAP は CDN の `<script src>` で
  読み込む（本体を貼り込むと lint の error）。書き出しはどちらも通る。
- 素材枠があるテンプレートは置いても空のまま。サブ composition を含むものは `place_template` が断る。
- 人が会話へ棚のタイルを添えると、発話の末尾の `<attachments>` に
  `- template id=<stock_items.id> name="…"` が載る。その id で `get_template` を引く
  （名前で探さない — 同名があると別のものを置く）。

置き方・作り方の規則と理由は [references/templates.md](references/templates.md)。
