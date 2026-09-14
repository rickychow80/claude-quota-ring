# Claude Quota Ring

<p align="center"><img src="assets/logo.png" width="120" alt="Claude Quota Ring logo" /></p>

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

**API キー不要。ログイントークン不要。認証は一切不要です。**

[claude.ai](https://claude.ai) の session(5時間)と weekly(7日間)の使用量を、ツールバーの二重リングバッジで表示する小さな Chrome 拡張機能です。認証情報を求めることも、トークンを保存することも、Anthropic の API を自分から呼び出すこともありません。

![platform](https://img.shields.io/badge/platform-Chrome%20Extension-blue) ![manifest](https://img.shields.io/badge/manifest-v3-informational) ![permissions](https://img.shields.io/badge/permissions-storage%20%2B%20alarms-lightgrey)

---

## スクリーンショット

<p align="center"><img src="assets/screen-capture-1.png" width="360" alt="session と weekly の使用量リングを表示する Claude Quota Ring のポップアップ" /></p>

## 実際のデータ取得方法

多くの「使用量トラッカー」拡張機能は、API キーや OAuth トークンの貼り付けを求めたり、セッション Cookie を読み取って *代わりに* API を呼び出したりします。この拡張機能はどちらも行いません。

代わりにやっていることは、**claude.ai 自身がすでに発行しているリクエストを盗み見る**ことです:

1. `MAIN` world で動く content script(`fetch-hook.js`)が `window.fetch` と `XMLHttpRequest` を上書きします —— ただし上書きするのは**拡張機能自身のコンテキストではなく、claude.ai ページ自身の JS コンテキスト**です。Web 解析ツールがよく使う手法と同じで、外向きではなく内向きに使っているだけです。
2. ページを普通に使っているとき(開く、メッセージを送る、サイドバーが描画されるなど)、claude.ai のフロントエンドは自分自身の内部エンドポイントを呼び出します:

   ```
   GET https://claude.ai/api/organizations/{orgId}/usage
   ```

   これはあなたがすでにログインしているセッションを使います。このフックは**ページ自身がすでに正当に受け取ったレスポンス**を読むだけで、自分からリクエストを発行することも、`document.cookie` や認証ヘッダーに触れることも一切ありません。
3. レスポンスから必要なフィールドを取り出します:

   ```json
   {
     "five_hour": { "utilization": 26, "resets_at": "2026-09-15T02:10:00Z" },
     "seven_day": { "utilization": 14, "resets_at": "2026-09-20T00:00:00Z" }
   }
   ```

4. これは `postMessage` → isolated world の content script → `chrome.runtime.sendMessage` という経路でバックグラウンドの service worker に渡され、二重リングバッジを描画し、popup 用にデータを保存します。

claude.ai を一度も開かなければ、拡張機能には表示するものが何もありません —— そもそも自分から何かを取りに行くことがないからです。メッセージを送っていなくても数値を新鮮に保つため、定期的に `claude.ai/settings/usage` を**最小化・非フォーカスのウィンドウ**で数秒間開き、ページ自身に本物のリクエストを発行させてから閉じます。仕組みも信頼境界も同じで、自動化されているだけです。

## なぜこれが重要か

| | 一般的な使用量トラッカー拡張機能 | Claude Quota Ring |
|---|---|---|
| トークン/API キーの貼り付けが必要 | よくある | 不要 |
| `document.cookie` を読む | よくある | 一切なし |
| Anthropic の API を直接呼び出す | する | 一切しない |
| 要求される権限 | `cookies`、広範囲の `host_permissions`、時には `<all_urls>` | `storage`、`alarms`、`host_permissions` は `claude.ai` のみ |
| 見えるもの | 要求すれば何でも見える | claude.ai ページ自身がすでに受け取ったものだけ |

データの流れに「認証情報の抽出」という工程が一切ないため、漏洩するものもなく、実際のセッション状態とずれることもなく、取り消す必要があるものもありません。

## なぜ Claude だけなのか

Claude Pro しか課金してないから!(冗談です)

他の使用量トラッカーは、バックグラウンドのワーカーが cookie を読み取り、あなたのセッションを使って各プロバイダーの API を直接呼び出すことで、一度に多くの AI サービスに対応しています——しかしこれはまさにこのプロジェクトが避けたい信頼モデルです。cookie に触れず、自分から認証済みリクエストを発行せずに安全にそれを実現するには、サイトごとに公開されていない使用量エンドポイントを個別にリバースエンジニアリングし、保守し続ける必要があります。それに、そもそも全部のサービスを同時に使っている人はそう多くありません。だからこのプロジェクトは claude.ai だけに範囲を絞っています——多くの信頼を求めて多くのことをするのではなく、信頼を求めずに一つのことをきちんとやる、という選択です。

## 機能

- 🍩 二重リングのツールバーアイコン —— 外側 = session(5時間)、内側 = weekly(7日間)、使用量に応じて色が変化(上限に近づくと赤に)
- 🔄 popup 内の手動更新ボタン。回転アニメーションは新しいデータが届いた瞬間に止まります
- ⏱️ バックグラウンド自動更新(間隔設定可能、デフォルト5分)、メッセージ送信後にもトリガー
- 🌐 多言語 UI —— English、繁體中文、简体中文、日本語
- ⚙️ 言語・更新間隔・デバッグの詳細度を設定できる設定ページ
- 🐞 傍受した内容をそのまま表示する Debug タブ内蔵。「隠れた API 呼び出しがない」ことを誰でも自分で検証できます

## インストール

1. このリポジトリをダウンロードまたは clone
2. `chrome://extensions` → 「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」→ このフォルダを選択
4. claude.ai を普通に使う(または拡張機能の更新ボタンをクリック)

## 権限について

| 権限 | 理由 |
|---|---|
| `storage` | 直近の使用量データと設定をローカルに保存するため |
| `alarms` | バックグラウンドの定期更新をスケジュールするため |
| `host_permissions: https://claude.ai/*` | ページ自身のレスポンスを読む content script に必要 |

`cookies` 権限なし。`<all_urls>` なし。リモートコード実行なし —— すべてのコードはこのリポジトリに含まれています。

## 既知の制限

- Anthropic はこのエンドポイントの仕様を公開していないため、フィールド解析は執筆時点で観測された形に固定されています。Anthropic が形式を変更した場合、リングの更新が止まる可能性があります(Debug タブで原因の診断と修正が容易にできます)。
- 拡張機能を動かしているブラウザプロファイルで claude.ai にログインしていない場合、傍受するものが何もありません。

## ライセンス

MIT
