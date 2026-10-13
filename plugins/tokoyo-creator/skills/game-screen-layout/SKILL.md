---
name: game-screen-layout
description: ゲーム画面を、スマホの縦画面・横画面・PC の横長画面のどれでも崩れずに全面で見せる。どのゲームでも必ず使う。canvas の大きさと高解像度対応、プレイ領域の拡大縮小、HUD とスマホの操作部の置き場所、文字の描き方（大きさとコントラストの数値は game-ux）、ポーズと再開、タイトル・リザルト画面の作り方、リザルトの画面を共有するボタン（app.share.capture / app.ui.openShare）を扱う。layout, responsive, canvas, devicePixelRatio, HUD, safe area, orientation, pause.
---

# ゲーム画面（どの画面の形でも崩れない）

Platform はゲームを**枠の全面**に出す。枠の形はスマホの縦長（例 390×844）、スマホの横長、
タブレット、PC の横長（例 1440×900）のどれにもなり、途中で変わる（回転・ウィンドウの大きさ変更・全画面の切り替え）。
**どの形でも、遊べる大きさで、何も切れずに、全面が使われている**こと。

## 1. canvas は全面・実ピクセルで描く

```ts
const canvas = document.createElement('canvas')
canvas.style.display = 'block'
Object.assign(document.body.style, { margin: '0', overflow: 'hidden', background: '#0b1020' })
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

let view = { width: 0, height: 0 }                 // CSS px。ゲームの座標はこちらで考える
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  view = { width: window.innerWidth, height: window.innerHeight }
  canvas.style.width = `${view.width}px`
  canvas.style.height = `${view.height}px`
  canvas.width = Math.round(view.width * dpr)
  canvas.height = Math.round(view.height * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)            // 以後は CSS px で描ける
  layout()                                         // プレイ領域・HUD・盤面の位置を決め直す
}
window.addEventListener('resize', resize)
resize()
```

- `resize` は回転・全画面の切り替えでも来る。**大きさを起動時の 1 回だけで決めない。**
- 全画面はゲームから出さない（`requestFullscreen()` を呼ばない）。Platform の枠の全画面ボタンが出す。
  **カメラ / マイクを使うゲームでは呼んでもブラウザに断られる**（使用中の表示を隠さないため、Platform が枠ごと全画面にする）。
- **Phaser 4 は自前の `resize()` を書かず Scale Manager を使う**: 方式 A（§2）は `Phaser.Scale.FIT`、方式 B は
  `Phaser.Scale.EXPAND`（どちらも `autoCenter: Phaser.Scale.CENTER_BOTH`、基準の大きさは縦 720×1280 / 横 1280×720 のように大きめ）。
  `RESIZE` は画素が CSS の px と 1:1 になってスマホでぼけるので使わない。配置の決め直しは `this.scale.on('resize', …)`（`$game-phaser` §5）。
- Babylon.js は `createEngine(canvas)` の DPR 上限を使う（3D は描く画素がそのまま重さになる。`$game-3d-and-bundles` §2）。
  canvas の CSS を `width: 100%; height: 100%` にし、`resize` で `engine.resize()`（カメラの縦横比はエンジンが反映）。
- `manifest.json` の `orientation` は**実際に合う向き**を書く（`portrait` / `landscape` / `any`）。
  ただし Platform は向きを固定しない。**違う向きでも遊べる**レイアウトにする（§2）。

## 2. プレイ領域の決め方（2 通り。どちらかを選ぶ）

| 方式 | 向くゲーム | 作り方 |
|---|---|---|
| **A. 固定の論理サイズを拡大縮小**（レターボックス） | 盤面・パズル・カード・固定画面のアクション・縦シュー | 論理サイズ（例 縦 360×640 / 横 640×360）を決め、`scale = min(view.width / W, view.height / H)` で**全体が収まる最大**に拡大して中央に置く。余りは背景（絵や色）で埋める。**黒い帯のままにしない** |
| **B. 見える範囲を広げる** | 横スクロール・見下ろし・3D・ランナー | 1 単位の大きさ（例: キャラの高さ = 画面の短辺の 1/8）を短辺から決め、長辺方向は**見える範囲が広がる**。横長の PC では遠くまで見える |

- どちらでも**遊びに要るものは全部見える**こと。B では「画面が広い方が有利」になりすぎないよう、敵の出現範囲などを
  見える範囲ではなく論理的な範囲で決める。
- 盤面・マスは短辺から決め、**1 マス 44px 以上**を保つ。入り切らないならマス数ではなくレイアウト（縦並び⇔横並び）を変える。
- 縦長のスマホで横長の論理サイズ（またはその逆）を小さく出すだけにしない。向きごとに配置を変える
  （例: 縦ではスコア欄を上、横では右）。

## 3. HUD とスマホの操作部の置き場所

```text
┌──────────────────────────────┐
│ スコア・残機・時間        ⏸ 🔈 │ ← HUD は上端（端から 16px 以上内側）。ポーズとミュートは右上（44px 以上）
│                              │
│         プレイ領域            │
│                              │
│ ◯ スティック     ジャンプ ◯  │ ← スマホのとき下の約 180px は操作部（$game-controls のキット）
└──────────────────────────────┘
```

