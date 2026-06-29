"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Stack,
  Group,
  Paper,
  Text,
  Badge,
  SimpleGrid,
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
  Modal,
} from "@mantine/core";
import {
  IconChartBar,
  IconFilter,
  IconFileText,
  IconPill,
  IconClock,
  IconClockOff,
  IconBuildingHospital,
  IconBuildingSkyscraper,
  IconShoppingBag,
  IconPackage,
  IconClockCheck,
  IconTrendingUp,
  IconTrendingDown,
  IconList,
} from "@tabler/icons-react";
import { MonthPickerInput } from "@mantine/dates";
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

interface UsageReport {
  type: string;
  start: string;
  end: string;
  summary: SummaryItem[];
  totals_by_ward: WardSummary[];
  totals: { order_count: number; bil_item: number; jumlah_item: number };
  totals_by_masa: Record<string, { order_count: number; bil_item: number; jumlah_item: number }>;
  totals_by_masa_by_cat: Record<string, Record<string, { order_count: number; bil_item: number; jumlah_item: number }>>;
  timing: {
    completed_within_120: number;
    completed_over_120: number;
    total_completed: number;
    percentage_within_120: number;
  };
}

interface WardItemResult {
  item_id: number;
  item_name: string;
  order_count: number;
  quantity_sum: number;
}

