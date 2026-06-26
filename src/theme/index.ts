import { defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: "#e6f0ff" },
          100: { value: "#b3d1ff" },
          200: { value: "#80b3ff" },
          300: { value: "#4d94ff" },
          400: { value: "#1a75ff" },
          500: { value: "#4f87ff" },
          600: { value: "#3d6fcc" },
          700: { value: "#2b5799" },
          800: { value: "#1a3f66" },
          900: { value: "#082833" },
        },
        bg: {
          DEFAULT: { value: "#141618" },
          card: { value: "#1c1f22" },
          control: { value: "#123a66" },
        },
        text: {
          DEFAULT: { value: "#e7eaee" },
          muted: { value: "#a3aab3" },
        },
        line: { value: "rgba(231,234,238,0.10)" },
        good: { value: "#4caf50" },
        warn: { value: "#f0ad4e" },
        bad: { value: "#ef5350" },
        control: {
          border: { value: "rgba(79,135,255,0.12)" },
          hover: { value: "rgba(79,135,255,0.18)" },
        },
      },
      fonts: {
        body: { value: "'Roboto', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" },
        heading: { value: "'Roboto', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" },
      },
      radii: {
        sm: { value: "6px" },
        md: { value: "10px" },
        lg: { value: "14px" },
        full: { value: "999px" },
      },
    },
  },
  globalCss: {
    body: {
      bg: "#141618",
      color: "#e7eaee",
      fontFamily: "'Roboto', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
    },
  },
});

export default config;
