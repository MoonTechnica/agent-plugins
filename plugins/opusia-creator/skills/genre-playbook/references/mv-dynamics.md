# MV の緩急とカメラ —— のっぺりさせない（カット密度・カメラ・動き・テンプレート）

MV の字コンテを書くとき、[mv.md](mv.md) §5 の後に開く。**拍のどこで切るか**は
`film-grammar` の references/beat-sync.md が正本で、ここは**何カット・どの動き・どの強さ**を決める。

出典は `docs/_research/2026-10-02-mv-dynamic-camera-and-motion.md`（Runway / fal の Seedance ガイド、
Kling 3.0 ガイド、Veo 3.1 ガイド、Hailuo のカメラ語彙表、StudioBinder / No Film School、K-pop MV の
撮影記事、『バンドリ！』監督インタビュー、コミュニティの MV プロンプト集ほか）。

## 0. 抑制の既定は「A メロ・ブリッジ・物語の区間」のもの

カメラの既定は物語ものに合わせて**動かさない側**に倒してある（「動かすのは 1/3 以下」
「移動カットは固定で区切る」「1 カット 3〜8 秒」—— `previz` の references/camera-moves.md）。
**これを MV のサビにそのまま当てると、曲が跳ねているのに画が止まる。** 生成した MV が
のっぺりする一番の原因がこれ。

| 区間 | 当てる既定 |
|---|---|
| イントロ / A メロ / ブリッジ / 物語・台詞の区間 | **抑制型**（camera-moves.md の既定のまま） |
| **B メロ（溜め）/ サビ / ドロップ / ダンス / 大サビ** | **エネルギー型**（このファイル） |

**1 カットに付けるカメラの動きは 1 つ**のまま変えない（Runway・Kling・Hailuo の公式がそろって言う。
"A six-second clip has room for one idea of movement"）。勢いは
**「1 カットに動きを積む」ではなく「カットごとに違う動きを、短い尺で、並べる」**で出す。

## 1. 緩急は 5 つの軸で作る

勢いの正体は 5 つ: **① カット密度 ② カメラの速さと種類 ③ ショットサイズの跳躍（ワイド ↔ アップ）
④ 被写体と二次運動（髪・布・粒子・光） ⑤ 編成（誰が鳴っているか = 誰を映すか）**。
区間ごとに ①〜④ の目盛りを下の表で決め、⑤ は曲の地図の編成の帯（`arrangement`）と
出来事（`events`）に従う（§7）。**⑤ は区間名より強い** —— 区間の中でも編成が変われば画を変える。

| 区間 | ① 密度（15 秒あたり） | ② カメラ | ③ サイズ | ④ 被写体・二次運動 |
|---|---|---|---|---|
| イントロ | 2〜3 カット（4〜8 秒） | 遅い 1 本ずつ | ワイド中心 | 環境だけ動く |
| A メロ | 3 カット（4〜5 秒） | static と slow tracking を交互、rack focus 1 回 | ミディアム〜バスト | 小さな芝居 |
| B メロ / ビルド | 3〜4 カット、**4 → 4 → 3 → 2 秒と詰める** | **同じ向きの push in を連ねる**（寄り続ける） | 段階的に寄る | 予備動作・風が強まる |
| **山の直前** | 直前シーンの最後の 1 カットを **1〜2 秒の止め** | **static** | 極端なアップか極端なワイド（次と逆） | 止まる・光が落ちる |
| **サビ / ドロップ** | **5〜6 カット（2〜3 秒）** | **カットごとに別の動き。同じ動きを 2 回続けない** | **2 段以上の跳躍を 1 組以上** | 最大。髪・布・粒子・光の明滅 |
| ダンス | 4〜6 カット、または長回し 1 本（8〜15 秒） | 周回か固定。決めのカウントだけ bump | 全身（足まで） | 振付 |
| ブリッジ | 1〜2 カット（6〜15 秒） | 1 本の長い動き（dolly zoom は 1 曲 1 回） | 極端 | 最小 |
| **大サビ** | **6 カット**（頭だけ 3〜4 秒の大スケール） | 頭に最大スケール（pull back / crane / aerial）。**1 番サビと向きを反転** | 最大の跳躍 | 新しい要素を足す |
| アウトロ | 1〜2 カット（6〜10 秒） | slow pull back / slow crane up | ワイドへ | 減衰 |

