# ショットとカメラワークの用語表

絵コンテに書く日本語表記と、生成プロンプトに書く英語表現の対応。
**日本語の用語をそのままプロンプトに書かない** — モデルは英語のカメラ用語で
学習しているので、`アオリ` より `low angle shot` のほうが確実に効く。

## 1. ショットサイズ

| 絵コンテ表記 | 略 | プロンプト表現 | 画角 |
|---|---|---|---|
| 大ロング / 遠景 | ELS | `extreme wide shot` | 場所全体。人は点 |
| ロング / 引き | LS | `wide shot` | 全身 + 背景 |
| フルショット | FS | `full shot` | 全身が枠に収まる |
| ニーショット | KS | `medium full shot`（膝上） | 膝から上 |
| ミディアム / ウエスト | MS | `medium shot` | 腰から上 |
| バストショット | BS | `medium close-up` | 胸から上 |
| アップ | CU | `close-up` | 顔 |
| 大アップ | ECU | `extreme close-up` | 目・口・手・物 |
| 2 ショット | — | `two shot` | 2 人を 1 枠に |
| 肩なめ | OTS | `over-the-shoulder shot` | 手前の肩越しに相手 |

## 2. アングル（カメラの高さと傾き）

| 絵コンテ表記 | プロンプト表現 | 読まれ方 |
|---|---|---|
| アオリ | `low angle shot` | 大きい・強い・威圧 |
| フカン（俯瞰） | `high angle shot` | 小さい・弱い・客観 |
| 目線（アイレベル） | `eye level shot` | 中立。既定 |
| 真俯瞰 | `overhead shot` / `top-down shot` | 図解的・神の視点 |
| 斜め傾き | `dutch angle` | 不安・異常 |
| 主観 | `POV shot` | その人が見ているもの |

## 3. カメラワーク

| 絵コンテ表記 | 意味 | プロンプト表現 |
|---|---|---|
| **FIX** | 固定 | `static shot` / `locked-off camera` |
| **T.U**（トラックアップ） | 寄っていく | `slow dolly in` / `push in` |
| **T.B**（トラックバック） | 引いていく | `slow dolly out` / `pull back` |
| **PAN** | 左右に振る | `pan left` / `pan right` |
| **ティルト** | 上下に振る | `tilt up` / `tilt down` |
| **FOLLOW** | 被写体を追う | `tracking shot` / `follow shot` |
| **移動** | 横に平行移動 | `truck left` / `dolly right` |
| 手持ち | 揺れ | `handheld camera` |
| クレーン | 上下に大きく | `crane shot` / `boom up` |
| 回り込み | 周囲を回る | `orbit shot` / `arc shot` |
| ズーム | レンズで寄る | `zoom in`（**T.U とは別物。下記**） |

⚠️ **T.U を `zoom in` と書かない。** ズームはレンズの画角変化で、背景の
遠近感が変わらない（作り物っぽく見える）。カメラ自体が近づく `dolly in` /
`push in` のほうが、絵コンテの T.U が意図している画に近い。

### 3.1 アニメのカメラは「何が動いて見えるか」で書く

アニメの撮影用語は会社・人で定義が揺れる（付けPAN と Follow PAN の区別は撮影スタッフ同士でも
3 通り以上の定義が出て、本人たちが「方言」と呼んでいる）。**用語ではなく見え方を書く。**

| 絵コンテ表記 | 作り（何を動かしているか） | 見え方として書く | 生成か合成か |
|---|---|---|---|
| **PAN / T.U / T.B**（アニメ本来） | 平面の素材をスライド・拡縮。**視差が出ない** | 「絵は止まったまま、画面がゆっくり右へ流れる」 | **合成**（静止画を `compositor` で動かす） |
| **Follow / 付けPAN** | キャラはその場で動き、背景だけが流れる | `the character stays centered in frame while the background streams past` | 生成 |
| **密着 / マルチ** | 段ごとに移動量を変えて奥行きを出す（手前ほど速い） | `foreground layers slide faster than the background`（視差のある横移動） | 生成 or 合成 |
| **回り込み** | 被写体と背景をパースごと描き変える（**高い**） | `orbit shot around the character` | 生成（速く短く、または引きで） |
| **背動** | 背景そのものを 1 枚ずつ描く移動 | 手持ち感のある移動・乗り物の主観 | 生成 |
| **画面動 / 画面ブレ** | 絵全体を小刻みに揺らす（撮影で後付け） | — | **合成**（生成に書かない） |

**アニメの「安いカメラ」（平面のスライド・拡縮・止め絵 + じわ寄り）は生成に頼まない。** 生成モデルは
既定で 3D 的に動く（パースが変わり視差が出る）ので、平面の手触りは出ない。静止画を作って
タイムラインで動かすのが確実（`genre-playbook` の references/anime.md §2.5）。上の ⚠️（T.U を `dolly in` で
書く）は**生成で寄るとき**の書き方で、アニメ本来の拡縮の寄りが欲しいときは合成側で作る。

