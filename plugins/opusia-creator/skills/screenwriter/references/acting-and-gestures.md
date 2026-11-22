# 芝居の書き方と、日本の所作の辞書

ト書き（`cuts.note`）に**動作をどこまで書くか**。「カットが何を持つか」は SKILL.md
本体（§3）、「何を喋らせるか」は [dialogue-and-exposition.md](dialogue-and-exposition.md)。

## 0. ト書きは観客に届かない。だから厚く書く

**[dialogue-and-exposition.md](dialogue-and-exposition.md) §0 と衝突しない。** あちらは
**観客に届く情報**の話（画に預けるな、言葉で言え）。ここは**生成 AI へ渡す指示**の話で、
**観客は一文字も読まない**。だから、

| | 薄くする | 厚くする |
|---|---|---|
| **台詞**（観客が聞く） | ❌ 下限 150 字/分 を守る | — |
| **ト書き**（モデルだけが読む） | — | ✅ **普通のコンテなら書かないところまで書く** |

**書いても生成費用は 1 円も変わらない。** 一方、所作が違う映像を撮り直すと
**カット 1 本ぶんの費用**がかかる。`storyboard` §2.5 の「ここで戻すほうが安い」と
同じ理屈で、**書く側に寄せるほうが常に安い**。

### プロのト書きは「出来事」ではなく「身体の手順」

宮崎駿『君たちはどう生きるか』C112 のト書きは、こう書かれている。

> ドアをしめ　部屋をよこぎり　**ここにヒザをおり**　サイドテーブルに**お盆ごと**おやつをおき

「夏子がおやつを持ってくる」ではない。入っているのは **動線 / 経由する姿勢 /
小道具の扱い / 画面内の着地点**。同じ全集には
「**おもいきり**けっとばすが **ゆとりで**かわす」（2 人の力みの差を 1 行で対比）、
「**おもわぬ軽快さで**ま上にとんでいく」のような書き方が並ぶ。

**「A が食べる」は出来事の要約であって、芝居ではない。**

---

## 1. 動作は 1 行で書かない。6 つに割る

```
[姿勢]   どう座っている / 立っているか（正座・あぐら・椅子・立膝・体育座り）
[目線]   誰の / 何の どこを見ているか（顔の向きと目の向きを分ける）
[小道具] 何を、どちらの手で、どう持っているか
[予備]   主動作の前に、一度何をするか
[主]     何を、どの速さ・力みでするか
[余韻]   止まったあと、何が残って動くか / 何を元に戻すか
```

- **最低でも `[小道具]` `[予備]` `[主]` の 3 つ**を書く。
- `[姿勢]` は前のカットから変わらなければ省略してよい。
- **`[目線]` は会話・対人のカットでは必須**（書かないと全員がカメラを見る）。
  顔の向きと目の向きは**別に書く**（「顔は手元、目だけが相手へ」）。

---

## 2. 7 つのルール

語の有無で分かる 3・4・7 は `python3 <SKILL_DIR>/scripts/gesture_lint.py <list_cuts の JSON>` が先に見る。

| # | ルール | 理由 |
|---|---|---|
| **1** | **動詞 1 個で止めない。** 「食べる」「話す」「怒る」で終わるト書きは未完成 | 動詞 1 個は出来事であって芝居ではない。必ず**部位と順序**を入れる |
| **2** | **手と目を必ず書く** | 感情は表情よりも**手の扱いと目線**に出る。生成映像は微細な表情差が弱いのでなおさら |
| **3** | **日本的な所作は明示する。書かなければ西洋の既定値が出る** | モデルは学習分布の中心へ寄る。「食べる」→ フォーク、「家に入る」→ 土足、「挨拶」→ 握手 |
| **4** | **手段名ではなく「何がどう見えるか」を書く** | `T光` `半露` `BOOK` はセル撮影の**物理手段の名前**で、モデルには渡らない。「窓の光が白く滲んで輪郭を溶かす」と書く |
| **5** | **1 カット = 1 動作ブロック。** 尺に入る量だけ書く | 2 秒のカットに 3 つの動作を書くと、どれも中途半端に出る（`ai-video-craft` §3） |
| **6** | **不変項（髪型・服・持ち物・光の向き）はカットごとに言い直す** | モデルは前のカットを見ていない（`ai-video-craft` §6） |
| **7** | **「やってはいけない所作」を書く**（§7 の negative 語彙） | 仏箸・握り箸・土足・立ったまま襖 —— 出た瞬間に「日本を知らない絵」になる |

