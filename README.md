# Moon Technica Agent Plugins

Moon Technica の製品を Coding Agent から開発するためのプラグイン一覧です。

| Plugin | 開発キット | 接続先 |
| --- | --- | --- |
| `tokoyo-creator` | [TOKOYO Developer Kit](plugins/tokoyo-creator/README.md) | TOKOYO.games |
| `fdpocket-creator` | [FDPocket Developer Kit](plugins/fdpocket-creator/README.md) | FDPocket |

使う製品のプラグインを選んでインストールしてください。認証は製品ごとに行います。

## Claude Code

```text
/plugin marketplace add MoonTechnica/agent-plugins
/plugin install tokoyo-creator@moon-technica
```

FDPocket を使う場合は、最後のコマンドを次に替えます。

```text
/plugin install fdpocket-creator@moon-technica
```

## Codex

```sh
codex plugin marketplace add MoonTechnica/agent-plugins
codex plugin add tokoyo-creator@moon-technica
```

FDPocket を使う場合は、最後のコマンドを次に替えます。

```sh
codex plugin add fdpocket-creator@moon-technica
```

インストール後の認証と使い方は各キットの README を参照してください。

## Repository structure and publishing

このリポジトリは、複数のプラグインを配布する一つのマーケットプレイスです。
Codex のカタログは `.agents/plugins/marketplace.json`、Claude Code のカタログは
`.claude-plugin/marketplace.json` にあります。両方とも同じ `plugins/` 配下を参照します。

- TOKOYO のソースと公開処理: [MoonTechnica/game-sns](https://github.com/MoonTechnica/game-sns)
- FDPocket のソースと公開処理: [MoonTechnica/app-sns](https://github.com/MoonTechnica/app-sns)

各公開処理は、自製品のディレクトリとカタログ内の自製品の項目だけを更新します。
共有 README、会社情報、他製品のファイルは保持します。同時公開で Git の競合が起きた場合は
強制 push せず、最新状態から公開処理を再実行します。

以前の `tokoyo-plugins` を登録していた場合は、新しい `moon-technica` マーケットプレイスを
追加して、利用するプラグインをインストールしてください。TOKOYO の接続先は変わりません。
