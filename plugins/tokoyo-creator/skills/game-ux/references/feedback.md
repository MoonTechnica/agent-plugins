# 手応えの作り方（量の目安と道具ごとの書き方）

`SKILL.md` §2 の 4 種類の出来事に、何をどれだけ出すか。数値は**既定の目安**で、遊びに合わせて上下してよい。
ただし `SKILL.md` §5 の上限（画面の 20% 以上の点滅は 1 秒に 3 回まで・赤の全画面禁止）は超えない。

目次: 1 量の表 / 2 共通の作り（`effects` とヒットストップ）/ 3 Canvas 2D / 4 Godotの2D/3D / 6 効果音の 3 種類

## 1. 量の表

| 出来事 | 出すもの | 量の目安 |
|---|---|---|
| 押した | 押した物を 5〜10% 縮める / 明るくする → 80〜120ms で戻す。短い音 | 同じフレームで始める |
| 良い | 伸び縮み（縦 1.2 × 横 0.8 → 150ms で戻る）、パーティクル **6〜16 個**（0.3〜0.5 秒で消える）、浮かぶ数字（上へ 20〜40px・0.6 秒・後半で薄く）、高い音 | 100〜200ms |
| 当てた（攻撃が敵に当たった） | ヒットストップ **短く**（下の表）+ 当たった物の白い点滅 1 回（透明度か加算で 0.1 秒）+ ノックバック + 短い音 | 揺れは小さく（倒したときだけ） |
| 悪い | ヒットストップ **50〜100ms**（60fps で 3〜6 フレーム。強い衝突ほど長く）+ 揺れ **0.3 秒以内・振幅は画面の短辺の 2% まで** + 白か赤の点滅 **1 回**（0.1 秒・当たった物だけ）+ 低い音 | 揺れは `trauma`（0〜1）で持ち、量は `trauma²`、0.3 秒で 0 に戻す |
| 記録更新・クリア | 数字が増える（0.5 秒）→ 「NEW RECORD」が跳ねる（0.3 秒）→ 音 | 合計 1〜1.5 秒。タップ / キーで即座に最後の状態へ |
| 無効な操作 | 横に 4px 震える（2 往復）/ 一瞬灰色 + 短い低い音 | 100ms |

ヒットストップの長さ（ジャンルごとの手本はこれに揃える。`$game-controls` の references/genres.md・`$game-design` の references/genres-minimum.md も同じ値）:

| 場面 | 長さ |
|---|---|
| 連射する武器の 1 発が当たった（シューティング・ツインスティック） | 10〜20ms（止めすぎると連射が詰まる） |
| 1 回ずつの攻撃が当たった・敵を踏んだ（アクション・3D） | 50〜80ms |
| 格闘の打撃が当たった | 4〜6 フレーム（66〜100ms）。止まっている間も次の入力は受け付ける |
| やられた（自分が被弾した） | 50〜100ms |

イージング: 出るときは `easeOutCubic`（`1 - (1 - t) ** 3`）、消えるときは `easeInQuad`（`t * t`）で出るときの 6〜7 割の長さ。

## 2. 共通の作り

- **`effects`（0〜1）は 1 か所で掛ける**。揺れ・点滅・パーティクルを作る関数の中で掛け、呼び出し側に分岐を散らさない。
  `effects === 0` のとき、これらは呼ばれても何も起きない。**ヒットストップと音は `effects` に関係なく出す**。
- **ヒットストップはゲームの時間だけを止める**。描画・入力キットの `endFrame()`・音は止めない（押しっぱなしの状態を壊さない）。
  `setTimeout` で止めない（ポーズや画面が隠れたときに狂う）。フレームの経過時間で数える。
- 揺れは**カメラ（描画のずらし）で**行い、ゲームの座標（当たり判定）は動かさない。
- 浮かぶ数字・パーティクルは寿命付きの配列で持ち、寿命が尽きたら消す（上限 200 個程度。超えたら古い物から捨てる）。

```ts
let effects = 1                      // SKILL.md §5 / §7 で 0 になる
let hitstop = 0                      // 残り秒
let trauma = 0                       // 揺れの強さ 0〜1

function hit(strength: number) {    // 悪い出来事。strength は 0〜1
  hitstop = Math.max(hitstop, 0.05 + 0.05 * strength)
  trauma = Math.min(1, trauma + strength * effects)
  playSfx('bad')
}

function shakeOffset(dt: number, shortSide: number) {
  trauma = Math.max(0, trauma - dt / 0.3)
  const amount = trauma * trauma * shortSide * 0.02
  return { x: (Math.random() * 2 - 1) * amount, y: (Math.random() * 2 - 1) * amount }
}
```

## 3. Canvas 2D

```ts
function frame(now: number) {
  const raw = Math.min((now - last) / 1000, 1 / 30)
  last = now
  const dt = hitstop > 0 ? 0 : raw   // ヒットストップ中はゲームの時間を進めない
  hitstop = Math.max(0, hitstop - raw)
  step(dt)                            // ゲームの更新
  const shake = shakeOffset(raw, Math.min(view.width, view.height))
  ctx.save()
  ctx.translate(shake.x, shake.y)     // 世界だけ揺らす
  drawWorld()
  drawParticles(raw)
  ctx.restore()
  drawHud()                           // HUD は揺らさない
  input.endFrame()
  requestAnimationFrame(frame)
}

function burst(x: number, y: number, color: string) {
  const count = Math.round(10 * effects)
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2
    const speed = 80 + Math.random() * 160
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.4, color })
  }
}
```

伸び縮みは描くときに `ctx.scale(sx, sy)`（足元を基準にするなら、足元へ `translate` してから `scale`）。

## 4. Godotの2D/3D

固定版GodotのAPI定義を確認する。揺れはカメラの表示offsetへ上限付きで加え、HUDは別CanvasLayerへ置く。
伸び縮みと点滅は対象NodeのTweenで実装し、Node破棄時に停止する。全画面flashを使わない。
粒子はGPUParticles2D/3D等を上限付きで再利用し、不要なエフェクトと音をシーン終了時に解放する。
ヒットストップはローカルの演出に限定し、オンラインの権威あるサーバーtickや入力送信を止めない。
reduced-motionとeffects=0では揺れを止め、視覚だけ・音だけで必須情報を伝えない。

## 6. 効果音の 3 種類

最低限、**押す / 良い / 悪い** の 3 つを用意する。素材ツールで作るなら `$game-asset-tools` の効果音。無いときは Web Audio で合成する:

```ts
function tone(from: number, to: number, seconds: number, type: OscillatorType, volume: number) {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  const now = audio.currentTime
  osc.type = type
  osc.frequency.setValueAtTime(from, now)
  osc.frequency.exponentialRampToValueAtTime(to, now + seconds)
  gain.gain.setValueAtTime(volume, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + seconds)
  osc.connect(gain).connect(sfxGain)   // 効果音の GainNode（SKILL.md §7）に通す
  osc.start(now)
  osc.stop(now + seconds)
}
const sfx = {
  press: () => tone(660, 520, 0.05, 'square', 0.15),
  good: () => tone(660, 1320, 0.15, 'triangle', 0.25),
  bad: () => tone(220, 90, 0.2, 'sawtooth', 0.25),
}
```

連続で良いことが起きる遊び（連鎖・コンボ）は、回数に応じて `good` の音程を少しずつ上げると続けた手応えが出る。
