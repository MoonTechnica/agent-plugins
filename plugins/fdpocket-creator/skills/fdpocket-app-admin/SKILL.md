---
name: fdpocket-app-admin
description: 管理画面（admin の App）と権限（Role・Permission）を設計する。access restricted と requiredPermission、project.yaml の roles・defaultRoles・ownerBootstrap、admin の capability、画面の出し分けと守りの分離、kit dev での確かめ方。管理・運営・承認・ユーザーの権限が依頼にあるときに使う。
---

# 管理画面と権限

## 1. いつ作るか

「管理」「運営」「承認」「ユーザーの権限」「全員のデータを見る」が依頼にあるとき、または他人のデータを扱う役割があるとき。
1 人で使う道具・全員が同じ権限のアプリには作らない（`kit new --apps web`）。

## 1b. 管理画面の骨格（画面を作る前に決める）

管理画面は行き先が多い（一覧・詳細・ユーザーと権限・設定…）ので、**最初に行き先の一覧を書き出し、ひな形の `apps/admin/src/routes/__root.tsx` の `NAV_GROUPS` に入れる**。画面（`routes/` のファイル）を足すたびに、ここへ 1 行足す。足し忘れるとその画面へ行く道が無い。
並びはよく使う順（先頭の 4 つがスマホ幅の下のタブ。6 個以上は残りが自動で「その他」に入る）。節の見出し・上部の道具の帯（`topBar`）・フッター・ナビの下端のアカウントは `$fdpocket-app-responsive` §2。権限で見せない行き先は `client.auth.can()` で配列から外す（表示の補助。守りは次の 3 層）。

## 2. 守りの 3 層（どれも省かない）

| 層 | 書く場所 | 役割 |
|---|---|---|
| App を開けるか | `project.yaml` の `access: restricted` + `requiredPermission: app.access.admin` | Permission を持たない人には Host も Gateway も admin を開かせない |
| App が使える操作 | admin の `capabilities` | admin だけがユーザー・Role・監査に触れる。web には宣言しない |
| 行ごとの可否 | ZModel のポリシー（`auth().permissions?[name == '…']`） | 誰が・どの行を読める / 変えられるかの最終判断 |

**画面の条件分岐（`client.auth.can()`）は表示の補助で、どの層の代わりにもならない。**

## 3. project.yaml

```yaml
apps:
  admin:
    kind: web
    access: restricted
    requiredPermission: app.access.admin
    displayName: { ja: "タスク 管理", en: "Tasks Admin" }
    capabilities:
      models:
        user: [read]
        task: [read, update, delete]
        projectRole: [read, create, update, delete]
        rolePermission: [read, create, delete]
        userProjectRole: [read, create, delete]
        auditEvent: [read]
roles:
  admin: [app.access.admin, users.manage, roles.manage, audit.read, tasks.manage]
  moderator: [app.access.admin, tasks.manage]
  member: [workspace.create]
defaultRoles: [member]
ownerBootstrap: [admin]
```

- Permission は機能単位に分ける（`tasks.manage` / `reports.read`）。Role はその束。
- `ownerBootstrap` の Role が作者に付く（作者が最初の管理者）。`defaultRoles` は全員に付くので、管理の Permission を入れない。
- web の capability に `projectRole` / `userProjectRole` / `auditEvent` を入れない。

## 4. ZModel

管理の操作はポリシーに Permission の条件として書く:

```zmodel
@@allow('read', workspace.members?[userId == auth().id] || auth().permissions?[name == 'tasks.manage'])
@@allow('update,delete', ownerId == auth().id || auth().permissions?[name == 'tasks.manage'])
```

人に Role を付ける画面は `userProjectRole` の create / delete（基底のポリシーが `users.manage` を求める）。
自分の管理者の Role を外せる画面にするなら、最後の管理者を外さない確認を画面に入れる（基底は止めない）。

## 5. 画面

- 一覧（ユーザー・データ・監査）は全部ページングする（管理画面は件数が多い）。検索・絞り込みを付けるなら `where` で DB 側で絞る。
- 破壊的な操作（削除・権限の剥奪）は確認を挟み、結果を画面に出す。
- 監査（`auditEvent`）を見せるなら `at` の降順・ページング・`actorId` / `action` で絞る。

## 6. 確かめる（`kit dev`）

- admin を **member で開くと `FORBIDDEN`**、admin で開くと開くこと（`$fdpocket-app-testing` §2）。
- admin で Role を付け替えると、次のリクエストから web の表示も変わること（Permission はリクエストごとに DB から引かれる）。
