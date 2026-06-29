"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Stack,
  Group,
  TextInput,
  Button,
  Text,
  Badge,
  Flex,
  Title,
  Box,
  Modal,
  Table,
  Alert,
  Loader,
  Switch,
  Select,
  NumberInput,
  ActionIcon,
  Paper,
  Divider,
} from "@mantine/core";
import {
  IconRefresh,
  IconArrowsSort,
  IconClock,
  IconCircleCheck,
  IconAlertTriangle,
  IconTrash,
  IconSearch,
  IconDeviceFloppy,
  IconX,
} from "@tabler/icons-react";
import { DatePickerInput, MonthPickerInput, TimePicker } from "@mantine/dates";
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
  masa_diterima: string | null;
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
  | "sudah_disedia"
  | "masa_pejabat";

const ORDER_TYPE_DATA = [
  { value: "FS", label: "Floor Stock" },
  { value: "EMT", label: "Emergency Trolley" },
  { value: "AOH", label: "AOH - After Office Hours" },
];

const ORDER_TYPE_COLOR: Record<string, string> = {
  FS: "blue",
  EMT: "red",
  AOH: "orange",
};

function getMonthRange(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return {
    from: firstDay.toISOString().slice(0, 10),
    to: lastDay.toISOString().slice(0, 10),
  };
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
  if (mins <= 60) return "green";
  if (mins <= 120) return "yellow";
  return "red";
}

function formatElapsed(mins: number): string {
  return `${mins} min`;
}

function playWarningBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    /* audio not available */
  }
}

