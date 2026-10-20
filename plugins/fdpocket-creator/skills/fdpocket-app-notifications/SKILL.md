---
name: fdpocket-app-notifications
description: ミニアプリの同意付き通知テンプレートとサーバーからの通知送信を実装するときに使う。
---

# 通知

path付きテンプレートには対象のweb Appを `app: reports` のように明示する。manifest に通知テンプレート（日本語・英語の title / body / path と許可した params）を宣言する。サーバー app に `servicePermissions: [notifications.send]` を宣言し、`@workspace/sdk/server` の client から `notifications.send({ template, to, params, dedupeKey })` を呼ぶ。宛先は ProjectUserId。ブラウザにサーバー資格情報を置かない。

利用者の通知同意と設定、承認済みテンプレート、送信上限は Platform が確認する。通知を止めた利用者へ送らない。秘密や個人情報を文面やパラメータに入れない。

`kit dev` / ライブプレビュー / 検証の通知は固定の `{ recipients: 0 }` を返すモック。実際の通知を送らず開発パネルに件数を記録する。本番での配信確認と区別する。