> ⚠️ **カメラは `shot` に、芝居は `note` に。** 絵コンテでも書く場所が分かれている
> （枠の中の矢印＝カメラ、枠の脇の文字＝ト書き）。この分離を崩さない。
> カメラ語彙は `film-grammar` の references/shot-vocabulary.md。
> なお **上手＝画面の右／下手＝画面の左**（映画の定義。舞台とは逆なので混同しない）。

---

## 3. 予備動作 → 主動作 → 余韻（**①と③が落ちる**）

アニメーションの 12 原則のうち 3 つが、そのまま 1 動作の 3 分割になっている。

| 段 | 原則 | 中身 |
|---|---|---|
| **① 予備動作** | アンティシペーション | 主動作の直前に**一度逆へ動く**。ジャンプ前にしゃがむ、投げる前に腕を引く |
| **② 主動作** | — | **タメ**（ゆっくり溜める）と**ツメ**（一気に）で強弱を付ける |
| **③ 余韻** | フォロースルー | 止まったあとも動き続けるもの（髪・服・持ち物）。**残身** |

### 日本の所作は、①と③が「作法として決まっている」

| 動作 | ① 予備動作 | ② 主動作 | ③ 余韻 |
|---|---|---|---|
| 食べ始める | 箸を取る前に**手を合わせる** / **茶碗を先に持つ** | 三手で箸を取る → 食べる | — |
| 汁を飲む | **蓋を開けて露を切る** | 両手で持ち上げ、縁から飲む | 膳に戻し、**蓋を元の向きに戻す** |
| 襖を開ける | **こぶし 2 つ分手前に座り、声をかける** | 引手で 5cm → 親骨で中央まで → 手を替えて残り | **5cm 残す** |
| 部屋に上がる | **正面を向いたまま**靴を脱ぐ | 上がり框に上がる | **膝をついて靴の向きを変え、端に寄せる** |
| 挨拶する | **言葉を先に言い切る**（語先後礼） | すばやく下げる | **一呼吸静止 → ゆっくり戻す** |
| 名刺を渡す | 名刺入れに載せ、向きを変える | 両手で胸の高さに差し出す | **受け取った名刺を読む**（すぐしまわない） |

**AI が勝手に補えるのは ② だけ。**①と③は文化固有なので、書かなければ消える。
消えると一気に「日本ではない映像」になる —— 手を合わせずに食べ始める、
立ったまま襖を開ける、言いながら頭を下げる。
**つまり、書く価値がいちばん高いのは ①（予備動作）と ③（余韻）。**

---

## 4. 速度・力み・重さ・目線の語彙

| 軸 | 日本語（ト書き） | 英語（プロンプト） |
|---|---|---|
| **速度** | ゆっくり / そっと / するりと / さっと / 一気に / おもいきり | slowly / gently / smoothly / quickly / in one motion / with full force |
| **加減速** | タメてから一気に / ふっと力が抜ける | eases in then snaps / eases out into stillness |
| **力み** | 力を込めて / 力なく / ぐっと / ふわりと / ぎこちなく / ゆとりで | tense / limp / firmly / lightly / stiffly / effortlessly |
| **重さ** | 重そうに / 軽々と / 両手で抱えて / 片手でひょいと | as if heavy / effortlessly / carried with both arms / lifted with one hand |
| **音** | 音を立てずに / かちりと / ことり、と置く / ばたん | silently / with a click / sets it down with a small clack / slams |
| **視線** | 目を伏せる / 目だけ動かす / 顔ごと向ける / 目が合う / 目を逸らす | lowers the eyes / shifts only the eyes / turns the whole head / meets the gaze / looks away |
| **停止** | 一拍おいて / 動かない / 息を止める | after a beat / holds still / holds the breath |

