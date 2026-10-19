# サイトの開発・公開

## 構成

- 日本語・英語のルートMarkdownと translations/ 内の8言語のMarkdownが本文の唯一の編集元です。
- scripts/build.mjs が全10言語の静的HTMLを dist/ に生成します。
- site/ はUI翻訳・CSS・最小限のJavaScript・画像・HTTPヘッダー・404ページです。
- tests/ は18条の順序、段落数、注記、固定リンク、言語リンク、翻訳の原文ハッシュを検証します。
- wrangler.jsonc はCloudflare WorkersのStatic Assets構成です。データベースやサーバー処理は不要です。

## ローカル

Node.js 22以上（開発確認: 24）を用意します。

```sh
npm ci
npm test
npm run build
npm run dev
```

表示先はWranglerが出力するローカルURL（通常 http://127.0.0.1:8787 ）です。
/ja/、/en/、/es/、/fr/、/zh-Hant/、/it/、/de/、/ar/、/ru/、/hi/ が各言語です。
/ は日本語本文です。#article-1 ～ #article-18 は全言語共通です。
JavaScriptなしでも本文・目次・言語リンクが使えます。JavaScriptは言語切り替え時の条文位置の保持と小画面での目次折りたたみにのみ使用します。

## Cloudflare Workersへの公開

公式手順: https://developers.cloudflare.com/workers/static-assets/

```sh
npx wrangler login
npx wrangler whoami
npm run build
npx wrangler deploy --dry-run
npm run deploy
```

login はアカウント所有者がブラウザーで行います。トークンをチャットやリポジトリに貼り付けないでください。
公開前に whoami で対象アカウントを確認し、Worker名 digital-intelligence-rights-charter と公開先を確定してください。
複数アカウントの場合は対象アカウントを明示して設定してください。
実際の公開URLは deploy 成功時の出力を使用します。URLを推測して公開済みと扱わないでください。
独自ドメインは未設定です。PRのマージだけでは公開されません。

## 原稿と翻訳

translations/README.md の更新手順に従います。日本語原文が変わったまま翻訳ハッシュが古い場合、ビルドは失敗します。
翻訳の専門的レビューは未了であり、全言語に注意書きを表示しています。法律上の有効性を主張するサイトではありません。
ライセンスや運営ルールは新たに追加していません。

## 背景

site/assets/scroll.png はユーザー提供画像を無加工でコピーしたものです。
CSSの border-image により上下の巻き軸を本文の高さから分離し、中央の羊皮紙部分を伸ばします。
小画面では本文幅を優先して側部を細くしています。印刷時は装飾・目次・UIを省き、本文を表示します。
画像の配布条件は運営者が確認してください。独自のライセンス表記は付与していません。
