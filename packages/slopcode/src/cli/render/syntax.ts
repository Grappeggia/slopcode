import { RGBA, SyntaxStyle } from "@opentui/core"

export type SyntaxTheme = {
  accent: RGBA
  background: RGBA
  diffAdded: RGBA
  diffAddedBg: RGBA
  diffContext: RGBA
  diffContextBg: RGBA
  diffHighlightAdded?: RGBA
  diffHighlightRemoved?: RGBA
  diffRemoved: RGBA
  diffRemovedBg: RGBA
  error: RGBA
  info: RGBA
  markdownBlockQuote: RGBA
  markdownCode: RGBA
  markdownEmph: RGBA
  markdownHeading: RGBA
  markdownLink: RGBA
  markdownLinkText: RGBA
  markdownStrong: RGBA
  markdownListItem: RGBA
  secondary: RGBA
  success: RGBA
  syntaxComment: RGBA
  syntaxFunction: RGBA
  syntaxKeyword: RGBA
  syntaxNumber: RGBA
  syntaxOperator: RGBA
  syntaxPunctuation: RGBA
  syntaxString: RGBA
  syntaxType: RGBA
  syntaxVariable: RGBA
  text: RGBA
  textMuted: RGBA
  thinkingOpacity: number
  warning: RGBA
}

export function createCliSyntaxTheme() {
  return {
    accent: RGBA.fromInts(86, 182, 194),
    background: RGBA.fromInts(15, 15, 15),
    diffAdded: RGBA.fromInts(152, 195, 121),
    diffAddedBg: RGBA.fromInts(35, 54, 35),
    diffContext: RGBA.fromInts(128, 128, 128),
    diffContextBg: RGBA.fromInts(26, 26, 26),
    diffHighlightAdded: RGBA.fromInts(190, 230, 154),
    diffHighlightRemoved: RGBA.fromInts(245, 149, 157),
    diffRemoved: RGBA.fromInts(224, 108, 117),
    diffRemovedBg: RGBA.fromInts(58, 35, 38),
    error: RGBA.fromInts(224, 108, 117),
    info: RGBA.fromInts(86, 182, 194),
    markdownBlockQuote: RGBA.fromInts(229, 192, 123),
    markdownCode: RGBA.fromInts(152, 195, 121),
    markdownEmph: RGBA.fromInts(229, 192, 123),
    markdownHeading: RGBA.fromInts(220, 220, 220),
    markdownLink: RGBA.fromInts(97, 175, 239),
    markdownLinkText: RGBA.fromInts(86, 182, 194),
    markdownStrong: RGBA.fromInts(220, 220, 220),
    markdownListItem: RGBA.fromInts(97, 175, 239),
    secondary: RGBA.fromInts(198, 120, 221),
    success: RGBA.fromInts(152, 195, 121),
    syntaxComment: RGBA.fromInts(120, 120, 120),
    syntaxFunction: RGBA.fromInts(97, 175, 239),
    syntaxKeyword: RGBA.fromInts(198, 120, 221),
    syntaxNumber: RGBA.fromInts(229, 192, 123),
    syntaxOperator: RGBA.fromInts(86, 182, 194),
    syntaxPunctuation: RGBA.fromInts(220, 220, 220),
    syntaxString: RGBA.fromInts(152, 195, 121),
    syntaxType: RGBA.fromInts(86, 182, 194),
    syntaxVariable: RGBA.fromInts(220, 220, 220),
    text: RGBA.fromInts(220, 220, 220),
    textMuted: RGBA.fromInts(120, 120, 120),
    thinkingOpacity: 0.45,
    warning: RGBA.fromInts(229, 192, 123),
  } satisfies SyntaxTheme
}

export function createSyntaxStyle(theme: SyntaxTheme) {
  return SyntaxStyle.fromTheme(getSyntaxRules(theme))
}

export function createSubtleSyntaxStyle(theme: SyntaxTheme) {
  const rules = getSyntaxRules(theme)
  return SyntaxStyle.fromTheme(
    rules.map((rule) => {
      if (!rule.style.foreground) return rule
      const fg = rule.style.foreground
      return {
        ...rule,
        style: {
          ...rule.style,
          foreground: RGBA.fromInts(
            Math.round(fg.r * 255),
            Math.round(fg.g * 255),
            Math.round(fg.b * 255),
            Math.round(theme.thinkingOpacity * 255),
          ),
        },
      }
    }),
  )
}

