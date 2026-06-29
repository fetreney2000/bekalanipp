"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  AppShell as MantineAppShell,
  Group,
  NavLink,
  Text,
  Stack,
  Box,
  Burger,
  Badge,
  Divider,
  UnstyledButton,
} from "@mantine/core";
import {
  IconDashboard,
  IconFileText,
  IconPackage,
  IconChartBar,
  IconHospital,
  IconPill,
  IconBook2,
  IconCopyright,
  IconBell,
} from "@tabler/icons-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const INACTIVITY_TIMEOUT = 3 * 60 * 1000;

const navItems = [
  { href: "/", label: "Dashboard", icon: IconDashboard },
  { href: "/records", label: "Senarai Inden", icon: IconFileText },
  { href: "/supply", label: "Rekod Inden", icon: IconPackage },
  { href: "/reports", label: "Laporan", icon: IconChartBar },
  { href: "/wards", label: "Senarai Wad/Jabatan", icon: IconHospital },
  { href: "/items", label: "Senarai Item/Ubat", icon: IconPill },
  { href: "/catalog", label: "Katalog Wad/Jabatan", icon: IconBook2 },
  { href: "/hakcipta", label: "Hakcipta", icon: IconCopyright },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathnameRef = useRef(pathname);

  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await fetch("/api/orders/pending-count");
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.count);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchPendingCount();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") fetchPendingCount();
    }, 60_000);
    return () => clearInterval(timer);
  }, [fetchPendingCount]);

  useEffect(() => {
    const isSupplyPage = pathname === "/supply";

    if (isSupplyPage) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        router.push("/records");
      }, INACTIVITY_TIMEOUT);
    };

    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [pathname, router]);

  useEffect(() => {
    if (prevPathnameRef.current !== "/records" && pathname === "/records") {
      window.dispatchEvent(new Event("idle:refresh-records"));
    }
    prevPathnameRef.current = pathname;
  }, [pathname]);

  return (
    <MantineAppShell
      header={{ height: 64 }}
      navbar={{
        width: 260,
        breakpoint: "md",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <MantineAppShell.Header
        style={{
          borderBottom: "1px solid var(--mantine-color-gray-2)",
          backgroundColor: "var(--mantine-color-white)",
        }}
      >
        <Group h="100%" px="lg" justify="space-between">
          <Group gap="md">
            <Burger
              opened={opened}
              onClick={() => setOpened((o) => !o)}
              hiddenFrom="md"
              size="sm"
            />
            <Group gap="sm">
              <Box
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "var(--mantine-radius-sm)",
                  background: "linear-gradient(135deg, var(--mantine-color-cyan-6) 0%, var(--mantine-color-teal-6) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconPill size={20} color="white" />
              </Box>
              <Stack gap={0}>
                <Text fw={700} size="sm" c="gray.8" style={{ lineHeight: 1.2 }}>
                  Sistem Rekod Inden
                </Text>
                <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>
                  Jabatan Farmasi Hospital Keningau
                </Text>
              </Stack>
            </Group>
          </Group>

          <Group gap="md">
            <UnstyledButton
              style={{
                position: "relative",
                padding: "var(--mantine-spacing-xs)",
                borderRadius: "var(--mantine-radius-sm)",
              }}
            >
              <IconBell size={20} color="var(--mantine-color-gray-6)" />
              {pendingCount !== null && pendingCount > 0 && (
                <Badge
                  color="red"
                  variant="filled"
                  size="xs"
                  circle
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    minWidth: 18,
                    height: 18,
                    fontSize: 10,
                    padding: "0 5px",
                  }}
                >
                  {pendingCount}
                </Badge>
              )}
            </UnstyledButton>
            <Divider orientation="vertical" size="xs" />
            <Text size="xs" c="dimmed">
              Hospital Keningau
            </Text>
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar
        p="md"
        style={{
          borderRight: "1px solid var(--mantine-color-gray-2)",
          backgroundColor: "var(--mantine-color-gray-0)",
        }}
      >
        <Stack gap={2}>
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                href={item.href}
                component={Link}
                label={item.label}
                leftSection={<Icon size={18} />}
                active={isActive}
                onClick={() => setOpened(false)}
                variant="filled"
                autoContrast
                style={{
                  borderRadius: "var(--mantine-radius-sm)",
                }}
              />
            );
          })}
        </Stack>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <Box maw={1400} mx="auto">
          {children}
        </Box>
      </MantineAppShell.Main>

      <MantineAppShell.Footer
        p="xs"
        h="auto"
        style={{
          borderTop: "1px solid var(--mantine-color-gray-2)",
          backgroundColor: "var(--mantine-color-gray-0)",
        }}
      >
        <Group justify="flex-end" gap={4}>
          <Text size="xs" c="dimmed">Inden Belum Disediakan:</Text>
          <Text size="xs" c={pendingCount !== null && pendingCount > 0 ? "orange.7" : "dimmed"} fw={600}>
            {pendingCount !== null ? pendingCount : "..."}
          </Text>
        </Group>
      </MantineAppShell.Footer>
    </MantineAppShell>
  );
}
