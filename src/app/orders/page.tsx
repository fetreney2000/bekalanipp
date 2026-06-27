"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Stack,
  Group,
  TextInput,
  Button,
  Text,
  Badge,
  ActionIcon,
  Flex,
  Title,
  Box,
  Modal,
  Table,
  Alert,
  Loader,
  Select,
  NumberInput,
} from "@mantine/core";
import {
  IconEdit,
  IconTrash,
  IconX,
  IconShoppingCart,
  IconFilter,
  IconArrowsSort,
  IconAlertCircle,
} from "@tabler/icons-react";
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
  | "order_type"
  | "ward_name"
  | "masa_pejabat"
  | "sudah_disedia";

const ORDER_TYPE_MAP: Record<string, string> = {
  FS: "Floor Stock",
  EMT: "Emergency Trolley",
  AOH: "Selepas Waktu Pejabat",
};

const ORDER_TYPE_COLOR: Record<string, string> = {
  FS: "blue",
  EMT: "red",
  AOH: "orange",
};

function dateRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  return {
    from: firstDay.toISOString().slice(0, 10),
    to: lastDay.toISOString().slice(0, 10),
  };
}

function elapsedMinutes(order: Order): string {
  if (order.sudah_disedia && order.completion_minutes != null) {
    return `${order.completion_minutes} min`;
  }
  if (order.sudah_disedia && order.masa_selesai) {
    const created = new Date(order.created_at).getTime();
    const finished = new Date(order.masa_selesai).getTime();
    return `${Math.round((finished - created) / 60000)} min`;
  }
  const created = new Date(order.created_at).getTime();
  const diff = Math.round((Date.now() - created) / 60000);
  return `${diff} min`;
}

function elapsedColor(order: Order): string {
  let mins: number;
  if (order.sudah_disedia && order.completion_minutes != null) {
    mins = order.completion_minutes;
  } else if (order.sudah_disedia && order.masa_selesai) {
    const created = new Date(order.created_at).getTime();
    const finished = new Date(order.masa_selesai).getTime();
    mins = Math.round((finished - created) / 60000);
  } else {
    mins = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);
  }
  if (mins <= 60) return "green";
  if (mins <= 120) return "yellow";
  return "red";
}

