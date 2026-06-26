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
  IconAlertTriangle,
  IconAlertOctagon,
  IconActivity,
} from "@tabler/icons-react";

interface ItemStatus {
  item_id: string;
  item_name: string;
  total_used: number;
  total_quota: number;
  wards_using: number;
  status: string;
}

interface TopWard {
  ward_id: string;
  ward_name: string;
  order_count: number;
}

interface DashboardData {
  month: string;
  itemStatus: ItemStatus[];
  warnings: string[];
  exceeded: string[];
  orders_count: number;
  items_count: number;
  top_ward: TopWard | null;
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
}) {
  return (
    <Paper shadow="sm" p="md" radius="md" withBorder>
      <Group gap="sm" align="center">
        <ThemeIcon
          size="lg"
          radius="md"
          variant="light"
          color={iconColor}
          style={{ backgroundColor: `${iconColor}22`, color: iconColor }}
        >
          <Icon size={22} />
        </ThemeIcon>
        <Stack gap={0}>
          <Text size="xs" c="dimmed">
            {label}
          </Text>
          <Text size="xl" fw={700}>
            {value}
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}

function QuotaTable({
  items,
  type,
}: {
  items: ItemStatus[];
  type: "warning" | "exceeded";
}) {
  if (items.length === 0) return null;

  const bgColor = type === "exceeded" ? "rgba(239,83,80,0.08)" : "rgba(240,173,78,0.08)";
  const borderColor = type === "exceeded" ? "red.4" : "yellow.4";
  const Icon = type === "exceeded" ? IconAlertOctagon : IconAlertTriangle;
  const title = type === "exceeded" ? "Kuota Dilampaui" : "Amaran Kuota";
  const iconColor = type === "exceeded" ? "red" : "yellow";

  return (
    <Paper
      p="md"
      radius="md"
      style={{ backgroundColor: bgColor, border: `1px solid var(--mantine-color-${borderColor})` }}
    >
      <Group gap="xs" mb="md">
        <ThemeIcon size="sm" variant="light" color={iconColor}>
          <Icon size={18} />
        </ThemeIcon>
        <Title order={5} fw={600}>
          {title}
        </Title>
      </Group>
      <TableScrollContainer minWidth={400}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Wad</Table.Th>
              <Table.Th>Item</Table.Th>
              <Table.Th style={{ textAlign: "right" }}>Kuota</Table.Th>
              <Table.Th style={{ textAlign: "right" }}>Diguna</Table.Th>
              <Table.Th style={{ textAlign: "right" }}>Baki</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => (
              <Table.Tr key={item.item_id}>
                <Table.Td>{item.wards_using} wad</Table.Td>
                <Table.Td>{item.item_name}</Table.Td>
                <Table.Td style={{ textAlign: "right" }}>{item.total_quota}</Table.Td>
                <Table.Td style={{ textAlign: "right" }}>{item.total_used}</Table.Td>
                <Table.Td style={{ textAlign: "right" }}>{item.total_quota - item.total_used}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </TableScrollContainer>
    </Paper>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case "melebihi":
      return "red";
    case "hampir_habis":
      return "yellow";
    case "sederhana":
      return "orange";
    default:
      return "green";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "melebihi":
      return "Dilampaui";
    case "hampir_habis":
      return "Hampir Habis";
    case "sederhana":
      return "Sederhana";
    default:
      return "OK";
  }
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
          style={{ backgroundColor: "rgba(239,83,80,0.08)", border: "1px solid var(--mantine-color-red-4)" }}
        >
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color="red">
              <IconAlertOctagon size={18} />
            </ThemeIcon>
            <Text c="red.6">{error}</Text>
          </Group>
        </Paper>
      )}

      {data && (
        <Stack gap="lg">
          <Title order={3} fw={700}>
            Dashboard — {data.month}
          </Title>

          <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
            <StatCard
              label="Jumlah Pesanan"
              value={data.orders_count}
              icon={IconShoppingBag}
              iconColor="#4f87ff"
            />
            <StatCard
              label="Jumlah Item"
              value={data.items_count}
              icon={IconPackage}
              iconColor="#4caf50"
            />
            <StatCard
              label="Wad Paling Aktif"
              value={
                data.top_ward
                  ? `${data.top_ward.ward_name} (${data.top_ward.order_count})`
                  : "Tiada data"
              }
              icon={IconBuildingHospital}
              iconColor="#f0ad4e"
            />
          </SimpleGrid>

          {data.exceeded.length > 0 && (
            <QuotaTable
              items={data.itemStatus.filter((i) => i.status === "melebihi")}
              type="exceeded"
            />
          )}

          {data.warnings.length > 0 && (
            <QuotaTable
              items={data.itemStatus.filter((i) => i.status === "hampir_habis")}
              type="warning"
            />
          )}

          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Group gap="xs" mb="md">
              <ThemeIcon size="sm" variant="light" color="blue">
                <IconActivity size={18} />
              </ThemeIcon>
              <Title order={5} fw={600}>
                Status Kuota Bulanan
              </Title>
            </Group>
            <TableScrollContainer minWidth={500}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Item</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Diguna</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Kuota</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>%</Table.Th>
                    <Table.Th style={{ textAlign: "center" }}>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.itemStatus.map((item) => {
                    const pct =
                      item.total_quota > 0
                        ? Math.round((item.total_used / item.total_quota) * 100)
                        : 0;
                    return (
                      <Table.Tr key={item.item_id}>
                        <Table.Td>{item.item_name}</Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>{item.total_used}</Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>{item.total_quota}</Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          {item.total_quota > 0 ? `${pct}%` : "—"}
                        </Table.Td>
                        <Table.Td style={{ textAlign: "center" }}>
                          <Badge
                            color={getStatusColor(item.status)}
                            variant="light"
                            size="sm"
                            circle
                          >
                            {getStatusLabel(item.status)}
                          </Badge>
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
