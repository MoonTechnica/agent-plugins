# 静止画を動かしてシーンの確定動画にする（`motion` のシーン）

作り方の選び方・打点の配分・動きの語彙の意味は `genre-playbook` の references/motion-stills.md、
絵（層・差分）の描かせ方は `art-director` の references/motion-stills.md。ここは
**組み立てて、書き出して、シーンの確定にする手順**と、HTML 側の決まり。

## 0. 作る場所は「モーション」のシーン（独立した composition を作らない）

（試作の見せ方・歌詞の時刻の基準・板とカードの使い分けは previz の `references/motion-graphics.md` §2.9）

**描いた絵を動かすシーンは、モーション（`previz`。画面名「モーション」）で 1 シーンに組み、
タイムラインには `place_previz_clip` の 1 本の層（シーンへの参照）として置く。**
`create_composition` で書き出し専用の composition を別に作って HTML を組むのは**禁止**
（人がモーションの画面で開けず、キー・文字の型・出入りを詰められない。本編のシーンにもつながらない。
**試作・スタイルフレーム・「1 コーラスだけ先に」でも同じ**。早く見せたいときも、モーションのシーンに組んで見せる）。

| 中身 | モーションのシーンでの置き方（previz の `references/motion-graphics.md` §2.7） |
|---|---|
| 描いた絵（背景・キャラ・小物。層に分けた絵） | 画像の板 / **2D のカード**（`kind: card`、中身は `place: "card"` のレイヤー）。カメラワーク（寄り・視差）はモーションのカメラと板の奥行きで付ける |
| 絵の揺れ・まばたき・口パク・rig | カードの中身（`place: "card"` のレイヤーの HTML）。時刻は §3 の `face_cues.py` |
| 歌詞・見出し・数字（演出として動かす） | **`text` レイヤー**（型 fade / rise / pop / type / blur / slam × 字 / 語 / 行。人が画面で選び直せる）。型に無い動きだけ `html` |
| 光・粒・帯・グリッチ・図形 | `place: "front"` / `"back"` の 2D レイヤー |
| 字幕・読ませるだけの歌詞の行・クリップ 1 本の寄りやフェード | タイムライン（`compositor`）のまま |

**やってはいけない形**: シーンごとに 1 本の composition に絵・歌詞・光を全部書き込み、`render_scene_motion` で
mp4 にして終わる（人が中を直せない）。mp4 にするのは軽くしたいとき・確定させたいときだけで、既定は層。

## 1. 手順（モーションのシーンで組む）

```
0. 承認された本番の絵・層・差分がそろっていること（art-director）
1. create_previz_scene({ project_id, name, scene_id })   # 字コンテのシーンに結ぶ。2D だけなら床を消す
2. patch_previz_scene で絵の板・カード・layers（text / html）・カメラを足す   # §0 の表
   MV なら **曲の該当区間を `guide: true` の音声レイヤーで入れる**（previz の `references/motion-graphics.md` §2.8。
   人が画面で曲との合い方を確かめられる。入れた曲は書き出しにも本編にも入らない）
3. **本編のタイムラインに置く** = `place_previz_clip`（previz の `references/motion-graphics.md` §0.5。字コンテのシーンの下書きの枠があれば置き換える。置かずに終えない）
4. いつもの検査（SKILL.md §2 の 6）+ §4 を目で見る → record_check
5. 軽くしたい・確定にしたいときだけ render_previz_scene → set_scene_confirmed
   （または clip を入れた composition を estimate_render → render_scene_motion）
```

**以下は、シーンを mp4 にして確定させるとき（手順 5）の決まり。**

- **確定はプラットフォームがやる。** 書き出しが終わった時点で、出力がそのシーンの確定動画になる
  （`set_scene_confirmed` を叩かない）。同じ composition を人が Studio から書き出しても同じに確定する。
  先に投げた書き出しが後から終わっても、新しい書き出しの確定は戻らない。
- 確定に失敗したとき（`get_render_status` の `error.stage` が `scene_confirm`）は、出力は残っているので
  `set_scene_confirmed(scene_id, output_asset_id)` で手で確定する。
- `status='blocked'`（承認待ち）が返ったら投げ直さない。承認されて書き出しが終われば、同じに確定する。

- **シーン用の composition はタイムラインの一覧に並ぶ**（`create_composition` は脚本の器も
  一緒に作る）。名前に「静止画」とシーン名を入れ、本編と取り違えないようにする。
- 尺はシーンの尺に揃える（root の `data-duration`）。確定の尺はシーンの尺の上限を超えられない
  （DB が見る）。
- 直すときは同じ composition に版を積んで `render_scene_motion` を呼び直す
  （composition を作り直さない。束ねが消える）。

## 2. HTML の決まり（レイヤー・カードの中身の HTML）

script は `window.__timelines` ではなく `tl` / `t0` / `root` を使う（previz の `references/motion-graphics.md` §2.7）。

| 決まり | 中身 |
|---|---|
| **音を入れない** | 音・台詞・ナレーション・曲は本編のタイムラインが持つ。シーンの動画は映像だけ |
| **時刻はシーンの頭からの相対** | 打点・口パクの時刻は時刻の基準（曲の地図の `lyric_lines[]` / 拍、台詞・ナレーションは `read_transcript` の語）から**シーンの開始時刻を引いて**書く |
| **入力は時刻 t だけ** | 揺れは減衰する sin、乱数はシード + t、物理は使わない。前のフレームから積み上げない（シークと並列の書き出しで絵が変わる。layer-rig.md §5） |
| 層は変数で受ける | `data-var-src`。層の座標と重なり順は layerize の `meta.layers` から写す（layer-rig.md §1〜§4） |
| **カメラは描いた範囲の中だけ** | 寄りの倍率と移動量は「描いた寸法 ÷ 仕上がりの寸法」の範囲に収める（絵の縁を画面に出さない）。視差で手前の層ほど大きく動くので、`scripts/parallax_plan.py` で層ごとに確かめる |
| **クリップに名前を付け、1 レーンに 1 種類** | `data-name="種類_中身"`。文字のレーンと図形・光のレーンを分ける（SKILL.md §8 の表の下） |
| アニメーションは seek できる形 | GSAP の 1 本の paused timeline か CSS（`hyperframes-animation`）。`infinite` / `forwards` は使わない（§9） |