**文の型**（現場のト書きは凝った構文を使わない。読点で並べるだけ）:

```
<動線>、<経由する姿勢>、<小道具の扱い>、<着地>
```

連用形で繋ぐと 1 行が 1 連続の動作として読める。**モデルへ渡すときも同じ形が効く**
（動作を区切って並べると時系列として扱われる）。

---

## 5. 書き換え例

**Before（要約で止まっている。これが「箸を使わず手で食べる」を生む）**

```
C12  3s  A が食べる。
```

**After（型に沿って割る）**

```
C12  3s  [shot] medium shot, low table from a slight front angle, evening window light from the left
  姿勢:   A は座卓に正座。膝の前に一汁三菜の膳
  目線:   最初は手元の茶碗、最後だけ向かいの B へ上がる
  小道具: 右手に箸、左手にご飯茶碗（持ち上げたまま）
  予備:   両手を胸の前で合わせ、軽く頭を下げる（1 拍）
  主:     茶碗を両手で持ち上げて左手にのせ、右手で箸を取り上げ、
          左手の指の間で箸先を挟んでから持ち替える。ひと口ぶんを口へ運ぶ
  余韻:   噛みながら、目だけが B へ上がる
  NG:     フォーク・スプーン、箸をご飯に立てる、箸を握りこむ、皿に顔を近づけてかき込む
```

英語プロンプトに落とすとき:

```
A young woman kneels in seiza at a low table, evening window light from the left.
She presses her palms together at her chest and bows her head slightly, then lifts the rice
bowl with both hands and settles it on her left palm, picks up the chopsticks with her right
hand, and brings a mouthful to her lips. Her eyes stay on the bowl, then lift to the man
across the table.
(negative: fork, spoon, chopsticks standing upright in the rice, fist grip on chopsticks,
face lowered into the bowl)
```

---

## 6. 日本の所作チートシート

**使い方**: 場面から引き、**日本語欄をト書きに、英語欄をプロンプトに**入れる。
英語は訳ではなく「**映像で何が見えるか**」の記述にしてあるので、そのまま使える。

⚠️ **作法を「正解は 1 つ」として扱わない。** 椀の蓋の置き方・合掌の有無・ノックの回数・
参道の歩き方などは**地域と流派で違う**。作品の格式・時代・土地に合わせて選ぶ。

### 食事

| # | 場面 | 日本語の所作（手順） | 英語表現（プロンプト用） |
|---|---|---|---|
| 1 | 箸を持つ | 上の箸を親指・人差し指・中指で鉛筆のように、下の箸を親指の付け根と薬指で固定。**動くのは上の箸だけ** | holds the upper chopstick like a pencil between thumb, index and middle finger; the lower one rests in the crook of the thumb on the ring finger; only the upper chopstick moves |
| 2 | 箸を取り上げる | 右手で上から取る → 左手で下から受ける → 右手を滑らせて持ち替える（**三手**） | picks the chopsticks up from above with the right hand, cradles them from beneath with the left, then slides the right hand under into the grip |
| 3 | 箸を置く | 逆の三手で**箸置き**に揃えて置く。音を立てない | lays the chopsticks side by side on the chopstick rest without a sound |
| 4 | 食べ始める | 手を合わせて「いただきます」→ **茶碗を先に**両手で取る → 箸を取る | presses the palms together at chest height and bows the head, then lifts the rice bowl with both hands before picking up the chopsticks |
| 5 | ご飯を食べる | 左手に茶碗を**持ち上げたまま**、右手の箸で口へ運ぶ | eats with the rice bowl held up in the left hand, close to the chest |
| 6 | 汁椀の蓋を開ける | 左手で椀の縁を押さえ、右手で蓋を上へ → 傾けて**露を椀へ落とす** → 裏返して右に置く | presses the rim of the lacquered bowl with the left hand, lifts the lid, tilts it so the condensation runs back in, and sets it upside down to the right |
| 7 | 汁を飲む | 椀を**両手で持ち上げ**、箸で具を押さえながら椀の縁から飲む | lifts the lacquered bowl with both hands and drinks from its rim, holding the solids back with the chopsticks |
| 8 | 麺をすする | 箸で 4〜5 本をつまみ上げ、**空気ごと一気に吸い込む**。音が出る | lifts four or five strands with the chopsticks and slurps them up in one quick audible breath |
| 9 | ラーメンを食べる | 丼は持ち上げず、**丼の上に身を乗り出して**食べる。レンゲはスープ用 | leans forward over the large bowl rather than lifting it, using the flat-bottomed spoon for the broth |
| 10 | 食べ終わる | **箸を箸置きに戻してから**手を合わせて「ごちそうさま」→ **蓋を元の向きに戻す** | sets the chopsticks down on the rest first, then presses the palms together again; replaces the bowl lid the right way up |
| 11 | 酌をする / 受ける | 徳利は**両手**で持って注ぐ。受ける側は猪口を**持ち上げて**受ける | pours from the flask with both hands; the other lifts the small cup off the table to receive it |
| 12 | お茶を飲む（湯呑み） | 右手で持ち上げ、**左手を底に添えて**飲む。茶托は持ち上げない | lifts the cup with the right hand and supports its base with the left, leaving the saucer on the table |

