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
      header={{ height: 60 }}
      navbar={{
        width: 260,
        breakpoint: "md",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger
              opened={opened}
              onClick={() => setOpened((o) => !o)}
              hiddenFrom="md"
              size="sm"
            />
            <Group gap="xs">
              <IconPill size={22} color="cyan.6" />
              <Text fw={700} size="sm">Sistem Rekod FS, EMT, AOH - Jabatan Farmasi Hospital Keningau</Text>
            </Group>
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="md">
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

      <MantineAppShell.Footer p="xs" h="auto">
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
