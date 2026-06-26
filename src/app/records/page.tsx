"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Text,
  Badge,
  Flex,
  Heading,
  Switch,
} from "@chakra-ui/react";
import {
  RefreshCw,
  ArrowUpDown,
  Clock,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import AppShell from "@/components/AppShell";

type OrderItem = {
  item_id: string;
  item_name: string;
  quantity: number;
};

type Order = {
  id: string;
  ward_id: string;
  ward_name: string;
  order_date: string;
  order_number: string;
  order_type: string;
  masa_pejabat: boolean;
  masa_diterima: boolean;
  sudah_disedia: boolean;
  completion_minutes: number | null;
  masa_selesai: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
};

type SortKey =
  | "order_date"
  | "order_number"
  | "ward_name"
  | "order_type"
  | "items"
  | "sudah_disedia"
  | "masa_pejabat";

const ORDER_TYPE_MAP: Record<string, string> = {
  FS: "Floor Stock",
  EMT: "Emergency Trolley",
  AOH: "Selepas Waktu Pejabat",
};

function getMonthRange(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return {
    from: firstDay.toISOString().slice(0, 10),
    to: lastDay.toISOString().slice(0, 10),
  };
}

function SortHeader({
  label,
  sortFor,
  sortKey,
  sortAsc,
  onToggle,
  align = "left",
}: {
  label: string;
  sortFor: SortKey;
  sortKey: SortKey;
  sortAsc: boolean;
  onToggle: (key: SortKey) => void;
  align?: "left" | "center";
}) {
  return (
    <th
      onClick={() => onToggle(sortFor)}
      style={{
        padding: "10px",
        borderBottom: "1px solid rgba(231,234,238,0.10)",
        color: "var(--muted)",
        fontWeight: 600,
        fontSize: "13px",
        textAlign: align,
        cursor: "pointer",
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {label}
        <ArrowUpDown
          size={14}
          style={{
            opacity: sortKey === sortFor ? 1 : 0.4,
            transform:
              sortKey === sortFor && !sortAsc ? "scaleY(-1)" : undefined,
          }}
        />
      </span>
    </th>
  );
}

function getElapsedMinutes(order: Order): number {
  if (order.sudah_disedia && order.completion_minutes != null) {
    return order.completion_minutes;
  }
  if (order.sudah_disedia && order.masa_selesai) {
    const created = new Date(order.created_at).getTime();
    const finished = new Date(order.masa_selesai).getTime();
    return Math.round((finished - created) / 60000);
  }
  return Math.round(
    (Date.now() - new Date(order.created_at).getTime()) / 60000
  );
}

function getElapsedGradient(mins: number): string {
  if (mins <= 0) return "green";
  if (mins <= 60) return "green";
  if (mins <= 120) return "yellow";
  return "red";
}

function formatElapsed(mins: number): string {
  return `${mins} min`;
}

function monthLabel(year: number, month: number): string {
  const names = [
    "Januari",
    "Februari",
    "Mac",
    "April",
    "Mei",
    "Jun",
    "Julai",
    "Ogos",
    "September",
    "Oktober",
    "November",
    "Disember",
  ];
  return `${names[month]} ${year}`;
}

export default function RecordsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [searchText, setSearchText] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("order_date");
  const [sortAsc, setSortAsc] = useState(false);
  const [togglingReady, setTogglingReady] = useState<string | null>(null);
  const [togglingPejabat, setTogglingPejabat] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    orderId: string;
    value: boolean;
  } | null>(null);
  const [, setTick] = useState(0);

  const range = useMemo(() => getMonthRange(year, month), [year, month]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/orders?from=${range.from}&to=${range.to}`
      );
      if (!res.ok) throw new Error("Gagal memuatkan data");
      const data = await res.json();
      setOrders(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ralat tidak diketahui");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const handler = () => fetchOrders();
    window.addEventListener("idle:refresh-records", handler);
    return () => window.removeEventListener("idle:refresh-records", handler);
  }, [fetchOrders]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const handleToggleReady = async (orderId: string, value: boolean) => {
    if (!value) {
      setConfirmDialog({ orderId, value });
      return;
    }
    setTogglingReady(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/ready`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sudah_disedia: value }),
      });
      if (!res.ok) throw new Error("Gagal mengemaskini");
      const data = await res.json();
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                sudah_disedia: data.sudah_disedia,
                completion_minutes: data.completion_minutes,
                masa_selesai: data.masa_selesai,
              }
            : o
        )
      );
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setTogglingReady(null);
    }
  };

  const handleConfirmReady = async () => {
    if (!confirmDialog) return;
    await handleToggleReady(confirmDialog.orderId, confirmDialog.value);
    setConfirmDialog(null);
  };

  const handleTogglePejabat = async (orderId: string, value: boolean) => {
    setTogglingPejabat(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/masa-pejabat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masa_pejabat: value }),
      });
      if (!res.ok) throw new Error("Gagal mengemaskini");
      const data = await res.json();
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, masa_pejabat: data.masa_pejabat } : o
        )
      );
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setTogglingPejabat(null);
    }
  };

  const filtered = useMemo(() => {
    let list = [...orders];
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.ward_name.toLowerCase().includes(q) ||
          o.items.some((i) => i.item_name.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => {
      let va: string | boolean | number = "";
      let vb: string | boolean | number = "";
      if (sortKey === "ward_name") {
        va = a.ward_name;
        vb = b.ward_name;
      } else if (sortKey === "items") {
        va = a.items.map((i) => i.item_name).join(", ");
        vb = b.items.map((i) => i.item_name).join(", ");
      } else {
        va = (a as Record<string, unknown>)[sortKey] as string | boolean;
        vb = (b as Record<string, unknown>)[sortKey] as string | boolean;
      }
      if (typeof va === "boolean") {
        va = va ? "1" : "0";
        vb = (vb as boolean) ? "1" : "0";
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [orders, searchText, sortKey, sortAsc]);

  return (
    <AppShell>
      <VStack gap={4} align="stretch">
        <Flex justify="space-between" align="center" flexWrap="wrap" gap={3}>
          <HStack gap={2}>
            <Clock size={22} color="#4f87ff" />
            <Heading size="lg">Senarai Inden</Heading>
          </HStack>
        </Flex>

        <Flex gap={3} flexWrap="wrap" align="center">
          <HStack gap={2}>
            <Button size="sm" onClick={prevMonth} variant="ghost">
              ←
            </Button>
            <Text fontWeight={600} whiteSpace="nowrap" fontSize="14px">
              {monthLabel(year, month)}
            </Text>
            <Button size="sm" onClick={nextMonth} variant="ghost">
              →
            </Button>
          </HStack>
          <Button
            size="sm"
            onClick={fetchOrders}
            display="inline-flex"
            gap={2}
            variant="ghost"
          >
            <RefreshCw size={14} /> Muat Semula
          </Button>
          <Box flex={1} minW="200px" maxW="320px">
            <Input
              placeholder="Cari No. Inden, Wad, atau Item..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              size="sm"
            />
          </Box>
        </Flex>

        {loading && (
          <Box py={8} textAlign="center" color="muted">
            Memuatkan data...
          </Box>
        )}

        {error && (
          <Box
            py={4}
            px={4}
            bg="rgba(239,83,80,0.1)"
            border="1px solid rgba(239,83,80,0.3)"
            borderRadius="10px"
            color="red.300"
          >
            {error}
          </Box>
        )}

        {!loading && !error && (
          <Box overflowX="auto">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th
                    style={{
                      padding: "10px",
                      borderBottom: "1px solid rgba(231,234,238,0.10)",
                      color: "var(--muted)",
                      fontWeight: 600,
                      fontSize: "13px",
                      textAlign: "left",
                    }}
                  >
                    No
                  </th>
                  <SortHeader label="Tarikh" sortFor="order_date" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                  <SortHeader label="No. Inden" sortFor="order_number" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                  <SortHeader label="Wad" sortFor="ward_name" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                  <SortHeader label="Jenis" sortFor="order_type" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                  <SortHeader label="Item" sortFor="items" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                  <th
                    style={{
                      padding: "10px",
                      borderBottom: "1px solid rgba(231,234,238,0.10)",
                      color: "var(--muted)",
                      fontWeight: 600,
                      fontSize: "13px",
                      textAlign: "center",
                    }}
                  >
                    Disediakan
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      borderBottom: "1px solid rgba(231,234,238,0.10)",
                      color: "var(--muted)",
                      fontWeight: 600,
                      fontSize: "13px",
                      textAlign: "center",
                    }}
                  >
                    Masa Pejabat
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      borderBottom: "1px solid rgba(231,234,238,0.10)",
                      color: "var(--muted)",
                      fontWeight: 600,
                      fontSize: "13px",
                      textAlign: "center",
                    }}
                  >
                    Masa
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        padding: "24px",
                        textAlign: "center",
                        color: "var(--muted)",
                      }}
                    >
                      Tiada data ditemui
                    </td>
                  </tr>
                )}
                {filtered.map((order, idx) => {
                  const elapsed = getElapsedMinutes(order);
                  const elapsedGrad = getElapsedGradient(elapsed);
                  return (
                    <tr
                      key={order.id}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(79,135,255,0.06)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid rgba(231,234,238,0.10)",
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid rgba(231,234,238,0.10)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {order.order_date}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid rgba(231,234,238,0.10)",
                          fontWeight: 600,
                        }}
                      >
                        {order.order_number}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid rgba(231,234,238,0.10)",
                        }}
                      >
                        {order.ward_name}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid rgba(231,234,238,0.10)",
                        }}
                      >
                        <Badge
                          size="sm"
                          colorPalette={
                            order.order_type === "FS"
                              ? "blue"
                              : order.order_type === "EMT"
                                ? "red"
                                : "orange"
                          }
                          variant="solid"
                          borderRadius="full"
                        >
                          {ORDER_TYPE_MAP[order.order_type] || order.order_type}
                        </Badge>
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid rgba(231,234,238,0.10)",
                          maxWidth: "200px",
                        }}
                      >
                        <VStack align="start" gap={0}>
                          {order.items.map((item) => (
                            <Text key={item.item_id} fontSize="12px" lineHeight="1.4">
                              {item.item_name} ({item.quantity})
                            </Text>
                          ))}
                        </VStack>
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid rgba(231,234,238,0.10)",
                          textAlign: "center",
                        }}
                      >
                        <Switch.Root
                          size="sm"
                          checked={order.sudah_disedia}
                          onCheckedChange={(details) =>
                            handleToggleReady(order.id, details.checked)
                          }
                          disabled={togglingReady === order.id}
                        >
                          <Switch.HiddenInput />
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Root>
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid rgba(231,234,238,0.10)",
                          textAlign: "center",
                        }}
                      >
                        <Switch.Root
                          size="sm"
                          checked={order.masa_pejabat}
                          onCheckedChange={(details) =>
                            handleTogglePejabat(order.id, details.checked)
                          }
                          disabled={togglingPejabat === order.id}
                        >
                          <Switch.HiddenInput />
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Root>
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid rgba(231,234,238,0.10)",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Badge
                          size="sm"
                          colorPalette={elapsedGrad}
                          variant="subtle"
                          borderRadius="full"
                          display="inline-flex"
                          gap={1}
                          alignItems="center"
                        >
                          {order.sudah_disedia && order.completion_minutes != null ? (
                            <CheckCircle size={12} />
                          ) : (
                            <Clock size={12} />
                          )}
                          {formatElapsed(elapsed)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
        )}

        <Text fontSize="12px" color="muted">
          {filtered.length} pesanan dipaparkan
        </Text>
      </VStack>

      {confirmDialog && (
        <Box
          position="fixed"
          inset={0}
          bg="rgba(0,0,0,0.6)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={9999}
          p={4}
          onClick={() => setConfirmDialog(null)}
        >
          <Box
            bg="var(--card)"
            border="1px solid var(--line)"
            borderRadius="14px"
            w="100%"
            maxW="400px"
            p={5}
            onClick={(e) => e.stopPropagation()}
          >
            <HStack gap={2} mb={3}>
              <AlertTriangle size={20} color="var(--warn)" />
              <Heading size="sm">Sahkan Tindakan</Heading>
            </HStack>
            <Text fontSize="14px" color="muted" mb={4}>
              Adakah anda pasti mahu membatalkan status &quot;Sudah
              Disediakan&quot; untuk pesanan ini?
            </Text>
            <Flex justify="flex-end" gap={2}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDialog(null)}
              >
                Batal
              </Button>
              <Button
                size="sm"
                colorPalette="red"
                onClick={handleConfirmReady}
              >
                Ya, Batalkan
              </Button>
            </Flex>
          </Box>
        </Box>
      )}
    </AppShell>
  );
}
