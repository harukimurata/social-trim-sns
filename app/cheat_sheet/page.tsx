"use client";

import MarkdownContent from "@/app/components/MarkdownContent";
import { Accordion } from "@/app/components/Accordion";

const HEADINGS_MD = `# 見出し1
## 見出し2
### 見出し3
#### 見出し4`;

const TEXT_STYLE_MD = `**太字テキスト**
*斜体テキスト*
~~取り消し線~~`;

const LIST_MD = `- りんご
- バナナ
- ぶどう

1. 第一項目
2. 第二項目
3. 第三項目`;

const CODE_MD =
  "インライン: `const x = 1`\n\n```js\nfunction hello() {\n  return \"world\";\n}\n```";

const BLOCKQUOTE_MD = `> これは引用文です。
> 複数行も可能です。`;

const LINK_MD = `[Google](https://www.google.com)`;

const TABLE_MD = `| 名前 | 年齢 |
|------|------|
| 田中 | 25 |
| 鈴木 | 30 |`;

const COLOR_MD = `:red[赤] :blue[青] :green[緑] :orange[オレンジ] :yellow[黄] :purple[紫] :pink[ピンク] :cyan[シアン] :gray[グレー]`;

function SyntaxPreview({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-body mb-1.5">記法</p>
        <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre">
          {markdown}
        </pre>
      </div>
      <div>
        <p className="text-xs font-medium text-body mb-1.5">プレビュー</p>
        <div className="border border-default rounded-base p-3">
          <MarkdownContent>{markdown}</MarkdownContent>
        </div>
      </div>
    </div>
  );
}

const cheatItems = [
  {
    id: "headings",
    title: "見出し",
    content: <SyntaxPreview markdown={HEADINGS_MD} />,
  },
  {
    id: "text-style",
    title: "太字・斜体・取り消し線",
    content: <SyntaxPreview markdown={TEXT_STYLE_MD} />,
  },
  {
    id: "list",
    title: "リスト（箇条書き・番号付き）",
    content: <SyntaxPreview markdown={LIST_MD} />,
  },
  {
    id: "code",
    title: "コード（インライン・ブロック）",
    content: <SyntaxPreview markdown={CODE_MD} />,
  },
  {
    id: "blockquote",
    title: "引用",
    content: <SyntaxPreview markdown={BLOCKQUOTE_MD} />,
  },
  {
    id: "link",
    title: "リンク",
    content: <SyntaxPreview markdown={LINK_MD} />,
  },
  {
    id: "table",
    title: "テーブル",
    content: <SyntaxPreview markdown={TABLE_MD} />,
  },
  {
    id: "color",
    title: "カラーテキスト（trim 独自記法）",
    content: <SyntaxPreview markdown={COLOR_MD} />,
  },
];

export default function CheatSheet() {
  return (
    <main className="w-full max-w-[600px]">
      <div className="px-1 py-3 mb-4 border-b border-default">
        <h1 className="text-lg font-semibold text-heading">チートシート</h1>
      </div>
      <Accordion items={cheatItems} />
    </main>
  );
}