export default function OrdersPage() {
  const defaultRange = dateRange();
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [searchText, setSearchText] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("order_date");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    order_date: "",
    order_number: "",
    order_type: "FS",
    masa_pejabat: false,
    masa_diterima: false,
  });
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/orders?from=${fromDate}&to=${toDate}`
      );
      if (!res.ok) throw new Error("Gagal memuatkan data");
      const data = await res.json();
      setOrders(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ralat tidak diketahui");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (orders.length > 0 && !selectedOrder) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      if (id) {
        const order = orders.find((o) => o.id === id);
        if (order) openModal(order);
      }
    }
  }, [orders]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const filtered = useMemo(() => {
    let list = [...orders];
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.ward_name.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let va: string | boolean = "";
      let vb: string | boolean = "";
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
    return list.slice(0, 500);
  }, [orders, searchText, sortKey, sortAsc]);

  const openModal = async (order: Order) => {
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
  };

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
      if (data.notifications?.length) {
        setModalSuccess(data.notifications.join("\n"));
      } else {
        setModalSuccess("Berjaya disimpan");
      }
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

  const updateItemQuantity = (index: number, qty: number) => {
    setEditItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: qty } : item))
    );
  };

  const removeItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  const SortIcon = ({ active }: { active: boolean }) => (
    <IconArrowsSort
      size={14}
      style={{
        opacity: active ? 1 : 0.4,
        transform: active && !sortAsc ? "scaleY(-1)" : undefined,
      }}
    />
  );

  const ORDER_TYPE_DATA = [
    { value: "FS", label: "Floor Stock" },
    { value: "EMT", label: "Emergency Trolley" },
    { value: "AOH", label: "Selepas Waktu Pejabat" },
  ];

  return (
    <AppShell>
      <Stack gap="md">
        <Flex justify="space-between" align="center" wrap="wrap" gap="sm">
          <Group gap="sm">
            <IconShoppingCart size={22} color="#4f87ff" />
            <Title order={2}>Butiran Inden</Title>
          </Group>
        </Flex>

        <Flex gap="sm" wrap="wrap" align="flex-end">
          <TextInput
            label="Dari Tarikh"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            w={180}
          />
          <TextInput
            label="Ke Tarikh"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            w={180}
          />
          <Button
            size="compact-sm"
            onClick={fetchOrders}
            leftSection={<IconFilter size={14} />}
          >
            Tapis
          </Button>
          <Box style={{ flex: 1, minWidth: 200 }}>
            <Text size="xs" c="dimmed" mb={4}>
              Cari
            </Text>
            <TextInput
              placeholder="Cari No. Inden atau Wad..."
              value={searchText}
              onChange={(e) => setSearchText(e.currentTarget.value)}
              size="sm"
            />
          </Box>
        </Flex>

        {loading && (
          <Box py={40} style={{ textAlign: "center", color: "var(--mantine-color-dimmed)" }}>
            <Loader size="sm" />
            <Text size="sm" mt="xs" c="dimmed">Memuatkan data...</Text>
          </Box>
        )}

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            variant="light"
            radius="md"
          >
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <Box style={{ overflowX: "auto" }}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  {[
                    { key: null, label: "No" },
                    { key: "order_date" as SortKey, label: "Tarikh" },
                    { key: "order_number" as SortKey, label: "No. Inden" },
                    { key: "order_type" as SortKey, label: "Jenis" },
                    { key: "ward_name" as SortKey, label: "Wad" },
                    { key: "masa_pejabat" as SortKey, label: "Masa Pejabat" },
                    { key: "sudah_disedia" as SortKey, label: "Diterima" },
                    { key: null, label: "Masa" },
                    { key: null, label: "Aksi" },
                  ].map((col, i) => (
                    <Table.Th
                      key={i}
                      onClick={
                        col.key ? () => toggleSort(col.key!) : undefined
                      }
                      style={{
                        cursor: col.key ? "pointer" : "default",
                        whiteSpace: "nowrap",
                        userSelect: "none",
                      }}
                    >
                      <Group gap={4} style={{ flexWrap: "nowrap" }}>
                        {col.label}
                        {col.key && (
                          <SortIcon active={sortKey === col.key} />
                        )}
                      </Group>
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={9} style={{ textAlign: "center" }}>
                      <Text c="dimmed" py="md">Tiada data ditemui</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {filtered.map((order, idx) => (
                  <Table.Tr
                    key={order.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => openModal(order)}
                  >
                    <Table.Td>{idx + 1}</Table.Td>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>
                      {order.order_date}
                    </Table.Td>
                    <Table.Td style={{ fontWeight: 600 }}>
                      {order.order_number}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={ORDER_TYPE_COLOR[order.order_type] || "gray"}
                        variant="filled"
                        radius="xl"
                        size="sm"
                      >
                        {ORDER_TYPE_MAP[order.order_type] || order.order_type}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{order.ward_name}</Table.Td>
                    <Table.Td style={{ textAlign: "center" }}>
                      {order.masa_pejabat ? (
                        <Badge color="orange" variant="filled" size="sm">
                          Ya
                        </Badge>
                      ) : (
                        <Text c="dimmed" size="sm">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ textAlign: "center" }}>
                      {order.sudah_disedia ? (
                        <Badge color="green" variant="filled" size="sm">
                          Diterima
                        </Badge>
                      ) : (
                        <Badge color="yellow" variant="filled" size="sm">
                          Menunggu
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>
                      <Badge
                        color={elapsedColor(order)}
                        variant="light"
                        radius="xl"
                        size="sm"
                      >
                        {elapsedMinutes(order)}
                      </Badge>
                    </Table.Td>
                    <Table.Td
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => openModal(order)}
                        >
                          <IconEdit size={14} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        )}

        <Text size="xs" c="dimmed">
          {filtered.length} pesanan dipaparkan
        </Text>
      </Stack>

      <Modal
        opened={!!selectedOrder}
        onClose={closeModal}
        title="Butiran Inden"
        size="md"
        centered
      >
        {modalLoading ? (
          <Box py={40} style={{ textAlign: "center" }}>
            <Loader size="sm" />
            <Text size="sm" mt="xs" c="dimmed">Memuatkan butiran...</Text>
          </Box>
        ) : (
          <Stack gap="md">
            {modalError && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="red"
                variant="light"
                radius="md"
              >
                {modalError}
              </Alert>
            )}

            {modalSuccess && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="green"
                variant="light"
                radius="md"
                style={{ whiteSpace: "pre-wrap" }}
              >
                {modalSuccess}
              </Alert>
            )}

            <TextInput
              label="Tarikh Inden"
              type="date"
              value={editForm.order_date}
              onChange={(e) =>
                setEditForm({ ...editForm, order_date: e.target.value })
              }
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
              <Select
                label="Masa Diterima"
                data={[
                  { value: "false", label: "Tidak" },
                  { value: "true", label: "Ya" },
                ]}
                value={String(editForm.masa_diterima)}
                onChange={(val) =>
                  setEditForm({
                    ...editForm,
                    masa_diterima: val === "true",
                  })
                }
              />
            </Group>

            <Box>
              <Text size="sm" fw={500} mb={8}>
                Item
              </Text>
              <Stack gap="xs">
                {editItems.map((item, idx) => (
                  <Flex
                    key={idx}
                    gap="sm"
                    align="center"
                    p="xs"
                    style={{
                      borderRadius: "8px",
                      background: "var(--mantine-color-gray-light)",
                    }}
                  >
                    <Text style={{ flex: 1 }} size="sm">
                      {item.item_name}
                    </Text>
                    <NumberInput
                      value={item.quantity}
                      onChange={(val) => updateItemQuantity(idx, Math.max(1, typeof val === "number" ? val : 1))}
                      min={1}
                      w={70}
                      size="xs"
                      hideControls
                    />
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => removeItem(idx)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Flex>
                ))}
                {editItems.length === 0 && (
                  <Text c="dimmed" size="sm" style={{ textAlign: "center" }} py="xs">
                    Tiada item
                  </Text>
                )}
              </Stack>
            </Box>

            <Flex
              justify="space-between"
              align="center"
              pt="sm"
              style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
            >
              <Group gap="sm">
                {confirmDelete ? (
                  <Group gap="sm">
                    <Text size="sm" c="red">
                      Pasti padam?
                    </Text>
                    <Button
                      size="compact-sm"
                      color="red"
                      onClick={handleDelete}
                      loading={deleting}
                    >
                      Ya, Padam
                    </Button>
                    <Button
                      size="compact-sm"
                      variant="subtle"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Batal
                    </Button>
                  </Group>
                ) : (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>
              <Group gap="sm">
                <Button
                  size="compact-sm"
                  variant="subtle"
                  onClick={closeModal}
                >
                  Batal
                </Button>
                <Button
                  size="compact-sm"
                  onClick={handleSave}
                  loading={saving}
                >
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
