# 人型以外のリグとモーション

対応する体型・動作にはTripo専用AIを優先する。未対応の体型や独自動作はAIがBlenderで骨格・ウェイト・アクションを作り、ゲームで動くGLBまで完成させる。全体を移動・回転するだけでは「リグを付けて動く」要件を満たさない。

## 1. 専用AIを優先する

入力と形状の診断は [model-quality.md](model-quality.md) を先に使う。
翼/膜/指/脚の隙間を一律のリメッシュで消さず、骨格を付ける前に必要な可動部を保つ。

1. `$game-art-direction` §3に従いライブラリを調査し、合うモデルが無ければBlenderでのモデリングを評価、難しければ `generate_model_3d` で形を作る（非人型ではrig=false）。既存のリグ・必要なクリップが体型と動作に合う場合は再利用し、不足分だけ以下で補う。
2. `rig_model_3d(name, asset_id, rig_type)`で体型に合うTripo v2.5のリグを作る。無料rig-checkで体型一致を確認してから有料リグを依頼する。入力GLBは150 MB以下。
3. `animate_model_3d(name, asset_id, animations, animate_in_place=true)`へ**rig_model_3dのready成果物**を渡す。体型に合う下記の公式presetだけを使う。
4. 有料タスクのPROVIDER_TIMEOUTは返されたasset_idをget_assetで回収する。追加の有料生成でやり直さない。無料rig-checkのタイムアウトにはasset_idが無く、有料リグは未送信なので確認から再試行できる。

| rig_type | 確認済みpreset |
|---|---|
| biped | preset:idle / walk / run / dive / climb / jump / slash / shoot / hurt / fall / turn（全てpreset:接頭辞） |
| quadruped | preset:quadruped:walk |
| hexapod | preset:hexapod:walk |
| octopod | preset:octopod:walk |
| serpentine | preset:serpentine:march |
| aquatic | preset:aquatic:march |
| avian | 自動リグは対応。飛行presetは公式一覧に無いので、リグをBlenderへ渡してFlyを作る |

これらはTripo直接API（TRIPO_API_KEY）を使う。専用ツールが提供されていない・rig-check非対応なら以下のBlender経路を使い、その経路を報告する。未確認のpresetを捏造しない。四足Run/Attack、翼と四足の複合体、機械の関節もBlenderで追加調整する。

公式仕様: https://developers.tripo3d.ai/en/docs/animations-rig / https://developers.tripo3d.ai/en/docs/animations-retarget

### Blenderで体型に合わせる

| 体型 | 骨格 | 動作と注意点 |
|---|---|---|
| 人型・二足のロボット | Meshyの自動リグ、または人型のBlenderリグ | 人型の骨格と関節配置が合う場合だけSMPL-Hをリターゲット |
| 四足（犬・猫・馬） | root→spine→neck/head、四肢それぞれ上肢→下肢→足、tail | Idle / Walk / Run。歩行と速歩の接地順を区別。支持足はIKで固定し、足滑り・地面貫通を確認 |
| 鳥・翼のある生物 | root→spine、左右wing肩→肘→翼先、neck/head、tail、必要なら脚 | Idle / Fly / Land。羽ばたきは肩だけでなく肘と翼先にも。ドラゴンは四足＋翼の複合リグ |
| 魚・水生生物 | head/body→spineの連鎖→tail、必要ならfin | Idle / Swim。尾へ向かって位相を遅らせ、胴体が剛体のままにならないようにする |
| 蛇・長い生物 | rootと胴体に沿う連続したspine | Idle / Slither。左右に波を伝える。背骨が地面から浮かず、胴の伸縮を避ける |
| 六脚・八脚 | root→body、左右3/4対の脚ごとに2〜3関節と足 | Idle / Walk。六脚は三脚支持、八脚は交互の支持群など体型に合う接地順。四足の位相をそのままコピーしない |
| 機械・特殊形状 | 実際の可動部に合わせた関節。硬い部品は骨に100%ウェイト、柔らかい部分だけスキニング | Open / Rotate / Attackなど依頼に合う動作。骨が不要な硬い可動部ならノードアニメーションでよいが、リグ要求なら骨格を作る |

人型以外の生成は `generate_model_3d(..., rig=false)` で形を作り、そのGLBを `run_3d_script` の `inputs` に渡す。形だけなら既定MeshyでもTripo/Hi3Dでもよい。falで確認できたMeshyの自動リグは人型向け。Tripo本体の非人型APIをfalのエンドポイントとして呼ばない。