- **ずっと同じ強さにしない。** 溜め → 止め → 解放の落差でサビが立つ（"If a video stays at one
  energetic pitch, attention fades."）。止めの次（サビ頭）は**サイズを跳ばす**（極端なアップ → ワイド）
- 尺は小節で決める（beat-sync.md §7）。サビの 2〜3 秒は **1 小節**（120 BPM = 2 秒、90 BPM = 2.67 秒）
  か 2 小節。`duration_seconds = ceil(小節数 × 240 ÷ BPM)`
- **費用で削るときも、サビのカット数から削らない。** 削るのはイントロ・A メロ・アウトロの長さと、
  2 番の A メロ（1 番と同じ画を回してよい）

### 生成するカットは 2 秒以上、1 秒の刻みはタイムラインで

公式の多ショット例は最短 2 秒（Veo 8 秒 4 ショット / Kling 6 ショット / Seedance 15 秒 5 ショット）。
短いショットを詰めると**潰れて 1 ショットになる・省かれる**報告がある。だから:

| 技法 | 作り方（`compositor`） |
|---|---|
| 1 秒のキメ（`scene_plan[].hits_sec`） | 既にある別アングル・別シーンのクリップから切り出す |
| クラッシュズーム / パンチイン | 同軸で寄った画へのアキシャルカット（生成済みクリップの拡大でも可） |
| ホイップパン | 前カットの尻 `camera whips right into motion blur` + 次カットの頭 `camera settles from a whip, entering from the left`。**向きと速さを揃え、ブレの中で切る**（1 カット内のホイップは起きなかった報告がある） |
| フラッシュ / インパクトフレーム | 白 4〜5 コマをカット頭に重ねて抜く / 1〜3 コマの反転 |
| スマッシュカット | 静止カット + 爆発カットを並べる |
| 分割画面・ミラー | 合成 |

字コンテには**タイムラインでやる処理として `note` に書く**（`TL: whip cut to C3`）。生成に頼まない。

## 2. カメラの割り当て

### 2.1 区間ごとの既定（`shot` の語彙）

| 区間 | 使う動き | 避けるもの |
|---|---|---|
| イントロ | `slow crane up` / `slow push in` / `aerial view, slow descent` / `static wide shot` | 速い動き |
| A メロ | `static` ↔ `slow tracking` / `slow push in`。`rack focus` を 1 回 | 毎カット動かす |
| B メロ | **同じ向きの `push in` を連ねる** / `low angle, slow tilt up` | 引き |
| 山の直前 | `static, locked-off` | 何かが動くこと |
| **サビ** | **カットごとに替える**: `orbit` → `low-angle tracking` → `handheld push in` → `crane up` → `high-angle wide` → `static close-up`（最後に受ける） | 同じ動きの連続 / 歌唱アップでの速い orbit |
| ダンス | `wide shot, full body`、`low angle`、`slow orbit around the dancers`、決めで `handheld bump` | 足が切れる構図 / 踊りと逆向きの動き |
| ブリッジ | `very slow orbit` / `dolly zoom`（1 曲 1 回）/ `slow crane down` / `dutch angle` | 速い切り返し |
| 大サビ | 頭に `pull back reveal` / `crane up to a high wide` / `aerial tracking`。以降はサビと同じで向きを反転 | 1 番サビと同じ並び |
| アウトロ | `slow pull back` / `slow crane up` | — |

### 2.2 カットの役割で速さを決める（全区間共通）

| 役割 | カメラの速さ | 理由 |
|---|---|---|
| 口を見せる歌唱アップ | **遅い**（`slow push in` / `static`）。代わりに髪・肩・光を動かす | 激しいカメラは顔を崩す（Hailuo 公式: "Aggressive camera moves are a top cause of face drift"）。口の同期も落ちる |
| 後ろ姿・シルエット・逆光・手元・風景・群衆 | **速くてよい**（`orbit` / `handheld` / `tracking` / `crane` / `aerial`） | 顔が無いので崩れが見えない |
| 全身ダンス | 中（`slow orbit` / `tracking`）。**速さは振りに任せ、カメラは振りに逆らわない** | |

