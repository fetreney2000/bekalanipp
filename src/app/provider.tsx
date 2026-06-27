"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { NavigationProgress } from "@mantine/nprogress";

const theme = createTheme({
  primaryColor: "cyan",
  primaryShade: 6,
  defaultRadius: "md",
  fontFamily: "'Roboto', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
  colors: {
    cyan: [
      "#e3fafc", "#c5f6fa", "#99e9f2", "#66d9e8", "#3bc9db",
      "#22b8cf", "#15aabf", "#1098ad", "#0c8599", "#0b7285",
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
