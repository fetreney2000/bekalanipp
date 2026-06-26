"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/AppShell";
import {
  Stack,
  Group,
  Paper,
  Text,
  Badge,
  Button,
  TextInput,
  Select,
  NumberInput,
  Switch,
  Alert,
  Table,
  TableScrollContainer,
  ActionIcon,
  Title,
  Flex,
  Box,
  rem,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPackage,
  IconPlus,
  IconTrash,
  IconSend,
  IconCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";

interface Ward {
  id: number;
  name: string;
  category: string;
}

interface CatalogItem {
  ward_id: number;
  item_id: number;
  item_name: string;
  max_per_order: number;
  monthly_quota: number;
  month_used: number;
}

interface OrderRow {
  id: number;
  item_id: number | null;
  quantity: number;
}

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function SupplyPage() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [orderDate, setOrderDate] = useState(todayStr());
  const [orderNumber, setOrderNumber] = useState("");
  const [orderType, setOrderType] = useState<string | null>("FS");
  const [masaDiterima, setMasaDiterima] = useState(nowTimeStr());
  const [masaPejabat, setMasaPejabat] = useState(true);
  const [orderRows, setOrderRows] = useState<OrderRow[]>([
    { id: 1, item_id: null, quantity: 1 },
  ]);
  const [nextRowId, setNextRowId] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/wards")
      .then((res) => res.json())
      .then((data) => setWards(data))
      .catch(() => {});
  }, []);

  const fetchCatalog = useCallback((wardId: number) => {
    fetch(`/api/catalog/${wardId}?month=${currentMonth()}`)
      .then((res) => res.json())
      .then((data) => setCatalogItems(data.items || []))
      .catch(() => setCatalogItems([]));
  }, []);

  const wardData = useMemo(
    () => wards.map((w) => ({ value: String(w.id), label: w.name })),
    [wards]
  );

  const orderTypeData = [
    { value: "FS", label: "FS - Floor Stock" },
    { value: "EMT", label: "EMT - Emergency Trolley" },
    { value: "AOH", label: "AOH - After Office Hours" },
  ];

  const catalogData = useMemo(
    () => catalogItems.map((c) => ({ value: String(c.item_id), label: c.item_name })),
    [catalogItems]
  );

  const handleWardChange = (value: string | null) => {
    setSelectedWardId(value);
    const numId = Number(value);
    if (numId) {
      fetchCatalog(numId);
    }
    setOrderRows([{ id: 1, item_id: null, quantity: 1 }]);
    setNextRowId(2);
    setErrors({});
    setSuccessId(null);
  };

  const addRow = () => {
    setOrderRows((prev) => [...prev, { id: nextRowId, item_id: null, quantity: 1 }]);
    setNextRowId((n) => n + 1);
  };

  const removeRow = (id: number) => {
    setOrderRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id: number, field: "item_id" | "quantity", value: number | null) => {
    setOrderRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const getCatalogInfo = (itemId: number | null) =>
    catalogItems.find((c) => c.item_id === itemId);

  const getUsagePct = (itemId: number | null) => {
    const cat = getCatalogInfo(itemId);
    if (!cat || cat.monthly_quota === 0) return null;
    return Math.round((cat.month_used / cat.monthly_quota) * 100);
  };

  const getUsageBadgeColor = (pct: number | null) => {
    if (pct === null) return "gray";
    if (pct >= 100) return "red";
    if (pct >= 80) return "yellow";
    return "green";
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!selectedWardId) errs.ward = "Pilih wad/jabatan";
    if (!orderDate) errs.date = "Tarikh diperlukan";
    if (!orderNumber.trim()) errs.number = "No. Inden diperlukan";

    if (orderRows.length === 0) {
      errs.items = "Sekurang-kurangnya satu item diperlukan";
    }

    orderRows.forEach((row) => {
      if (!row.item_id) errs[`item_${row.id}`] = "Pilih item";
      if (row.quantity < 1) errs[`qty_${row.id}`] = "Kuantiti mesti >= 1";

      const cat = getCatalogInfo(row.item_id);
      if (cat && cat.max_per_order > 0 && row.quantity > cat.max_per_order) {
        errs[`qty_${row.id}`] = `Maksimum ${cat.max_per_order} setiap pesanan`;
      }
      if (cat && cat.monthly_quota > 0) {
        const newTotal = cat.month_used + row.quantity;
        if (newTotal > cat.monthly_quota) {
          errs[`qty_${row.id}`] = `Akan melebihi kuota bulanan (${cat.monthly_quota})`;
        }
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setSuccessId(null);

    try {
      const payload = {
        ward_id: Number(selectedWardId),
        order_date: orderDate,
        order_number: orderNumber.trim(),
        order_type: orderType,
        masa_pejabat: masaPejabat,
        masa_diterima: masaDiterima || null,
        sudah_disedia: false,
        items: orderRows.filter((r) => r.item_id).map((r) => ({
          item_id: r.item_id,
          quantity: r.quantity,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        notifications.show({
          title: "Ralat",
          message: data.error || "Gagal mencipta pesanan",
          color: "red",
        });
        return;
      }

      setSuccessId(data.id);
      notifications.show({
        title: "Berjaya",
        message: `Pesanan ${orderNumber} telah dicipta`,
        color: "green",
      });

      setOrderNumber("");
      setOrderDate(todayStr());
      setOrderType("FS");
      setMasaDiterima(nowTimeStr());
      setMasaPejabat(true);
      setOrderRows([{ id: 1, item_id: null, quantity: 1 }]);
      setNextRowId(2);
      setErrors({});
      if (selectedWardId) fetchCatalog(Number(selectedWardId));
    } catch {
      notifications.show({
        title: "Ralat",
        message: "Gagal menghantar pesanan",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <Stack gap="lg" pb="xl">
        <Title order={3} fw={700}>Rekod Inden Baharu</Title>

        {successId && (
          <Alert
            icon={<IconCheck size={16} />}
            title="Pesanan berjaya dicipta"
            color="green"
            variant="light"
            radius="md"
          >
            <Text size="sm" c="dimmed">ID: {successId}</Text>
          </Alert>
        )}

        <Paper shadow="sm" p="md" radius="md" withBorder>
          <Stack gap="md">
            <Title order={5} fw={600}>Maklumat Inden</Title>

            <Group gap="md" align="flex-start" wrap="wrap">
              <Box style={{ flex: "1 1 220px" }}>
                <Select
                  label="Wad/Jabatan *"
                  placeholder="Cari wad/jabatan..."
                  data={wardData}
                  searchable
                  value={selectedWardId}
                  onChange={handleWardChange}
                  error={errors.ward}
                />
              </Box>

              <Box style={{ flex: "1 1 160px" }}>
                <TextInput
                  label="Tarikh *"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  error={errors.date}
                />
              </Box>

              <Box style={{ flex: "1 1 180px" }}>
                <TextInput
                  label="No. Inden *"
                  placeholder="Contoh: IND-2026-001"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  error={errors.number}
                />
              </Box>

              <Box style={{ flex: "1 1 180px" }}>
                <Select
                  label="Jenis *"
                  placeholder="Pilih jenis..."
                  data={orderTypeData}
                  value={orderType}
                  onChange={setOrderType}
                />
              </Box>

              <Box style={{ flex: "1 1 140px" }}>
                <TextInput
                  label="Masa Diterima"
                  type="time"
                  value={masaDiterima}
                  onChange={(e) => setMasaDiterima(e.target.value)}
                />
              </Box>

              <Box style={{ paddingTop: rem(20) }}>
                <Switch
                  label="Masa Pejabat"
                  checked={masaPejabat}
                  onChange={(e) => setMasaPejabat(e.currentTarget.checked)}
                />
              </Box>
            </Group>
          </Stack>
        </Paper>

        <Paper shadow="sm" p="md" radius="md" withBorder>
          <Flex justify="space-between" align="center" mb="md">
            <Group gap="xs">
              <IconPackage size={16} />
              <Title order={5} fw={600}>Item Pesanan</Title>
            </Group>
            <Button
              size="compact-sm"
              variant="filled"
              leftSection={<IconPlus size={14} />}
              onClick={addRow}
            >
              Tambah Baris
            </Button>
          </Flex>

          {errors.items && (
            <Alert
              icon={<IconAlertTriangle size={16} />}
              color="red"
              variant="light"
              radius="md"
              mb="md"
            >
              {errors.items}
            </Alert>
          )}

          <TableScrollContainer minWidth={600}>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ textAlign: "center" }}>#</Table.Th>
                  <Table.Th>Item</Table.Th>
                  <Table.Th>Kuantiti</Table.Th>
                  <Table.Th>Had/Pesanan</Table.Th>
                  <Table.Th>Kuota Bulanan</Table.Th>
                  <Table.Th>Diguna</Table.Th>
                  <Table.Th style={{ textAlign: "center" }}>Status</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {orderRows.map((row, idx) => {
                  const cat = getCatalogInfo(row.item_id);
                  const pct = getUsagePct(row.item_id);
                  return (
                    <Table.Tr key={row.id}>
                      <Table.Td style={{ textAlign: "center" }}>{idx + 1}</Table.Td>
                      <Table.Td style={{ minWidth: 200 }}>
                        <Select
                          placeholder="Cari item..."
                          data={catalogData}
                          searchable
                          value={row.item_id ? String(row.item_id) : null}
                          onChange={(value) => {
                            updateRow(row.id, "item_id", value ? Number(value) : null);
                          }}
                          size="xs"
                          error={errors[`item_${row.id}`]}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={1}
                          value={row.quantity}
                          onChange={(value) => updateRow(row.id, "quantity", typeof value === "number" ? value : 0)}
                          size="xs"
                          style={{ width: 70 }}
                          hideControls
                          error={errors[`qty_${row.id}`]}
                        />
                      </Table.Td>
                      <Table.Td style={{ fontSize: 13 }}>{cat ? cat.max_per_order : "—"}</Table.Td>
                      <Table.Td style={{ fontSize: 13 }}>{cat ? cat.monthly_quota : "—"}</Table.Td>
                      <Table.Td style={{ fontSize: 13 }}>{cat ? `${cat.month_used} / ${cat.monthly_quota}` : "—"}</Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {pct !== null ? (
                          <Badge color={getUsageBadgeColor(pct)} variant="light" size="sm">
                            {pct}%
                          </Badge>
                        ) : "—"}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {orderRows.length > 1 && (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => removeRow(row.id)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </TableScrollContainer>
        </Paper>

        <Flex justify="flex-end">
          <Button
            variant="filled"
            size="md"
            px="xl"
            leftSection={<IconSend size={16} />}
            onClick={handleSubmit}
            loading={submitting}
          >
            {submitting ? "Menghantar..." : "Hantar Pesanan"}
          </Button>
        </Flex>
      </Stack>
    </AppShell>
  );
}