## 2. 形を見て関節位置を決める

1. 最初に生成物の4方向プレビューとメッシュのboundsを確認する。正面-Y、上+Z、足元Z=0に正規化し、回転・スケールを適用する。
2. 頭・胴・翼・尾・各脚の位置をログと画像で確認し、骨のhead/tail座標をスクリプトに明示する。boundsの割合だけで関節位置を決めない。左右対称でない生物は骨も非対称にする。
3. 骨は親から子の順に作り、headとtailを同じ点にしない。親子関係は体の接続に合わせる。rootには全体移動、spineには胴の変形を担当させる。
4. 有機的なメッシュは自動ウェイト `parent_set(type="ARMATURE_AUTO")` を使い、全ての変形対象頂点に正のウェイトがあるか確認する。heat weighting失敗や未割当は成功扱いにしない。メッシュの重複・非多様体を直すか、部位の近傍骨へ明示的にウェイトを付け直して確認する。
5. 目・牙・装飾などの硬い部位は近い骨の単独ウェイトまたはbone parentingを使う。左右脚や翼のウェイトが反対側へ漏れていないか、最大屈曲のポーズで確認する。

骨格を作る基本API（骨の具体的な座標と名前は対象モデルから決める）:

```python
bpy.ops.object.armature_add()
rig = bpy.context.object
bpy.ops.object.mode_set(mode="EDIT")
rig.data.edit_bones.remove(rig.data.edit_bones[0])
for name, head, tail, parent in bone_specs:
    bone = rig.data.edit_bones.new(name)
    bone.head, bone.tail = head, tail
    if parent:
        bone.parent = rig.data.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
weighted_groups = {g.index for g in mesh.vertex_groups if g.name in rig.data.bones}
if any(not any(g.group in weighted_groups and g.weight > 0 for g in v.groups)
       for v in mesh.data.vertices):
    raise ValueError("unweighted deforming vertices; repair weights before export")
```

## 3. 依頼の動作を作る

- スクリプトに骨ごとのキーフレームを作る。`Idle`だけで終わらせず、ゲームに必要なWalk / Run / Fly / Swim / Slither / Attackを用意する。ゲームに不要な動作まで量産しない。
- フレーム1で**全ての骨**の回転・位置・スケールをリセットして記録し、前のアクションが次へ漏れないようにする。回転軸は各骨のローカル軸に合わせる。
- ループでは終端と先頭の姿勢を一致させる。魚・蛇の波は角度を `amplitude * sin(phase - joint_index * lag)` のように関節ごとに遅らせ、名前だけの静止クリップを作らない。
- 歩行の接地はIK等で制御する。翼の変形は肩・肘・先端の連動を作る。非ループのAttack/Jump/Landは開始→予備動作→本動作→復帰を作る。
- IK/ドライバ/制約は `nla.bake(..., visual_keying=True, bake_types={"POSE"})` 等で骨の変形に焼き込む。glTFにBlenderの制約そのものは渡せない。
- 1動作1アクション・NLAトラック。`export_animation_mode="NLA_TRACKS"`で全動作を出し、書き出し後に読み直してアニメ一覧とスキンを確認する。

## 4. 完成条件とクレジット

- Sandboxの `exports` 例: `{"path":"wolf.glb","kind":"model_3d","name":"wolf","require_rig":true,"required_animations":["Idle","Walk","Run"],"optimize":true}`。静止モデルやimageにはrequire_rigを指定しない。
- 結果がrunningならget_3d_runで回収し、失敗ならlogを読んで修正する。静止モデルへ自動的に差し替えて終わらない。
- statsのjoints / skins / animationsと**実際に再生したプレビュー**を確認。前・横・後ろから、脚滑り・地面貫通・尾や翼の崩れ・ループ継ぎ目を確認してから完成とする。静止プレビュー4方向だけではモーション検証にならない。
- GLBをゲームのBabylon AnimationGroupで再生し、モバイルでも必要な動作が切り替わることを確認する。ポリゴン・テクスチャをゲーム向けに軽量化する。
- 形の生成は選んだfalモデルの原価、Blender処理は既存のSandbox実行時間・資源の実測料金でクレジットを消費する。専用リグ・モーションはTripo応答のcredits_consumedを実測記録（1 Tripo credit = $0.01、100分の1 credit単位で整数記録）し、TOKOYOクレジットへ既存の換算で反映する。公開目安はリグ$0.25、アニメ1本$0.10。Tripo残高とTOKOYO残高は別物。
