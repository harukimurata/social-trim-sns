import { visit } from "unist-util-visit";
import { MARKDOWN_COLOR_MAP } from "./markdownColors";

// remark-directive が生成した textDirective (:color[text]) を
// hast の span 要素に変換するプラグイン
export function remarkColorDirective() {
  return (tree: Parameters<typeof visit>[0]) => {
    visit(tree, "textDirective", (node: any) => {
      if (!(node.name in MARKDOWN_COLOR_MAP)) return;
      node.data = {
        hName: "span",
        hProperties: {
          className: MARKDOWN_COLOR_MAP[node.name as keyof typeof MARKDOWN_COLOR_MAP],
        },
      };
    });
  };
}
