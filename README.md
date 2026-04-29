# trim

テキスト・画像投稿型のシンプルなSNSプラットフォーム。

---

## 利用技術・環境

### フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| TypeScript | ^5.9 | 言語 |
| React | ^19 | UIフレームワーク |
| Next.js | ^15 | アプリケーションフレームワーク（App Router） |
| Tailwind CSS | ^4 | スタイリング |
| Jotai | ^2 | クライアント状態管理 |
| react-hook-form | ^7 | フォームバリデーション |
| clsx / tailwind-merge | - | 条件付きクラス名合成 |
| react-icons | ^5 | UIアイコン |
| dayjs | ^1 | 日時操作・TTL計算 |
| ulid | ^2 | 投稿ID等の生成 |

### バックエンド（AWS）

| サービス | 用途 |
|---------|------|
| AWS Amplify Gen2 | ホスティング・CI/CD・バックエンドプロビジョニング |
| Amazon Cognito | ユーザー認証・JWT発行 |
| AWS AppSync (GraphQL) | API（クエリ・ミューテーション・サブスクリプション） |
| AWS Lambda | 編集制限チェック・トレンド集計・TTL補完削除 |
| Amazon DynamoDB | 投稿・ユーザー・フォロー関係・ハッシュタグカウント |
| Amazon S3 | 投稿画像のアップロード・保存 |
| Amazon CloudFront | S3コンテンツのCDN配信 |
| DynamoDB Streams | 投稿変更検知 → Lambdaでリアルタイム集計 |
| Amazon EventBridge | トレンド定期更新・期限切れ投稿の削除補完 |

### 開発ツール

| ツール | バージョン | 用途 |
|--------|-----------|------|
| Node.js | 22.x | ランタイム |
| npm | 10.x | パッケージマネージャー |
| Volta | - | Node.jsバージョン管理 |
| ESLint | ^8 | 静的解析 |
| Prettier | ^3 | コードフォーマット |

---

## 環境構築手順

### 前提条件

以下のツールが事前にインストールされている必要があります。

- [Volta](https://volta.sh/)（Node.js / npm のバージョン管理）
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)（`aws configure` 済み）

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd social-trim-sns
```

### 2. Node.js / npm のセットアップ

Volta を使用している場合、プロジェクトルートの `volta` 設定により自動的に Node.js 22 / npm 10 が使用されます。

```bash
# Volta未インストールの場合は手動でNode.js 22をインストール
node -v  # v22.x.x であることを確認
```

### 3. 依存関係のインストール

```bash
npm install
```

### 4. AWS プロファイルの設定

Amplify Sandbox を起動するには、有効なAWS認証情報が必要です。

```bash
aws configure
# または既存プロファイルを使用する場合
aws configure --profile <profile-name>
```

### 5. Amplify Sandbox の起動

開発環境用のバックエンドリソース（Cognito・AppSync・DynamoDB等）をAWSにプロビジョニングします。

```bash
npx ampx sandbox
# 特定プロファイルを使用する場合
npx ampx sandbox --profile <profile-name>
```

初回起動時はAWSリソースの作成に数分かかります。起動が完了すると `amplify_outputs.json` がプロジェクトルートに生成されます。

### 6. 開発サーバーの起動

別ターミナルで実行します。

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) でアプリケーションが起動します。

### 7. 型チェック

```bash
npm run type-check
```

### 8. ビルド

```bash
npm run build
```

---

## デプロイ

AWS Amplify Hosting を使用してCI/CDが設定されています。`main` ブランチへのプッシュにより自動デプロイが実行されます。

ビルド設定は [`amplify.yml`](amplify.yml) を参照してください。
