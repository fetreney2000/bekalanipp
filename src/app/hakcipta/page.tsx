"use client";

import {
  Stack,
  Group,
  Paper,
  Text,
  Title,
  ThemeIcon,
  Divider,
  SimpleGrid,
  Box,
} from "@mantine/core";
import {
  IconCopyright,
  IconUser,
  IconMail,
  IconPhone,
  IconCode,
  IconHeart,
} from "@tabler/icons-react";
import AppShell from "@/components/AppShell";

export default function HakciptaPage() {
  return (
    <AppShell>
      <Stack gap="lg" maw={800} mx="auto">
        <Group gap="sm">
          <ThemeIcon size="lg" variant="light" color="cyan">
            <IconCopyright size={24} />
          </ThemeIcon>
          <Title order={2} fw={700}>
            Hakcipta
          </Title>
        </Group>

        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Stack gap="xl">
            <Group gap="md" justify="center">
              <ThemeIcon size={80} radius="xl" variant="light" color="cyan">
                <IconCode size={40} />
              </ThemeIcon>
            </Group>

            <Stack gap="xs" ta="center">
              <Title order={3} fw={700}>
                Sistem Pengurusan Bekalan Floor Stock, EMT & AOH
              </Title>
              <Text size="sm" c="dimmed">
                Jabatan Farmasi Hospital Keningau
              </Text>
            </Stack>

            <Divider />

            <Stack gap="md">
              <Title order={4} fw={600} ta="center">
                Pembangun Sistem
              </Title>

              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <Paper p="md" radius="md" withBorder>
                  <Stack gap="xs" align="center" ta="center">
                    <ThemeIcon size="lg" variant="light" color="cyan">
                      <IconUser size={20} />
                    </ThemeIcon>
                    <Text size="sm" fw={600}>
                      Nama
                    </Text>
                    <Text size="sm" c="dimmed">
                      Ahmad Fetre Bin Mohammad Zime
                    </Text>
                  </Stack>
                </Paper>

                <Paper p="md" radius="md" withBorder>
                  <Stack gap="xs" align="center" ta="center">
                    <ThemeIcon size="lg" variant="light" color="blue">
                      <IconMail size={20} />
                    </ThemeIcon>
                    <Text size="sm" fw={600}>
                      Email
                    </Text>
                    <Text size="sm" c="dimmed">
                      fetreney2000@gmail.com
                    </Text>
                  </Stack>
                </Paper>

                <Paper p="md" radius="md" withBorder>
                  <Stack gap="xs" align="center" ta="center">
                    <ThemeIcon size="lg" variant="light" color="green">
                      <IconPhone size={20} />
                    </ThemeIcon>
                    <Text size="sm" fw={600}>
                      Telefon
                    </Text>
                    <Text size="sm" c="dimmed">
                      016-881 3920
                    </Text>
                  </Stack>
                </Paper>
              </SimpleGrid>
            </Stack>

            <Divider />

            <Stack gap="xs" ta="center">
              <Group gap="xs" justify="center">
                <IconHeart size={14} color="red" />
                <Text size="xs" c="dimmed">
                  Dibangunkan dengan penuh dedikasi untuk Jabatan Farmasi Hospital Keningau
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                &copy; {new Date().getFullYear()} Hak Cipta Terpelihara
              </Text>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </AppShell>
  );
}