- **スマホの操作部が出ている間**（`input.mode === 'touch'`）は、下端から約 180px の左右の角に
  重要な物（自機の立ち位置・足場・敵・ボタン）を置かない。方式 B ならカメラを少し上にずらす。方式 A なら
  プレイ領域の下端を操作部の上に合わせる（縦画面なら余りがあることが多い）。
- 文字と操作部を**重ねない**。スコアの桁が増えても隣とぶつからないよう、欄の幅を先に確保する。
- プレイ中に常に見せる情報は **2〜3 個まで**（`$game-ux` §3）。
- 画面の端 16px には触る物を置かない（OS の端の操作、角の丸み、ノッチ）。

### 3.1 セーフエリア（ノッチ・Dynamic Island・ホームインジケータ）

**画面の端まで描き、HUD と操作部だけをセーフエリアの内側に置く**のが既定の作り方。

1. `manifest.json` に **`"safeArea": "app"`** を書く。書かないと Host が描画領域をセーフエリアの内側に収め、
   その外側（ノッチの横など）は黒い帯になる。
2. **背景・世界・演出は画面の端まで**描く（canvas は親要素いっぱいのまま。セーフエリアで縮めない）。
3. **押す物・読む物（HUD・ボタン・スティック・文字）はセーフエリアの内側**に置く。
   - DOM の HUD は CSS 変数: `top: calc(var(--app-safe-area-top) + 16px); left: calc(var(--app-safe-area-left) + 16px);`
     （`--app-safe-area-top` / `-right` / `-bottom` / `-left`。単位 px）
   - canvas に描く HUD は `app.display.safeArea()`（`{ top, right, bottom, left }`）から位置を決め、
     `app.display.onSafeAreaChange()` と `resize` で決め直す（端末を回すと左右と上下が入れ替わる）。
   - `$game-controls` のキットの操作部は自動でこの内側に入る。
4. `env(safe-area-inset-*)` は使わない（iframe の中では 0 になる端末がある）。
5. **左上の角（約 56px 四方）は空けておく**。スマホのアプリでは Platform の「閉じる」ボタンが重なる。

```text
 ┌──────┬────────────────────────┬──────┐
 │ノッチ│ ⓧ  スコア・残り時間  ⏸ 🔈 │      │ ← 背景は端まで。HUD は --app-safe-area-* の内側
 │（背景│                        │      │
 │ だけ）│      プレイ領域          │      │
 │      │ ◯ スティック  ジャンプ ◯ │      │
 └──────┴────────────────────────┴──────┘
          ↑ ホームインジケータの上（--app-safe-area-bottom）に操作部
```

## 4. 文字

- **大きさ・コントラスト・背板と縁取りの数値は `$game-ux` §3**（本文 16px・プレイ中の数字 24px・4.5:1）。
- `ctx.font` の大きさは CSS px で指定する（`setTransform` 済みなら DPR は不要）。Phaser は基準の大きさで書くので
  縮めて表示される分を見込む（`$game-phaser` §5）。
- 画面幅に比例して文字を大きくしない。大きさの段を決めて使う（見出し 28〜36px / 本文 16px / 補足 12〜14px）。
- 長い文は行を折り返す。
- 文言は日本語。

## 5. 画面の流れ

| 画面 | 中身 |
|---|---|
| **タイトル** | ゲーム固有の主役/場所/盤面 + タイトル + 明確な開始/再開 + 短い操作案内。構図は下記、機能と状態は `$game-ux` references/start-screen.md |
| **プレイ** | 最初の 1 手を画面の中で示し、最初の課題は易しく（`$game-ux` §1） |
| **ポーズ** | ポーズボタン / Escape / P で止まる。「再開」「最初から」・操作説明・効果音 / BGM / 画面の揺れのトグル（`$game-ux` §7） |
| **リザルト** | 中身は `$game-ux` §6（スコア・自己ベスト・前回との差・終わった理由・「もう一度」）。タップ / クリック / Space の 1 回でやり直せる |

手応え（押した反応・効果音）と読み込みの表示は `$game-ux` §2 / §8。

### スタート画面の構図

- 主役・代表的な場所・盤面から何を遊ぶかが分かる構図を選ぶ。実ゲームの場面または同じ美術の絵を使い、
  主役の顔/機体/重要な盤面とメニューが重ならない余白を取る（`$game-art-direction` §6.1）。
- 主操作を補助操作より強く見せる。タイトルは作品の個性、メニューと説明は読みやすさを担う。
  本編/ポーズと配色・形・線幅・文字の役割を揃える。汎用カードや光彩を理由なく足さない。
- 横長は絵とメニューを左右、縦長は上下に置く等、構図を組み替える。単に全体を縮小しない。
  単純なゲームは中央の短いメニューでもよい。配置をジャンルだけで固定しない。
- 通常/選択/押下/準備中/使用不可を区別する。操作部と文字の大きさ・背板・セーフエリアは §3/§4 と `$game-ux`。
  メニューの後ろの動きは同Skill §5 に従い、操作受付を遅らせる入場演出を作らない。