**主要な軌道は 1 カットに 1 つ。** 軌道に身体由来の小さな揺れを重ねることや、
目的のある複合軌道は可能。`locked-off` と揺れの併記は矛盾だが、
`tracking shot with subtle head bob and body sway` は両立する。
選び方・組み合わせ・文字コンテへの記述は [camera-design.md](camera-design.md)。

### 3.2 位置と向きは別々に指定する

| 表現 | 位置 | 向き・注意 |
|---|---|---|
| `orbit shot` / `arc shot` | 被写体の周囲の円弧を移動 | 被写体を見続ける。360°限定ではない。角度・方向・高さ・半径も書く |
| `circular dolly, maintaining a fixed world-space orientation` | 円周を移動 | 向きを世界座標で固定。中心を見続ける Orbit と区別。Circular tracking だけでは曖昧 |
| `pan left/right, camera position fixed` | 固定 | 左右へ回転（yaw）。平行移動ではない |
| `tilt up/down, camera position fixed` | 固定 | 上下へ回転（pitch）。上昇・下降ではない |
| `camera roll` | 単独では固定 | 視線軸まわりに回転。角度・回転方向を添える |
| `pedestal up/down` | 垂直移動 | 向きを保つなら明示。tilt と区別 |
| `leading shot` | 被写体の前を後退 | 被写体に向ける |
| `fly-through` | 通路・開口を通り抜ける | 経路と向きは別指定。壁を貫通する指示ではない |

### 3.3 身体由来の揺れ・反応

以下は撮影用語とゲームでの動作記述を含む。固有名だけで再現性を保証しない。

| 表現 | 動作と指定すること |
|---|---|
| `handheld camera` | 撮影者が保持する不規則な揺れ。強さを指定。人物の POV とは別 |
| `head bobbing` / `walking bob` / `running bob` | 歩調に同期する上下・左右動。歩行と走行を区別 |
| `camera sway` / `body sway` | 重心移動のゆっくりした揺れ。並進か回転かを書く |
| `breathing motion` | 呼吸に同期する微小な視点の動き。レンズの focus breathing とは別 |
| `camera shake` | 揺れの総称。原因・方向・強さ・持続・減衰を指定 |
| `idle sway` / `weight-shift sway` | 静止時の微動 / 片足から他方への体重移動 |
| `footstep impulse` | 接地時だけの短い衝撃。歩調に同期 |
| `glance` / `head turn` / `look-back` | ちら見 / 顔を向ける / 振り返る。視線の行き先と戻りを指定 |
| `lean and peek` | 隠れた位置から体を傾けてのぞく |
| `crouch / stand transition` | しゃがむ・立つときの視点の高さの変化 |
| `jump / landing response` | 跳躍の上昇・落下と、着地時の沈み込み・回復 |
| `stumble / stagger` | つまずき・よろめきによる不規則な姿勢変化 |
| `recoil and recovery` | 反動の直後に視点が戻る。方向・戻る時間を指定 |
| `body-mounted camera` / `SnorriCam-style` | 頭・胸などへの固定 / 人物の体に対して構図が固定され背景が動く表現 |

### 3.4 動きの質・被写体との関係

| 表現 | 動作と指定すること |
|---|---|
| `follow lag` / `camera lag` | 被写体に遅れて追う。遅延と追いつき方 |
| `damping / smoothing` | 急変を和らげる。被写体の停止からの収束時間 |
| `inertial drift` | 停止後にも少し進む慣性 |
| `overshoot and settle` / `spring response` | 行き過ぎて戻る / 減衰する揺り戻し |
| `ease in / ease out` / `hard stop` | 加速 / 減速 / 急停止 |
| `micro-jitter` / `low-frequency drift` | 細かく速い揺れ / ゆっくり漂う揺れ |
| `procedural noise` / `impulse shake` | 継続的不規則揺れ / 出来事に反応する減衰振動 |
| `lock-on tracking` / `reframing` | 対象を見続ける / 構図を整え直す |
| `look-ahead / anticipatory framing` | 進行方向・次の動作の側へ余白を作る |
| `catch-up pan` | 追い損ねてからパンで追いつく |
| `reveal` / `push past` | 隠れていたものを明かす / 手前の物を通り越して奥を見せる |
| `parallax move` / `foreground wipe` | 近景と遠景の移動差 / 手前の物が画面を覆う。移動方向・対象を指定 |

### 3.5 空撮・ドローン・FPV

**aerial は視点、軌道、演出上の役割を区別する。** 真俯瞰だから上昇しているとは限らない。
下表には一般語・説明的表現・DJI のモード名が混在する。生成モデルへの指定では動作も添える。

