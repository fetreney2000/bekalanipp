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
  ActionIcon,
  useComputedColorScheme,
  useMantineColorScheme,
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
  IconSun,
  IconMoon,
} from "@tabler/icons-react";
import Logo from "./Logo";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { notifications } from "@mantine/notifications";

const INACTIVITY_TIMEOUT = 3 * 60 * 1000;
const IDLE_WARNING_DELAY = INACTIVITY_TIMEOUT - 30 * 1000;
const IDLE_NOTICE_ID = "idle-redirect";

// Pages where redirecting would discard in-progress work (half-filled forms,
// open edit modals). The old code only exempted /supply — everything else was
// protected only by luck.
const EDITABLE_PAGES = [
  "/supply",
  "/records",
  "/wards",
  "/items",
  "/catalog",
];

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
  const warnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnedRef = useRef(false);
  const prevPathnameRef = useRef(pathname);

  const { setColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme("light");
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/orders/pending-count");
        if (res.ok) {
          const data = await res.json();
          if (active) setPendingCount(data.count);
        }
      } catch {
        // ignore
      }
    };
    load();
    // ...but the 60s poll only runs on the records page, where statuses are
    // actually toggled. Polling every open tab on every page was wasted work
    // (the endpoint now has an index, but it's still one request/tab/minute).
    if (pathname !== "/records") return () => { active = false; };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pathname]);

  useEffect(() => {
    const isEditablePage = EDITABLE_PAGES.includes(pathname);

    if (isEditablePage) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warnRef.current) clearTimeout(warnRef.current);
      if (warnedRef.current) {
        notifications.hide(IDLE_NOTICE_ID);
        warnedRef.current = false;
      }
      timerRef.current = null;
      warnRef.current = null;
      return;
    }

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warnRef.current) clearTimeout(warnRef.current);
      if (warnedRef.current) {
        notifications.hide(IDLE_NOTICE_ID);
        warnedRef.current = false;
      }
      // Warn 30s before redirecting so anyone who stepped away briefly but
      // returns mid-countdown can cancel it with any interaction.
      warnRef.current = setTimeout(() => {
        warnedRef.current = true;
        notifications.show({
          id: IDLE_NOTICE_ID,
          title: "Sesi tidak aktif",
          message:
            "Anda akan dipindahkan ke Senarai Inden dalam 30 saat. Gerakkan tetikus atau tekan kekunci untuk kekal di halaman ini.",
          color: "orange",
          autoClose: false,
        });
      }, IDLE_WARNING_DELAY);
      timerRef.current = setTimeout(() => {
        if (warnedRef.current) {
          notifications.hide(IDLE_NOTICE_ID);
          warnedRef.current = false;
        }
        router.push("/records");
      }, INACTIVITY_TIMEOUT);
    };

    // mousemove is included because the warning below promises "Gerakkan
    // tetikus" (move the mouse) cancels the countdown — without it, merely
    // moving the mouse did nothing and the redirect fired on a present user.
    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warnRef.current) clearTimeout(warnRef.current);
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
            <Group gap="xs" wrap="nowrap">
              <Logo />
              <Text size="xs" c="dimmed" visibleFrom="md" style={{ whiteSpace: "nowrap" }}>
                Jabatan Farmasi Hospital Keningau
              </Text>
            </Group>
          </Group>
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => setColorScheme(colorScheme === "light" ? "dark" : "light")}
            title={colorScheme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {colorScheme === "light" ? <IconMoon size={18} /> : <IconSun size={18} />}
          </ActionIcon>
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
