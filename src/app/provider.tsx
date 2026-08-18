"use client";

import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { NavigationProgress } from "@mantine/nprogress";
import { mantineTheme } from "./theme";
import "./style.css";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      theme={mantineTheme}
      defaultColorScheme="light"
    >
      <NavigationProgress />
      <Notifications position="top-right" />
      {children}
    </MantineProvider>
  );
}