### 2.3 繋ぎ（隣り合う動くカット）

- **向きを揃えるか、意図して逆らう。** たまたま逆向きが一番安っぽく見える。`shot` に向きを書く
  （`tracking right` / `orbit clockwise`）
- 寄り → 寄り → 寄りと**同じ向きの push in を連ねる**のが溜め、サビ頭で**サイズを跳ばす**のが解放
- 2 番サビ・大サビは 1 番の**向きを反転**するか**スケールを上げる**（mv.md §8 の具体形）

### 2.4 シーン間の繋ぎ（絵をぶつ切りにしない）

**シーンは別々に生成されるので、何もしなければ前のシーンの最後と次のシーンの最初は
何も揃わない**（動きの向き・色・光・構図・被写体）。拍に乗っていても、これが
「ぶつ切り」に見える。シーンの境目は**作るもの**であって、勝手には繋がらない。

**① どこで替えるか —— 区間かフレーズの頭、それと大きな変化。** フレーズ（聞き手が 1 まとまりに
聞く単位。歌なら 1〜2 行、だいたい 4 / 8 小節）の途中でシーンを替えると、曲はまだ文を言い終えて
いないのに画面だけが別の場面へ飛ぶ。逆に、**全員が入る・引き算になる・ソロが始まる瞬間
（地図の `events` の magnitude 2 以上）は、短くても必ずシーンを替える**（地図の `scene_plan` が
そう割ってある。束ねない）。時刻は曲の地図の `phrases[].start_sec`。`plan_scenes` ではシーンの
1 カット目に `starts_scene` を立て、置くときは `apply_scene_proposal(audio_map_asset_id=…)` で
確かめる（外れた境界は断られる）。

**② どれだけ変えてよいか —— 曲の切れ目の強さで決める。**

| 曲の切れ目 | 変えてよいもの | 繋ぎの既定 |
|---|---|---|
| **区間の頭**（A メロ → B メロ → サビ、ドロップ） | 場所・時間帯・色・人数、全部 | 動 → 静 / 静 → 動、サイズの跳躍。ドロップはタイムラインでフラッシュかホイップを 1 つ |
| **編成の変化**（全員が入る・引き算・ソロ） | 人数・サイズ・光。場所は残してよい | §7 の表のとおり（全員が入るならサイズを 2 段以上跳ばし、光を開く） |
| **区間の中のフレーズの頭** | **場所・被写体・色と光のうち 1 つだけ** | 残りを受け渡す（同じ場所の別アングル、同じ人物の別の場所 + 動きの継続、など） |
| フレーズの途中 | シーンは替えない（カットは替えてよい） | — |

**③ 境目の 2 カットは組で書く。** 前のシーンの最後のカットと次のシーンの最初のカットは、
**別々に生成されることを前提に、両方の `shot` / `note` に同じ繋ぎを書く**。使う繋ぎを 1 つ選ぶ:

| 繋ぎ | 前のシーンの最後 | 次のシーンの最初 |
|---|---|---|
| **動きの継続** | `tracking right, fast` で終わる | `tracking right, fast` で始まる（向き・速さを揃える） |
| **アクション繋ぎ** | 振り向き始める / 手を伸ばし始める | 振り向き終わる / 手が届く（動作の途中で切る） |
| **注目点の位置** | 顔が画面の右 1/3 | 次の被写体も右 1/3（目線が動かずに済む） |
| **形のマッチ** | 丸い物（時計・瞳・月）が画面中央 | 同じ大きさの丸い物が中央 |
| **色と光の受け渡し** | 赤い光が画面を満たして終わる | 赤い光が引いていくところから始まる |
| **モチーフ** | 小物（花・鏡・糸）に寄って終わる | 同じ小物から引いて始まる（mv.md §10） |
| **遮って抜ける** | 前景（人・柱・手）が画面を横切って覆う | 覆いが抜けると別の場面 |

