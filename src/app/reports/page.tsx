"use client";

import { useState, useCallback } from "react";
import {
  Stack,
  Group,
  Paper,
  Text,
  Badge,
  SimpleGrid,
  CloseButton,
  Loader,
  Flex,
  Select,
  Button,
  TextInput,
  NumberInput,
  Table,
  Alert,
  ThemeIcon,
  Title,
  Box,
} from "@mantine/core";
import {
  IconChartBar,
  IconCalendar,
  IconDownload,
  IconFilter,
  IconFileText,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
} from "@tabler/icons-react";
import AppShell from "@/components/AppShell";

type ReportType = "daily" | "weekly" | "monthly" | "yearly";

interface SummaryItem {
  ward_id: number;
  ward_name: string;
  order_type: string;
  order_count: number;
  bil_item: number;
  jumlah_item: number;
}

interface WardSummary {
  ward_id: number;
  ward_name: string;
  order_count: number;
  bil_item: number;
  jumlah_item: number;
}

interface MasaSummary {
  masa_pejabat: boolean;
  quantity: number;
}

interface MasaCatSummary {
  ward_category: string;
  masa_pejabat: boolean;
  quantity: number;
}

interface Recommendation {
  item_id: string;
  item_name: string;
  avg_per_day: number;
  recommended_stock: number;
}

interface UsageReport {
  type: string;
  start: string;
  end: string;
  summary: SummaryItem[];
  totals_by_ward: WardSummary[];
  totals: { order_count: number; bil_item: number; jumlah_item: number };
  totals_by_masa: Record<string, { order_count: number; bil_item: number; jumlah_item: number }>;
  totals_by_masa_by_cat: Record<string, Record<string, { order_count: number; bil_item: number; jumlah_item: number }>>;
  recommendations: Recommendation[];
}

interface WardItemResult {
  item_id: string;
  item_name: string;
  order_count: number;
  quantity_sum: number;
}

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

