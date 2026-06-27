"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  AppShell as MantineAppShell,
  Group,
  NavLink,
  Text,
  Badge,
  Stack,
  Box,
  Burger,
} from "@mantine/core";
import {
  IconDashboard,
  IconFileText,
  IconPackage,
  IconShoppingCart,
  IconChartBar,
  IconHospital,
  IconPill,
  IconBook2,
  IconShield,
} from "@tabler/icons-react";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: IconDashboard },
  { href: "/records", label: "Senarai Inden", icon: IconFileText },
  { href: "/supply", label: "Rekod Inden", icon: IconPackage },
  { href: "/orders", label: "Butiran Inden", icon: IconShoppingCart },
  { href: "/reports", label: "Laporan", icon: IconChartBar },
  { href: "/wards", label: "Senarai Wad/Jabatan", icon: IconHospital },
  { href: "/items", label: "Senarai Item/Ubat", icon: IconPill },
  { href: "/catalog", label: "Katalog Wad/Jabatan", icon: IconBook2 },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [opened, setOpened] = useState(false);

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
              <Text fw={700} size="sm">Rekod FS, EMT, AOH - Hospital Keningau</Text>
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
        <Group justify="flex-end" gap="xs">
          <Text size="xs" c="dimmed" mr="auto">
            Ahmad Fetre Bin Mohammad Zime - 2026
          </Text>
          <Link href="/admin">
            <Group
              gap={4}
              px="xs"
              py={4}
              style={{ borderRadius: 4, cursor: "pointer" }}
            >
              <IconShield size={14} />
            </Group>
          </Link>
        </Group>
      </MantineAppShell.Footer>
    </MantineAppShell>
  );
}