字コンテの `note` に `→ next: <繋ぎ>` / `← prev: <繋ぎ>` と書いておく（下流の生成とタイムラインが読む）。

**④ 同じ場所でフレーズを跨ぐときは、前のシーンの最後のコマを渡す。** 確定動画の最後のフレームを
手元で切り出し（`get_asset_preview` の url → ffmpeg → `register_upload(source_asset_id=前のシーンの動画)`）、
次のシーンの 1 カット目の `material_asset_ids` に付けて `continues from @<その画像>: same framing, same light`
と書く。光・衣装・立ち位置が揃う。区間の頭（大きく変える所）ではやらない。

**⑤ ディゾルブ（OL）はサビで使わない。** 時間が飛んだ・場所が変わったの意味になり、勢いが止まる。
使うならブリッジ・アウトロの区間の頭だけ。

## 3. 動きを書く（キャラが動かない、を防ぐ）

動かない原因はほぼ 3 つ: **`note` が状態だけ**（`stands` / `looks sad`）、**尺に対して出来事が少ない**
（モデルが余った時間をその場の揺れやループで埋める）、**歌唱アップで口しか動いていない**。

| 決まり | 書き方 |
|---|---|
| **`note` は始点と終点のある動作を 2〜4 拍で** | `plants her feet → grips the mic with both hands → closes her eyes` |
| **1 カットで速くするのはカメラか被写体のどちらか 1 つ** | 速い orbit なら被写体は止め寄り、全力の動作ならカメラは static |
| **被写体の勢いは手足の速さではなく物理の結果で** | `hair whips` / `jacket flares` / `confetti bursts` / `leaves scatter on each impact` / `lights pulse with the beat`。全力疾走・大ジャンプ・激しい格闘は歪みやすい（Runway の Seedance ガイド） |
| **歌唱アップには口以外の動きを 1 つ** | `a loose strand of hair moves in the breeze` / `her shoulders rise with the breath` / `out-of-focus lights drift behind her` |
| **サビには物理の結果を 1 つ以上** | 舞う・弾む・散る・明滅 |
| 速さは語で言い切る | `slow` / `fast` / `snaps` / `explosive`。修飾は 2〜3 個まで（`ai-video-craft` §3） |
| 振付を正確にしたいときは参照動画に振付を渡す | `The character from [Image1] performs the dance from [Video1].`（fal 公式の書き方） |

### アニメ調の MV

- **カメラはフルコマ、キャラは 2 コマ**、**引くときは思いきり引く**、奥行きでスライド幅を変えて
  パララックスを出す（『バンドリ！』監督・3DCG 担当）
- 勢いは**スミア・インパクトフレーム・前景を横切る物**で出す。インパクトフレームは生成させず
  タイムラインで（§1 の表）
- `animated on twos` のようなアニメ用語は公式語彙に無く、効くかは未検証

## 4. テンプレート（`shot` + `note`。120 BPM = 1 小節 2 秒）

`<SINGER>` `<DANCER>` は人物の固定ブロック（外見は毎カット省略しない）に置き換える。
**写すのは形であって中身ではない** —— 場所・小物・光はその曲の企画（mv.md §2）から決める。
以下はその型をそのまま使った例。

### 4.1 B メロ / ビルド（4 カット / 13 秒、最後が止め）

```
C1 4s shot: slow push in, full shot to medium shot, low angle
      note: <SINGER> plants her feet and squares her shoulders; the wind starts to lift her coat
C2 4s shot: push in, medium shot to medium close-up, same direction as the previous shot
      note: she grips the microphone with both hands; her hair begins to whip across her face
C3 3s shot: faster push in to a close-up, slight low angle
      note: she closes her eyes and inhales; the lights behind her dim to a single red glow
C4 2s shot: static extreme close-up, locked-off
      note: her eyes snap open; everything else is still
```

同じ向きの push in を 3 本、尺を 4 → 4 → 3 と詰め、C4 が山の直前の止め。次のサビ頭は**ワイドへ跳ぶ**。

