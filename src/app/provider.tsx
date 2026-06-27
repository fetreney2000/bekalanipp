"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { NavigationProgress } from "@mantine/nprogress";

const theme = createTheme({
  primaryColor: "stone",
  primaryShade: { light: 5, dark: 4 },
  defaultRadius: "md",
  fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
  colors: {
    stone: [
      "#fafaf9", "#f5f5f4", "#e7e5e4", "#d6d3d1", "#a8a29e",
      "#78716c", "#57534e", "#44403c", "#292524", "#1c1917", "#0c0a09",
    ],
    dark: [
      "#d6d3d1", "#a8a29e", "#78716c", "#57534e", "#44403c",
      "#292524", "#1c1917", "#0c0a09", "#0c0a09", "#0c0a09",
    ],
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <NavigationProgress />
      <Notifications position="top-right" />
      {children}
    </MantineProvider>
  );
}
