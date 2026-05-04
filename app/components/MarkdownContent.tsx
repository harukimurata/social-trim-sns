"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkBreaks from "remark-breaks";
import { remarkColorDirective } from "@/lib/remarkColorDirective";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold mt-3 mb-1 text-gray-900">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold mt-3 mb-1 text-gray-900">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-bold mt-2 mb-1 text-gray-900">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-bold mt-2 mb-1 text-gray-900">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="text-sm font-semibold mt-1 mb-0.5 text-gray-900">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="text-xs font-semibold mt-1 mb-0.5 text-gray-700">{children}</h6>
  ),
  p: ({ children }) => (
    <p className="mb-1 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-bold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic">{children}</em>
  ),
  del: ({ children }) => (
    <del className="line-through text-gray-500">{children}</del>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code className={`${className ?? ""} font-mono text-xs`}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-pink-600">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-xs my-2 font-mono">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-gray-300 pl-3 text-gray-600 my-2 italic">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-1 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-1 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  hr: () => <hr className="my-3 border-gray-200" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-500 underline hover:text-blue-700"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="border-collapse text-xs w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 px-2 py-1 bg-gray-50 font-semibold text-left">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 px-2 py-1">{children}</td>
  ),
  // img タグは SNS では投稿画像カルーセルで管理するため無効化
  img: () => null,
};

type Props = { children: string };

export default function MarkdownContent({ children }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkDirective, remarkColorDirective, remarkBreaks]}
      components={components}
    >
      {children}
    </ReactMarkdown>
  );
}
