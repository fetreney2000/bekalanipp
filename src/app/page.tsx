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
  Box,
  Divider,
} from "@mantine/core";
import {
  IconShoppingBag,
  IconPackage,
  IconBuildingHospital,
  IconCalendar,
  IconTrendingUp,
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
          <Box
            style={{
              background: "linear-gradient(135deg, var(--mantine-color-gray-0) 0%, var(--mantine-color-white) 100%)",
              borderRadius: "var(--mantine-radius-md)",
              padding: "var(--mantine-spacing-xl)",
              border: "1px solid var(--mantine-color-gray-2)",
            }}
          >
            <Group justify="space-between" align="flex-start">
              <Stack gap="xs">
                <Title order={3} fw={700} c="gray.8">
                  Dashboard
                </Title>
                <Group gap="xs">
                  <IconCalendar size={16} color="var(--mantine-color-gray-5)" />
                  <Text size="sm" c="dimmed">
                    {data.month}
                  </Text>
                </Group>
              </Stack>
              <Group gap="xs">
                <ThemeIcon size="lg" variant="light" color="teal" radius="md">
                  <IconTrendingUp size={20} />
                </ThemeIcon>
              </Group>
            </Group>
          </Box>

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <Paper
              p="lg"
              radius="md"
              withBorder
              style={{
                borderLeft: "3px solid var(--mantine-color-cyan-6)",
                transition: "box-shadow 150ms ease",
              }}
            >
              <Group gap="md" align="center">
                <ThemeIcon size="xl" radius="md" variant="light" color="cyan">
                  <IconShoppingBag size={24} />
                </ThemeIcon>
                <Stack gap={2}>
                  <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: "0.05em" }}>
                    Jumlah Pesanan
                  </Text>
                  <Text size="2xl" fw={700} c="gray.8">
                    {data.orders_count}
                  </Text>
                </Stack>
              </Group>
            </Paper>
            <Paper
              p="lg"
              radius="md"
              withBorder
              style={{
                borderLeft: "3px solid var(--mantine-color-green-6)",
                transition: "box-shadow 150ms ease",
              }}
            >
              <Group gap="md" align="center">
                <ThemeIcon size="xl" radius="md" variant="light" color="green">
                  <IconPackage size={24} />
                </ThemeIcon>
                <Stack gap={2}>
                  <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: "0.05em" }}>
                    Jumlah Item
                  </Text>
                  <Text size="2xl" fw={700} c="gray.8">
                    {data.items_count}
                  </Text>
                </Stack>
              </Group>
            </Paper>
            <Paper
              p="lg"
              radius="md"
              withBorder
              style={{
                borderLeft: "3px solid var(--mantine-color-amber-6)",
                transition: "box-shadow 150ms ease",
              }}
            >
              <Group gap="md" align="center">
                <ThemeIcon size="xl" radius="md" variant="light" color="yellow">
                  <IconBuildingHospital size={24} />
                </ThemeIcon>
                <Stack gap={2}>
                  <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: "0.05em" }}>
                    Pesanan Terbanyak
                  </Text>
                  <Text size="lg" fw={700} c="gray.8">
                    {data.top_ward
                      ? `${data.top_ward.ward_name}`
                      : "Tiada data"}
                  </Text>
                  {data.top_ward && (
                    <Text size="xs" c="dimmed">
                      {data.top_ward.order_count} pesanan
                    </Text>
                  )}
                </Stack>
              </Group>
            </Paper>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <Paper
              p="lg"
              radius="md"
              withBorder
              style={{
                background: "linear-gradient(135deg, var(--mantine-color-gray-0) 0%, var(--mantine-color-white) 100%)",
              }}
            >
              <Group gap="sm" mb="md">
                <ThemeIcon size="md" variant="light" color="orange" radius="sm">
                  <IconTrendingUp size={18} />
                </ThemeIcon>
                <Title order={5} fw={600} c="gray.8">
                  Ringkasan Amaran
                </Title>
              </Group>
              <Divider mb="md" />
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Amaran (80%+)</Text>
                  <Badge color="yellow" variant="light" size="lg">
                    {data.warnings.length}
                  </Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Kritikal (100%+)</Text>
                  <Badge color="red" variant="light" size="lg">
                    {data.exceeded.length}
                  </Badge>
                </Group>
              </Stack>
            </Paper>

            <Paper
              p="lg"
              radius="md"
              withBorder
              style={{
                borderTop: "3px solid var(--mantine-color-yellow-6)",
              }}
            >
              <Group gap="sm" mb="md">
                <Badge color="yellow" variant="filled" size="lg" radius="sm">
                  80%+
                </Badge>
                <Title order={5} fw={600} c="gray.8">
                  Melebihi 80%
                </Title>
              </Group>
              <Divider mb="md" />
              {data.warnings.length === 0 ? (
                <Text c="dimmed" size="sm" ta="center" py="md">
                  Tiada amaran pada masa ini
                </Text>
              ) : (
                <Stack gap="sm">
                  {data.warnings.slice(0, 5).map((item, idx) => (
                    <Box
                      key={idx}
                      p="xs"
                      style={{
                        borderRadius: "var(--mantine-radius-sm)",
                        backgroundColor: "var(--mantine-color-yellow-0)",
                        border: "1px solid var(--mantine-color-yellow-2)",
                      }}
                    >
                      <Text size="sm" fw={600} c="gray.8">
                        {item.ward_name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {item.item_name} ({item.used}/{item.quota})
                      </Text>
                    </Box>
                  ))}
                  {data.warnings.length > 5 && (
                    <Text size="xs" c="dimmed" ta="center">
                      +{data.warnings.length - 5} lagi...
                    </Text>
                  )}
                </Stack>
              )}
            </Paper>

            <Paper
              p="lg"
              radius="md"
              withBorder
              style={{
                borderTop: "3px solid var(--mantine-color-red-6)",
              }}
            >
              <Group gap="sm" mb="md">
                <Badge color="red" variant="filled" size="lg" radius="sm">
                  100%+
                </Badge>
                <Title order={5} fw={600} c="gray.8">
                  Habis Kuota
                </Title>
              </Group>
              <Divider mb="md" />
              {data.exceeded.length === 0 ? (
                <Text c="dimmed" size="sm" ta="center" py="md">
                  Tiada item melebihi kuota
                </Text>
              ) : (
                <Stack gap="sm">
                  {data.exceeded.slice(0, 5).map((item, idx) => (
                    <Box
                      key={idx}
                      p="xs"
                      style={{
                        borderRadius: "var(--mantine-radius-sm)",
                        backgroundColor: "var(--mantine-color-red-0)",
                        border: "1px solid var(--mantine-color-red-2)",
                      }}
                    >
                      <Text size="sm" fw={600} c="gray.8">
                        {item.ward_name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {item.item_name} ({item.used}/{item.quota})
                      </Text>
                    </Box>
                  ))}
                  {data.exceeded.length > 5 && (
                    <Text size="xs" c="dimmed" ta="center">
                      +{data.exceeded.length - 5} lagi...
                    </Text>
                  )}
                </Stack>
              )}
            </Paper>
          </SimpleGrid>

          <Paper
            p="lg"
            radius="md"
            withBorder
            style={{
              borderTop: "3px solid var(--mantine-color-slate-6)",
            }}
          >
            <Group justify="space-between" mb="md">
              <Group gap="sm">
                <ThemeIcon size="md" variant="light" color="slate" radius="sm">
                  <IconPackage size={18} />
                </ThemeIcon>
                <Title order={5} fw={600} c="gray.8">
                  Butiran Item Kuota Kritikal
                </Title>
              </Group>
              <Badge color="gray" variant="light" size="sm">
                {data.itemStatus.filter((item) => item.quota > 0).length} item
              </Badge>
            </Group>
            <Divider mb="md" />
            <TableScrollContainer minWidth={500}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th fw={600} c="gray.7">Wad/Jabatan</Table.Th>
                    <Table.Th fw={600} c="gray.7">Item</Table.Th>
                    <Table.Th ta="right" fw={600} c="gray.7">Digunakan</Table.Th>
                    <Table.Th ta="right" fw={600} c="gray.7">Kuota</Table.Th>
                    <Table.Th ta="center" fw={600} c="gray.7">Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.itemStatus
                    .filter((item) => item.quota > 0)
                    .map((item, idx) => {
                      const pct = Math.round((item.used / item.quota) * 100);
                      return (
                        <Table.Tr key={idx}>
                          <Table.Td fw={500}>{item.ward_name}</Table.Td>
                          <Table.Td>{item.item_name}</Table.Td>
                          <Table.Td ta="right" fw={600}>{item.used}</Table.Td>
                          <Table.Td ta="right" fw={600}>{item.quota}</Table.Td>
                          <Table.Td ta="center">
                            {pct >= 100 ? (
                              <Badge color="red" variant="filled" size="sm" radius="sm">
                                100%+
                              </Badge>
                            ) : pct >= 80 ? (
                              <Badge color="yellow" variant="filled" size="sm" radius="sm">
                                80%+
                              </Badge>
                            ) : (
                              <Badge color="green" variant="light" size="sm" radius="sm">
                                &lt;80%
                              </Badge>
                            )}
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