### 住まい

| # | 場面 | 日本語の所作（手順） | 英語表現（プロンプト用） |
|---|---|---|---|
| 13 | 玄関で靴を脱ぐ | **正面を向いたまま**脱ぎ、上がり框に上がる | steps out of the shoes while still facing forward and steps up onto the raised wooden floor |
| 14 | 靴を揃える | 上がってから**斜めに膝をつき**、片手で靴を**つま先が外向き**になるよう回し、端へ寄せる | kneels at an angle on the step, turns the shoes with one hand so the toes point back toward the door, and sets them to one side |
| 15 | スリッパ | 玄関でスリッパに履き替え、**和室に入る前に脱ぐ** | changes into house slippers at the entrance and steps out of them before entering the tatami room |
| 16 | 襖を開ける | 手前に正座し声をかける → 引手で 5cm → 親骨を押して中央まで → 手を替えて残り（**5cm 残す**） | kneels before the sliding panel, slips the fingers into the recessed pull and eases it open a few centimetres, then moves the hand to the frame and slides it open in two further movements |
| 17 | 襖を閉める | 敷居から 15cm 上 → 手を替えて 30cm 上 → 最後に引手 | closes the sliding panel in three movements, finishing with the fingers in the recessed pull |
| 18 | 敷居・畳の縁 | **踏まずにまたぐ** | steps over the threshold and the tatami border rather than on them |
| 19 | 正座する | 左膝 → 右膝の順に床につき、かかとの上に座り、**両足の親指を重ねる** | lowers the left knee first, then the right, and settles back onto the heels with the big toes overlapping |
| 20 | 正座から立つ | つま先を立てて**跪座** → **右膝**から立つ → 左足を揃える | rises onto the balls of the feet, stands leading with the right knee, and brings the left foot alongside |
| 21 | 座布団に座る | 座布団の**手前の畳に座り**、膝とつま先で**にじって**上へ移る。踏まない | kneels on the tatami beside the cushion and shuffles forward onto it on the knees, never stepping on it |
| 22 | 和室での移動 | 立ち上がらず、**膝で進む（にじる）** | moves forward on the knees instead of standing |

### 挨拶・対人