interface ItemOrder {
  order_id: number;
  order_number: string;
  order_date: string;
  order_type: string;
  ward_name: string;
  quantity: number;
  masa_pejabat: boolean;
  sudah_disedia: boolean;
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
  const [monthDate, setMonthDate] = useState<Date>(new Date());
  const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
  const [year, setYear] = useState(() => String(getCurrentYear()));

  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wardItems, setWardItems] = useState<WardItemResult[]>([]);
  const [wardItemsLoading, setWardItemsLoading] = useState(false);

  const [selectedItem, setSelectedItem] = useState<WardItemResult | null>(null);
  const [itemOrders, setItemOrders] = useState<ItemOrder[]>([]);
  const [itemOrdersLoading, setItemOrdersLoading] = useState(false);
  const [itemOrdersModal, setItemOrdersModal] = useState(false);

  const [selectedWard, setSelectedWard] = useState<WardSummary | null>(null);
  const [wardOrders, setWardOrders] = useState<ItemOrder[]>([]);
  const [wardOrdersLoading, setWardOrdersLoading] = useState(false);
  const [wardOrdersModal, setWardOrdersModal] = useState(false);

  const qs = useMemo(
    () => buildQueryParams(reportType, date, week, month, year),
    [reportType, date, week, month, year]
  );

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWardItems([]);
    try {
      const res = await fetch(`/api/reports/usage?${qs}`);
      if (!res.ok) throw new Error("Gagal memuatkan laporan");
      const data = await res.json();
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ralat tidak diketahui");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  const fetchWardItems = useCallback(async () => {
    setWardItemsLoading(true);
    try {
      const res = await fetch(`/api/reports/ward-items?${qs}`);
      if (!res.ok) throw new Error("Gagal memuatkan item wad");
      const data = await res.json();
      setWardItems(data.items || []);
    } catch {
      setWardItems([]);
    } finally {
      setWardItemsLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    if (report) fetchWardItems();
  }, [report, fetchWardItems]);

  const fetchItemOrders = useCallback(async (item: WardItemResult) => {
    setSelectedItem(item);
    setItemOrdersModal(true);
    setItemOrdersLoading(true);
    try {
      const res = await fetch(`/api/reports/item-orders?item_id=${item.item_id}&${qs}`);
      if (!res.ok) throw new Error("Gagal memuatkan inden");
      const data = await res.json();
      setItemOrders(data.orders || []);
    } catch {
      setItemOrders([]);
    } finally {
      setItemOrdersLoading(false);
    }
  }, [qs]);

  const fetchWardOrders = useCallback(async (ward: WardSummary) => {
    setSelectedWard(ward);
    setWardOrdersModal(true);
    setWardOrdersLoading(true);
    try {
      const res = await fetch(`/api/reports/ward-orders?ward_id=${ward.ward_id}&${qs}`);
      if (!res.ok) throw new Error("Gagal memuatkan inden wad");
      const data = await res.json();
      setWardOrders(data.orders || []);
    } catch {
      setWardOrders([]);
    } finally {
      setWardOrdersLoading(false);
    }
  }, [qs]);

  const mp = report?.totals_by_masa.masa_pejabat || { order_count: 0, bil_item: 0, jumlah_item: 0 };
  const smp = report?.totals_by_masa.selepas_masa_pejabat || { order_count: 0, bil_item: 0, jumlah_item: 0 };
  const wMp = report?.totals_by_masa_by_cat.ward?.masa_pejabat || { order_count: 0, bil_item: 0, jumlah_item: 0 };
  const wSmp = report?.totals_by_masa_by_cat.ward?.selepas_masa_pejabat || { order_count: 0, bil_item: 0, jumlah_item: 0 };
  const nwMp = report?.totals_by_masa_by_cat.not_ward?.masa_pejabat || { order_count: 0, bil_item: 0, jumlah_item: 0 };
  const nwSmp = report?.totals_by_masa_by_cat.not_ward?.selepas_masa_pejabat || { order_count: 0, bil_item: 0, jumlah_item: 0 };

  const wadTotalOrders = wMp.order_count + wSmp.order_count;
  const bukanWadTotalOrders = nwMp.order_count + nwSmp.order_count;
  const wadTotalItems = wMp.jumlah_item + wSmp.jumlah_item;
  const bukanWadTotalItems = nwMp.jumlah_item + nwSmp.jumlah_item;

  const indenCards = useMemo(() => [
    { label: "Jumlah Inden", value: report?.totals.order_count || 0, icon: IconShoppingBag, color: "cyan" },
    { label: "Masa Pejabat", value: mp.order_count, icon: IconClock, color: "teal" },
    { label: "Selepas Masa Pejabat", value: smp.order_count, icon: IconClockOff, color: "red" },
    { label: "Wad", value: wadTotalOrders, icon: IconBuildingHospital, color: "blue" },
    { label: "Bukan Wad", value: bukanWadTotalOrders, icon: IconBuildingSkyscraper, color: "gray" },
    { label: "Wad + Masa Pejabat", value: wMp.order_count, icon: IconBuildingHospital, color: "teal" },
    { label: "Wad + Selepas MP", value: wSmp.order_count, icon: IconBuildingHospital, color: "yellow" },
    { label: "Bukan Wad + MP", value: nwMp.order_count, icon: IconBuildingSkyscraper, color: "orange" },
    { label: "Bukan Wad + Selepas MP", value: nwSmp.order_count, icon: IconBuildingSkyscraper, color: "pink" },
  ], [report, mp, smp, wadTotalOrders, bukanWadTotalOrders, wMp, wSmp, nwMp, nwSmp]);

  const itemCards = useMemo(() => [
    { label: "Jumlah Item", value: report?.totals.jumlah_item || 0, icon: IconPackage, color: "green" },
    { label: "Masa Pejabat", value: mp.jumlah_item, icon: IconClock, color: "teal" },
    { label: "Selepas Masa Pejabat", value: smp.jumlah_item, icon: IconClockOff, color: "red" },
    { label: "Wad", value: wadTotalItems, icon: IconBuildingHospital, color: "blue" },
    { label: "Bukan Wad", value: bukanWadTotalItems, icon: IconBuildingSkyscraper, color: "gray" },
    { label: "Wad + Masa Pejabat", value: wMp.jumlah_item, icon: IconBuildingHospital, color: "teal" },
    { label: "Wad + Selepas MP", value: wSmp.jumlah_item, icon: IconBuildingHospital, color: "yellow" },
    { label: "Bukan Wad + MP", value: nwMp.jumlah_item, icon: IconBuildingSkyscraper, color: "orange" },
    { label: "Bukan Wad + Selepas MP", value: nwSmp.jumlah_item, icon: IconBuildingSkyscraper, color: "pink" },
  ], [report, mp, smp, wadTotalItems, bukanWadTotalItems, wMp, wSmp, nwMp, nwSmp]);

  const bilItemCards = useMemo(() => [
    { label: "Jumlah Bilangan Item", value: report?.totals.bil_item || 0, icon: IconPackage, color: "green" },
    { label: "Masa Pejabat", value: mp.bil_item, icon: IconClock, color: "teal" },
    { label: "Selepas Masa Pejabat", value: smp.bil_item, icon: IconClockOff, color: "red" },
    { label: "Wad", value: wMp.bil_item + wSmp.bil_item, icon: IconBuildingHospital, color: "blue" },
    { label: "Bukan Wad", value: nwMp.bil_item + nwSmp.bil_item, icon: IconBuildingSkyscraper, color: "gray" },
    { label: "Wad + Masa Pejabat", value: wMp.bil_item, icon: IconBuildingHospital, color: "teal" },
    { label: "Wad + Selepas MP", value: wSmp.bil_item, icon: IconBuildingHospital, color: "yellow" },
    { label: "Bukan Wad + MP", value: nwMp.bil_item, icon: IconBuildingSkyscraper, color: "orange" },
    { label: "Bukan Wad + Selepas MP", value: nwSmp.bil_item, icon: IconBuildingSkyscraper, color: "pink" },
  ], [report, mp, smp, wMp, wSmp, nwMp, nwSmp]);

  const kategoriInden = (report?.summary || []).reduce((acc, s) => {
    const existing = acc.find((a) => a.order_type === s.order_type);
    if (existing) {
      existing.order_count += s.order_count;
      existing.bil_item += s.bil_item;
      existing.jumlah_item += s.jumlah_item;
    } else {
      acc.push({ order_type: s.order_type, order_count: s.order_count, bil_item: s.bil_item, jumlah_item: s.jumlah_item });
    }
    return acc;
  }, [] as { order_type: string; order_count: number; bil_item: number; jumlah_item: number }[]);

  return (
    <AppShell>
      <Stack gap="lg">
        <Paper shadow="sm" p="sm" radius="md" withBorder>
          <Group gap="xs">
            <IconChartBar size={18} color="var(--mantine-color-gray-5)" />
            <Title order={2} fw={700}>Laporan</Title>
          </Group>
        </Paper>

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
                <MonthPickerInput
                  label="Bulan"
                  value={monthDate}
                  onChange={(val) => {
                    if (val) setMonthDate(typeof val === "object" ? val : new Date(val));
                  }}
                  size="sm"
                  style={{ minWidth: 160, flex: 1 }}
                  valueFormat="MMMM YYYY"
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
                <Badge color="cyan" variant="light">
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
              <Loader size="lg" color="cyan" />
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
            <Paper shadow="sm" p="md" radius="md">
              <Group gap="sm" style={{ marginBottom: "var(--mantine-spacing-md)" }}>
                <IconClockCheck size={18} color="cyan.6" />
                <Title order={4} fw={700}>
                  Prestasi Masa Inden
                </Title>
              </Group>
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                <Paper shadow="sm" p="md" radius="md" withBorder>
                  <Group gap="sm" align="center">
                    <ThemeIcon size="lg" radius="md" variant="light" color="green">
                      <IconTrendingUp size={22} />
                    </ThemeIcon>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">Inden Dibekal &le; 120 Minit</Text>
                      <Text size="xl" fw={700}>{formatNumber(report.timing.completed_within_120)}</Text>
                    </Stack>
                  </Group>
                </Paper>
                <Paper shadow="sm" p="md" radius="md" withBorder>
                  <Group gap="sm" align="center">
                    <ThemeIcon size="lg" radius="md" variant="light" color="red">
                      <IconTrendingDown size={22} />
                    </ThemeIcon>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">Inden Dibekal &gt; 120 Minit</Text>
                      <Text size="xl" fw={700}>{formatNumber(report.timing.completed_over_120)}</Text>
                    </Stack>
                  </Group>
                </Paper>
                <Paper shadow="sm" p="md" radius="md" withBorder>
                  <Group gap="sm" align="center">
                    <ThemeIcon size="lg" radius="md" variant="light" color="teal">
                      <IconClockCheck size={22} />
                    </ThemeIcon>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">Peratus &le; 120 Minit</Text>
                      <Text size="xl" fw={700}>{report.timing.percentage_within_120}%</Text>
                    </Stack>
                  </Group>
                </Paper>
              </SimpleGrid>
            </Paper>

            <Paper shadow="sm" p="md" radius="md">
              <Group gap="sm" style={{ marginBottom: "var(--mantine-spacing-md)" }}>
                <IconShoppingBag size={18} color="cyan.6" />
                <Title order={4} fw={700}>
                  Jumlah Inden
                </Title>
              </Group>
              <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
                {indenCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <Paper key={card.label} shadow="sm" p="md" radius="md" withBorder>
                      <Group gap="sm" align="center">
                        <ThemeIcon size="lg" radius="md" variant="light" color={card.color}>
                          <Icon size={22} />
                        </ThemeIcon>
                        <Stack gap={0}>
                          <Text size="xs" c="dimmed">{card.label}</Text>
                          <Text size="xl" fw={700}>{formatNumber(card.value)}</Text>
                        </Stack>
                      </Group>
                    </Paper>
                  );
                })}
              </SimpleGrid>
            </Paper>

            <Paper shadow="sm" p="md" radius="md">
              <Group gap="sm" style={{ marginBottom: "var(--mantine-spacing-md)" }}>
                <IconList size={18} color="blue.6" />
                <Title order={4} fw={700}>
                  Bilangan Item
                </Title>
              </Group>
              <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
                {bilItemCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <Paper key={card.label} shadow="sm" p="md" radius="md" withBorder>
                      <Group gap="sm" align="center">
                        <ThemeIcon size="lg" radius="md" variant="light" color={card.color}>
                          <Icon size={22} />
                        </ThemeIcon>
                        <Stack gap={0}>
                          <Text size="xs" c="dimmed">{card.label}</Text>
                          <Text size="xl" fw={700}>{formatNumber(card.value)}</Text>
                        </Stack>
                      </Group>
                    </Paper>
                  );
                })}
              </SimpleGrid>
            </Paper>

            <Paper shadow="sm" p="md" radius="md">
              <Group gap="sm" style={{ marginBottom: "var(--mantine-spacing-md)" }}>
                <IconPackage size={18} color="green.6" />
                <Title order={4} fw={700}>
                  Jumlah Item
                </Title>
              </Group>
              <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
                {itemCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <Paper key={card.label} shadow="sm" p="md" radius="md" withBorder>
                      <Group gap="sm" align="center">
                        <ThemeIcon size="lg" radius="md" variant="light" color={card.color}>
                          <Icon size={22} />
                        </ThemeIcon>
                        <Stack gap={0}>
                          <Text size="xs" c="dimmed">{card.label}</Text>
                          <Text size="xl" fw={700}>{formatNumber(card.value)}</Text>
                        </Stack>
                      </Group>
                    </Paper>
                  );
                })}
              </SimpleGrid>
            </Paper>

            <Paper shadow="sm" p="md" radius="md">
              <Group gap="sm" style={{ marginBottom: "var(--mantine-spacing-md)" }}>
                <IconFileText size={18} color="cyan.6" />
                <Title order={4} fw={700}>
                  Mengikut Kategori Inden
                </Title>
              </Group>
              <Table.ScrollContainer minWidth={400}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Jenis Inden</Table.Th>
                      <Table.Th ta="right">Bilangan Inden</Table.Th>
                      <Table.Th ta="right">Bilangan Item</Table.Th>
                      <Table.Th ta="right">Jumlah Item</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {kategoriInden.map((row) => (
                      <Table.Tr key={row.order_type}>
                        <Table.Td fw={500}>{row.order_type}</Table.Td>
                        <Table.Td ta="right">{formatNumber(row.order_count)}</Table.Td>
                        <Table.Td ta="right">{formatNumber(row.bil_item)}</Table.Td>
                        <Table.Td ta="right" fw={600}>{formatNumber(row.jumlah_item)}</Table.Td>
                      </Table.Tr>
                    ))}
                    <Table.Tr fw={700}>
                      <Table.Td>JUMLAH</Table.Td>
                      <Table.Td ta="right">{formatNumber(report.totals.order_count)}</Table.Td>
                      <Table.Td ta="right">{formatNumber(report.totals.bil_item)}</Table.Td>
                      <Table.Td ta="right">{formatNumber(report.totals.jumlah_item)}</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>

            <Paper shadow="sm" p="md" radius="md">
              <Group gap="sm" style={{ marginBottom: "var(--mantine-spacing-md)" }}>
                <IconFileText size={18} color="cyan.6" />
                <Title order={4} fw={700}>
                  Ringkasan Mengikut Wad
                </Title>
              </Group>
              <Table.ScrollContainer minWidth={400}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Wad</Table.Th>
                      <Table.Th ta="right">Bil. Inden</Table.Th>
                      <Table.Th ta="right">Bil. Item</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {report.totals_by_ward.map((ws) => (
                      <Table.Tr
                        key={ws.ward_id}
                        style={{ cursor: "pointer" }}
                        onClick={() => fetchWardOrders(ws)}
                      >
                        <Table.Td>{ws.ward_name}</Table.Td>
                        <Table.Td ta="right">{formatNumber(ws.order_count)}</Table.Td>
                        <Table.Td ta="right" fw={600}>{formatNumber(ws.jumlah_item)}</Table.Td>
                      </Table.Tr>
                    ))}
                    <Table.Tr fw={700}>
                      <Table.Td>JUMLAH</Table.Td>
                      <Table.Td ta="right">{formatNumber(report.totals.order_count)}</Table.Td>
                      <Table.Td ta="right">{formatNumber(report.totals.jumlah_item)}</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>

            <Paper shadow="sm" p="md" radius="md">
              <Group gap="sm" style={{ marginBottom: "var(--mantine-spacing-md)" }}>
                <IconPill size={18} color="cyan.6" />
                <Title order={4} fw={700}>
                  Butiran Item
                </Title>
              </Group>
              {wardItemsLoading ? (
                <Flex justify="center" py="md">
                  <Loader size="sm" />
                </Flex>
              ) : wardItems.length === 0 ? (
                <Text size="sm" c="dimmed" py="md" ta="center">
                  Tiada item ditemui untuk tempoh ini.
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={400}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Item</Table.Th>
                        <Table.Th ta="right">Bil. Inden</Table.Th>
                        <Table.Th ta="right">Jumlah Kuantiti</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {wardItems.map((wi) => (
                        <Table.Tr
                          key={wi.item_id}
                          style={{ cursor: "pointer" }}
                          onClick={() => fetchItemOrders(wi)}
                        >
                          <Table.Td fw={500}>{wi.item_name}</Table.Td>
                          <Table.Td ta="right">{formatNumber(wi.order_count)}</Table.Td>
                          <Table.Td ta="right" fw={600}>{formatNumber(wi.quantity_sum)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Paper>
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

      <Modal
        opened={itemOrdersModal}
        onClose={() => {
          setItemOrdersModal(false);
          setSelectedItem(null);
          setItemOrders([]);
        }}
        title={`Inden: ${selectedItem?.item_name || ""}`}
        size="lg"
        centered
      >
        {itemOrdersLoading ? (
          <Flex justify="center" py="md">
            <Loader size="sm" />
          </Flex>
        ) : itemOrders.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">
            Tiada inden ditemui untuk item ini.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={300}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>No. Inden</Table.Th>
                  <Table.Th>Tarikh</Table.Th>
                  <Table.Th>Wad</Table.Th>
                  <Table.Th ta="right">Kuantiti</Table.Th>
                  <Table.Th>MP</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {itemOrders.map((o) => (
                  <Table.Tr key={o.order_id}>
                    <Table.Td fw={500}>{o.order_number}</Table.Td>
                    <Table.Td>{o.order_date}</Table.Td>
                    <Table.Td>{o.ward_name}</Table.Td>
                    <Table.Td ta="right" fw={600}>{o.quantity}</Table.Td>
                    <Table.Td>
                      <Badge color={o.masa_pejabat ? "cyan" : "red"} variant="light" size="sm">
                        {o.masa_pejabat ? "Ya" : "Tidak"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={o.sudah_disedia ? "green" : "yellow"} variant="light" size="sm">
                        {o.sudah_disedia ? "Selesai" : "Menunggu"}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Modal>

      <Modal
        opened={wardOrdersModal}
        onClose={() => {
          setWardOrdersModal(false);
          setSelectedWard(null);
          setWardOrders([]);
        }}
        title={`Inden: ${selectedWard?.ward_name || ""}`}
        size="xl"
        centered
      >
        {wardOrdersLoading ? (
          <Flex justify="center" py="md">
            <Loader size="sm" />
          </Flex>
        ) : wardOrders.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">
            Tiada inden ditemui untuk wad ini.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={500}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>No. Inden</Table.Th>
                  <Table.Th>Tarikh</Table.Th>
                  <Table.Th>Jenis</Table.Th>
                  <Table.Th ta="right">Jumlah Kuantiti</Table.Th>
                  <Table.Th>MP</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {wardOrders.map((o) => (
                  <Table.Tr key={o.order_id}>
                    <Table.Td fw={500}>{o.order_number}</Table.Td>
                    <Table.Td>{o.order_date}</Table.Td>
                    <Table.Td>
                      <Badge color="blue" variant="light" size="sm">{o.order_type}</Badge>
                    </Table.Td>
                    <Table.Td ta="right" fw={600}>{o.quantity}</Table.Td>
                    <Table.Td>
                      <Badge color={o.masa_pejabat ? "cyan" : "red"} variant="light" size="sm">
                        {o.masa_pejabat ? "Ya" : "Tidak"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={o.sudah_disedia ? "green" : "yellow"} variant="light" size="sm">
                        {o.sudah_disedia ? "Selesai" : "Menunggu"}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Modal>
    </AppShell>
  );
}
