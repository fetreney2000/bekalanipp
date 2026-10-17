"use client";

import { useEffect } from "react";
import { Stack, Group, Paper, Text, Title, ThemeIcon, Button } from "@mantine/core";
import { IconAlertTriangle, IconRefresh, IconHome } from "@tabler/icons-react";
import Link from "next/link";
import AppShell from "@/components/AppShell";

/**
 * Global error boundary. Without this, a thrown error / render crash shows the
 * default Next.js overlay in production — an unhelpful white screen for the
 * pharmacist. This catches it, logs it for debugging, and offers a way out.
 *
 * Must be a client component and is rendered outside the page layout, so it
 * wraps itself in AppShell.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real error in the console for debugging.
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <AppShell>
      <Stack gap="lg" maw={600} mx="auto" py="xl">
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Stack gap="md" align="center" ta="center">
            <ThemeIcon size={72} radius="xl" variant="light" color="red">
              <IconAlertTriangle size={36} />
            </ThemeIcon>

            <Title order={3} fw={700}>
              Berlaku ralat
            </Title>

            <Text size="sm" c="dimmed">
              Maaf, sesuatu tidak kena semasa memproses permintaan ini. Sila
              cuba semula. Jika masalah berterusan, hubungi pentadbir sistem.
            </Text>

            {error.digest ? (
              <Text size="xs" c="dimmed" className="mono">
                Rujukan ralat: {error.digest}
              </Text>
            ) : null}

            <Group gap="sm" mt="sm">
              <Button
                leftSection={<IconRefresh size={16} />}
                onClick={reset}
                color="cyan"
              >
                Cuba lagi
              </Button>
              <Button
                component={Link}
                href="/"
                variant="default"
                leftSection={<IconHome size={16} />}
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