| # | 場面 | 日本語の所作（手順） | 英語表現（プロンプト用） |
|---|---|---|---|
| 23 | 会釈 | 上体を**約 15 度**。視線は 3m 先 | a shallow bow of about fifteen degrees, eyes falling a few metres ahead |
| 24 | 敬礼（普通礼） | 上体を**約 30 度**。腰から折り、背中は一直線 | a bow of about thirty degrees from the waist, back perfectly straight |
| 25 | 最敬礼 | 上体を**約 45 度以上**、**3〜4 秒静止** | a deep bow of forty-five degrees or more, held for several seconds |
| 26 | お辞儀の手 | 男性は**体の横**、女性は**体の前で右手を下に重ねる** | hands flat against the thighs (men) or overlapped in front of the body (women) |
| 27 | 語先後礼 | **言葉を言い切ってから**頭を下げる。下げは速く、戻しはゆっくり | speaks first, finishes the greeting, and only then bows — going down quickly and coming up slowly |
| 28 | 座礼 | 正座のまま、**両手を畳につき（指先を内向きに合わせ）**、その間へ頭を下げる | bows from seiza, placing both hands on the tatami with the fingertips angled inward, and lowering the head between them |
| 29 | 名刺を渡す | 名刺入れの上に載せ、相手が読める向きで**両手・胸の高さ**。**目下から先に、やや低く** | offers the card with both hands at chest height, resting on the card case and turned to face the recipient |
| 30 | 名刺を受け取る | 「頂戴いたします」と**両手**で受け、**胸より下に下ろさず**名前を読む | receives the card with both hands and reads the name without lowering it below chest level |
| 31 | 物を渡す | **両手で、正面を相手に向けて**。紙袋からは出してから | holds the object out with both hands, its front turned toward the other person |
| 32 | お茶を出す | 茶托を**両手**で、客の**右後方から**、**高さを合わせて屈んで** | crouches to the seated guest's height and sets the saucer down with both hands from behind their right shoulder |

### 学校・職場

| # | 場面 | 日本語の所作（手順） | 英語表現（プロンプト用） |
|---|---|---|---|
| 33 | 登校（昇降口） | 下駄箱で通学靴を入れ、**上履きに履き替える** | changes from outdoor shoes into indoor shoes at the numbered cubbies in the entrance hall |
| 34 | 授業の号令 | 日直の号令で全員**起立 → 一斉に礼 → 着席** | at the monitor's call the whole class stands, bows in unison, and sits back down |
| 35 | 教室で座る | 椅子に浅く腰掛け、背筋を伸ばす。**机の横にフックで鞄** | sits upright on the chair, school bag hanging from the hook on the side of the desk |
| 36 | 体育座り | 床で膝を立て、**両腕で脛を抱える** | sits on the floor with the knees drawn up and both arms wrapped around the shins |
| 37 | 給食 | 白衣と帽子・マスクの**給食当番**が配膳し、全員で「いただきます」 | students in white serving coats and caps ladle lunch at the front of the classroom |
| 38 | 部活 | 体育館の入口で**一礼してから**入る | stops at the edge of the gym floor and bows before stepping on |
| 39 | 入室（洋室） | ノック → 返事を待つ → 「失礼します」→ **ドアを閉めてから**一礼 | knocks, waits for the reply, steps in, closes the door, and only then bows |
| 40 | 退室 | ドアの前で向き直り、一礼してから出る | turns back at the door and bows once before leaving |

### その他