| 表現 | 動作・見え方 |
|---|---|
| `aerial establishing shot` | 上空から場所の全体像を提示する役割。経路は別指定 |
| `bird's-eye view` / `oblique aerial shot` | 高所からの俯瞰 / 斜め下向きの空撮 |
| `top-down / nadir shot` | 真下向き。方向の基準を決めないと画面が回る |
| `hover shot` | 空中で位置を保持。向きも固定するかは別指定 |
| `flyover` / `flyby` | 上空を通過 / 側方を通過 |
| `aerial push-in / pull-back` | 空中で接近 / 後退 |
| `lateral aerial tracking` | 横方向へ飛びながら追う |
| `ascend / descend` | 上昇 / 下降。ジンバルの向きを別指定 |
| `orbit / circle` / `arc shot` | 被写体を注視して周回 / 部分的な回り込み |
| `helix / spiral ascent` / `spiral descent` | 周回しながら上昇 / 下降 |
| `expanding / contracting orbit` | 周回半径を広げる / 狭める |
| `dronie` | 被写体を見続けながら後退・上昇 |
| `rocket shot` | 真下を向きながら垂直に上昇 |
| `boomerang` | 楕円状に離れながら上昇し、戻りながら下降 |
| `rise-up reveal` / `lateral reveal` | 障害物の背後から上昇 / 横移動して景色を明かす |
| `tilt-up reveal` / `pull-back reveal` | 地面から地平線へ向きを起こす / 後退して全体を見せる |
| `ridgeline reveal` / `canopy reveal` | 稜線を越えて奥の景色を見せる / 樹冠の上へ出て森を見せる |
| `parallax flyby` | 近景のそばを通り、背景との移動差で奥行きを出す |
| `ground / water / canopy skimming` | 地表 / 水面 / 樹冠の近くを飛ぶ |
| `terrain following / contour flight` | 地形の起伏に合わせて高度を変える |
| `ridgeline / coastline tracking` | 尾根 / 海岸線に沿って飛ぶ |
| `canyon run` / `gap fly-through` | 峡谷を進む / 開口を通り抜ける |
| `FPV chase` | 機動的な一人称飛行で対象を追う |
| `banked turn` | 旋回に合わせて機体と画面が傾く |
| `swoop` | 弧を描いて下降し、上昇へ移る |
| `dive` / `building dive` / `mountain dive` | 急降下 / 外壁沿い / 山の斜面沿いの急降下 |
| `pull-out` | 急降下から引き起こして水平飛行・上昇へ移る |
| `axial roll` / `loop` / `Split-S` | 進行軸まわりの回転 / 縦の一回転 / 半ロール後に下降半ループして反転 |

`clockwise` は**上から見て**など観察方向を添える。水平保持のジンバル空撮と、旋回で水平線が
傾く FPV を区別する。`Asteroid`（DJI）は球面パノラマを含む自動編集表現で、単純な飛行経路ではない。
使うなら上昇・後退の撮影と球面表示への転換を分けて設計する。

## 4. レンズと被写界深度

| 言いたいこと | プロンプト表現 |
|---|---|
| 広く写す・歪む | `24mm wide lens` |
| 自然な画角 | `35mm lens` / `50mm lens` |
| 圧縮・背景をぼかす | `85mm telephoto lens` |
| 背景をぼかす | `shallow depth of field` / `bokeh background` |
| 手前も奥もはっきり | `deep focus` |
| ピント送り | `rack focus` |
| 急速なズーム | `crash zoom / snap zoom` |
| 大きさを保ち背景の遠近を変える | `dolly zoom / vertigo effect`。逆向きの移動とズーム、一定に保つ被写体を明示 |
| ピント変化に伴う画角の変動 | `focus breathing`。呼吸によるカメラの揺れとは区別 |

## 5. 光と時間帯

| 言いたいこと | プロンプト表現 |
|---|---|
| 夕方の斜光 | `golden hour lighting` |
| 日没直後の青 | `blue hour` |
| 曇天のやわらかい光 | `overcast soft light` |
| 硬い影 | `hard light` / 柔らかい影 `soft light` |
| 明るく軽い | `high key lighting` / 暗く重い `low key lighting` |
| 輪郭光 | `rim light` / `backlight` |
| 光の筋 | `volumetric light` / `god rays` |
| 画面内の光源（ランプ等） | `practical lights` |

## 6. 切り替え（編集側の語彙）

**これらは生成プロンプトに書かない。** 1 カットの中で切り替えが起きてしまう。
切り替えはタイムライン側（`compositor`）で付ける。

| 絵コンテ表記 | 意味 |
|---|---|
| F.I / F.O | フェードイン / フェードアウト |
| O.L | オーバーラップ（ディゾルブ） |
| W.I / W.O | ホワイトイン / ホワイトアウト |
| カット | 切り替え効果なし |

## 7. 1 カットぶんの書き方の型

```
[ショットサイズ] + [被写体と動作] + [場所] + [カメラワーク] + [アングル] + [光] + [画風]
```

例（絵コンテ → プロンプト）:

```
絵コンテ:  BS・アオリ・T.U / A が振り返る / 夕方の教室
プロンプト: medium close-up of a girl turning around, empty classroom,
           slow dolly in, low angle, golden hour backlight, anime style
```

**被写体と動作を先頭に置く。** モデルは前半に強く注意を向けるので、
情報が溢れたときに捨てられるのは後半（光・画風）になる。捨てられて困るものを
後ろに置かない（`ai-video-craft` §3）。
