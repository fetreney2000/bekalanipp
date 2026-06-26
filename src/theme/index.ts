import { createTheme } from "@mantine/core";

const theme = createTheme({
  primaryColor: "blue",
  primaryShade: 6,
  defaultRadius: "md",
  fontFamily: "'Roboto', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
  colors: {
    blue: [
      "#e6f0ff", "#b3d1ff", "#80b3ff", "#4d94ff", "#1a75ff",
      "#4f87ff", "#3d6fcc", "#2b5799", "#1a3f66", "#082833",
    ],
  },
});

export default theme;
