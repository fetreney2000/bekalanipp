"use client";

import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { NavigationProgress } from "@mantine/nprogress";
import { shadcnTheme } from "./theme";
import { shadcnCssVariableResolver } from "./cssVariableResolver";
import "./style.css";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      theme={shadcnTheme}
      cssVariablesResolver={shadcnCssVariableResolver}
      defaultColorScheme="dark"
    >
      <NavigationProgress />
      <Notifications position="top-right" />
      {children}
    </MantineProvider>
  );
}