| # | 場面 | 日本語の所作（手順） | 英語表現（プロンプト用） |
|---|---|---|---|
| 41 | 傘を持つ | 閉じた傘は**先端を下**に向けて体の横 | carries the closed umbrella point-down at the side |
| 42 | 傘の水を切る | **軒下で**開いたまま軽く上下に振ってから閉じる。回して飛ばさない | shakes the open umbrella lightly under the eaves before folding it |
| 43 | 傘（車内） | 体の**正面で縦に**持つ | holds the umbrella upright against the body |
| 44 | 電車で吊り革 | 片手で吊り革、**リュックは前に抱える** | holds the hanging strap with one hand, backpack carried in front |
| 45 | 改札 | IC カードを**読み取り部にタッチ**して通る | taps the IC card on the gate reader and walks through |
| 46 | 自転車 | 後輪のスタンドを**足で蹴って**立てる。校門内は**押して歩く** | kicks the rear stand down with one foot; walks the bicycle in through the gate |
| 47 | コンビニ会計 | 商品を台に置き、**カルトン（小さなトレー）に現金を置く** | sets the items on the counter and places the coins on the small rubber tray |
| 48 | 鳥居 | 手前で**衣服を整え、軽く一礼**してからくぐる | stops before the gate, straightens the clothes, and bows once before passing through |
| 49 | 手水 | 左手 → 右手 → 口（左手に受けて）→ 左手 → 柄を立てて流す（**柄杓一杯で**） | rinses the left hand, then the right, then the mouth from the left palm, rinses the left hand again, and tips the ladle upright to rinse the handle |
| 50 | 拝礼 | 賽銭を静かに入れ、鈴を鳴らし、**二拝二拍手一拝** | drops the coin in quietly, rings the bell, bows twice, claps twice at chest height, and bows once more |
| 51 | 着物で座る | しゃがみながら**膝裏の裾を撫でて**たたみ、**袖を両側へ流す** | sweeps the hem smooth behind the knees while lowering into seiza, then lays the sleeves to either side |
| 52 | 着物で手を上げる | もう片方の手で**袖口を押さえる** | holds the opposite sleeve closed at the wrist when raising an arm |
| 53 | 着物で階段 | 体を**斜め**にし、**褄を持ち上げて**上る | turns slightly sideways and lifts the front hem when climbing the stairs |
| 54 | 浴衣で歩く | 歩幅を狭く、**内股気味**に、腰から下を動かさない | walks with short steps, knees close together, the hips barely moving |

## 7. negative に入れる語（出たら一発で壊れるもの）

```
fork, spoon, knife, eating rice with the hands,
chopsticks standing upright in a rice bowl, chopsticks laid across the bowl,
fist grip on chopsticks, passing food chopstick-to-chopstick, pointing with chopsticks,
wearing shoes indoors / on tatami, standing while opening a sliding paper door,
stepping on the tatami border or the threshold, stepping on a floor cushion,
handshake / hug as a greeting, one-handed business card exchange,
bowing while still speaking, bowing with a rounded back
```

---

## 8. 文字で押し切らない

**書いても出ない所作がある。** 3 回投げて出なければ、それはト書きの書き方ではなく
**モデル側の限界**なので、絵コンテ（board sheet）側に倒す —— **正しい所作を描いた
コマを参照に渡す**ほうが速い（`storyboard` / `cinematographer` の reference-to-video）。
それでも出なければ、**その所作が映らない構図に変える**（`ai-video-craft` §5）。

書式を足したら、同じシーンを 2 通りで生成して**実際に効いたかを見る**:
箸を持っているか／握り箸になっていないか／屋内で靴を履いていないか／
挨拶が握手になっていないか／**予備動作（手を合わせる・声をかける）が映っているか**。

## 出典

- [スタジオジブリ絵コンテ全集 23 読書メモ](https://note.com/kakinaihotaru/n/n6dd5d7ab9bed) — ト書き原文の引用
- [三鷹の森ジブリ美術館「絵コンテを読む。」](https://www.ghibli-museum-shop.jp/contents/storyboard/)
- [絵コンテ用語解説](http://www.mars.dti.ne.jp/yato/eva/cont.htm) — 誌面の逐条解説
- [益山亮司「レイアウト⑤ 目線と表情」](https://note.com/masuyama56/n/n38b4e1746c79)
- [アニログ「アニメーションの 12 原則」](https://animlog.net/12principles-of-animation/)
- [和食文化国民会議「最初は、茶碗？ 箸？」](https://washokujapan.jp/column/info-20220926/) / [All About「箸使い 30 の NG マナー」](https://allabout.co.jp/gm/gc/505270/)
- [All About「襖の開け方・閉め方」](https://allabout.co.jp/gm/gc/220739/) / [nippon.com「靴を脱ぐ『玄関』は家の結界！」](https://www.nippon.com/ja/guide-to-japan/gu020004/)
- [東京都神社庁「参拝の作法」](http://www.tokyo-jinjacho.or.jp/sanpai/)
- 調査の全文（諸説ありの 10 項目・業界用語 40 語の表を含む）は
  `docs/_research/2026-09-25-direction-notation-and-japanese-gestures.md`