function formatNumber(n: number | undefined | null): string {
  return (n || 0).toLocaleString("ms-MY");
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function buildQueryParams(
  type: ReportType,
  date: string,
  week: string,
  month: string,
  year: string
): string {
  const params = new URLSearchParams({ type });
  if (type === "daily" && date) params.set("date", date);
  if (type === "weekly" && week) params.set("week", week);
  if (type === "monthly" && month) params.set("month", month);
  if (type === "yearly" && year) params.set("year", year);
  return params.toString();
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("monthly");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [week, setWeek] = useState(() => {
    const now = new Date();
    const jan1 = new Date(now.getFullYear(), 0, 1);
    const dayOfYear =
      Math.floor((now.getTime() - jan1.getTime()) / 86400000) + 1;
    const weekNum = Math.ceil(dayOfYear / 7);
    return `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  });
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [year, setYear] = useState(() => String(getCurrentYear()));

  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wardItems, setWardItems] = useState<WardItemResult[] | null>(null);
  const [wardItemsLoading, setWardItemsLoading] = useState(false);
  const [wardItemsError, setWardItemsError] = useState<string | null>(null);
  const [showWardItems, setShowWardItems] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWardItems(null);
    setShowWardItems(false);
    try {
      const qs = buildQueryParams(reportType, date, week, month, year);
      const res = await fetch(`/api/reports/usage?${qs}`);
      if (!res.ok) throw new Error("Gagal memuatkan laporan");
      const data = await res.json();
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ralat tidak diketahui");
    } finally {
      setLoading(false);
    }
  }, [reportType, date, week, month, year]);

  const fetchWardItems = useCallback(async () => {
    setWardItemsLoading(true);
    setWardItemsError(null);
    try {
      const qs = buildQueryParams(reportType, date, week, month, year);
      const res = await fetch(`/api/reports/ward-items?${qs}`);
      if (!res.ok) throw new Error("Gagal memuatkan item wad");
      const data = await res.json();
      setWardItems(data.items || []);
      setShowWardItems(true);
    } catch (err: unknown) {
      setWardItemsError(
        err instanceof Error ? err.message : "Ralat tidak diketahui"
      );
    } finally {
      setWardItemsLoading(false);
    }
  }, [reportType, date, week, month, year]);

  const masaPejabatQty =
    report?.totals_by_masa.masa_pejabat?.jumlah_item || 0;
  const selepasMasaPejabatQty =
    report?.totals_by_masa.selepas_masa_pejabat?.jumlah_item || 0;
  const totalQty = report?.totals.jumlah_item || 0;

  const wardMpQty =
    report?.totals_by_masa_by_cat.ward?.masa_pejabat?.jumlah_item || 0;
  const wardSmpQty =
    report?.totals_by_masa_by_cat.ward?.selepas_masa_pejabat?.jumlah_item || 0;
  const bukanWardMpQty =
    report?.totals_by_masa_by_cat.not_ward?.masa_pejabat?.jumlah_item || 0;
  const bukanWardSmpQty =
    report?.totals_by_masa_by_cat.not_ward?.selepas_masa_pejabat?.jumlah_item || 0;

  const statCards = [
    {
      label: "Jumlah Pesanan",
      value: formatNumber(report?.totals.order_count || 0),
      icon: IconFileText,
      color: "cyan",
    },
    {
      label: "Jumlah Item",
      value: formatNumber(report?.totals.jumlah_item || 0),
      icon: IconChartBar,
      color: "green",
    },
    {
      label: "Masa Pejabat",
      value: formatNumber(masaPejabatQty),
      icon: IconTrendingUp,
      color: "yellow",
    },
    {
      label: "Selepas Masa Pejabat",
      value: formatNumber(selepasMasaPejabatQty),
      icon: IconTrendingDown,
      color: "red",
    },
    {
      label: "Wad + MP",
      value: formatNumber(wardMpQty),
      icon: IconMinus,
      color: "cyan",
    },
    {
      label: "Bukan Wad + SMP",
      value: formatNumber(bukanWardSmpQty),
      icon: IconMinus,
      color: "gray",
    },
  ];

  return (
    <AppShell>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap" gap="md">
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="blue">
              <IconChartBar size={24} />
            </ThemeIcon>
            <Title order={2} fw={700}>
              Laporan
            </Title>
          </Group>
        </Group>

        <Paper shadow="sm" p="md" radius="md">
          <Stack gap="md">
            <Group gap="md" wrap="wrap" align="flex-end">
              <Select
                label="Jenis Laporan"
                data={[
                  { value: "daily", label: "Harian" },
                  { value: "weekly", label: "Mingguan" },
                  { value: "monthly", label: "Bulanan" },
                  { value: "yearly", label: "Tahunan" },
                ]}
                value={reportType}
                onChange={(val) => setReportType(val as ReportType)}
                style={{ minWidth: 160, flex: 1 }}
              />

              {reportType === "daily" && (
                <TextInput
                  label="Tarikh"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.currentTarget.value)}
                  style={{ minWidth: 160, flex: 1 }}
                />
              )}

              {reportType === "weekly" && (
                <TextInput
                  label="Minggu"
                  type="week"
                  value={week}
                  onChange={(e) => setWeek(e.currentTarget.value)}
                  style={{ minWidth: 160, flex: 1 }}
                />
              )}

              {reportType === "monthly" && (
                <TextInput
                  label="Bulan"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.currentTarget.value)}
                  style={{ minWidth: 160, flex: 1 }}
                />
              )}

              {reportType === "yearly" && (
                <NumberInput
                  label="Tahun"
                  value={Number(year)}
                  onChange={(val) => setYear(String(val ?? getCurrentYear()))}
                  min={2000}
                  max={2100}
                  style={{ minWidth: 120, flex: 1 }}
                />
              )}

              <Button
                leftSection={<IconFilter size={15} />}
                onClick={fetchReport}
                loading={loading}
                loaderProps={{ size: "sm" }}
                variant="filled"
                size="sm"
              >
                Jana Laporan
              </Button>
            </Group>

            {report && (
              <Group gap="xs" wrap="wrap">
                <Badge color="blue" variant="light">
                  {REPORT_TYPE_LABELS[report.type as ReportType]}
                </Badge>
                <Badge color="green" variant="light">
                  {report.start} hingga {report.end}
                </Badge>
              </Group>
            )}
          </Stack>
        </Paper>

        {loading && (
          <Flex justify="center" py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" color="blue" />
              <Text size="sm" c="dimmed">
                Memuatkan laporan...
              </Text>
            </Stack>
          </Flex>
        )}

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        {report && !loading && (
          <>
            <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
              {statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Paper key={card.label} shadow="sm" p="md" radius="md">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={4}>
                        <Text size="sm" c="dimmed">
                          {card.label}
                        </Text>
                        <Text size="xl" fw={700}>
                          {card.value}
                        </Text>
                      </Stack>
                      <ThemeIcon
                        size="lg"
                        variant="light"
                        color={card.color}
                      >
                        <Icon size={20} />
                      </ThemeIcon>
                    </Group>
                  </Paper>
                );
              })}
            </SimpleGrid>

            <Paper shadow="sm" p="md" radius="md">
              <Group gap="sm" mb="md">
                <IconFileText size={18} color="cyan.6" />
                <Title order={4} fw={700}>
                  Ringkasan Mengikut Wad
                </Title>
              </Group>
              <Table.ScrollContainer minWidth={300}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Wad</Table.Th>
                      <Table.Th style={{ textAlign: "right" }}>Jumlah Item</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {report.totals_by_ward.map((ws) => (
                      <Table.Tr key={ws.ward_id}>
                        <Table.Td>{ws.ward_name}</Table.Td>
                        <Table.Td style={{ textAlign: "right", fontWeight: 600 }}>
                          {formatNumber(ws.jumlah_item)}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    <Table.Tr style={{ fontWeight: 700 }}>
                      <Table.Td>JUMLAH</Table.Td>
                      <Table.Td style={{ textAlign: "right" }}>
                        {formatNumber(report.totals.jumlah_item)}
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>

            <Paper shadow="sm" p="md" radius="md">
              <Group gap="sm" mb="md">
                <IconCalendar size={18} color="yellow.6" />
                <Title order={4} fw={700}>
                  Masa Pejabat
                </Title>
              </Group>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Paper p="md" radius="md" variant="light" color="cyan">
                  <Text size="sm" fw={600} mb="sm" c="cyan">
                    Masa Pejabat
                  </Text>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Bil. Pesanan</Text>
                      <Text size="sm" fw={600}>{formatNumber(masaPejabatQty)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Peratusan</Text>
                      <Text size="sm" fw={600}>
                        {totalQty > 0
                          ? ((masaPejabatQty / totalQty) * 100).toFixed(1)
                          : "0.0"}
                        %
                      </Text>
                    </Group>
                  </Stack>
                </Paper>
                <Paper p="md" radius="md" variant="light" color="red">
                  <Text size="sm" fw={600} mb="sm" c="red">
                    Selepas Masa Pejabat
                  </Text>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Bil. Pesanan</Text>
                      <Text size="sm" fw={600}>{formatNumber(selepasMasaPejabatQty)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Peratusan</Text>
                      <Text size="sm" fw={600}>
                        {totalQty > 0
                          ? ((selepasMasaPejabatQty / totalQty) * 100).toFixed(1)
                          : "0.0"}
                        %
                      </Text>
                    </Group>
                  </Stack>
                </Paper>
              </SimpleGrid>
            </Paper>

            <Paper shadow="sm" p="md" radius="md">
              <Group gap="sm" mb="md">
                <IconChartBar size={18} color="green.6" />
                <Title order={4} fw={700}>
                  Pecahan Mengikut Kategori
                </Title>
              </Group>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Paper p="md" radius="md" variant="light" color="cyan">
                  <Text size="sm" fw={600} mb="sm" c="cyan">
                    Wad + Masa Pejabat
                  </Text>
                  <Text size="xl" fw={700}>{formatNumber(wardMpQty)}</Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    {totalQty > 0 ? ((wardMpQty / totalQty) * 100).toFixed(1) : "0.0"} % daripada jumlah
                  </Text>
                </Paper>
                <Paper p="md" radius="md" variant="light" color="yellow">
                  <Text size="sm" fw={600} mb="sm" c="yellow">
                    Wad + Selepas Masa Pejabat
                  </Text>
                  <Text size="xl" fw={700}>{formatNumber(wardSmpQty)}</Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    {totalQty > 0 ? ((wardSmpQty / totalQty) * 100).toFixed(1) : "0.0"} % daripada jumlah
                  </Text>
                </Paper>
                <Paper p="md" radius="md" variant="light" color="green">
                  <Text size="sm" fw={600} mb="sm" c="green">
                    Bukan Wad + Masa Pejabat
                  </Text>
                  <Text size="xl" fw={700}>{formatNumber(bukanWardMpQty)}</Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    {totalQty > 0 ? ((bukanWardMpQty / totalQty) * 100).toFixed(1) : "0.0"} % daripada jumlah
                  </Text>
                </Paper>
                <Paper p="md" radius="md" variant="light" color="gray">
                  <Text size="sm" fw={600} mb="sm" c="dimmed">
                    Bukan Wad + Selepas Masa Pejabat
                  </Text>
                  <Text size="xl" fw={700}>{formatNumber(bukanWardSmpQty)}</Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    {totalQty > 0 ? ((bukanWardSmpQty / totalQty) * 100).toFixed(1) : "0.0"} % daripada jumlah
                  </Text>
                </Paper>
              </SimpleGrid>
            </Paper>

            {report.recommendations.length > 0 && (
              <Paper shadow="sm" p="md" radius="md">
                <Group gap="sm" mb="md">
                  <IconTrendingUp size={18} color="green.6" />
                  <Title order={4} fw={700}>
                    Cadangan Kuota
                  </Title>
                </Group>
                <Table.ScrollContainer minWidth={500}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Item</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Purata/Hari</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Kuota Semasa (30 hari)</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Cadangan (×1.25)</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Delta</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {report.recommendations.slice(0, 50).map((rec) => {
                        const current = rec.avg_per_day * 30;
                        const suggested = rec.recommended_stock;
                        const delta = suggested - current;
                        const deltaPercent =
                          current > 0
                            ? ((delta / current) * 100).toFixed(1)
                            : "0.0";
                        const deltaColor =
                          delta > 0
                            ? "green"
                            : delta < 0
                              ? "red"
                              : "dimmed";
                        const DeltaIcon =
                          delta > 0
                            ? IconTrendingUp
                            : delta < 0
                              ? IconTrendingDown
                              : IconMinus;
                        return (
                          <Table.Tr key={rec.item_id}>
                            <Table.Td>{rec.item_name}</Table.Td>
                            <Table.Td style={{ textAlign: "right" }}>
                              {rec.avg_per_day}
                            </Table.Td>
                            <Table.Td style={{ textAlign: "right" }}>
                              {formatNumber(Math.round(current))}
                            </Table.Td>
                            <Table.Td style={{ textAlign: "right", fontWeight: 600, color: deltaColor }}>
                              {formatNumber(suggested)}
                            </Table.Td>
                            <Table.Td style={{ textAlign: "right" }}>
                              <Group gap={4} justify="flex-end" wrap="nowrap">
                                <DeltaIcon size={14} color={deltaColor} />
                                <Text size="sm" fw={600} c={deltaColor}>
                                  {delta > 0 ? "+" : ""}
                                  {formatNumber(delta)} ({deltaPercent}%)
                                </Text>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
                {report.recommendations.length > 50 && (
                  <Text size="xs" c="dimmed" mt="sm" ta="center">
                    Menunjukkan 50 item teratas daripada{" "}
                    {report.recommendations.length} item
                  </Text>
                )}
              </Paper>
            )}

            <Box>
              <Button
                leftSection={<IconFileText size={15} />}
                onClick={fetchWardItems}
                loading={wardItemsLoading}
                loaderProps={{ size: "sm" }}
                variant="light"
                size="sm"
              >
                Butiran Item
              </Button>
            </Box>

            {wardItemsError && (
              <Alert color="red" variant="light">
                {wardItemsError}
              </Alert>
            )}

            {showWardItems && wardItems && (
              <Paper shadow="sm" p="md" radius="md">
                <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
                  <Group gap="sm">
                    <IconDownload size={18} color="cyan.6" />
                    <Title order={4} fw={700}>
                      Butiran Item
                    </Title>
                  </Group>
                  <CloseButton onClick={() => setShowWardItems(false)} />
                </Group>
                {wardItems.length === 0 ? (
                  <Text size="sm" c="dimmed" py="md" ta="center">
                    Tiada item ditemui untuk tempoh ini.
                  </Text>
                ) : (
                  <Table.ScrollContainer minWidth={400}>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Item</Table.Th>
                          <Table.Th style={{ textAlign: "right" }}>Bil. Pesanan</Table.Th>
                          <Table.Th style={{ textAlign: "right" }}>Jumlah Kuantiti</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {wardItems.map((wi) => (
                          <Table.Tr key={wi.item_id}>
                            <Table.Td>{wi.item_name}</Table.Td>
                            <Table.Td style={{ textAlign: "right" }}>
                              {formatNumber(wi.order_count)}
                            </Table.Td>
                            <Table.Td style={{ textAlign: "right", fontWeight: 600 }}>
                              {formatNumber(wi.quantity_sum)}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                )}
              </Paper>
            )}
          </>
        )}

        {!report && !loading && !error && (
          <Flex justify="center" align="center" py={64} style={{ opacity: 0.5 }}>
            <Stack align="center" gap="md">
              <IconChartBar size={48} />
              <Text size="md" c="dimmed">
                Pilih parameter dan tekan &quot;Jana Laporan&quot; untuk melihat
                laporan
              </Text>
            </Stack>
          </Flex>
        )}
      </Stack>
    </AppShell>
  );
}
