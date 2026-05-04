export const MARKDOWN_COLOR_MAP: Record<string, string> = {
  red:    "text-red-500",
  blue:   "text-blue-500",
  green:  "text-green-600",
  orange: "text-orange-500",
  yellow: "text-yellow-600",
  purple: "text-purple-500",
  pink:   "text-pink-500",
  cyan:   "text-cyan-500",
  gray:   "text-gray-500",
} as const;

export type MarkdownColorName = keyof typeof MARKDOWN_COLOR_MAP;
