"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { NavigationProgress } from "@mantine/nprogress";

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
    dark: [
      "#C1C2C5", "#A6A7AB", "#909296", "#5C5F66", "#373A40",
      "#2C2E33", "#25262B", "#1A1B1E", "#141517", "#101113",
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
