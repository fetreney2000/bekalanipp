"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/AppShell";
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
  Alert,
  Combobox,
  createToaster,
  createListCollection,
} from "@chakra-ui/react";
import { Package, Plus, Trash2, Send, CheckCircle, AlertTriangle } from "lucide-react";

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

const toaster = createToaster({ placement: "top", overlap: true, gap: 16 });

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

const comboboxInputCss = {
  bg: "#123a66",
  borderColor: "rgba(79,135,255,0.12)",
  color: "#e7eaee",
  borderRadius: "10px",
  fontSize: "14px",
  padding: "6px 10px",
  width: "100%",
};

export default function SupplyPage() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedWardId, setSelectedWardId] = useState<string[]>([]);
  const [orderDate, setOrderDate] = useState(todayStr());
  const [orderNumber, setOrderNumber] = useState("");
  const [orderType, setOrderType] = useState<string[]>(["FS"]);
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

  const wardCollection = useMemo(
    () =>
      createListCollection({
        items: wards.map((w) => ({ value: String(w.id), label: w.name })),
      }),
    [wards]
  );

  const orderTypeCollection = createListCollection({
    items: [
      { value: "FS", label: "FS - Floor Stock" },
      { value: "EMT", label: "EMT - Emergency Trolley" },
      { value: "AOH", label: "AOH - After Office Hours" },
    ],
  });

  const catalogCollection = useMemo(
    () =>
      createListCollection({
        items: catalogItems.map((c) => ({
          value: String(c.item_id),
          label: c.item_name,
        })),
      }),
    [catalogItems]
  );

  const handleWardChange = (details: { value: string[] }) => {
    setSelectedWardId(details.value);
    const numId = Number(details.value[0]);
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
    if (!selectedWardId[0]) errs.ward = "Pilih wad/jabatan";
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
        ward_id: Number(selectedWardId[0]),
        order_date: orderDate,
        order_number: orderNumber.trim(),
        order_type: orderType[0],
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
        toaster.create({ title: "Ralat", description: data.error || "Gagal mencipta pesanan", type: "error" });
        return;
      }

      setSuccessId(data.id);
      toaster.create({ title: "Berjaya", description: `Pesanan ${orderNumber} telah dicipta`, type: "success" });

      setOrderNumber("");
      setOrderDate(todayStr());
      setOrderType(["FS"]);
      setMasaDiterima(nowTimeStr());
      setMasaPejabat(true);
      setOrderRows([{ id: 1, item_id: null, quantity: 1 }]);
      setNextRowId(2);
      setErrors({});
      if (selectedWardId[0]) fetchCatalog(Number(selectedWardId[0]));
    } catch {
      toaster.create({ title: "Ralat", description: "Gagal menghantar pesanan", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <VStack align="stretch" gap={6}>
        <Heading fontSize="1.3rem" fontWeight={700}>Rekod Inden Baharu</Heading>

        {successId && (
          <Alert.Root status="success" borderRadius="10px">
            <Alert.Indicator><CheckCircle size={16} /></Alert.Indicator>
            <Box>
              <Text fontSize="14px" fontWeight={600}>Pesanan berjaya dicipta</Text>
              <Text fontSize="13px" color="text.muted">ID: {successId}</Text>
            </Box>
          </Alert.Root>
        )}

        <Box bg="bg.card" border="1px solid" borderColor="line" borderRadius="14px" p={5}>
          <VStack align="stretch" gap={4}>
            <Heading fontSize="0.95rem" fontWeight={600} mb={1}>Maklumat Inden</Heading>

            <HStack gap={4} flexWrap="wrap" align="start">
              <Box flex="1 1 220px">
                <Text fontSize="13px" color="text.muted" mb={1.5}>Wad/Jabatan *</Text>
                <Combobox.Root
                  collection={wardCollection}
                  value={selectedWardId}
                  onValueChange={handleWardChange}
                  positioning={{ sameWidth: true }}
                >
                  <Combobox.Control>
                    <Combobox.Input
                      placeholder="Cari wad/jabatan..."
                      css={comboboxInputCss}
                    />
                    <Combobox.Trigger />
                  </Combobox.Control>
                  <Combobox.Positioner>
                    <Combobox.Content bg="#1c1f22" borderColor="line" color="#e7eaee">
                      <Combobox.Empty>Tiada hasil</Combobox.Empty>
                      {wardCollection.items.map((w) => (
                        <Combobox.Item key={w.value} item={w}>
                          <Combobox.ItemText>{w.label}</Combobox.ItemText>
                          <Combobox.ItemIndicator />
                        </Combobox.Item>
                      ))}
                    </Combobox.Content>
                  </Combobox.Positioner>
                </Combobox.Root>
                {errors.ward && <Text fontSize="12px" color="bad" mt={1}>{errors.ward}</Text>}
              </Box>

              <Box flex="1 1 160px">
                <Text fontSize="13px" color="text.muted" mb={1.5}>Tarikh *</Text>
                <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} bg="#123a66" borderColor="rgba(79,135,255,0.12)" color="text" borderRadius="10px" size="sm" />
                {errors.date && <Text fontSize="12px" color="bad" mt={1}>{errors.date}</Text>}
              </Box>

              <Box flex="1 1 180px">
                <Text fontSize="13px" color="text.muted" mb={1.5}>No. Inden *</Text>
                <Input type="text" placeholder="Contoh: IND-2026-001" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} bg="#123a66" borderColor="rgba(79,135,255,0.12)" color="text" borderRadius="10px" size="sm" />
                {errors.number && <Text fontSize="12px" color="bad" mt={1}>{errors.number}</Text>}
              </Box>

              <Box flex="1 1 180px">
                <Text fontSize="13px" color="text.muted" mb={1.5}>Jenis *</Text>
                <Combobox.Root
                  collection={orderTypeCollection}
                  value={orderType}
                  onValueChange={(details) => setOrderType(details.value)}
                  positioning={{ sameWidth: true }}
                >
                  <Combobox.Control>
                    <Combobox.Input
                      placeholder="Pilih jenis..."
                      css={comboboxInputCss}
                    />
                    <Combobox.Trigger />
                  </Combobox.Control>
                  <Combobox.Positioner>
                    <Combobox.Content bg="#1c1f22" borderColor="line" color="#e7eaee">
                      <Combobox.Empty>Tiada hasil</Combobox.Empty>
                      {orderTypeCollection.items.map((item) => (
                        <Combobox.Item key={item.value} item={item}>
                          <Combobox.ItemText>{item.label}</Combobox.ItemText>
                          <Combobox.ItemIndicator />
                        </Combobox.Item>
                      ))}
                    </Combobox.Content>
                  </Combobox.Positioner>
                </Combobox.Root>
              </Box>

              <Box flex="1 1 140px">
                <Text fontSize="13px" color="text.muted" mb={1.5}>Masa Diterima</Text>
                <Input type="time" value={masaDiterima} onChange={(e) => setMasaDiterima(e.target.value)} bg="#123a66" borderColor="rgba(79,135,255,0.12)" color="text" borderRadius="10px" size="sm" />
              </Box>

              <Box flex="0 0 auto" pt={5}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#a3aab3" }}>
                  <input type="checkbox" checked={masaPejabat} onChange={(e) => setMasaPejabat(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#4f87ff" }} />
                  Masa Pejabat
                </label>
              </Box>
            </HStack>
          </VStack>
        </Box>

        <Box bg="bg.card" border="1px solid" borderColor="line" borderRadius="14px" p={5}>
          <Flex justifyContent="space-between" alignItems="center" mb={4}>
            <Heading fontSize="0.95rem" fontWeight={600}>
              <Flex alignItems="center" gap={2}><Package size={16} /> Item Pesanan</Flex>
            </Heading>
            <Button size="xs" bg="#4f87ff" color="white" borderRadius="8px" onClick={addRow} _hover={{ bg: "#3d6fcc" }}>
              <Plus size={14} /> Tambah Baris
            </Button>
          </Flex>

          {errors.items && (
            <Alert.Root status="error" borderRadius="10px" mb={4}>
              <Alert.Indicator><AlertTriangle size={16} /></Alert.Indicator>
              <Alert.Title>{errors.items}</Alert.Title>
            </Alert.Root>
          )}

          <Box overflowX="auto">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["#", "Item", "Kuantiti", "Had/Pesanan", "Kuota Bulanan", "Diguna", "Status", ""].map((header) => (
                    <th key={header} style={{ textAlign: header === "#" || header === "Status" ? "center" : "left", color: "#a3aab3", fontSize: 12, fontWeight: 600, padding: "8px", borderBottom: "1px solid rgba(231,234,238,0.10)" }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderRows.map((row, idx) => {
                  const cat = getCatalogInfo(row.item_id);
                  const pct = getUsagePct(row.item_id);
                  return (
                    <tr key={row.id}>
                      <td style={{ padding: "8px", borderBottom: "1px solid rgba(231,234,238,0.10)", fontSize: 13, textAlign: "center" }}>{idx + 1}</td>
                      <td style={{ padding: "8px", borderBottom: "1px solid rgba(231,234,238,0.10)", minWidth: 200 }}>
                        <Combobox.Root
                          collection={catalogCollection}
                          value={row.item_id ? [String(row.item_id)] : []}
                          onValueChange={(details) => {
                            const val = details.value[0];
                            updateRow(row.id, "item_id", val ? Number(val) : null);
                          }}
                          positioning={{ sameWidth: true }}
                        >
                          <Combobox.Control>
                            <Combobox.Input
                              placeholder="Cari item..."
                              css={{
                                bg: "#123a66",
                                borderColor: "rgba(79,135,255,0.12)",
                                color: "#e7eaee",
                                borderRadius: "8px",
                                fontSize: "12px",
                                padding: "4px 8px",
                                minWidth: "180px",
                              }}
                            />
                            <Combobox.Trigger />
                          </Combobox.Control>
                          <Combobox.Positioner>
                            <Combobox.Content bg="#1c1f22" borderColor="line" color="#e7eaee" maxH="260px" overflowY="auto">
                              <Combobox.Empty>Tiada item</Combobox.Empty>
                              {catalogCollection.items.map((c) => (
                                <Combobox.Item key={c.value} item={c}>
                                  <Combobox.ItemText>{c.label}</Combobox.ItemText>
                                  <Combobox.ItemIndicator />
                                </Combobox.Item>
                              ))}
                            </Combobox.Content>
                          </Combobox.Positioner>
                        </Combobox.Root>
                        {errors[`item_${row.id}`] && <Text fontSize="11px" color="bad" mt={0.5}>{errors[`item_${row.id}`]}</Text>}
                      </td>
                      <td style={{ padding: "8px", borderBottom: "1px solid rgba(231,234,238,0.10)" }}>
                        <Input type="number" min={1} value={row.quantity} onChange={(e) => updateRow(row.id, "quantity", parseInt(e.target.value) || 0)} bg="#123a66" borderColor="rgba(79,135,255,0.12)" color="text" borderRadius="8px" size="xs" w="70px" />
                        {errors[`qty_${row.id}`] && <Text fontSize="11px" color="bad" mt={0.5}>{errors[`qty_${row.id}`]}</Text>}
                      </td>
                      <td style={{ padding: "8px", borderBottom: "1px solid rgba(231,234,238,0.10)", fontSize: 13 }}>{cat ? cat.max_per_order : "—"}</td>
                      <td style={{ padding: "8px", borderBottom: "1px solid rgba(231,234,238,0.10)", fontSize: 13 }}>{cat ? cat.monthly_quota : "—"}</td>
                      <td style={{ padding: "8px", borderBottom: "1px solid rgba(231,234,238,0.10)", fontSize: 13 }}>{cat ? `${cat.month_used} / ${cat.monthly_quota}` : "—"}</td>
                      <td style={{ padding: "8px", borderBottom: "1px solid rgba(231,234,238,0.10)", textAlign: "center" }}>
                        {pct !== null ? (
                          <Badge colorPalette={getUsageBadgeColor(pct)} size="sm" borderRadius="full">{pct}%</Badge>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "8px", borderBottom: "1px solid rgba(231,234,238,0.10)", textAlign: "center" }}>
                        {orderRows.length > 1 && (
                          <IconButton aria-label="Padam" size="xs" bg="transparent" color="bad" _hover={{ bg: "rgba(239,83,80,0.1)" }} onClick={() => removeRow(row.id)}>
                            <Trash2 size={14} />
                          </IconButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
        </Box>

        <Flex justifyContent="flex-end">
          <Button bg="#4f87ff" color="white" borderRadius="10px" px={6} onClick={handleSubmit} disabled={submitting} _hover={{ bg: "#3d6fcc" }}>
            <Send size={16} /> {submitting ? "Menghantar..." : "Hantar Pesanan"}
          </Button>
        </Flex>
      </VStack>
    </AppShell>
  );
}
