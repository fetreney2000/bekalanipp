"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Switch,
  Alert,
  Table,
  TableScrollContainer,
  ActionIcon,
  Title,
  Flex,
  Box,
  rem,
  Loader,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { DatePickerInput, TimePicker } from "@mantine/dates";
import Holidays from "date-holidays";
import {
  IconPackage,
  IconPlus,
  IconTrash,
  IconSend,
  IconCheck,
  IconAlertTriangle,
  IconBuildingHospital,
  IconHash,
  IconList,
  IconClock,
} from "@tabler/icons-react";
import type { CatalogItem, Ward } from "@/lib/types";
import { isOfficeHour as isOfficeHourInKuching } from "@/lib/office-hours";
import { checkMaxPerOrder, checkMonthlyQuota } from "@/lib/quota";

interface OrderRow {
  id: number;
  item_id: number | null;
  quantity: string;
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

/**
 * Whether a given instant falls in office hours (Mon-Fri, 08:00-17:00,
 * excluding Sabah public holidays), evaluated in Asia/Kuching.
 *
 * The rule itself lives in the shared lib so it is unit tested; here we just
 * supply the real Sabah (MY-12) holiday checker that the lib injects.
 *
 * `when` is passed in explicitly so callers can pass the *server* clock
 * (from /api/time) rather than trusting the workstation's clock — a machine
 * with a wrong clock would otherwise write wrong masa_pejabat flags, which
 * feed the totals_by_masa KPIs.
 */
const sabahHolidays = new Holidays("MY", "12");
const isOfficeHour = (when: Date): boolean =>
  isOfficeHourInKuching(when, (isoDate) => Boolean(sabahHolidays.isHoliday(isoDate)));

/** Fetch the server's current instant, falling back to the local clock. */
async function fetchServerNow(): Promise<Date> {
  try {
    const res = await fetch("/api/time");
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    if (data?.iso) return new Date(data.iso);
  } catch {
    /* fall through to local clock */
  }
  return new Date();
}

export default function SupplyPage() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  // Monotonic token so a slow catalog response for a previously selected ward
  // can't land after the current ward's and populate the wrong item list.
  const catalogSeq = useRef(0);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [orderDate, setOrderDate] = useState(todayStr());
  const [orderNumber, setOrderNumber] = useState("");
  const [orderType, setOrderType] = useState<string | null>("FS");
  const [masaDiterima, setMasaDiterima] = useState(nowTimeStr());
  const [masaPejabat, setMasaPejabat] = useState(false);
  const [orderRows, setOrderRows] = useState<OrderRow[]>([
    { id: 1, item_id: null, quantity: "" },
  ]);
  const [nextRowId, setNextRowId] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successId, setSuccessId] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    fetch("/api/wards")
      .then((res) => res.json())
      .then((data) => setWards(data))
      .catch(() => {});
  }, []);

  // Seed the office-hours flag from the *server* clock, not this
  // workstation's — a wrong client clock would otherwise write an
  // unauditable masa_pejabat flag into the totals_by_masa KPIs.
  useEffect(() => {
    let cancelled = false;
    fetchServerNow().then((serverNow) => {
      if (!cancelled) setMasaPejabat(isOfficeHour(serverNow));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchCatalog = useCallback((wardId: number) => {
    const seq = ++catalogSeq.current;
    const stale = () => seq !== catalogSeq.current;
    setCatalogLoading(true);
    fetch(`/api/catalog/${wardId}?month=${currentMonth()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!stale()) setCatalogItems(data.items || []);
      })
      .catch(() => {
        if (!stale()) setCatalogItems([]);
      })
      .finally(() => {
        if (!stale()) setCatalogLoading(false);
      });
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
    () =>
      catalogItems
        .map((c) => ({ value: String(c.item_id), label: c.item_name }))
        .sort((a, b) => a.label.localeCompare(b.label, "ms")),
    [catalogItems]
  );

  const getCatalogInfo = (itemId: number | null) =>
    catalogItems.find((c) => c.item_id === itemId);

  const getCatalogQuickRx = (itemId: number | null) =>
    !!getCatalogInfo(itemId)?.quick_rx_record;

  const getUsagePct = (itemId: number | null) => {
    const cat = getCatalogInfo(itemId);
    if (!cat || !cat.monthly_quota) return null;
    return Math.round(((cat.month_used ?? 0) / cat.monthly_quota) * 100);
  };

  const getUsageBadgeColor = (pct: number | null) => {
    if (pct === null) return "gray";
    if (pct >= 100) return "red";
    if (pct >= 80) return "yellow";
    return "green";
  };

  const getAvailableItems = useCallback((currentRowId: number) => {
    const selectedIds = new Set(
      orderRows.filter((r) => r.id !== currentRowId && r.item_id).map((r) => String(r.item_id))
    );
    return catalogData
      .filter((item) => !selectedIds.has(item.value))
      .map((item) => {
        const cat = catalogItems.find((c) => c.item_id === Number(item.value));
        return {
          ...item,
          label: `${item.label}${cat && cat.quick_rx_record ? " [QuickRx]" : ""}`,
        };
      });
  }, [catalogData, catalogItems, orderRows]);

  const handleWardChange = (value: string | null) => {
    setSelectedWardId(value);
    const numId = Number(value);
    if (numId) {
      fetchCatalog(numId);
    } else {
      // Ward cleared: invalidate any in-flight fetch so its items can't be
      // shown (and picked) without a ward selected.
      catalogSeq.current += 1;
      setCatalogItems([]);
      setCatalogLoading(false);
    }
    setOrderRows([{ id: 1, item_id: null, quantity: "" }]);
    setNextRowId(2);
    setErrors({});
    setSuccessId(null);
  };

  const addRow = () => {
    setOrderRows((prev) => [...prev, { id: nextRowId, item_id: null, quantity: "" }]);
    setNextRowId((n) => n + 1);
  };

  const removeRow = (id: number) => {
    setOrderRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id: number, field: "item_id" | "quantity", value: number | string | null) => {
    setOrderRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
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
      const qty = Number(row.quantity);
      if (!row.quantity.trim() || isNaN(qty) || qty < 1) errs[`qty_${row.id}`] = "Kuantiti mesti >= 1";

      const cat = getCatalogInfo(row.item_id);
      if (cat) {
        // Same rule as the server (single source of truth in lib/quota), but
        // with short inline messages that fit a form field.
        const maxViolation = checkMaxPerOrder(cat, qty);
        if (maxViolation) {
          errs[`qty_${row.id}`] = `Maksimum ${maxViolation.limit} setiap pesanan`;
        } else {
          const quotaViolation = checkMonthlyQuota(cat, qty, cat.month_used ?? 0);
          if (quotaViolation) {
            errs[`qty_${row.id}`] = `Akan melebihi kuota bulanan (${quotaViolation.limit})`;
          }
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
          quantity: Number(r.quantity),
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

      setSelectedWardId(null);
      setOrderNumber("");
      setOrderDate(todayStr());
      setOrderType("FS");
      setMasaDiterima(nowTimeStr());
      // Re-derive the flag from the server clock for the fresh form.
      fetchServerNow().then((serverNow) => setMasaPejabat(isOfficeHour(serverNow)));
setOrderRows([{ id: 1, item_id: null, quantity: "" }]);
      setNextRowId(2);
      setErrors({});
      // Invalidate any in-flight catalog fetch so it can't repopulate the
      // cleared list after the reset above.
      catalogSeq.current += 1;
      setCatalogItems([]);
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
        <Paper>
          <Group gap="xs">
            <IconPackage size={18} color="var(--mantine-color-gray-5)" />
            <Title order={3}>Rekod Inden Baharu</Title>
          </Group>
        </Paper>

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

        <Paper>
          <Stack gap="md">
            <Title order={4}>Maklumat Inden</Title>

            <Group gap="md" align="flex-start" wrap="wrap">
              <Box flex="1 1 220px">
                <Select
                  label="Wad/Jabatan *"
                  placeholder="Cari wad/jabatan..."
                  leftSection={<IconBuildingHospital size={16} />}
                  data={wardData}
                  searchable
                  value={selectedWardId}
                  onChange={handleWardChange}
                  error={errors.ward}
                />
              </Box>

              <Box flex="1 1 160px">
                <DatePickerInput
                  label="Tarikh *"
                  value={orderDate}
                  onChange={(val) => setOrderDate(val || "")}
                  valueFormat="DD/MM/YYYY"
                  error={errors.date}
                />
              </Box>

              <Box flex="1 1 180px">
                <TextInput
                  label="No. Inden *"
                  placeholder="Contoh: 131990 / CKK A No: 057374/19"
                  leftSection={<IconHash size={16} />}
                  styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)" } }}
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  error={errors.number}
                />
              </Box>

              <Box flex="1 1 180px">
                <Select
                  label="Jenis *"
                  placeholder="Pilih jenis..."
                  leftSection={<IconList size={16} />}
                  data={orderTypeData}
                  value={orderType}
                  onChange={setOrderType}
                />
              </Box>

              <Box flex="1 1 140px">
                <TimePicker
                  label="Masa Diterima"
                  leftSection={<IconClock size={16} />}
                  value={masaDiterima}
                  onChange={(val) => setMasaDiterima(val)}
                  withDropdown
                />
              </Box>

              <Box pt={rem(20)}>
                <Switch
                  label="Masa Pejabat"
                  checked={masaPejabat}
                  onChange={(e) => setMasaPejabat(e.currentTarget.checked)}
                />
              </Box>
            </Group>
          </Stack>
        </Paper>

        <Paper>
          <Flex justify="space-between" align="center" mb="md">
            <Group gap="xs">
              <IconPackage size={16} />
              <Title order={4}>Item Pesanan</Title>
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

          {catalogLoading ? (
            <Flex justify="center" py="xl">
              <Stack align="center" gap="xs">
                <Loader size="sm" color="cyan" />
                <Text size="sm" c="dimmed">Memuatkan senarai item...</Text>
              </Stack>
            </Flex>
          ) : (
          <TableScrollContainer minWidth={600}>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th ta="center">#</Table.Th>
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
                      <Table.Td ta="center">
                        <Text className="mono" c="dimmed" size="sm">{idx + 1}</Text>
                      </Table.Td>
                      <Table.Td miw={200} style={getCatalogQuickRx(row.item_id) ? {
                        backgroundImage: "linear-gradient(90deg, var(--mantine-color-cyan-light), var(--mantine-color-cyan-light))",
                        boxShadow: "inset 4px 0 0 var(--mantine-color-cyan-6)",
                      } : undefined}>
                        <div
                          onKeyDownCapture={(e: React.KeyboardEvent) => {
                            if (e.key === "Tab") {
                              const active = document.querySelector(
                                '[data-combobox-option-active][data-combobox-value]'
                              );
                              if (active) {
                                const val = active.getAttribute("data-combobox-value");
                                if (val) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  updateRow(row.id, "item_id", Number(val));
                                }
                              }
                            }
                          }}
                        >
                          <Select
                            placeholder="Cari item..."
                            data={getAvailableItems(row.id)}
                            searchable
                            value={row.item_id ? String(row.item_id) : null}
                            onChange={(value) => {
                              updateRow(row.id, "item_id", value ? Number(value) : null);
                            }}
                            size="xs"
                            error={errors[`item_${row.id}`]}
                          />
                          {row.item_id && getCatalogQuickRx(row.item_id) && (
                            <Badge
                              color="cyan"
                              variant="filled"
                              radius="xl"
                              size="xs"
                              mt={4}
                              style={{ display: "inline-flex" }}
                            >
                              QuickRx
                            </Badge>
                          )}
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={row.quantity}
                          onChange={(e) => {
                            const val = e.currentTarget.value;
                            if (val === "" || /^\d*$/.test(val)) {
                              updateRow(row.id, "quantity", val);
                            }
                          }}
                          size="xs"
                          w={70}
                          error={errors[`qty_${row.id}`]}
                          onFocus={(e) => e.target.select()}
                          placeholder="0"
                        />
                      </Table.Td>
                      <Table.Td><Text className="mono" size="sm">{cat ? cat.max_per_order : "—"}</Text></Table.Td>
                      <Table.Td><Text className="mono" size="sm">{cat && (cat.monthly_quota ?? 0) > 0 ? cat.monthly_quota : "—"}</Text></Table.Td>
                      <Table.Td><Text className="mono" size="sm" c={pct !== null && pct >= 100 ? "red" : undefined}>{cat && (cat.monthly_quota ?? 0) > 0 ? `${cat.month_used ?? 0} / ${cat.monthly_quota}` : "—"}</Text></Table.Td>
                      <Table.Td ta="center">
                        {pct !== null ? (
                          <Badge color={getUsageBadgeColor(pct)} variant="light" size="sm">
                            <Text component="span" className="mono" size="xs">{pct}%</Text>
                          </Badge>
                        ) : "—"}
                      </Table.Td>
                      <Table.Td ta="center">
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
          )}
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
            {submitting ? "Menyimpan..." : "Simpan Inden"}
          </Button>
        </Flex>
      </Stack>
    </AppShell>
  );
}