### 2.1 動きの語彙 → 書き方

| 動き | 書き方 |
|---|---|
| 寄り・引き・パン | CSS / GSAP の transform（`hyperframes-animation` のカメラ系） |
| 視差（2.5D）・寄り・揺れ・ピント送り | **[parallax-camera.md](parallax-camera.md)**（層ごとの 2D の transform を 1 つの関数で書く。余白・拡大率・速さは `scripts/parallax_plan.py`） |
| カメラの揺れ | 画面全体に掛ける（parallax-camera.md §4.3） |
| 髪・服・リボン・旗の揺れ | **[layer-rig.md](layer-rig.md)**（PixiJS の網。実測済み） |
| まばたき・口パク・表情 | §3 |
| 粒子・光・発光・逆光 | **[light-particles.md](light-particles.md)**（多段グロー・リム・漂う粒の canvas）/ §9 の効果（[effects.md](effects.md)） |
| 色ずれ・グリッチ | §9 の効果（[effects.md](effects.md)） |
| 帯・図形・集中線 | **[shape-motion.md](shape-motion.md)** |

### 2.2 混ぜるとき

| 重ね方 | 書き方 |
|---|---|
| 生成・撮影の動画を一番下に敷く | **生成の前に持ち分表を書く**（`ai-video-craft` の references/layer-ownership.md。生成の光・粒子と上の層が二重にならないように）。動画を変数で受け、`muted`（音は本編が持つ）。尺は生成の尺から切って使う。生成の動画は一度作ったら素材として固定し、作り直さない |
| 透過の要る層（切り抜いた絵・粒子の素材） | 透過 PNG を変数で受ける（切り抜きは art-director の references/motion-stills.md §6） |
| 3D の背景 × 2D のキャラ | `place_previz_clip` で層を置き、2D をカードか z で重ねる（SKILL.md §9.3、[illustration-mv.md](illustration-mv.md)） |
| 生成した動画を中ほどの層 | 背景を抜く必要があり縁が崩れやすい。避けられないか先に director へ戻す |

## 3. まばたき・口パク・表情（差分の切り替え）

差分は**同じ寸法の画像を重ね、時刻で 1 枚だけ見せる**（`visibility` を切り替える。フェードさせない）。
時刻は `scripts/face_cues.py` が出し、型は [face-cues.html](face-cues.html)。

```
1. get_document(<曲の地図>) か get_document(<文字起こし>) を JSON に保存
2. python3 <SKILL_DIR>/scripts/face_cues.py --start <シーンの頭の秒> --duration <シーンの尺> \
       --map map.json            # 歌（地図の lyric_lines[] の行の間だけ口が動く）
       # または --transcript transcript.json --speaker aoi=speaker_0 --speaker ren=speaker_1
       --json
3. face-cues.html を写し、3 か所だけ書き換える（寸法と尺 / 差分の img と変数の宣言 / JSON を貼る）
```

| 何 | 時刻の決め方（スクリプトがやる） |
|---|---|
| まばたき | 2〜6 秒おきの不規則な間隔（`--seed` で決まる。書き出すたびに同じ）。閉じは 3 コマ |
| 口パク | 語っている間（歌詞の行、または文字起こしの語の開始〜終了）だけ、0.12 秒開いて 0.08 秒閉じるのを繰り返す。語の頭で必ず開く。**話者ごとに別の口**（`--speaker <口の名前>=<speaker_id>`。名前は img の `data-mouth` と揃える）。語単位なので音（モーラ）までは合わない —— 開閉 2〜3 段で十分 |
| 表情 | 字コンテの「画」で決めた転換点（歌詞・台詞の転換）で、表情の差分を同じやり方で切り替える（区間を JSON に足すか、timeline に `set` を書く） |

- 時刻は**シーンの頭からの相対**で出る。`--start` には曲・本編での絶対秒を渡す。
- カメラや揺れと同じ composition に入れるときは、型の `addFaceCues(tl)` をその composition の
  timeline（1 本）に掛ける。
- 差分の位置がずれていると切り替えで顔が跳ねる。束ねる前に `get_asset_preview` で重ねて見る。
- 2026-11-11 に手元の HyperFrames 0.9.30 で書き出し、まばたき・口の区間の中と外で差分が
  切り替わることを確かめた（Cloud の書き出しでの確認はまだ）。

## 4. 書き出す前に目で見るもの

`timeline_report.py` はまだこれを数えない。**山（打点・突風）と静かなところのコマ**を見る:

- カメラが描いた範囲の外へ出て、絵の縁が見えていないか
- 差分を切り替えた瞬間に顔・口の位置が跳ねていないか
- 長く止める静止画で、拍（語りの形式では文）ごとに何か変わっているか
- 揺れたパーツが体の前へ回り込んでいないか（layer-rig.md §3 の `--back`）
- 全カットが歌詞・語りの切れ目だけで切れていないか（本編のカット境界の話。§10「MV のカット境界」）