### 4.2 サビ / ドロップ（6 カット / 15 秒）

```
C1 3s shot: crane up from ground level to a high wide shot, fast
      note: <SINGER> throws both arms open as the beat drops; confetti bursts upward around her
C2 2s shot: low-angle tracking shot, moving right, fast, from behind
      note: she runs forward through the crowd; her jacket flares out behind her
C3 3s shot: handheld medium shot, push in
      note: she sings the hook straight into the lens, pointing at the camera on the last word; neon lights pulse behind her
C4 2s shot: orbit around her, clockwise, wide shot, silhouette against strobing backlight
      note: she spins once with her arm extended; the light flashes white as she completes the turn
C5 2s shot: extreme close-up, static
      note: her hand clenches into a fist; sparks drift through the frame
C6 3s shot: high-angle wide shot, slow pull back
      note: she stands still with her head tilted back as the crowd jumps around her; streamers fall
```

6 種類の動き（crane / tracking / handheld / orbit / static / pull back）、サイズはワイド → ミディアム →
ワイド → 超アップ → ワイドと跳ぶ。**速い動き（C2・C4）は後ろ姿・シルエット**、歌唱の C3 は顔へ
handheld の push in だけ。C4 の閃光・C5 の拳はタイムラインでフラッシュ / キメの 1 秒を重ねる候補。

### 4.3 ダンス（全身・カメラは振りに従う）

```
C1 4s shot: wide shot, full body including feet, low angle, slow orbit counter-clockwise around the dancers
      note: <DANCER> and four backup dancers hit the same pose on the downbeat, then drop into a low step; their sleeves snap with each hit
C2 3s shot: static wide shot, eye level, locked-off
      note: the group slides two steps left in unison and freezes on the final count; dust kicks up from the floor
C3 2s shot: medium shot, handheld bump on the hit
      note: the lead dancer snaps her head toward the camera on the last count; her ponytail whips around
```

### 4.4 歌唱アップ（遅いカメラ + 口以外の動き 1 つ）

```
C1 4s shot: medium close-up, slow push in, eye level, soft key light from the left
      note: <SINGER> sings the line with her eyes half closed, then opens them on the last word; a loose strand of hair moves in the breeze
C2 3s shot: close-up, static, shallow depth of field
      note: she sings the sustained note, her shoulders rising with the breath; out-of-focus city lights drift behind her
```

### 4.5 ブリッジ（2 カット / 15 秒、拍から浮かせる）

```
C1 9s shot: very slow orbit, half circle, wide shot, high angle
      note: <SINGER> sits alone on the rooftop edge and slowly lowers her head; snow begins to fall around her
C2 6s shot: dolly zoom on her face, slow
      note: she looks up as the background stretches away behind her; the snow hangs almost still
```

### 4.6 大サビ（6 カット / 15 秒。1 番サビと向きを反転し、頭を最大スケールに）

```
C1 4s shot: pull back reveal, fast, from medium shot to an extreme wide aerial shot
      note: <SINGER> raises the microphone as the whole skyline lights up behind her; fireworks burst on the downbeat
C2 2s shot: low-angle tracking shot, moving left, opposite to the first chorus
      note: she strides along the rooftop edge; her coat streams out in the wind
C3 2s shot: handheld close-up, push in
      note: she sings the hook with her eyes locked on the lens; rain droplets scatter off her hair
C4 2s shot: orbit counter-clockwise, wide shot, silhouette against the fireworks
      note: she spins with both arms out; a burst of light flares across the lens
C5 2s shot: extreme close-up, static
      note: her lips form the last word; her eyelashes catch the light
C6 3s shot: crane up to a top-down shot, slow
      note: she lies back on the rooftop with arms spread as petals swirl down around her
```

イントロ（`aerial view, slow descent` → `static wide` で人物を小さく → `slow push in`）、A メロ
（`static` ↔ `slow lateral tracking` ↔ `rack focus`）、アウトロ（`slow pull back` 1 本）は §2.1 の語彙で組む。

## 5. 公式・コミュニティの MV プロンプトから採ったもの

