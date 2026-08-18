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
  Box,
  Loader,
  Center,
  ThemeIcon,
  Title,
  Table,
  TableScrollContainer,
  Progress,
} from "@mantine/core";
import {
  IconShoppingBag,
  IconPackage,
  IconBuildingHospital,
  IconCalendar,
  IconCircleCheck,
  IconChartPie,
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

  // Presentational derivations only — no data transform, no logic change.
  const quotaRows = (data?.itemStatus ?? []).filter((item) => item.quota > 0);
  const hasQuotaData =
    quotaRows.length > 0 ||
    (data?.warnings.length ?? 0) > 0 ||
    (data?.exceeded.length ?? 0) > 0;

  return (
    <AppShell>
      {loading && (
        <Center h={320}>
          <Stack align="center" gap="xs">
            <Loader size="md" />
            <Text size="sm" c="dimmed">Memuatkan data...</Text>
          </Stack>
        </Center>
      )}

      {error && (
        <Paper style={{ backgroundColor: "var(--mantine-color-red-light)" }}>
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
          <Paper>
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <IconCalendar size={18} color="var(--mantine-color-gray-5)" />
                <Title order={3}>Dashboard</Title>
              </Group>
              <Text size="sm" c="dimmed" className="mono">{data.month}</Text>
            </Group>
          </Paper>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Paper>
              <Group gap="sm" align="center">
                <ThemeIcon size="lg" radius="md" variant="light" color="cyan">
                  <IconShoppingBag size={22} />
                </ThemeIcon>
                <Stack gap={0}>
                  <Text size="xs" c="dimmed">Jumlah Pesanan</Text>
                  <Text size="xl" fw={700} className="mono">{data.orders_count}</Text>
                </Stack>
              </Group>
            </Paper>

            <Paper>
              <Group gap="sm" align="center">
                <ThemeIcon size="lg" radius="md" variant="light" color="green">
                  <IconPackage size={22} />
                </ThemeIcon>
                <Stack gap={0}>
                  <Text size="xs" c="dimmed">Jumlah Item</Text>
                  <Text size="xl" fw={700} className="mono">{data.items_count}</Text>
                </Stack>
              </Group>
            </Paper>

            <Paper>
              <Group gap="sm" align="center" wrap="nowrap">
                <ThemeIcon size="lg" radius="md" variant="light" color="yellow">
                  <IconBuildingHospital size={22} />
                </ThemeIcon>
                <Stack gap={0} style={{ minWidth: 0 }}>
                  <Text size="xs" c="dimmed">Pesanan Terbanyak</Text>
                  {data.top_ward ? (
                    <>
                      <Text fw={700} size="md" truncate>{data.top_ward.ward_name}</Text>
                      <Text size="xs" c="dimmed" className="mono">
                        {data.top_ward.order_count.toLocaleString("ms-MY")} pesanan
                      </Text>
                    </>
                  ) : (
                    <Text size="sm" c="dimmed">Tiada data</Text>
                  )}
                </Stack>
              </Group>
            </Paper>
          </SimpleGrid>

          {hasQuotaData ? (
            <>
              <Paper>
                <Group gap="sm" mb="md">
                  <IconChartPie size={18} color="var(--mantine-color-gray-5)" />
                  <Title order={4}>Kuota Bulanan</Title>
                </Group>
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <Paper>
                    <Group justify="space-between" align="center" mb="sm">
                      <Text size="sm" fw={600}>Melebihi 80%</Text>
                      <Badge color="yellow" variant="light" size="sm" className="mono">
                        {data.warnings.length}
                      </Badge>
                    </Group>
                    {data.warnings.length === 0 ? (
                      <Text size="sm" c="dimmed">Tiada amaran kuota.</Text>
                    ) : (
                      <Stack gap="xs">
                        {data.warnings.map((item, idx) => {
                          const pct = Math.round((item.used / item.quota) * 100);
                          return (
                            <Box key={idx}>
                              <Group justify="space-between" gap="xs" wrap="nowrap">
                                <Text size="sm" truncate style={{ minWidth: 0 }}>
                                  <strong>{item.ward_name}</strong>
                                  <Text component="span" c="dimmed"> · {item.item_name}</Text>
                                </Text>
                                <Text size="xs" c="dimmed" className="mono" style={{ whiteSpace: "nowrap" }}>
                                  {item.used}/{item.quota}
                                </Text>
                              </Group>
                              <Progress value={Math.min(100, pct)} size="xs" mt={4} color="yellow" />
                            </Box>
                          );
                        })}
                      </Stack>
                    )}
                  </Paper>

                  <Paper>
                    <Group justify="space-between" align="center" mb="sm">
                      <Text size="sm" fw={600}>Habis Kuota (100%+)</Text>
                      <Badge color="red" variant="light" size="sm" className="mono">
                        {data.exceeded.length}
                      </Badge>
                    </Group>
                    {data.exceeded.length === 0 ? (
                      <Text size="sm" c="dimmed">Tiada kuota yang habis.</Text>
                    ) : (
                      <Stack gap="xs">
                        {data.exceeded.map((item, idx) => {
                          const pct = Math.round((item.used / item.quota) * 100);
                          return (
                            <Box key={idx}>
                              <Group justify="space-between" gap="xs" wrap="nowrap">
                                <Text size="sm" truncate style={{ minWidth: 0 }}>
                                  <strong>{item.ward_name}</strong>
                                  <Text component="span" c="dimmed"> · {item.item_name}</Text>
                                </Text>
                                <Text size="xs" c="red" className="mono" style={{ whiteSpace: "nowrap" }}>
                                  {item.used}/{item.quota}
                                </Text>
                              </Group>
                              <Progress value={Math.min(100, pct)} size="xs" mt={4} color="red" />
                            </Box>
                          );
                        })}
                      </Stack>
                    )}
                  </Paper>
                </SimpleGrid>
              </Paper>

              <Paper>
                <Title order={4} mb="md">Butiran Item Kuota</Title>
                <TableScrollContainer minWidth={520}>
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
                      {quotaRows.map((item, idx) => {
                        const pct = Math.round((item.used / item.quota) * 100);
                        const over = item.used > item.quota;
                        return (
                          <Table.Tr key={idx}>
                            <Table.Td>{item.ward_name}</Table.Td>
                            <Table.Td>{item.item_name}</Table.Td>
                            <Table.Td ta="right">
                              <Text className="mono" fw={600} c={over ? "red" : undefined}>{item.used}</Text>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text className="mono" c="dimmed">{item.quota}</Text>
                            </Table.Td>
                            <Table.Td ta="center">
                              {pct >= 100 ? (
                                <Badge color="red" variant="light" size="sm" className="mono">100%+</Badge>
                              ) : pct >= 80 ? (
                                <Badge color="yellow" variant="light" size="sm" className="mono">80%+</Badge>
                              ) : (
                                <Badge color="green" variant="light" size="sm" className="mono">&lt;80%</Badge>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </TableScrollContainer>
              </Paper>
            </>
          ) : (
            <Paper>
              <Center py={48}>
                <Stack align="center" gap="xs" ta="center" maw={420}>
                  <ThemeIcon size="xl" radius="md" variant="light" color="green">
                    <IconCircleCheck size={28} />
                  </ThemeIcon>
                  <Text fw={600}>Tiada amaran kuota bagi bulan ini</Text>
                  <Text size="sm" c="dimmed">
                    Semua wad/jabatan masih dalam had kuota. Tiada tindakan diperlukan.
                  </Text>
                </Stack>
              </Center>
            </Paper>
          )}
        </Stack>
      )}
    </AppShell>
  );
}