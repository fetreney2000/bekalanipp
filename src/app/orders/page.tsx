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
  IconButton,
  Flex,
  Heading,
} from "@chakra-ui/react";
import {
  Edit,
  Trash2,
  X,
  ShoppingCart,
  Filter,
  ArrowUpDown,
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
    <ArrowUpDown
      size={14}
      style={{
        opacity: active ? 1 : 0.4,
        transform: active && !sortAsc ? "scaleY(-1)" : undefined,
      }}
    />
  );

  return (
    <AppShell>
      <VStack gap={4} align="stretch">
        <Flex justify="space-between" align="center" flexWrap="wrap" gap={3}>
          <HStack gap={2}>
            <ShoppingCart size={22} color="#4f87ff" />
            <Heading size="lg">Butiran Inden</Heading>
          </HStack>
        </Flex>

        <Flex gap={3} flexWrap="wrap" align="flex-end">
          <Box>
            <Text fontSize="13px" color="muted" mb={1}>
              Dari Tarikh
            </Text>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              size="sm"
              maxW="180px"
            />
          </Box>
          <Box>
            <Text fontSize="13px" color="muted" mb={1}>
              Ke Tarikh
            </Text>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              size="sm"
              maxW="180px"
            />
          </Box>
          <Button
            size="sm"
            onClick={fetchOrders}
            display="inline-flex"
            gap={2}
          >
            <Filter size={14} /> Tapis
          </Button>
          <Box flex={1} minW="200px">
            <Text fontSize="13px" color="muted" mb={1}>
              Cari
            </Text>
            <Input
              placeholder="Cari No. Inden atau Wad..."
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
                    <th
                      key={i}
                      onClick={
                        col.key ? () => toggleSort(col.key!) : undefined
                      }
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid rgba(231,234,238,0.10)",
                        color: "var(--muted)",
                        fontWeight: 600,
                        fontSize: "13px",
                        textAlign: "left",
                        cursor: col.key ? "pointer" : "default",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {col.label}
                        {col.key && (
                          <SortIcon active={sortKey === col.key} />
                        )}
                      </span>
                    </th>
                  ))}
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
                {filtered.map((order, idx) => (
                  <tr
                    key={order.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => openModal(order)}
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
                      <Badge
                        size="sm"
                        colorPalette={ORDER_TYPE_COLOR[order.order_type] || "gray"}
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
                      }}
                    >
                      {order.ward_name}
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid rgba(231,234,238,0.10)",
                        textAlign: "center",
                      }}
                    >
                      {order.masa_pejabat ? (
                        <Badge size="sm" colorPalette="orange" variant="solid">
                          Ya
                        </Badge>
                      ) : (
                        <Text color="muted" fontSize="13px">
                          -
                        </Text>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid rgba(231,234,238,0.10)",
                        textAlign: "center",
                      }}
                    >
                      {order.sudah_disedia ? (
                        <Badge size="sm" colorPalette="green" variant="solid">
                          Diterima
                        </Badge>
                      ) : (
                        <Badge size="sm" colorPalette="yellow" variant="solid">
                          Menunggu
                        </Badge>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid rgba(231,234,238,0.10)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Badge
                        size="sm"
                        colorPalette={elapsedColor(order)}
                        variant="subtle"
                        borderRadius="full"
                      >
                        {elapsedMinutes(order)}
                      </Badge>
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid rgba(231,234,238,0.10)",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <HStack gap={1}>
                        <IconButton
                          aria-label="Sunting"
                          size="xs"
                          variant="ghost"
                          onClick={() => openModal(order)}
                        >
                          <Edit size={14} />
                        </IconButton>
                      </HStack>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        )}

        <Text fontSize="12px" color="muted">
          {filtered.length} pesanan dipaparkan
        </Text>
      </VStack>

      {selectedOrder && (
        <Box
          position="fixed"
          inset={0}
          bg="rgba(0,0,0,0.6)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={9999}
          p={4}
          onClick={closeModal}
        >
          <Box
            bg="var(--card)"
            border="1px solid var(--line)"
            borderRadius="14px"
            w="100%"
            maxW="640px"
            maxH="90vh"
            overflowY="auto"
            p={0}
            onClick={(e) => e.stopPropagation()}
          >
            <Flex
              justify="space-between"
              align="center"
              px={5}
              py={4}
              borderBottom="1px solid var(--line)"
            >
              <Heading size="md">Butiran Inden</Heading>
              <IconButton
                aria-label="Tutup"
                size="sm"
                variant="ghost"
                onClick={closeModal}
              >
                <X size={18} />
              </IconButton>
            </Flex>

            {modalLoading ? (
              <Box py={8} textAlign="center" color="muted">
                Memuatkan butiran...
              </Box>
            ) : (
              <VStack gap={4} align="stretch" p={5}>
                {modalError && (
                  <Box
                    py={3}
                    px={4}
                    bg="rgba(239,83,80,0.1)"
                    border="1px solid rgba(239,83,80,0.3)"
                    borderRadius="10px"
                    color="red.300"
                    fontSize="13px"
                  >
                    {modalError}
                  </Box>
                )}

                {modalSuccess && (
                  <Box
                    py={3}
                    px={4}
                    bg="rgba(76,175,80,0.1)"
                    border="1px solid rgba(76,175,80,0.3)"
                    borderRadius="10px"
                    color="green.300"
                    fontSize="13px"
                    whiteSpace="pre-wrap"
                  >
                    {modalSuccess}
                  </Box>
                )}

                <Box>
                  <Text fontSize="13px" color="muted" mb={1}>
                    Tarikh Inden
                  </Text>
                  <Input
                    type="date"
                    value={editForm.order_date}
                    onChange={(e) =>
                      setEditForm({ ...editForm, order_date: e.target.value })
                    }
                    size="sm"
                  />
                </Box>

                <Box>
                  <Text fontSize="13px" color="muted" mb={1}>
                    No. Inden
                  </Text>
                  <Input
                    value={editForm.order_number}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        order_number: e.target.value,
                      })
                    }
                    size="sm"
                  />
                </Box>

                <Box>
                  <Text fontSize="13px" color="muted" mb={1}>
                    Jenis
                  </Text>
                  <select
                    value={editForm.order_type}
                    onChange={(e) =>
                      setEditForm({ ...editForm, order_type: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      border: "1px solid var(--control-border)",
                      background: "var(--control)",
                      color: "var(--text)",
                      fontSize: "14px",
                    }}
                  >
                    <option value="FS">Floor Stock</option>
                    <option value="EMT">Emergency Trolley</option>
                    <option value="AOH">Selepas Waktu Pejabat</option>
                  </select>
                </Box>

                <HStack gap={4}>
                  <Box flex={1}>
                    <Text fontSize="13px" color="muted" mb={1}>
                      Masa Pejabat
                    </Text>
                    <select
                      value={editForm.masa_pejabat ? "true" : "false"}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          masa_pejabat: e.target.value === "true",
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        border: "1px solid var(--control-border)",
                        background: "var(--control)",
                        color: "var(--text)",
                        fontSize: "14px",
                      }}
                    >
                      <option value="false">Tidak</option>
                      <option value="true">Ya</option>
                    </select>
                  </Box>
                  <Box flex={1}>
                    <Text fontSize="13px" color="muted" mb={1}>
                      Masa Diterima
                    </Text>
                    <select
                      value={editForm.masa_diterima ? "true" : "false"}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          masa_diterima: e.target.value === "true",
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        border: "1px solid var(--control-border)",
                        background: "var(--control)",
                        color: "var(--text)",
                        fontSize: "14px",
                      }}
                    >
                      <option value="false">Tidak</option>
                      <option value="true">Ya</option>
                    </select>
                  </Box>
                </HStack>

                <Box>
                  <Text fontSize="13px" color="muted" mb={2}>
                    Item
                  </Text>
                  <VStack gap={2} align="stretch">
                    {editItems.map((item, idx) => (
                      <Flex
                        key={idx}
                        gap={2}
                        align="center"
                        bg="var(--bg)"
                        p={2}
                        borderRadius="8px"
                      >
                        <Text flex={1} fontSize="13px">
                          {item.item_name}
                        </Text>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemQuantity(
                              idx,
                              Math.max(1, parseInt(e.target.value) || 1)
                            )
                          }
                          size="xs"
                          w="70px"
                          min={1}
                        />
                        <IconButton
                          aria-label="Buang item"
                          size="xs"
                          variant="ghost"
                          color="red.400"
                          onClick={() => removeItem(idx)}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </Flex>
                    ))}
                    {editItems.length === 0 && (
                      <Text color="muted" fontSize="13px" textAlign="center" py={2}>
                        Tiada item
                      </Text>
                    )}
                  </VStack>
                </Box>

                <Flex
                  justify="space-between"
                  align="center"
                  pt={2}
                  borderTop="1px solid var(--line)"
                >
                  <HStack gap={2}>
                    {confirmDelete ? (
                      <HStack gap={2}>
                        <Text fontSize="13px" color="red.300">
                          Pasti padam?
                        </Text>
                        <Button
                          size="sm"
                          colorPalette="red"
                          onClick={handleDelete}
                          loading={deleting}
                        >
                          Ya, Padam
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(false)}
                        >
                          Batal
                        </Button>
                      </HStack>
                    ) : (
                      <IconButton
                        aria-label="Padam"
                        size="sm"
                        variant="ghost"
                        color="red.400"
                        onClick={() => setConfirmDelete(true)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    )}
                  </HStack>
                  <HStack gap={2}>
                    <Button size="sm" variant="ghost" onClick={closeModal}>
                      Batal
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      loading={saving}
                      colorPalette="blue"
                    >
                      Simpan
                    </Button>
                  </HStack>
                </Flex>
              </VStack>
            )}
          </Box>
        </Box>
      )}
    </AppShell>
  );
}