MV のプロンプトそのものを公式に出しているベンダは無い。コミュニティの MV プロンプト
（GitHub の Seedance プロンプト集、MV 用のスキル、X の作例）は次の形に収束している:

| 型 | 採否 |
|---|---|
| ショットごとに**先頭にサイズ + 角度 + カメラ**、続けて動作 | **採る**（公式 3 社と一致。本リポジトリの `shot` + `note` がこの形） |
| 1 ショット 1 動き。速さはショットを短く・数を増やして出す | **採る**（公式 3 社で一致・高信頼） |
| 速い切り返しは回す画を列挙する（`facial close-ups, hand movements, full-body swaying, side silhouettes`） | 採る（サビのカットの選び方として。§4.2 がこの形） |
| 強さは動詞（`snaps` `explosive` `whip`）と物理の結果（`hair flies` `jacket flutters`）で | **採る**（fal 公式 + コミュニティ 3） |
| `lights pulse with the beat` / `the BGM stops at the climax, the frame freezes` | **試す**（一事例ずつ。参照音声のある生成で拍に乗るかは未検証） |
| `motion blur masking cuts` / `whip pans between angles` | **生成には頼まない**（不発の報告と衝突。§1 のタイムラインの処理で） |
| 販促記事の数値（「エンゲージメント 87% 向上」等） | 採らない（出典なし） |

マルチショットの時刻帯（`[C3] (5-8s)`）は**サーバが `gen_prompt` に書く**ので、字コンテで書き分けない。

## 6. のっぺりチェック（MV の字コンテを書き終えたら必ず）

機械で読める項目（1・2・3・4・13・14・15・17・18）は `screenwriter` の `scripts/mv_check.py` が先に見る
（全員が入る・ドロップで始まるシーンは、区間の energy に関わらずサビとして見る）。
同じスクリプトが**小節数の合計・歌詞の行の途中で切ったカット・歌の無い所の歌唱カット**も見る
（`screenwriter` の references/other-formats.md §2）。
残り（動作の始点と終点・口以外の動き・物理の結果・2 番サビの違い）は自分で見る。

| # | 確認 | 落ちていたら |
|---|---|---|
| 1 | サビのシーンが **15 秒あたり 5 カット以上** | `cuts` を割る（2〜3 秒・1 小節） |
| 2 | サビで**同じカメラの動きが 2 回続いていない** | §2.1 から替える |
| 3 | サビに**ショットサイズの 2 段以上の跳躍**が 1 組以上 | 1 カットを極端なアップかワイドに |
| 4 | サビ・ダンス・大サビの **2/3 以上が static 以外**（A メロ・ブリッジは 1/3 以下のまま） | §2.1 から動きを入れる |
| 5 | **山の直前に 1〜2 秒の止め** | 直前シーンの最後を static に |
| 6 | 全カットの `note` に**始点と終点のある動作** | 状態の `note` を動作に書き直す（§3） |
| 7 | 歌唱アップに**口以外の動き**が 1 つ | 髪・肩・光・背景を 1 つ |
| 8 | サビに**物理の結果**が 1 つ以上 | 舞う・弾む・散る・明滅 |
| 9 | **速いカメラ × 速い被写体**を同じカットに積んでいない | どちらかを遅く |
| 10 | 速いカメラを**顔のアップ**に使っていない | 後ろ姿・ワイド・手元へ |
| 11 | 隣り合う動くカットの**向きが揃っている**か、逆らう意図が書いてある | `shot` に向きを書く |
| 12 | 2 番サビ・大サビが 1 番と**向きかスケールが違う** | 反転・拡大 |
| 13 | ホイップ・クラッシュズーム・フラッシュ・1 秒のキメを**生成に頼っていない** | `note` に `TL:` で書き、`compositor` で作る |
| 15 | **シーンの境目が区間かフレーズの頭**にある（`starts_scene` を立てたカットの頭 = `phrases[].start_sec`） | 境目をフレーズの頭へ動かす。1 回の生成に収まらなければフレーズの頭で割る |
| 16 | **境目の 2 カットに同じ繋ぎ**が書いてある（`→ next` / `← prev`）。フレーズの頭では場所・被写体・色と光の**1 つだけ**を変えている | §2.4 の表から 1 つ選んで両方に書く |
| 14 | 全カットの尺が**小節の整数倍**（サビは 1 小節も可）で、`note` に `♪ n bars` がある | 確定後に `align_scene_cuts` で拍に置くための値。無いとカットの頭が決まらない |
| 17 | **キメの打点（`hits_sec`）の近くにカットの頭**がある | 近くでカットを割り `note` に `cut: kime`。配置後に `align_scene_cuts` で打点へ寄せる |
| 18 | **全員が入るシーンの頭で、前のシーンの最後からサイズが 2 段以上跳ぶ** | 手元のアップから全景へ。初めて全体を見せる瞬間にする |
| 19 | **画に映っている人が、鳴っている楽器と合っている**（§7。ギターだけの区間にバンド全景を出さない） | `arrangement[].parts` を見て `visual` と `shot` を直す |
| 20 | **隣のシーンの画の説明が同じでない**（照明の説明の使い回しは平板の典型） | 地図の保存で断られるが、字コンテでも同じ文を並べない |