function getSyntaxRules(theme: SyntaxTheme) {
  return [
    {
      scope: ["default"],
      style: {
        foreground: theme.text,
      },
    },
    {
      scope: ["prompt"],
      style: {
        foreground: theme.accent,
      },
    },
    {
      scope: ["extmark.file"],
      style: {
        foreground: theme.warning,
        bold: true,
      },
    },
    {
      scope: ["extmark.agent"],
      style: {
        foreground: theme.secondary,
        bold: true,
      },
    },
    {
      scope: ["extmark.paste"],
      style: {
        foreground: theme.background,
        background: theme.warning,
        bold: true,
      },
    },
    {
      scope: ["extmark.ghost"],
      style: {
        foreground: theme.textMuted,
      },
    },
    {
      scope: ["comment"],
      style: {
        foreground: theme.syntaxComment,
        italic: true,
      },
    },
    {
      scope: ["comment.documentation"],
      style: {
        foreground: theme.syntaxComment,
        italic: true,
      },
    },
    {
      scope: ["string", "symbol"],
      style: {
        foreground: theme.syntaxString,
      },
    },
    {
      scope: ["number", "boolean"],
      style: {
        foreground: theme.syntaxNumber,
      },
    },
    {
      scope: ["character.special"],
      style: {
        foreground: theme.syntaxString,
      },
    },
    {
      scope: ["keyword.return", "keyword.conditional", "keyword.repeat", "keyword.coroutine"],
      style: {
        foreground: theme.syntaxKeyword,
        italic: true,
      },
    },
    {
      scope: ["keyword.type"],
      style: {
        foreground: theme.syntaxType,
        bold: true,
        italic: true,
      },
    },
    {
      scope: ["keyword.function", "function.method"],
      style: {
        foreground: theme.syntaxFunction,
      },
    },
    {
      scope: ["keyword"],
      style: {
        foreground: theme.syntaxKeyword,
        italic: true,
      },
    },
    {
      scope: ["keyword.import"],
      style: {
        foreground: theme.syntaxKeyword,
      },
    },
    {
      scope: ["operator", "keyword.operator", "punctuation.delimiter"],
      style: {
        foreground: theme.syntaxOperator,
      },
    },
    {
      scope: ["keyword.conditional.ternary"],
      style: {
        foreground: theme.syntaxOperator,
      },
    },
    {
      scope: ["variable", "variable.parameter", "function.method.call", "function.call"],
      style: {
        foreground: theme.syntaxVariable,
      },
    },
    {
      scope: ["variable.member", "function", "constructor"],
      style: {
        foreground: theme.syntaxFunction,
      },
    },
    {
      scope: ["type", "module"],
      style: {
        foreground: theme.syntaxType,
      },
    },
    {
      scope: ["constant"],
      style: {
        foreground: theme.syntaxNumber,
      },
    },
    {
      scope: ["property"],
      style: {
        foreground: theme.syntaxVariable,
      },
    },
    {
      scope: ["class"],
      style: {
        foreground: theme.syntaxType,
      },
    },
    {
      scope: ["parameter"],
      style: {
        foreground: theme.syntaxVariable,
      },
    },
    {
      scope: ["punctuation", "punctuation.bracket"],
      style: {
        foreground: theme.syntaxPunctuation,
      },
    },
    {
      scope: ["variable.builtin", "type.builtin", "function.builtin", "module.builtin", "constant.builtin"],
      style: {
        foreground: theme.error,
      },
    },
    {
      scope: ["variable.super"],
      style: {
        foreground: theme.error,
      },
    },
    {
      scope: ["string.escape", "string.regexp"],
      style: {
        foreground: theme.syntaxKeyword,
      },
    },
    {
      scope: ["keyword.directive"],
      style: {
        foreground: theme.syntaxKeyword,
        italic: true,
      },
    },
    {
      scope: ["punctuation.special"],
      style: {
        foreground: theme.syntaxOperator,
      },
    },
    {
      scope: ["keyword.modifier"],
      style: {
        foreground: theme.syntaxKeyword,
        italic: true,
      },
    },
    {
      scope: ["keyword.exception"],
      style: {
        foreground: theme.syntaxKeyword,
        italic: true,
      },
    },
    {
      scope: [
        "markup.heading",
        "markup.heading.1",
        "markup.heading.2",
        "markup.heading.3",
        "markup.heading.4",
        "markup.heading.5",
        "markup.heading.6",
      ],
      style: {
        foreground: theme.markdownHeading,
        bold: true,
      },
    },
    {
      scope: ["markup.bold", "markup.strong"],
      style: {
        foreground: theme.markdownStrong,
        bold: true,
      },
    },
    {
      scope: ["markup.italic"],
      style: {
        foreground: theme.markdownEmph,
        italic: true,
      },
    },
    {
      scope: ["markup.list"],
      style: {
        foreground: theme.markdownListItem,
      },
    },
    {
      scope: ["markup.quote"],
      style: {
        foreground: theme.markdownBlockQuote,
        italic: true,
      },
    },
    {
      scope: ["markup.raw", "markup.raw.block"],
      style: {
        foreground: theme.markdownCode,
      },
    },
    {
      scope: ["markup.raw.inline"],
      style: {
        foreground: theme.markdownCode,
        background: theme.background,
      },
    },
    {
      scope: ["markup.link", "markup.link.url", "string.special", "string.special.url"],
      style: {
        foreground: theme.markdownLink,
        underline: true,
      },
    },
    {
      scope: ["markup.link.label", "label"],
      style: {
        foreground: theme.markdownLinkText,
        underline: true,
      },
    },
    {
      scope: ["spell", "nospell"],
      style: {
        foreground: theme.text,
      },
    },
    {
      scope: ["conceal"],
      style: {
        foreground: theme.textMuted,
      },
    },
    {
      scope: ["character"],
      style: {
        foreground: theme.syntaxString,
      },
    },
    {
      scope: ["float"],
      style: {
        foreground: theme.syntaxNumber,
      },
    },
    {
      scope: ["comment.error"],
      style: {
        foreground: theme.error,
        italic: true,
        bold: true,
      },
    },
    {
      scope: ["comment.warning"],
      style: {
        foreground: theme.warning,
        italic: true,
        bold: true,
      },
    },
    {
      scope: ["comment.todo", "comment.note"],
      style: {
        foreground: theme.info,
        italic: true,
        bold: true,
      },
    },
    {
      scope: ["namespace"],
      style: {
        foreground: theme.syntaxType,
      },
    },
    {
      scope: ["field"],
      style: {
        foreground: theme.syntaxVariable,
      },
    },
    {
      scope: ["type.definition"],
      style: {
        foreground: theme.syntaxType,
        bold: true,
      },
    },
    {
      scope: ["keyword.export"],
      style: {
        foreground: theme.syntaxKeyword,
      },
    },
    {
      scope: ["attribute", "annotation"],
      style: {
        foreground: theme.warning,
      },
    },
    {
      scope: ["tag"],
      style: {
        foreground: theme.error,
      },
    },
    {
      scope: ["tag.attribute"],
      style: {
        foreground: theme.syntaxKeyword,
      },
    },
    {
      scope: ["tag.delimiter"],
      style: {
        foreground: theme.syntaxOperator,
      },
    },
    {
      scope: ["markup.strikethrough"],
      style: {
        foreground: theme.textMuted,
      },
    },
    {
      scope: ["markup.underline"],
      style: {
        foreground: theme.text,
        underline: true,
      },
    },
    {
      scope: ["markup.list.checked"],
      style: {
        foreground: theme.success,
      },
    },
    {
      scope: ["markup.list.unchecked"],
      style: {
        foreground: theme.textMuted,
      },
    },
    {
      scope: ["diff.plus"],
      style: {
        foreground: theme.diffAdded,
        background: theme.diffAddedBg,
      },
    },
    {
      scope: ["diff.minus"],
      style: {
        foreground: theme.diffRemoved,
        background: theme.diffRemovedBg,
      },
    },
    {
      scope: ["diff.delta"],
      style: {
        foreground: theme.diffContext,
        background: theme.diffContextBg,
      },
    },
    {
      scope: ["slopcode.diff.plus"],
      style: {
        foreground: theme.diffAdded,
      },
    },
    {
      scope: ["slopcode.diff.minus"],
      style: {
        foreground: theme.diffRemoved,
      },
    },
    {
      scope: ["slopcode.diff.plus.emphasis"],
      style: {
        foreground: theme.diffHighlightAdded ?? theme.diffAdded,
        bold: true,
      },
    },
    {
      scope: ["slopcode.diff.minus.emphasis"],
      style: {
        foreground: theme.diffHighlightRemoved ?? theme.diffRemoved,
        bold: true,
      },
    },
    {
      scope: ["slopcode.diff.context"],
      style: {
        dim: true,
      },
    },
    {
      scope: ["error"],
      style: {
        foreground: theme.error,
        bold: true,
      },
    },
    {
      scope: ["warning"],
      style: {
        foreground: theme.warning,
        bold: true,
      },
    },
    {
      scope: ["info"],
      style: {
        foreground: theme.info,
      },
    },
    {
      scope: ["debug"],
      style: {
        foreground: theme.textMuted,
      },
    },
  ]
}
