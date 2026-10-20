---
name: fdpocket-app-storage
description: ミニアプリでファイル（画像・添付・書類）を扱う。project.yaml の論理バケット（public・maxBytes・contentTypes）と capability、可視性（private・workspace・public）、client.storage のアップロード・ダウンロード・削除、一覧は db.storageFile、画像の表示、上限。ファイルを保存・表示する機能を作るときに使う。
---

# ファイル

## 1. バケットを宣言する（`infra/project.yaml`）

```yaml
buckets:
  attachments:
    public: false                 # 誰でも見られる CDN 配信が要るときだけ true
    maxBytes: 10485760            # 1 ファイルの上限（100 MiB まで）。用途に合う最小にする
    contentTypes: [image/png, image/jpeg, image/webp, application/pdf]   # image/* のように書いてもよい
apps:
  web:
    capabilities:
      buckets:
        attachments: [read, write, delete]
      models:
        storageFile: [read]       # 一覧・メタデータを db で読むなら要る（create / update は宣言できない）
```

- バケットは用途ごとに分ける（`avatars` / `attachments` / `exports`）。10 個まで。
- `contentTypes` は必要な種類だけ。何でも受け付ける `*/*` にしない。
- 同じProjectのApp間で共有しないバケットだけ `appScoped: true` を指定する（`public: false` 必須）。同じ本人・管理者でも別Appからは一覧・取得・確定・削除・grant操作ができない。未指定なら従来どおり共有する。
- App専用の所属はアップロード時に固定する。設定を変えても既存ファイルを移動・再分類しない。業務モデルで `auth().appSlug` を使わず、基底Storageポリシーに任せる。

## 2. 可視性

| `visibility` | 見られる人 | 使う場面 |
|---|---|---|
| `private`（既定） | 上げた本人 | 個人の書類・下書き |
| `workspace` | `workspaceId` の Workspace のメンバー | チームの添付 |
| `public` | 誰でも（`public: true` のバケットだけ。CDN の URL） | 公開プロフィールの画像など、ログインせずに見せるもの |

読めるかどうかは `StorageFile` の基底のポリシーが決める（本人・Workspace・`public`・個別の共有 `StorageGrant`）。
削除は本人か、Workspace の owner / admin。

## 3. 使い方

```ts
import { client } from '@workspace/sdk'

const bucket = client.storage.from('attachments')
const file = await bucket.upload(input.files[0], {
  workspaceId,
  visibility: 'workspace',
  onProgress: ({ loaded, total }) => setProgress(Math.round((loaded / total) * 100)),
})
// 業務の行にはファイルの id を持たせる（URL は保存しない）
await client.db.task.update({ where: { id: taskId }, data: { attachmentId: file.id } })

const { url } = await bucket.getDownloadUrl(file.id)    // 表示・ダウンロードのたびに取る（60〜300 秒で切れる）
await bucket.remove(file.id)
```

- 業務のモデルからは `StorageFile` の id（`String`）を持つか、`StorageFile` への relation を張る。**URL を DB に保存しない**（署名 URL は切れる）。
- 権限取消を次の取得から反映したいprivateバケットは `delivery: proxy` を指定する。同じ `getDownloadUrl()` のURLをimg/videoのsrcやPDFを開くリンクへ指定できる。全量をBlobにしない。Rangeはブラウザが必要に応じて送る。URLは特定ファイルの短命な資格情報なので共有・保存・ログ出力しない。長時間再生ではexpiresAt前に再発行し、再生位置を保ってURLを更新する。publicとは併用できない。取得済みの内容は回収できない。
- 一覧は `client.db.storageFile.findMany({ where: { bucket: 'attachments', workspaceId, status: 'active' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20 })`。
  ページングする。
- 画像を一覧に並べるときは、表示の直前に `getDownloadUrl` を取り、`<img loading="lazy" width height>` で大きさを決めて置く（レイアウトを動かさない）。
  大量に並べるならサムネイル用の小さい画像を上げ時に作って別ファイルにする（ブラウザの canvas で縮める）。
- アップロード中は進み具合を出し、失敗（`PAYLOAD_TOO_LARGE` / `VALIDATION_FAILED` / `FORBIDDEN` / `GATEWAY_UNAVAILABLE`）を画面に出す。

## 4. 上限と注意

- 1 ファイル 100 MiB まで（バケットの `maxBytes` が小さければそれまで）。空のファイルと名前の無いファイルは SDK が断る。
- 送信は Gateway を通らず、署名 URL へ直接 PUT される。`upload` が返るまで（確定まで）は一覧に出ない。
- 利用者が上げた画像・書類を他人に見せる機能は、見える範囲を Workspace に閉じる（`$fdpocket-app-design` §4）。
- `kit dev` ではファイルは `.kit/objects/` に置かれる（本番と同じ形の署名 URL）。
