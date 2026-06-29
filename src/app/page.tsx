"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import {
  SimpleGrid,
  Text,
  Badge,
  Paper,
  Stack,
  Group,
  Loader,
  Center,
  ThemeIcon,
  Title,
  Table,
  TableScrollContainer,
} from "@mantine/core";
import {
  IconShoppingBag,
  IconPackage,
  IconBuildingHospital,
  IconCalendar,
} from "@tabler/icons-react";

interface ItemStatus {
  ward_name: string;
  item_name: string;
  quota: number;
  used: number;
}

interface TopWard {
  ward_id: string;
  ward_name: string;
  order_count: number;
}

interface DashboardData {
  month: string;
  itemStatus: ItemStatus[];
  warnings: ItemStatus[];
  exceeded: ItemStatus[];
  orders_count: number;
  items_count: number;
  top_ward: TopWard | null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    fetch(`/api/dashboard?month=${month}`)
      .then((res) => {
        if (!res.ok) throw new Error("Gagal memuatkan data");
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      {loading && (
        <Center h={400}>
          <Loader size="lg" color="blue" />
        </Center>
      )}

      {error && (
        <Paper
          p="md"
          radius="md"
          style={{ backgroundColor: "var(--mantine-color-red-light)", border: "1px solid var(--mantine-color-red-4)" }}
        >
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color="red">
              <IconBuildingHospital size={18} />
            </ThemeIcon>
            <Text c="red.6">{error}</Text>
          </Group>
        </Paper>
      )}

      {data && (
        <Stack gap="lg">
          <Paper shadow="sm" p="sm" radius="md" withBorder>
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <IconCalendar size={18} color="var(--mantine-color-gray-5)" />
                <Title order={3} fw={700}>
                  Dashboard - {data.month}
                </Title>
              </Group>
            </Group>
          </Paper>

          <SimpleGrid cols={3}>
            <Paper shadow="sm" p="md" radius="md" withBorder>
              <Group gap="sm" align="center">
                <ThemeIcon size="lg" radius="md" variant="light" color="cyan">
                  <IconShoppingBag size={22} />
                </ThemeIcon>
                <Stack gap={0}>
                  <Text size="xs" c="dimmed">Jumlah Pesanan</Text>
                  <Text size="xl" fw={700}>{data.orders_count}</Text>
                </Stack>
              </Group>
            </Paper>
            <Paper shadow="sm" p="md" radius="md" withBorder>
              <Group gap="sm" align="center">
                <ThemeIcon size="lg" radius="md" variant="light" color="green">
                  <IconPackage size={22} />
                </ThemeIcon>
                <Stack gap={0}>
                  <Text size="xs" c="dimmed">Jumlah Item</Text>
                  <Text size="xl" fw={700}>{data.items_count}</Text>
                </Stack>
              </Group>
            </Paper>
            <Paper shadow="sm" p="md" radius="md" withBorder>
              <Group gap="sm" align="center">
                <ThemeIcon size="lg" radius="md" variant="light" color="yellow">
                  <IconBuildingHospital size={22} />
                </ThemeIcon>
                <Stack gap={0}>
                  <Text size="xs" c="dimmed">Pesanan Terbanyak</Text>
                  <Text size="xl" fw={700}>
                    {data.top_ward
                      ? `${data.top_ward.ward_name} (${data.top_ward.order_count})`
                      : "Tiada data"}
                  </Text>
                </Stack>
              </Group>
            </Paper>
          </SimpleGrid>

          <SimpleGrid cols={3}>
            <Paper p="md" radius="md" withBorder>
              <Title order={5} fw={600} mb="md">Amaran Kuota (Bulan Ini)</Title>
              <Text size="sm">
                Jumlah amaran: {data.warnings.length} (80%+) | Jumlah kritikal: {data.exceeded.length} (100%+)
              </Text>
            </Paper>

            <Paper p="md" radius="md" withBorder>
              <Title order={5} fw={600} mb="md">Wad/Jabatan Melebihi 80%</Title>
              {data.warnings.length === 0 ? (
                <Text c="dimmed">Tiada</Text>
              ) : (
                <Stack gap="xs">
                  {data.warnings.map((item, idx) => (
                    <Group key={idx} gap="xs">
                      <Badge color="yellow" variant="light" size="sm">80%+</Badge>
                      <Text size="sm"><strong>{item.ward_name}</strong> - {item.item_name} ({item.used}/{item.quota})</Text>
                    </Group>
                  ))}
                </Stack>
              )}
            </Paper>

            <Paper p="md" radius="md" withBorder>
              <Title order={5} fw={600} mb="md">Wad/Jabatan Habis Kuota</Title>
              {data.exceeded.length === 0 ? (
                <Text c="dimmed">Tiada</Text>
              ) : (
                <Stack gap="xs">
                  {data.exceeded.map((item, idx) => (
                    <Group key={idx} gap="xs">
                      <Badge color="red" variant="light" size="sm">100%+</Badge>
                      <Text size="sm"><strong>{item.ward_name}</strong> - {item.item_name} ({item.used}/{item.quota})</Text>
                    </Group>
                  ))}
                </Stack>
              )}
            </Paper>
          </SimpleGrid>

          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Title order={5} fw={600} mb="md">Butiran Item Kuota Kritikal</Title>
            <TableScrollContainer minWidth={500}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Wad/Jabatan</Table.Th>
                    <Table.Th>Item</Table.Th>
                    <Table.Th ta="right">Digunakan</Table.Th>
                    <Table.Th ta="right">Kuota</Table.Th>
                    <Table.Th ta="center">Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.itemStatus
                    .filter((item) => item.quota > 0)
                    .map((item, idx) => {
                      const pct = Math.round((item.used / item.quota) * 100);
                      return (
                        <Table.Tr key={idx}>
                          <Table.Td>{item.ward_name}</Table.Td>
                          <Table.Td>{item.item_name}</Table.Td>
                          <Table.Td ta="right">{item.used}</Table.Td>
                          <Table.Td ta="right">{item.quota}</Table.Td>
                          <Table.Td ta="center">
                            {pct >= 100 ? <Badge color="red" variant="light" size="sm">100%+</Badge> : pct >= 80 ? <Badge color="yellow" variant="light" size="sm">80%+</Badge> : <Badge color="green" variant="light" size="sm">&lt;80%</Badge>}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                </Table.Tbody>
              </Table>
            </TableScrollContainer>
          </Paper>
        </Stack>
      )}
    </AppShell>
  );
}
