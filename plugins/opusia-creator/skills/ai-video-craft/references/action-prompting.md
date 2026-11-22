# 動作をモデルに伝える

SKILL.md §3（語順と情報量）の詳細。**何を書き足すと良くなり、何を足すと壊れるか**を
一次情報（各社の公式プロンプトガイド）で分けたもの。

## 0. 書かなかったものは「省略」ではなく「モデルの任意」

> **"Unless you describe these details, Sora will make them up."**
> — [Sora 2 Prompting Guide](https://cookbook.openai.com/examples/sora/sora2_prompting_guide)

> "If too little plot is specified... the model may **improvise more freely**."
> — [ByteDance / Seedance](https://docs.byteplus.com/en/docs/ModelArk/2607689)

任意にされた結果は**学習データの最頻値**に落ちる。だから「食べる」とだけ書くと
**フォークで食べる**。モデルは「和食なら箸」を推論しない。

**ベンダー自身が作例で道具を名指ししている** —— Kling 公式ギャラリーは
`"A giant panda is eating hot pot **with chopsticks**"`、`"a **Chinese** child is eating **dumplings**"`。
**「食べる」だけの公式作例は 1 つも無い。**

---

## 1. 「具体的に書く」と「盛りすぎるな」は別の軸

| 軸 | 中身 | 増やすと | SKILL.md §3 の制限 |
|---|---|---|---|
| **A. 名詞と動詞の精度** | 箸・椀・持ち方・接点・歩数・視線 | **良くなる。上限は無い** | **制限していない** |
| **B. 修飾語の量** | 「美しい」「映画的」「静かに」 | **悪くなる**（互いに薄める） | 「修飾は 2〜3 個まで」= **これ** |
| **C. 出来事の数** | 図書館 → 車 → 倉庫 | **壊れる**（混ざる・欠ける） | 「1 カット 1 動作」= **これ** |

**「食べる」→「右手の箸で麺を持ち上げ、口へ運ぶ」は軸 A の追加**なので、
**§3 の決まりを 1 つも破らずに書き足せる。** 迷ったらこの表に戻る。

> "**Verbs and nouns that point to visible results** will always give you a clearer,
> more consistent output."（Sora 2）
> "Avoid using overly conceptual language... prompts that describe the idea or feeling behind a
> motion, rather than **the specific physical movements**, may lead to unexpected results."
> （[Runway Gen-4](https://help.runwayml.com/hc/en-us/articles/39789879462419-Gen-4-Video-Prompting-Guide)）

### ただし「何でも細かく」ではない（予算配分）

ByteDance は**逆向き**を言う:

> "**Actions: Give priority to general descriptions** ... **Only write specific details for a few
> memorable actions**, and avoid repeating the same actions."

矛盾ではない。Seedance 2.5 は 15〜30 秒・複数ショットを 1 本で書くので、全部細密だと破綻する。
**細かく書く対象は「そのカットの見せ場 1 つ」に絞り、そこは軸 A で徹底する。残りは粗くてよい。**

---

## 2. 人物が物を扱うカットで、必ず埋める 5 つ

**1〜5 が埋まっていないト書きは未完成として差し戻す。**

| # | 項目 | 何を書くか | 埋めないと |
|---|---|---|---|
| **1** | **誰が** | 年齢帯・性別・**文化圏**・髪・服。**カットごとに毎回フルで**（前カット参照は効かない） | 別人になる／西洋人になる |
| **2** | **何を扱うか** | 対象物を**具体名**で（麺／丼／湯呑み／障子） | 別の物に置き換わる |
| **3** | **何で扱うか** | **道具を名指し**（箸／レンゲ／筆／両手） | ⚠️ **手掴みになる** |
| **4** | **どう触れるか** | 手と物の**接点と持ち方**（右手の箸で／両手で底を支えて） | 物が浮く・消える・貫通する |
| **5** | **動きの軌跡** | **順に分解**（持ち上げる → つまむ → 運ぶ → 下ろす）。可能なら**回数・歩数・秒** | 動作が始まらない／別の動きにすり替わる |

6 以降は従来どおり: どこで（＋手前の小物 2〜3 個）／カメラ（動きは 1 つ）／光／画風 1 つ／音。

> **1 行ルール**: **「誰が・何を・何で・どう触って・どの順に動くか」が無ければ、
> それはト書きではなくメモ。**

ト書き側の型（姿勢・目線・予備動作・余韻）と**日本の所作 54 行の辞書**は
`screenwriter` の references/acting-and-gestures.md が正本。ここはそれを**モデルへ渡す形**の話。

### 尺に対する密度（語数ではなく「出来事の数」で管理する）

一次情報に語数の推奨は無い（上限だけ。MiniMax H3 = **7000 文字**）。

| 尺 | 出来事（場所・時間が飛ぶ回数） | 拍 | 細密に書く動作 |
|---|---|---|---|
| 4〜6 秒 | **1** | 1〜3 | **1** |
| 8〜10 秒 | **1** | 3〜5 | 1 |
| 15〜30 秒（Seedance 2.5） | ショット列で明示 | ショットごとに 2〜4 | **全体で 1〜2** |

---

## 3. 書いてはいけないもの

| # | 禁止 | 根拠 |
|---|---|---|
| 1 | **品質語・感嘆語**（美しい・映画的・高品質） | 画面に映らない＝情報ゼロ。Sora 公式の weak 例 |
| 2 | **心情だけの動詞**（味わう・噛み締める・葛藤する） | Runway: 抽象語は「意図の解釈」を強いる → ランダムな動きになる |
| 3 | **強度の高い感情語**（狂信的な・極度に驚いた） | ByteDance: **瞳が不自然に発光する**。"amazed" 程度に落とす |
| **4** | **否定形を本文に書く**（〜しない・〜を写さない） | Runway: "**negative phrasing is not supported and may produce... opposite results**"。Google も `no` / `don't` は非推奨 → **`negative_prompt` に単語で入れる**（§5） |
| 5 | **場所・時間が飛ぶ連鎖**（A してから B へ行き C する） | Google: "muddled or incomplete videos" → **カットを割る** |
| 6 | **依頼文・会話文**（〜してください） | Runway: "waste valuable prompt space" |
| 7 | **矛盾するカメラ指示**（static + handheld） | SKILL.md §4 |
| 8 | **i2v で人物・背景・光を書き直す** | Google: "Redundant prompts confuse the model"。i2v は**動きだけ** |
| 9 | **参照素材を渡したうえで同じ内容を細かく書き直す** | ByteDance: "avoid repeatedly describing the scene in detail" |
| 10 | **台詞のあとに括弧で演技指示**（Seedance） | ByteDance: "These descriptions can **trigger subtitle generation**" |
| 11 | **高頻度動作の回数指定**（1 秒に 3 回首を振る）（Seedance） | ByteDance が明示的に非推奨 |
| 12 | **JSON で書く** | **どのベンダーも推奨していない**。公式が示すのは**ラベル付きのプレーンテキスト** |

---

## 4. プロンプトは、送ったあとに書き換えられることがある

**丁寧に書いても、モデル側の「拡張器」が書き直す設定が既定で入っている**（fal のスキーマ実測）。

| endpoint | パラメータ | 既定 | 中身 |
|---|---|---|---|
| `minimax/h3/*`・`h3-max/*` | `prompt_expansion_mode` | **`balanced`** | "How much effort to spend **rewriting the prompt** before generation." `disabled` で無効 |
| `heygen/heygen-video/*` | `prompt_enhancement` | **`turbo`** | H3 の post-train 版。`disabled` で無効（こちらでは `prompt_expansion_mode` として渡す） |

**＝「箸で」と書いたのに手掴みで返る原因が、拡張器の書き換えである可能性がある。**
逆に**素っ気ないプロンプトを投げると、拡張器が空欄を自分の事前分布で埋める** ——
**「短く書いて拡張器に任せる」は所作の観点では最悪手**になる。

**所作を確定したいカットでは拡張を切る。** `generate_scene` / `generate_asset` の
`fields` に渡す:

```jsonc
fields: { "prompt_expansion_mode": "disabled" }   // 既定は "balanced"
```

切ると**空欄を埋めてくれなくなる**ので、§2 の 5 項目を自分で埋めていることが前提。
**粗い本文のまま切ると、かえって悪くなる。**

H3 は `expanded_prompt` が返るので、外れたときは**まずそれを読んで
「実際に何を投げたことになったか」を見る**。

---

## 5. モデルごとに違う記法（1 つの書き方で統一しない）

| | Sora 2 | Seedance 2.5 | Kling v3 |
|---|---|---|---|
| **台詞の引用符** | **使う**（`- Detective: "You're lying."`） | `話者の台詞（感情）: 内容` | — |
| **否定** | 本文で扱わず編集で直す | 字幕・音のみ（`No subtitles.`） | `negative_prompt`（既定値あり・2500 字） |
| **日本語の台詞** | 不明 | **可**（1.5 Pro で明記） | **不可（黙って英訳される）** |

**プロンプト本文は英語で書く。** Veo のモデルページに **"Prompt languages: English"** と明記があった
（Veo は 2026-10 に fal から外れた）。
**「日本語で書けば日本文化に寄る」は成り立たない**（学習分布は言語で切り替わらない）。
日本的な所作は**言語ではなく記述で**指定する（§2 の 3 と 4）。

---

## 6. それでも所作は直りきらない（期待値を持っておく）

査読前論文 CultureScore（arXiv:2606.07311v2）がプロンプトを厚くしたときの改善幅を測っている。

| 次元 | 詳細プロンプトによる改善 | 到達点 |
|---|---|---|
| Context（背景・環境） | **+25.5%** | 上がる |
| **Behavior（所作・身振り）** | +15.8〜16.7% | **どのモデルも 52.1% を超えない** |

> "**Behavior is the most resistant dimension to prompt enrichment**"

**視覚品質が最高のモデルが、文化的忠実さでは最下位**ということも起きる。

**所作が作品の要になるカットは、文字で粘らずに参照へ逃がす**:

1. **正しい所作を描いた絵コンテのコマ**を参照に渡す（`storyboard` → reference-to-video）
2. それでも出なければ**その所作が映らない構図に変える**（SKILL.md §5）
3. 3 回投げて出なければ設計を変える（SKILL.md §7）

---

## 出典

- [Sora 2 Prompting Guide](https://cookbook.openai.com/examples/sora/sora2_prompting_guide)（archived バナーあり。2026-03 更新が最新）
- [Google: Veo prompt guide / video generation best practices](https://ai.google.dev/gemini-api/docs/video)（2026-09-24 更新）
- [ByteDance / Seedance 2.5 prompt guide](https://docs.byteplus.com/en/docs/ModelArk/2607689)
- [Runway Gen-4 Video Prompting Guide](https://help.runwayml.com/hc/en-us/articles/39789879462419-Gen-4-Video-Prompting-Guide)
- [MiniMax: Video generation](https://platform.minimax.io/docs/guides/video-generation)
- CultureScore（arXiv:2606.07311v2, 2026-06-19）— 所作は最も改善しにくい次元
- モデル別の全文・確定できなかった 12 項目は
  `docs/_research/2026-09-25-video-model-action-prompting.md`
