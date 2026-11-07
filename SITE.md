# サイトの開発・公開

## 構成

- 日本語・英語のルートMarkdownと translations/ 内の8言語のMarkdownが本文の唯一の編集元です。
- scripts/build.mjs が全10言語の静的HTMLを dist/ に生成します。
- site/ はUI翻訳・CSS・最小限のJavaScript・画像・HTTPヘッダー・404ページです。
- tests/ は18条の順序、段落数、注記、固定リンク、言語リンク、翻訳の原文ハッシュを検証します。
- `forum/` に掲示板の画面、Worker API、D1移行ファイルがあります。`wrangler.jsonc` は静的配信と `/api/forum/*` のWorker処理を組み合わせます。
- [掲示板の要件定義・実装計画](docs/FORUM_PLAN_JA.md)に初期範囲と公開前の確認事項を記載しています。

## ローカル

Node.js 22以上（開発確認: 24）を用意します。

```sh
npm ci
npm test
npm run build
npx wrangler d1 migrations apply digital-intelligence-rights-forum --local
npm run dev
```

表示先はWranglerが出力するローカルURL（通常 http://127.0.0.1:8787 ）です。
/ja/、/en/、/es/、/fr/、/zh-Hant/、/it/、/de/、/ar/、/ru/、/hi/ が各言語です。
/ は日本語本文です。#article-1 ～ #article-18 は全言語共通です。
JavaScriptなしでも本文・目次・言語リンクが使えます。JavaScriptは言語切り替え時の条文位置の保持と小画面での目次折りたたみにのみ使用します。
掲示板は `/forum/` です。広い画面では憲章を左、掲示板を右に置き、それぞれスクロールできます。憲章ページ上部の掲示板リンクを使うと、開いていた条文へ左欄を合わせます。狭い画面では上下に並べます。閲覧はローカルD1だけで動作します。投稿・通報を試すには、Cloudflare公式の[Turnstileテストキー](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)と長さ32字以上のローカル用 `FORUM_HASH_SECRET` を `.dev.vars` に設定します。管理画面 `/forum/?admin=1` には別の `FORUM_ADMIN_TOKEN` が必要です。`.dev.vars` はGitに含めません。

```text
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET=1x0000000000000000000000000000000AA
FORUM_HASH_SECRET=ローカル専用で32文字以上の値
FORUM_ADMIN_TOKEN=ローカル専用で32文字以上の値
```

このテストキーでの投稿はローカルの `localhost` / `127.0.0.1` のみ許可します。本番では必ず実キーを設定します。スレッドは1時間に同一接続元から3件、返信は10件、通報は5件までです。公開書き込みは設定不足なら拒否されます。

AIレビューの試験にはプロバイダーごとに `OPENAI_API_KEY` + `OPENAI_MODEL`、`ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL`、`GEMINI_API_KEY` + `GEMINI_MODEL` を設定します。さらに `AI_DAILY_BUDGET_USD`、`AI_MAX_COST_PER_RUN_USD`、`AI_DAILY_RUN_LIMIT` の正の値が必要です。これらのドル上限は実行予約の推定枠であり、実際の請求上限を保証しません。プロバイダー側でも予算上限を設定してください。各モデルへ同じ原文と質問を独立に送信し、回答は管理者が確認して公開するまで非公開です。APIキーがない場合は架空の回答を作成しません。

## Cloudflare Workersへの公開

公式手順: https://developers.cloudflare.com/workers/static-assets/

**本番D1、Turnstile、Secretsは運営者の承認を得て設定しました。** `wrangler.jsonc` には本番D1 IDを設定済みです。新たな環境へ公開する際の手順は次のとおりです。

1. 対象Cloudflareアカウント、公開Worker、既存データへの影響を確認する。
2. D1 `digital-intelligence-rights-forum` を作成し、返されたIDを `wrangler.jsonc` に設定する。
3. `npx wrangler d1 migrations apply digital-intelligence-rights-forum --remote` で初期スキーマと5つのスレッドを投入する。既存DBなら先に[Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)の復元点と内容を確認する。
4. Turnstile実サイトキーと秘密鍵、管理者トークン、IPハッシュ用秘密鍵をWorker Secretsに設定する。`wrangler secret put` は即時デプロイも行うため、操作順序に注意する。
5. AI試験版を使う場合だけモデル設定、APIキー、日次枠を設定する。未設定ならAI実行は無効のままにする。
6. `npm test`、`npm run build`、`npx wrangler deploy --dry-run` を再実行し、公開の承認後にデプロイする。
7. 公開後に憲章10言語、`/forum/`、閲覧、投稿、通報、管理権限を実環境で確認する。失敗時はWorkerの以前の版へ戻し、D1の復元が必要ならデータ損失範囲を確認してから操作する。

login はアカウント所有者がブラウザーで行います。トークンをチャットやリポジトリに貼り付けないでください。
公開前に whoami で対象アカウントを確認し、Worker名 digital-intelligence-rights-charter と公開先を確定してください。
複数アカウントの場合は対象アカウントを明示して設定してください。
実際の公開URLは deploy 成功時の出力を使用します。URLを推測して公開済みと扱わないでください。
独自ドメインは未設定です。GitHub連携のWorkers Buildsによる自動ビルドを使用しています。PRマージ前にも公開への影響を確認します。

## 原稿と翻訳

translations/README.md の更新手順に従います。日本語原文が変わったまま翻訳ハッシュが古い場合、ビルドは失敗します。
翻訳の専門的レビューは未了であり、全言語に注意書きを表示しています。法律上の有効性を主張するサイトではありません。
ライセンスや運営ルールは新たに追加していません。

## 背景

site/assets/scroll.png はユーザー提供画像を無加工でコピーしたものです。
CSSの border-image により上下の巻き軸を本文の高さから分離し、中央の羊皮紙部分を伸ばします。
小画面では本文幅を優先して側部を細くしています。印刷時は装飾・目次・UIを省き、本文を表示します。
画像の配布条件は運営者が確認してください。独自のライセンス表記は付与していません。
