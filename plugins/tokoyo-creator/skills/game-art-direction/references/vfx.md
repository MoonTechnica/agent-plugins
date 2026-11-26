# エフェクト（粒子・shader・光）を Compatibility で作る

エフェクトは**遊びの情報を運ぶ**ために使う（当たった・予告・取った・危ない）。量と時間の目安は `$game-ux` references/feedback.md、
光過敏・揺れの規則は `$game-ux` §5、攻撃の予告の色は `$game-combat` §1。ここは Godot 4.5 の Compatibility（WebGL2）で何が使えて、何で代えるか。

## 1. Compatibility で使えない物と代わり

| 使えない・弱い | 代わり |
|---|---|
| Decal（地面の焦げ・足元の影・予告の円） | 地面の少し上（1〜2 cm）に置いた板（`QuadMesh`・`unshaded`・半透明か `alpha_scissor`）。予告の円は板の shader で広がる輪 |
| SSAO / SSIL / SSR / SDFGI / VoxelGI / 体積フォグ | AO は Blender で焼く・shader で根元を暗く。反射は ReflectionProbe（1 つの物に 2 個まで）か空の色。霧は通常の Fog |
| 被写界深度・FXAA・TAA | 遠景を色で薄く（霧）。3D は MSAA（2x から。スマホは重さを測る） |
| 2D の HDR（光が 1 を超えて光る） | 加算の合成（`CanvasItemMaterial.blend_mode = BLEND_MODE_ADD`）と明るい色で |
| 色の階調が少なく縞（banding）が出る。Debanding が無い | 大きな滑らかなグラデーションを避ける。テクスチャに少しのノイズを入れる |
| 影の柔らかさ（PCSS） | 影は硬いまま。丸い影の板で足元を示す |
| 光の数（1 つの物に omni 8・spot 8 まで） | 多くの小さな光は光らせた板（unshaded・加算）で見せ、本物の光は数個に |

Glow（光のにじみ）は使える。強く掛けすぎると画面全体が白っぽくなるので、光る物だけ明るく（`emission` を 1 より上）して閾値で拾う。
`SCREEN_TEXTURE` / `DEPTH_TEXTURE` は使えるが毎フレームの写しで重い。スマホでは使う場面を 1 つに絞る。

## 2. 粒子

- 2D は `CPUParticles2D` を基本にする（動く発生源・物理補間と相性がよい。`$game-godot` references/best-practices.md）。
  3D は `GPUParticles3D` か `CPUParticles3D`。数は**1 回の演出で 6〜32 個、画面全体で 300 個前後まで**から始め、`TokoyoQuality` の段で減らす。
- 1 回だけの粒子は `one_shot` + `restart()`。続けて出るなら発生源を数個使い回す。終わったら消す（`$game-ux` references/feedback.md の解放の規則）。
- 粒子の形は小さな四角・丸・菱形で十分。テクスチャを使うなら小さく（32〜64 px）、1 枚の画像にまとめる。
- 半透明の粒子を大きく重ねると重い（塗りの重なり）。大きい煙は数を減らして 1 個を大きく、短く。

## 3. shader の書き方

- 自分で書く shader は `shader_type canvas_item;`（2D）か `spatial`（3D）。Compatibility で動くことを書き出しのプレビューで確かめる
  （エディタの Forward+ で動いても Compatibility で崩れることがある）。
- よく使う形: 白く光る（`COLOR.rgb = mix(COLOR.rgb, vec3(1.0), flash)`）・溶けて消える（ノイズの閾値で `discard`）・広がる輪
  （中心からの距離と時間）・流れる帯（UV を時間でずらす）。値は `uniform` にして Tween で動かす。
- 多くの物に同じ shader を使い、物ごとの違いは `instance uniform` か頂点の色で渡す（マテリアルを物ごとに複製しない）。
- 自然（草・葉・水・地面）は [nature.md](nature.md) の検証済みの shader を使う。

## 4. 光と雰囲気

- 主な光は 1 つ（太陽・月）+ 補助の光を数個。光の向きと色はコンセプトの光に合わせる（[visual-direction.md](visual-direction.md)・`design/palette.json`）。
- 大事な物（取る物・扉・敵の弱点）は少し光らせるか、周りより明るくする。プレイヤーの目を光で導く。
- 暗い場面: 真っ黒にせず、環境光を少し残し、プレイヤーの周りと次の道を照らす。

## 5. 検査

- [ ] Decal・SSAO などの使えない機能に頼っていない（§1 の代わりを使った）
- [ ] 粒子の数を決め、`TokoyoQuality` の段で減らせる。終わった粒子を消している
- [ ] 自作の shader を Compatibility の実際の描画で確かめた（未確認なら `design/playtest.md` に書く）
- [ ] 点滅が SKILL の規則（`$game-ux` §5）を守っている
