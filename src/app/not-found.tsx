"use client";

import { Stack, Group, Paper, Text, Title, ThemeIcon, Button } from "@mantine/core";
import { IconFileSearch, IconHome } from "@tabler/icons-react";
import Link from "next/link";
import AppShell from "@/components/AppShell";

/**
 * Rendered for unmatched routes (404) and by `notFound()`. Without this, Next.js
 * serves a bare unstyled page that doesn't match the rest of the app.
 */
export default function NotFound() {
  return (
    <AppShell>
      <Stack gap="lg" maw={600} mx="auto" py="xl">
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Stack gap="md" align="center" ta="center">
            <ThemeIcon size={72} radius="xl" variant="light" color="yellow">
              <IconFileSearch size={36} />
            </ThemeIcon>

            <Title order={3} fw={700}>
              Halaman tidak dijumpai
            </Title>

            <Text size="sm" c="dimmed">
              Halaman yang anda cari tidak wujud atau telah dipindahkan.
              Sila semak semula alamat pelayar anda.
            </Text>

            <Group gap="sm" mt="sm">
              <Button
                component={Link}
                href="/"
                leftSection={<IconHome size={16} />}
                color="cyan"
              >
                Ke halaman utama
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </AppShell>
  );
}
