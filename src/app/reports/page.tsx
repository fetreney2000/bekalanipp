"use client";

import { useState, useCallback } from "react";
import {
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Text,
  Badge,
  Heading,
  Flex,
  SimpleGrid,
  CloseButton,
  Spinner,
} from "@chakra-ui/react";
import {
  BarChart3,
  Calendar,
  Download,
  Filter,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import AppShell from "@/components/AppShell";

type ReportType = "daily" | "weekly" | "monthly" | "yearly";

interface SummaryItem {
  item_id: string;
  item_name: string;
  quantity: number;
}

interface WardSummary {
  ward_id: string;
  ward_name: string;
  quantity: number;
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
  totals: { orders: number; quantity: number };
  totals_by_masa: MasaSummary[];
  totals_by_masa_by_cat: MasaCatSummary[];
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

function formatNumber(n: number): string {
  return n.toLocaleString("ms-MY");
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

const inputStyle = {
  bg: "var(--control)",
  border: "1px solid var(--control-border)",
  borderRadius: "10px",
  color: "var(--text)",
  padding: "10px 10px",
  fontSize: "14px",
  outline: "none",
  width: "100%",
  transition: "box-shadow 0.12s ease, border-color 0.12s ease",
};

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
    report?.totals_by_masa.find((m) => m.masa_pejabat)?.quantity || 0;
  const selepasMasaPejabatQty =
    report?.totals_by_masa.find((m) => !m.masa_pejabat)?.quantity || 0;
  const totalQty = report?.totals.quantity || 0;

  const wardMpQty =
    report?.totals_by_masa_by_cat
      .filter((c) => c.ward_category === "Wad" && c.masa_pejabat)
      .reduce((s, c) => s + c.quantity, 0) || 0;
  const wardSmpQty =
    report?.totals_by_masa_by_cat
      .filter((c) => c.ward_category === "Wad" && !c.masa_pejabat)
      .reduce((s, c) => s + c.quantity, 0) || 0;
  const bukanWardMpQty =
    report?.totals_by_masa_by_cat
      .filter((c) => c.ward_category !== "Wad" && c.masa_pejabat)
      .reduce((s, c) => s + c.quantity, 0) || 0;
  const bukanWardSmpQty =
    report?.totals_by_masa_by_cat
      .filter((c) => c.ward_category !== "Wad" && !c.masa_pejabat)
      .reduce((s, c) => s + c.quantity, 0) || 0;

  const statCards = [
    {
      label: "Jumlah Pesanan",
      value: formatNumber(report?.totals.orders || 0),
      icon: FileText,
      color: "#4f87ff",
    },
    {
      label: "Jumlah Item",
      value: formatNumber(report?.totals.quantity || 0),
      icon: BarChart3,
      color: "#4caf50",
    },
    {
      label: "Masa Pejabat",
      value: formatNumber(masaPejabatQty),
      icon: TrendingUp,
      color: "#f0ad4e",
    },
    {
      label: "Selepas Masa Pejabat",
      value: formatNumber(selepasMasaPejabatQty),
      icon: TrendingDown,
      color: "#ef5350",
    },
    {
      label: "Wad + MP",
      value: formatNumber(wardMpQty),
      icon: Minus,
      color: "#4f87ff",
    },
    {
      label: "Bukan Wad + SMP",
      value: formatNumber(bukanWardSmpQty),
      icon: Minus,
      color: "#a3aab3",
    },
  ];

  return (
    <AppShell>
      <VStack align="stretch" gap={6}>
        <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
          <HStack gap={3}>
            <Box color="#4f87ff">
              <BarChart3 size={28} />
            </Box>
            <Heading size="lg" fontWeight={700}>
              Laporan
            </Heading>
          </HStack>
        </HStack>

        <Box
          bg="var(--card)"
          border="1px solid var(--line)"
          borderRadius="14px"
          p={5}
        >
          <VStack align="stretch" gap={4}>
            <HStack gap={3} flexWrap="wrap" align="flex-end">
              <VStack align="stretch" gap={1} minW="160px" flex={1}>
                <Text fontSize="13px" color="var(--muted)">
                  Jenis Laporan
                </Text>
                <select
                  value={reportType}
                  onChange={(e) =>
                    setReportType(e.target.value as ReportType)
                  }
                  style={inputStyle}
                >
                  <option value="daily">Harian</option>
                  <option value="weekly">Mingguan</option>
                  <option value="monthly">Bulanan</option>
                  <option value="yearly">Tahunan</option>
                </select>
              </VStack>

              {reportType === "daily" && (
                <VStack align="stretch" gap={1} minW="160px" flex={1}>
                  <Text fontSize="13px" color="var(--muted)">
                    Tarikh
                  </Text>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={inputStyle}
                  />
                </VStack>
              )}

              {reportType === "weekly" && (
                <VStack align="stretch" gap={1} minW="160px" flex={1}>
                  <Text fontSize="13px" color="var(--muted)">
                    Minggu
                  </Text>
                  <input
                    type="week"
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                    style={inputStyle}
                  />
                </VStack>
              )}

              {reportType === "monthly" && (
                <VStack align="stretch" gap={1} minW="160px" flex={1}>
                  <Text fontSize="13px" color="var(--muted)">
                    Bulan
                  </Text>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    style={inputStyle}
                  />
                </VStack>
              )}

              {reportType === "yearly" && (
                <VStack align="stretch" gap={1} minW="120px" flex={1}>
                  <Text fontSize="13px" color="var(--muted)">
                    Tahun
                  </Text>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    min={2000}
                    max={2100}
                    style={inputStyle}
                  />
                </VStack>
              )}

              <Button
                onClick={fetchReport}
                loading={loading}
                loadingText="Memuatkan..."
                bg="#4f87ff"
                color="white"
                _hover={{ bg: "#3a6fe0" }}
                size="sm"
                minH="38px"
                px={5}
                fontWeight={600}
              >
                <Filter size={15} />
                Jana Laporan
              </Button>
            </HStack>

            {report && (
              <HStack gap={2} flexWrap="wrap">
                <Badge
                  bg="rgba(79,135,255,0.15)"
                  color="#4f87ff"
                  px={2.5}
                  py={1}
                  borderRadius="8px"
                  fontSize="12px"
                  fontWeight={600}
                >
                  {REPORT_TYPE_LABELS[report.type as ReportType]}
                </Badge>
                <Badge
                  bg="rgba(76,175,80,0.15)"
                  color="#4caf50"
                  px={2.5}
                  py={1}
                  borderRadius="8px"
                  fontSize="12px"
                  fontWeight={600}
                >
                  {report.start} hingga {report.end}
                </Badge>
              </HStack>
            )}
          </VStack>
        </Box>

        {loading && (
          <Flex justify="center" py={10}>
            <VStack gap={3}>
              <Spinner color="#4f87ff" size="lg" />
              <Text color="var(--muted)" fontSize="14px">
                Memuatkan laporan...
              </Text>
            </VStack>
          </Flex>
        )}

        {error && (
          <Box
            bg="rgba(239,83,80,0.12)"
            border="1px solid rgba(239,83,80,0.3)"
            borderRadius="10px"
            p={4}
          >
            <Text color="#ef5350" fontSize="14px">
              {error}
            </Text>
          </Box>
        )}

        {report && !loading && (
          <>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
              {statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Box
                    key={card.label}
                    bg="var(--card)"
                    border="1px solid var(--line)"
                    borderRadius="14px"
                    p={4}
                  >
                    <HStack justify="space-between" align="flex-start">
                      <VStack align="stretch" gap={1}>
                        <Text fontSize="13px" color="var(--muted)">
                          {card.label}
                        </Text>
                        <Text
                          fontSize="24px"
                          fontWeight={700}
                          color="var(--text)"
                        >
                          {card.value}
                        </Text>
                      </VStack>
                      <Box
                        bg={`${card.color}22`}
                        color={card.color}
                        p={2.5}
                        borderRadius="10px"
                      >
                        <Icon size={20} />
                      </Box>
                    </HStack>
                  </Box>
                );
              })}
            </SimpleGrid>

            <Box
              bg="var(--card)"
              border="1px solid var(--line)"
              borderRadius="14px"
              p={5}
            >
              <HStack gap={2} mb={4}>
                <FileText size={18} color="#4f87ff" />
                <Heading size="md" fontWeight={700}>
                  Ringkasan Mengikut Wad
                </Heading>
              </HStack>
              <Box overflowX="auto">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th>Wad</th>
                      <th style={{ textAlign: "right" }}>Jumlah Item</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.totals_by_ward.map((ws) => (
                      <tr key={ws.ward_id}>
                        <td>{ws.ward_name}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>
                          {formatNumber(ws.quantity)}
                        </td>
                      </tr>
                    ))}
                    <tr
                      style={{
                        fontWeight: 700,
                        borderTop: "2px solid var(--line)",
                      }}
                    >
                      <td>JUMLAH</td>
                      <td style={{ textAlign: "right" }}>
                        {formatNumber(report.totals.quantity)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Box>
            </Box>

            <Box
              bg="var(--card)"
              border="1px solid var(--line)"
              borderRadius="14px"
              p={5}
            >
              <HStack gap={2} mb={4}>
                <Calendar size={18} color="#f0ad4e" />
                <Heading size="md" fontWeight={700}>
                  Masa Pejabat
                </Heading>
              </HStack>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                <Box
                  bg="rgba(79,135,255,0.06)"
                  border="1px solid rgba(79,135,255,0.15)"
                  borderRadius="10px"
                  p={4}
                >
                  <Text
                    fontSize="14px"
                    fontWeight={600}
                    mb={3}
                    color="#4f87ff"
                  >
                    Masa Pejabat
                  </Text>
                  <VStack align="stretch" gap={2}>
                    <HStack justify="space-between">
                      <Text fontSize="13px" color="var(--muted)">
                        Bil. Pesanan
                      </Text>
                      <Text fontSize="15px" fontWeight={600}>
                        {formatNumber(masaPejabatQty)}
                      </Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="13px" color="var(--muted)">
                        Peratusan
                      </Text>
                      <Text fontSize="15px" fontWeight={600}>
                        {totalQty > 0
                          ? ((masaPejabatQty / totalQty) * 100).toFixed(1)
                          : "0.0"}
                        %
                      </Text>
                    </HStack>
                  </VStack>
                </Box>
                <Box
                  bg="rgba(239,83,80,0.06)"
                  border="1px solid rgba(239,83,80,0.15)"
                  borderRadius="10px"
                  p={4}
                >
                  <Text
                    fontSize="14px"
                    fontWeight={600}
                    mb={3}
                    color="#ef5350"
                  >
                    Selepas Masa Pejabat
                  </Text>
                  <VStack align="stretch" gap={2}>
                    <HStack justify="space-between">
                      <Text fontSize="13px" color="var(--muted)">
                        Bil. Pesanan
                      </Text>
                      <Text fontSize="15px" fontWeight={600}>
                        {formatNumber(selepasMasaPejabatQty)}
                      </Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="13px" color="var(--muted)">
                        Peratusan
                      </Text>
                      <Text fontSize="15px" fontWeight={600}>
                        {totalQty > 0
                          ? (
                              (selepasMasaPejabatQty / totalQty) *
                              100
                            ).toFixed(1)
                          : "0.0"}
                        %
                      </Text>
                    </HStack>
                  </VStack>
                </Box>
              </SimpleGrid>
            </Box>

            <Box
              bg="var(--card)"
              border="1px solid var(--line)"
              borderRadius="14px"
              p={5}
            >
              <HStack gap={2} mb={4}>
                <BarChart3 size={18} color="#4caf50" />
                <Heading size="md" fontWeight={700}>
                  Pecahan Mengikut Kategori
                </Heading>
              </HStack>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                <Box
                  bg="rgba(79,135,255,0.06)"
                  border="1px solid rgba(79,135,255,0.15)"
                  borderRadius="10px"
                  p={4}
                >
                  <Text
                    fontSize="14px"
                    fontWeight={600}
                    mb={3}
                    color="#4f87ff"
                  >
                    Wad + Masa Pejabat
                  </Text>
                  <Text fontSize="24px" fontWeight={700}>
                    {formatNumber(wardMpQty)}
                  </Text>
                  <Text fontSize="12px" color="var(--muted)" mt={1}>
                    {totalQty > 0
                      ? ((wardMpQty / totalQty) * 100).toFixed(1)
                      : "0.0"}{" "}
                    % daripada jumlah
                  </Text>
                </Box>
                <Box
                  bg="rgba(240,173,78,0.06)"
                  border="1px solid rgba(240,173,78,0.15)"
                  borderRadius="10px"
                  p={4}
                >
                  <Text
                    fontSize="14px"
                    fontWeight={600}
                    mb={3}
                    color="#f0ad4e"
                  >
                    Wad + Selepas Masa Pejabat
                  </Text>
                  <Text fontSize="24px" fontWeight={700}>
                    {formatNumber(wardSmpQty)}
                  </Text>
                  <Text fontSize="12px" color="var(--muted)" mt={1}>
                    {totalQty > 0
                      ? ((wardSmpQty / totalQty) * 100).toFixed(1)
                      : "0.0"}{" "}
                    % daripada jumlah
                  </Text>
                </Box>
                <Box
                  bg="rgba(76,175,80,0.06)"
                  border="1px solid rgba(76,175,80,0.15)"
                  borderRadius="10px"
                  p={4}
                >
                  <Text
                    fontSize="14px"
                    fontWeight={600}
                    mb={3}
                    color="#4caf50"
                  >
                    Bukan Wad + Masa Pejabat
                  </Text>
                  <Text fontSize="24px" fontWeight={700}>
                    {formatNumber(bukanWardMpQty)}
                  </Text>
                  <Text fontSize="12px" color="var(--muted)" mt={1}>
                    {totalQty > 0
                      ? ((bukanWardMpQty / totalQty) * 100).toFixed(1)
                      : "0.0"}{" "}
                    % daripada jumlah
                  </Text>
                </Box>
                <Box
                  bg="rgba(163,170,179,0.06)"
                  border="1px solid rgba(163,170,179,0.15)"
                  borderRadius="10px"
                  p={4}
                >
                  <Text
                    fontSize="14px"
                    fontWeight={600}
                    mb={3}
                    color="var(--muted)"
                  >
                    Bukan Wad + Selepas Masa Pejabat
                  </Text>
                  <Text fontSize="24px" fontWeight={700}>
                    {formatNumber(bukanWardSmpQty)}
                  </Text>
                  <Text fontSize="12px" color="var(--muted)" mt={1}>
                    {totalQty > 0
                      ? ((bukanWardSmpQty / totalQty) * 100).toFixed(1)
                      : "0.0"}{" "}
                    % daripada jumlah
                  </Text>
                </Box>
              </SimpleGrid>
            </Box>

            {report.recommendations.length > 0 && (
              <Box
                bg="var(--card)"
                border="1px solid var(--line)"
                borderRadius="14px"
                p={5}
              >
                <HStack gap={2} mb={4}>
                  <TrendingUp size={18} color="#4caf50" />
                  <Heading size="md" fontWeight={700}>
                    Cadangan Kuota
                  </Heading>
                </HStack>
                <Box overflowX="auto">
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th style={{ textAlign: "right" }}>Purata/Hari</th>
                        <th style={{ textAlign: "right" }}>
                          Kuota Semasa (30 hari)
                        </th>
                        <th style={{ textAlign: "right" }}>
                          Cadangan (×1.25)
                        </th>
                        <th style={{ textAlign: "right" }}>Delta</th>
                      </tr>
                    </thead>
                    <tbody>
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
                            ? "#4caf50"
                            : delta < 0
                              ? "#ef5350"
                              : "var(--muted)";
                        const DeltaIcon =
                          delta > 0
                            ? TrendingUp
                            : delta < 0
                              ? TrendingDown
                              : Minus;
                        return (
                          <tr key={rec.item_id}>
                            <td>{rec.item_name}</td>
                            <td style={{ textAlign: "right" }}>
                              {rec.avg_per_day}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              {formatNumber(Math.round(current))}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontWeight: 600,
                                color: deltaColor,
                              }}
                            >
                              {formatNumber(suggested)}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <Flex
                                gap={1}
                                justify="flex-end"
                                align="center"
                              >
                                <DeltaIcon size={14} color={deltaColor} />
                                <Text
                                  fontSize="13px"
                                  fontWeight={600}
                                  color={deltaColor}
                                >
                                  {delta > 0 ? "+" : ""}
                                  {formatNumber(delta)} ({deltaPercent}%)
                                </Text>
                              </Flex>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Box>
                {report.recommendations.length > 50 && (
                  <Text
                    fontSize="12px"
                    color="var(--muted)"
                    mt={3}
                    textAlign="center"
                  >
                    Menunjukkan 50 item teratas daripada{" "}
                    {report.recommendations.length} item
                  </Text>
                )}
              </Box>
            )}

            <Box>
              <Button
                onClick={fetchWardItems}
                loading={wardItemsLoading}
                loadingText="Memuatkan item..."
                bg="var(--control)"
                border="1px solid var(--control-border)"
                color="var(--text)"
                _hover={{ bg: "var(--control-hover)" }}
                size="sm"
                fontWeight={600}
              >
                <FileText size={15} />
                Butiran Item
              </Button>
            </Box>

            {wardItemsError && (
              <Box
                bg="rgba(239,83,80,0.12)"
                border="1px solid rgba(239,83,80,0.3)"
                borderRadius="10px"
                p={4}
              >
                <Text color="#ef5350" fontSize="14px">
                  {wardItemsError}
                </Text>
              </Box>
            )}

            {showWardItems && wardItems && (
              <Box
                bg="var(--card)"
                border="1px solid var(--line)"
                borderRadius="14px"
                p={5}
              >
                <HStack
                  justify="space-between"
                  mb={4}
                  flexWrap="wrap"
                  gap={2}
                >
                  <HStack gap={2}>
                    <Download size={18} color="#4f87ff" />
                    <Heading size="md" fontWeight={700}>
                      Butiran Item
                    </Heading>
                  </HStack>
                  <CloseButton
                    size="sm"
                    onClick={() => setShowWardItems(false)}
                    color="var(--muted)"
                    _hover={{ color: "var(--text)" }}
                  />
                </HStack>
                {wardItems.length === 0 ? (
                  <Text
                    color="var(--muted)"
                    fontSize="14px"
                    py={4}
                    textAlign="center"
                  >
                    Tiada item ditemui untuk tempoh ini.
                  </Text>
                ) : (
                  <Box overflowX="auto">
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th style={{ textAlign: "right" }}>Bil. Pesanan</th>
                          <th style={{ textAlign: "right" }}>
                            Jumlah Kuantiti
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {wardItems.map((wi) => (
                          <tr key={wi.item_id}>
                            <td>{wi.item_name}</td>
                            <td style={{ textAlign: "right" }}>
                              {formatNumber(wi.order_count)}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontWeight: 600,
                              }}
                            >
                              {formatNumber(wi.quantity_sum)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Box>
                )}
              </Box>
            )}
          </>
        )}

        {!report && !loading && !error && (
          <Flex justify="center" alignItems="center" py={16} opacity={0.5}>
            <VStack gap={3}>
              <BarChart3 size={48} />
              <Text fontSize="16px" color="var(--muted)">
                Pilih parameter dan tekan &quot;Jana Laporan&quot; untuk melihat
                laporan
              </Text>
            </VStack>
          </Flex>
        )}
      </VStack>
    </AppShell>
  );
}