export default function RecordsPage() {
  const WARN_105 = 105;
  const WARN_115 = 115;
  const now = new Date();
  const [dateValue, setDateValue] = useState<Date>(now);
  const month = dateValue.getMonth();
  const year = dateValue.getFullYear();
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
  const playedAlerts = useRef<Set<string>>(new Set());

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    order_date: "" as string | null,
    order_number: "",
    order_type: "FS",
    masa_pejabat: false,
    masa_diterima: "" as string | null,
  });
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      for (const order of orders) {
        if (order.sudah_disedia) continue;
        const elapsed = getElapsedMinutes(order);
        if (elapsed < WARN_105) continue;
        if (elapsed >= WARN_105 && !playedAlerts.current.has(`${order.id}_105`)) {
          playedAlerts.current.add(`${order.id}_105`);
          playWarningBeep();
        }
        if (elapsed >= WARN_115 && !playedAlerts.current.has(`${order.id}_115`)) {
          playedAlerts.current.add(`${order.id}_115`);
          playWarningBeep();
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [orders]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && !selectedOrder) {
        fetchOrders();
      }
    }, 300000);
    return () => clearInterval(interval);
  }, [fetchOrders, selectedOrder]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
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

  const openDetailModal = useCallback(async (order: Order) => {
    setSelectedOrder(order);
    setModalLoading(true);
    setModalError(null);
    setModalSuccess(null);
    setConfirmDelete(false);
    try {
      const res = await fetch(`/api/orders/${order.id}`);
      if (!res.ok) throw new Error("Gagal memuatkan butiran");
      const data = await res.json();
      setEditForm({
        order_date: data.order_date,
        order_number: data.order_number,
        order_type: data.order_type,
        masa_pejabat: data.masa_pejabat,
        masa_diterima: data.masa_diterima,
      });
      setEditItems(data.items || []);
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : "Ralat");
    } finally {
      setModalLoading(false);
    }
  }, []);

  const closeModal = () => {
    setSelectedOrder(null);
    setConfirmDelete(false);
    setModalError(null);
    setModalSuccess(null);
  };

  const handleSave = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    setModalError(null);
    setModalSuccess(null);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          sudah_disedia: selectedOrder.sudah_disedia,
          items: editItems.map((i) => ({
            item_id: i.item_id,
            quantity: i.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      setModalSuccess("Berjaya disimpan");
      fetchOrders();
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : "Ralat");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrder) return;
    setDeleting(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal memadam");
      }
      closeModal();
      fetchOrders();
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : "Ralat");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <style>{`
        @keyframes inden-warn-pulse {
          0%, 100% { background-color: transparent; }
          50% { background-color: var(--mantine-color-red-light); }
        }
      `}</style>
      <Stack gap="md">
        <Paper shadow="sm" p="md" radius="md" withBorder>
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <IconClock size={18} color="var(--mantine-color-gray-5)" />
              <Title order={2} fw={700}>Senarai Inden</Title>
            </Group>
          </Group>
        </Paper>

        <Flex gap="sm" wrap="wrap" align="flex-end">
          <MonthPickerInput
            label="Bulan"
            value={dateValue}
            onChange={(val) => {
              if (val) setDateValue(typeof val === "object" ? val : new Date(val));
            }}
            size="sm"
            w={170}
            valueFormat="MMMM YYYY"
          />
          <Button
            size="compact-sm"
            onClick={fetchOrders}
            variant="subtle"
            leftSection={<IconRefresh size={14} />}
          >
            Muat Semula
          </Button>
          <Box flex={1} miw={200} maw={320}>
            <TextInput
              placeholder="Cari No. Inden, Wad, atau Item..."
              leftSection={<IconSearch size={14} />}
              value={searchText}
              onChange={(e) => setSearchText(e.currentTarget.value)}
              size="sm"
            />
          </Box>
        </Flex>

        {loading && (
          <Box py={40} ta="center">
            <Loader size="sm" />
            <Text size="sm" mt="xs" c="dimmed">Memuatkan data...</Text>
          </Box>
        )}

        {error && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="red"
            variant="light"
            radius="md"
          >
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <Table.ScrollContainer minWidth={800}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>No</Table.Th>
                  <Table.Th
                    onClick={() => toggleSort("order_date")}
                    style={{ cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", textAlign: "left" }}
                  >
                    <Group gap={4} style={{ flexWrap: "nowrap" }}>
                      Tarikh
                      <IconArrowsSort size={14} style={{ opacity: sortKey === "order_date" ? 1 : 0.4, transform: sortKey === "order_date" && !sortAsc ? "scaleY(-1)" : undefined }} />
                    </Group>
                  </Table.Th>
                  <Table.Th style={{ textAlign: "center" }}>Masa Diterima</Table.Th>
                  <Table.Th
                    onClick={() => toggleSort("order_number")}
                    style={{ cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", textAlign: "left" }}
                  >
                    <Group gap={4} style={{ flexWrap: "nowrap" }}>
                      No. Inden
                      <IconArrowsSort size={14} style={{ opacity: sortKey === "order_number" ? 1 : 0.4, transform: sortKey === "order_number" && !sortAsc ? "scaleY(-1)" : undefined }} />
                    </Group>
                  </Table.Th>
                  <Table.Th
                    onClick={() => toggleSort("ward_name")}
                    style={{ cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", textAlign: "left" }}
                  >
                    <Group gap={4} style={{ flexWrap: "nowrap" }}>
                      Wad
                      <IconArrowsSort size={14} style={{ opacity: sortKey === "ward_name" ? 1 : 0.4, transform: sortKey === "ward_name" && !sortAsc ? "scaleY(-1)" : undefined }} />
                    </Group>
                  </Table.Th>
                  <Table.Th
                    onClick={() => toggleSort("order_type")}
                    style={{ cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", textAlign: "left" }}
                  >
                    <Group gap={4} style={{ flexWrap: "nowrap" }}>
                      Jenis
                      <IconArrowsSort size={14} style={{ opacity: sortKey === "order_type" ? 1 : 0.4, transform: sortKey === "order_type" && !sortAsc ? "scaleY(-1)" : undefined }} />
                    </Group>
                  </Table.Th>
                  <Table.Th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Bil. Item</Table.Th>
                  <Table.Th style={{ textAlign: "center" }}>Disediakan</Table.Th>
                  <Table.Th style={{ textAlign: "center" }}>Masa Pejabat</Table.Th>
                  <Table.Th style={{ textAlign: "center" }}>Masa</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={10} ta="center">
                      <Text c="dimmed" py="md">Tiada data ditemui</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {filtered.map((order, idx) => {
                  const elapsed = getElapsedMinutes(order);
                  const elapsedGrad = getElapsedGradient(elapsed);
                  const isWarning = !order.sudah_disedia && elapsed >= WARN_105;
                  return (
                    <Table.Tr
                      key={order.id}
                      onClick={() => openDetailModal(order)}
                      style={{
                        cursor: "pointer",
                        ...(isWarning
                          ? { fontWeight: 600, animation: "inden-warn-pulse 1.5s ease-in-out infinite" }
                          : {}),
                      }}
                    >
                      <Table.Td>{idx + 1}</Table.Td>
                      <Table.Td style={{ whiteSpace: "nowrap" }}>
                        {order.order_date}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                        {order.masa_diterima || <Text c="dimmed" size="sm">-</Text>}
                      </Table.Td>
                      <Table.Td style={{ fontWeight: 600 }}>
                        {order.order_number}
                      </Table.Td>
                      <Table.Td>{order.ward_name}</Table.Td>
                      <Table.Td>
                        <Badge
                          color={ORDER_TYPE_COLOR[order.order_type] || "gray"}
                          variant="filled"
                          radius="xl"
                          size="sm"
                        >
                          {order.order_type}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {order.items.length}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={order.sudah_disedia}
                          onChange={(event) =>
                            handleToggleReady(order.id, event.currentTarget.checked)
                          }
                          disabled={togglingReady === order.id}
                          size="sm"
                          labelPosition="left"
                        />
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={order.masa_pejabat}
                          onChange={(event) =>
                            handleTogglePejabat(order.id, event.currentTarget.checked)
                          }
                          disabled={togglingPejabat === order.id}
                          size="sm"
                          labelPosition="left"
                        />
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                        <Badge
                          color={isWarning ? "red" : elapsedGrad}
                          variant={isWarning ? "filled" : "light"}
                          radius="xl"
                          size="sm"
                          tt="none"
                        >
                          <Group gap={4} style={{ flexWrap: "nowrap" }}>
                            {order.sudah_disedia && order.completion_minutes != null ? (
                              <IconCircleCheck size={12} />
                            ) : isWarning ? (
                              <IconAlertTriangle size={12} />
                            ) : (
                              <IconClock size={12} />
                            )}
                            {formatElapsed(elapsed)}
                          </Group>
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}

        <Text size="xs" c="dimmed">
          {filtered.length} inden dipaparkan
        </Text>
      </Stack>

      <Modal
        opened={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        title="Sahkan Tindakan"
        size="sm"
        centered
      >
        <Stack gap="md">
          <Group gap="sm">
            <IconAlertTriangle size={20} color="var(--mantine-color-yellow)" />
            <Text fw={600} size="sm">Sahkan Tindakan</Text>
          </Group>
          <Text size="sm" c="dimmed">
            Adakah anda pasti mahu membatalkan status &quot;Sudah
            Disediakan&quot; untuk inden ini?
          </Text>
          <Flex justify="flex-end" gap="sm">
            <Button
              size="compact-sm"
              variant="subtle"
              leftSection={<IconX size={14} />}
              onClick={() => setConfirmDialog(null)}
            >
              Batal
            </Button>
            <Button
              size="compact-sm"
              color="red"
              leftSection={<IconX size={14} />}
              onClick={handleConfirmReady}
            >
              Ya, Batalkan
            </Button>
          </Flex>
        </Stack>
      </Modal>

      <Modal
        opened={!!selectedOrder}
        onClose={closeModal}
        title="Butiran Inden"
        size="md"
        centered
      >
        {modalLoading ? (
          <Box py={40} ta="center">
            <Loader size="sm" />
            <Text size="sm" mt="xs" c="dimmed">Memuatkan butiran...</Text>
          </Box>
        ) : (
          <Stack gap="md">
            {modalError && (
              <Alert color="red" variant="light" radius="md">
                {modalError}
              </Alert>
            )}

            {modalSuccess && (
              <Alert color="green" variant="light" radius="md">
                {modalSuccess}
              </Alert>
            )}

            <DatePickerInput
              label="Tarikh Inden"
              value={editForm.order_date}
              onChange={(val) =>
                setEditForm({ ...editForm, order_date: val })
              }
              valueFormat="DD/MM/YYYY"
              clearable
            />

            <TextInput
              label="No. Inden"
              value={editForm.order_number}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  order_number: e.currentTarget.value,
                })
              }
            />

            <Select
              label="Jenis"
              data={ORDER_TYPE_DATA}
              value={editForm.order_type}
              onChange={(val) =>
                setEditForm({ ...editForm, order_type: val || "FS" })
              }
            />

            <Group grow>
              <Select
                label="Masa Pejabat"
                data={[
                  { value: "false", label: "Tidak" },
                  { value: "true", label: "Ya" },
                ]}
                value={String(editForm.masa_pejabat)}
                onChange={(val) =>
                  setEditForm({
                    ...editForm,
                    masa_pejabat: val === "true",
                  })
                }
              />
              <TimePicker
                label="Masa Diterima"
                value={editForm.masa_diterima || ""}
                onChange={(val) =>
                  setEditForm({
                    ...editForm,
                    masa_diterima: val || null,
                  })
                }
                withDropdown
              />
            </Group>

            <Box>
              <Text size="sm" fw={500} mb={8}>Item</Text>
              <Stack gap="xs">
                {editItems.map((item, idx) => (
                  <Paper
                    key={idx}
                    p="xs"
                    bg="var(--mantine-color-gray-light)"
                    radius="md"
                  >
                    <Flex gap="sm" align="center">
                      <Text flex={1} size="sm">
                        {item.item_name}
                      </Text>
                      <NumberInput
                        value={item.quantity}
                        onChange={(val) => {
                          const v = typeof val === "number" ? val : 1;
                          setEditItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, quantity: Math.max(1, v) } : it))
                          );
                        }}
                        min={1}
                        w={70}
                        size="xs"
                        hideControls
                      />
                    </Flex>
                  </Paper>
                ))}
                {editItems.length === 0 && (
                  <Text c="dimmed" size="sm" ta="center" py="xs">
                    Tiada item
                  </Text>
                )}
              </Stack>
            </Box>

            <Divider />
            <Flex
              justify="space-between"
              align="center"
              pt="sm"
            >
              <Group gap="sm">
                {confirmDelete ? (
                  <Group gap="sm">
                    <Text size="sm" c="red">Pasti padam?</Text>
                    <Button size="compact-sm" color="red" leftSection={<IconTrash size={14} />} onClick={handleDelete} loading={deleting}>
                      Ya, Padam
                    </Button>
                    <Button size="compact-sm" variant="subtle" leftSection={<IconX size={14} />} onClick={() => setConfirmDelete(false)}>
                      Batal
                    </Button>
                  </Group>
                ) : (
                  <ActionIcon variant="subtle" color="red" size="sm" onClick={() => setConfirmDelete(true)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>
              <Group gap="sm">
                <Button size="compact-sm" variant="subtle" leftSection={<IconX size={14} />} onClick={closeModal}>
                  Tutup
                </Button>
                <Button size="compact-sm" leftSection={<IconDeviceFloppy size={14} />} onClick={handleSave} loading={saving}>
                  Simpan
                </Button>
              </Group>
            </Flex>
          </Stack>
        )}
      </Modal>
    </AppShell>
  );
}