## 7. 編成を画に写す（地図の `arrangement` と `events`）

**誰が鳴っているかが、誰を映すかを決める。** 曲は編成で展開する（ギターだけ → 全員 →
鍵盤だけ → 全員）。画がそれに反応しないと、曲が動いたのに映像だけ同じ所に留まる
（2026-10-09 の本番は、全シーンが 2 種類の照明の説明の使い回しになった）。

| 地図の出来事 / 編成 | 画の決まり |
|---|---|
| **単独楽器**（`arrangement` の `parts` が 1 つ。導入のリフ等） | **その奏者だけ**を撮る。手元・横顔・シルエット。全体は見せない。光は 1 灯 |
| **`full_band_in`**（全員が入る） | **ここで初めて全体を見せる**。直前からサイズを 2 段以上跳ばし（手元のアップ → 全景）、光を開く（色数・強さを上げる）。タイムラインでフラッシュを 1 つ足してよい |
| `instrument_in`（1 パートが加わる） | 入った奏者を 1 カット差し込む。全体の構図は変えない |
| `instrument_out` / **`breakdown`**（引き算・落ちサビ） | **画も引き算**。残ったパートの奏者だけ、光を落とす、カメラを止める。人数を減らす |
| `solo_start` 〜 `solo_end` | **奏者が主役**。カメラは奏者を離れない。他のパートはぼかすか画面の外 |
| `kime`（`parts` が 1 つ） | **その奏者だけに光**を当て、打点でカットする。他は暗転か黒 |
| `kime`（全員） | 打点ごとに 1 カット、サイズを交互に（アップ ↔ ワイド） |
| `stop` | 黒か静止。次の音で戻す（戻りの 1 カット目でサイズを跳ばす） |
| `drop` / `build` | ドロップはサビと同じ（§1 の表）。ビルドは寄り続ける（§1） |
| `vocal_in` / `vocal_out` | 歌い出しで歌い手の顔へ、歌が抜けたら手元や風景へ |

- magnitude 3 の出来事は曲の山。**1 曲の中で最も強い画の変化**をそこに置く
- 区間の目盛り（§1 の表）は残る。§7 は「その区間の中で誰を映すか」を決める
- 画の説明（`scene_plan[].visual`）は地図がこの表に沿って書いている。字コンテはそれを
  `shot` と `note` に具体化する（奏者・楽器・光の色）

## 8. まだ実測していないこと（外れたら直す）

- 主力モデルで「15 秒 6 ショット（2〜3 秒）」が指定どおりの数・順で切れるか
  （`get_asset_preview` の `cut_starts_s` で数える。`cinematographer` §3.55）。潰れたら 5 カットに戻す
- ホイップの 2 カット分割が繋がって見えるか
- `lights pulse with the beat` が参照音声のある生成で拍に乗るか
- 速い orbit / handheld で顔が流れる率（Hailuo 以外は記載なし）
