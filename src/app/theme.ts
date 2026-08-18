import { Button, Card, Container, createTheme, Paper, rem, Select, Table } from "@mantine/core";
import type { MantineThemeOverride } from "@mantine/core";

const CONTAINER_SIZES: Record<string, string> = {
  xxs: rem("200px"),
  xs: rem("300px"),
  sm: rem("400px"),
  md: rem("500px"),
  lg: rem("600px"),
  xl: rem("1400px"),
  xxl: rem("1600px"),
};

// "Precise & technical" type pairing. Inter provides the UI/heading voice
// (set to a CSS variable in the root layout). Identifiers and numeric data
// are rendered in a fixed-width stack for a tabular, operations-console feel.
const UI_SANS =
  "var(--font-inter), Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const DATA_MONO =
  "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, 'Liberation Mono', monospace";

export const mantineTheme: MantineThemeOverride = createTheme({
  fontFamily: UI_SANS,
  fontFamilyMonospace: DATA_MONO,

  fontSizes: {
    xs: rem("12px"),
    sm: rem("14px"),
    md: rem("16px"),
    lg: rem("18px"),
    xl: rem("20px"),
    "2xl": rem("24px"),
    "3xl": rem("30px"),
    "4xl": rem("36px"),
    "5xl": rem("48px"),
  },
  spacing: {
    "3xs": rem("4px"),
    "2xs": rem("8px"),
    xs: rem("10px"),
    sm: rem("12px"),
    md: rem("16px"),
    lg: rem("20px"),
    xl: rem("24px"),
    "2xl": rem("28px"),
    "3xl": rem("32px"),
  },

  lineHeights: {
    xs: "1.5",
    sm: "1.5",
    md: "1.5",
    lg: "1.5",
    xl: "1.4",
  },

  headings: {
    fontFamily: UI_SANS,
    fontWeight: "600",
    textWrap: "balance",
    sizes: {
      h1: { fontSize: rem("30px"), lineHeight: "1.2", fontWeight: "700" },
      h2: { fontSize: rem("24px"), lineHeight: "1.25", fontWeight: "700" },
      h3: { fontSize: rem("18px"), lineHeight: "1.3", fontWeight: "600" },
      h4: { fontSize: rem("16px"), lineHeight: "1.35", fontWeight: "600" },
      h5: { fontSize: rem("14px"), lineHeight: "1.4", fontWeight: "600" },
      h6: { fontSize: rem("13px"), lineHeight: "1.4", fontWeight: "600" },
    },
  },

  radius: {
    xs: rem("4px"),
    sm: rem("6px"),
    md: rem("10px"),
    lg: rem("14px"),
    xl: rem("22px"),
  },
  defaultRadius: "md",

  // Restrained elevation: flat hairline surfaces for content, depth only on
  // overlays (modals/popovers/menus). Shadows here serve that distinction.
  shadows: {
    xs: "0 1px 2px rgba(0, 0, 0, 0.04)",
    sm: "0 1px 3px rgba(0, 0, 0, 0.06)",
    md: "0 4px 8px rgba(0, 0, 0, 0.06)",
    lg: "0 8px 20px rgba(0, 0, 0, 0.10)",
    xl: "0 16px 40px rgba(0, 0, 0, 0.14)",
  },

  // --- MantineHub "Pink" preset values ---
  primaryColor: "pink",
  primaryShade: { light: 6, dark: 6 },

  colors: {
    dark: [
      "#C9C9C9",
      "#B8B8B8",
      "#A6A6A6",
      "#949494",
      "#828282",
      "#707070",
      "#5E5E5E",
      "#404040",
      "#292929",
      "#141414",
    ],
  },
  // ----------------------------------------

  components: {
    Container: Container.extend({
      vars: (_, { size, fluid }) => ({
        root: {
          "--container-size": fluid
            ? "100%"
            : size !== undefined && size in CONTAINER_SIZES
              ? CONTAINER_SIZES[size]
              : rem(size),
        },
      }),
    }),
    Paper: Paper.extend({
      defaultProps: {
        p: "md",
        shadow: "none",
        radius: "md",
        withBorder: true,
      },
    }),
    Card: Card.extend({
      defaultProps: {
        p: "lg",
        shadow: "none",
        radius: "md",
        withBorder: true,
      },
    }),
    Button: Button.extend({
      defaultProps: {
        radius: "md",
      },
    }),
    Select: Select.extend({
      defaultProps: {
        checkIconPosition: "right",
      },
    }),
    Table: Table.extend({
      styles: () => ({
        th: {
          fontSize: "var(--mantine-font-size-xs)",
          fontWeight: 600,
          letterSpacing: "0.03em",
          textTransform: "uppercase",
          color: "var(--mantine-color-dimmed)",
          whiteSpace: "nowrap",
        },
      }),
    }),
  },
  other: {
    style: "mantine",
  },
});