## 5.1 リザルトを共有する（`app.share.capture` / `app.ui.openShare`）

**API の正本は `<kit>/sdk/app-sdk/spec.md` §3.4 と §8.5**。

スコア・勝敗・作った作品のように**人に見せたくなる結果がある遊び**なら、リザルトに「共有」ボタンを置く。
結果が無い遊び（眺めるだけ・終わりが無い）には無理に付けない。

- `manifest.json`: `sdkVersion` は `2`、`capabilities` に **`share.capture`**（画面を預ける）と **`ui.openShare`**（共有を開く）。
- 押すと、今の画面が画像として Platform に預けられ、Platform の共有ダイアログが開く。共有されるリンクは
  Platform の App のページで、その画像がリンクの画像（SNS のカード）とページの先頭に出る。
  **リンク（URL）は App が作らない・渡せない**。共有シートもダイアログのボタンで開くので、App は開かない。

```ts
import { app } from '@workspace/app-sdk'

async function shareResult(score: number) {
  renderResult() // リザルトを描く（WebGL / WebGPU なら scene.render()）
  let captureId: string | undefined
  try {
    // 描いた直後、同じ処理の中で呼ぶ（await を挟まない）。後で呼ぶと WebGL / WebGPU の画面は真っ黒になる
    // Phaser は自分のループで描くので、game.events.once(Phaser.Core.Events.POST_RENDER, …) の中で呼ぶ（$game-phaser §7）
    ;({ captureId } = await app.share.capture(canvas))
  } catch (error) {
    console.warn('share.capture failed', error) // 撮れなくてもリンクだけで共有を続ける
  }
  try {
    await app.ui.openShare({ ...(captureId ? { captureId } : {}), text: `スコア ${score} 点！` })
  } catch (error) {
    console.warn('openShare failed', error)
    // 公開前の試遊では共有できない。App の画面に短く「いまは共有できません」を出す（遊びは続ける）
  }
}
```

- ボタンはリザルトの「もう一度」の隣。44px 以上、タップ / クリック / キー（例: `S`）のどれでも押せる。
  連打で何枚も預けないよう、押したら終わるまでボタンを無効にする（**1 分 6 枚・1 日 50 枚まで**。未登録の人は半分）。
- 渡すのは `canvas`（`HTMLCanvasElement` / `OffscreenCanvas`）か画像の `Blob`。SDK が長辺 1600px の JPEG にする。
  透明な部分は黒になるので、背景を塗ったリザルトを撮る。DOM の HUD は写らない（canvas だけ）。
  スコアを画像に残したいなら canvas に描く。
- `text`（一言）は 100 文字まで。スコアや結果を短く。URL・ハッシュタグの羅列を入れない。
- 画像は**公開**され（リンクを知っていれば誰でも見られる）、90 日で消える。**利用者が入力した文章・チャット・
  個人の情報が写る画面を撮らない**（表示名とスコアは可）。
- 失敗しても遊びは止めない: 撮れない（`INVALID_ACTION` / `RATE_LIMITED` / `INTERNAL`）ならリンクだけで開く。
  公開前の試遊では撮るのも開くのも `FORBIDDEN`（短く「いまは共有できません」を出すだけにする）。

## 6. 止まる・再開する

- `app.lifecycle.onPause` と、画面が隠れたとき（`document.visibilityState === 'hidden'`）に**ゲームを止める**:
  ループ（`requestAnimationFrame` / `engine.stopRenderLoop()`）とタイマーを止め、音を `suspend()` し、
  ポーズ画面にする。入力キットの押しっぱなしは自動で離される。
- 再開は**利用者の操作で**（ポーズ画面の「再開」）。戻った瞬間に敵が動き出して負けない。
- `requestAnimationFrame` の時間差は上限を付ける（`dt = Math.min(dt, 1 / 30)`）。止まっていた時間ぶん一気に進めない。

## 7. 出力前のチェック

- [ ] 390×844（縦）・844×390（横）・1440×900（PC）のどれでも、切れず・はみ出さず・全面が使われている
- [ ] `resize` でプレイ領域・HUD・盤面が決め直される
- [ ] 高解像度でぼけない（DPR を掛けた canvas）
- [ ] HUD・文字・スマホの操作部が互いに重ならない。触る物は 44px 以上・端から 16px 以上内側
- [ ] `manifest.json` に `"safeArea": "app"`。背景は画面の端まで描き、HUD・操作部は `--app-safe-area-*`（canvas なら `app.display.safeArea()`）の内側。左上の角は空いている
- [ ] ポーズ（ボタン / Escape / P）とミュートがあり、画面が隠れたら止まる
- [ ] タイトル → プレイ → リザルト → もう一度 が、タップ / クリック / キーのどれでも回る
- [ ] `$game-ux` §9 のチェックも満たしている
- [ ] 共有を付けたなら: `share.capture` と `ui.openShare` を宣言し、リザルトを描いた直後に撮り、失敗してもリンクだけで開く・遊びは止まらない
