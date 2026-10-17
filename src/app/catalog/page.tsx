"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Stack,
  Group,
  TextInput,
  NumberInput,
  Button,
  Text,
  Badge,
  ActionIcon,
  Box,
  Title,
  Alert,
  Table,
  TableScrollContainer,
  Select,
  Loader,
  Paper,
  Switch,
} from "@mantine/core";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconBook2,
  IconDeviceFloppy,
  IconX,
  IconAlertTriangle,
  IconBuildingHospital,
  IconSearch,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import AppShell from "@/components/AppShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { CatalogItem, Item, Ward } from "@/lib/types";

export default function CatalogPage() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [selectedWard, setSelectedWard] = useState("");
  const [currentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [wardName, setWardName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [editMax, setEditMax] = useState(0);
  const [editQuota, setEditQuota] = useState(0);
  const [editHasQuota, setEditHasQuota] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [addItemId, setAddItemId] = useState("");
  const [addMax, setAddMax] = useState(10);
  const [addQuota, setAddQuota] = useState(0);
  const [addHasQuota, setAddHasQuota] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Pending destructive action, confirmed via ConfirmDialog instead of
  // native window.confirm().
  const [pendingDelete, setPendingDelete] = useState<CatalogItem | null>(null);

  useEffect(() => {
    fetch("/api/wards")
      .then((res) => res.json())
      .then(setWards)
      .catch(() => {});
    fetch("/api/items")
      .then((res) => res.json())
      .then(setAllItems)
      .catch(() => {});
  }, []);

  // Monotonic token so a slow response for the previously selected ward can't
  // overwrite the catalog (and ward name) of the one selected now.
  const catalogSeq = useRef(0);

  const fetchCatalog = useCallback(async () => {
    if (!selectedWard) return;
    const seq = ++catalogSeq.current;
    const stale = () => seq !== catalogSeq.current;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/catalog/${selectedWard}?month=${currentMonth}`);
      const data = await res.json();
      if (stale()) return;
      if (!res.ok) {
        setError(data.error || "Ralat memuatkan katalog");
        return;
      }
      setWardName(data.ward || "");
      setCatalogItems(data.items || []);
    } catch {
      if (stale()) return;
      setError("Ralat sambungan");
    } finally {
      if (!stale()) setLoading(false);
    }
  }, [selectedWard, currentMonth]);

  useEffect(() => {
    if (!selectedWard) return;
    // Defer to a microtask so the fetcher's synchronous setLoading(true) does
    // not run inside the effect body (react-hooks/set-state-in-effect).
    Promise.resolve().then(() => fetchCatalog());
  }, [selectedWard, currentMonth, fetchCatalog]);

  const availableItems = useMemo(() => {
    const inCatalog = new Set(catalogItems.map((ci) => ci.item_id));
    return allItems.filter((i) => !inCatalog.has(i.id));
  }, [allItems, catalogItems]);

  const filteredCatalogItems = useMemo(() => {
    if (!searchQuery.trim()) return catalogItems;
    const q = searchQuery.toLowerCase();
    return catalogItems.filter((ci) => ci.item_name.toLowerCase().includes(q));
  }, [catalogItems, searchQuery]);

  function getUsageColor(used: number, quota: number): "red" | "yellow" | "green" | "gray" {
    if (quota === 0) return "gray";
    const pct = (used / quota) * 100;
    if (pct >= 100) return "red";
    if (pct >= 80) return "yellow";
    return "green";
  }

  function startEdit(ci: CatalogItem) {
    setEditingKey(ci.item_id);
    setEditMax(ci.max_per_order);
    setEditQuota(ci.monthly_quota ?? 0);
    setEditHasQuota(ci.monthly_quota != null && ci.monthly_quota > 0);
    setError("");
  }

  function cancelEdit() {
    setEditingKey(null);
    setError("");
  }

  async function saveEdit(ci: CatalogItem) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/catalog/${ci.ward_id}/items/${ci.item_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_per_order: editMax, monthly_quota: editHasQuota ? editQuota : null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ralat menyimpan");
        return;
      }
      setCatalogItems((prev) =>
        prev.map((c) =>
          c.item_id === ci.item_id
            ? {
                ...c,
                max_per_order: editMax,
                // Match the server's stored value: without a quota it keeps
                // null, not 0, so later rendering paths (hasQuota) agree.
                monthly_quota: editHasQuota ? editQuota : null,
              }
            : c
        )
      );
      notifications.show({ message: "Item katalog dikemaskini", color: "green" });
      cancelEdit();
    } catch {
      setError("Ralat sambungan");
    } finally {
      setSaving(false);
    }
  }

  async function addToCatalog() {
    if (!selectedWard || !addItemId) {
      setError("Pilih item terlebih dahulu");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/catalog/${selectedWard}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: Number(addItemId),
          max_per_order: addMax,
          monthly_quota: addHasQuota ? addQuota : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ralat menyimpan");
        return;
      }
      notifications.show({ message: "Item ditambah ke katalog", color: "green" });
      setShowAdd(false);
      setAddItemId("");
      setAddMax(10);
      setAddQuota(0);
      setAddHasQuota(false);
      fetchCatalog();
    } catch {
      setError("Ralat sambungan");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCatalogItem(ci: CatalogItem) {
    setPendingDelete(null);
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/catalog/${ci.ward_id}/items/${ci.item_id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ralat memadam");
        return;
      }
      setCatalogItems((prev) => prev.filter((c) => c.item_id !== ci.item_id));
      notifications.show({ message: "Item dipadam daripada katalog", color: "red" });
    } catch {
      setError("Ralat sambungan");
    } finally {
      setSaving(false);
    }
  }

  // Mantine Select values must be strings; the underlying ids are numbers.
  const wardSelectData = wards.map((w) => ({ value: String(w.id), label: w.name }));
  const itemSelectData = availableItems.map((i) => ({ value: String(i.id), label: i.name }));

  return (
    <AppShell>
      <Stack gap="md">
        <Paper>
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <IconBook2 size={18} color="var(--mantine-color-gray-5)" />
              <Title order={3}>Katalog Wad/Jabatan</Title>
            </Group>
          </Group>
        </Paper>

        {error && (
          <Alert color="red" variant="light" title="Ralat">
            {error}
          </Alert>
        )}

        <Group wrap="wrap" gap="md">
          <Select
            label="Pilih Wad/Jabatan"
            placeholder="-- Pilih Wad/Jabatan --"
            leftSection={<IconBuildingHospital size={16} />}
            data={wardSelectData}
            value={selectedWard}
            onChange={(val) => {
              setSelectedWard(val || "");
              setShowAdd(false);
              setError("");
              // Reset the previous ward's state: a staged inline edit must not
              // be saved into the newly selected ward, and its rows/name must
              // not stay on screen while the new catalog loads.
              setEditingKey(null);
              setEditMax(0);
              setEditQuota(0);
              setEditHasQuota(false);
              setPendingDelete(null);
              setWardName("");
              setCatalogItems([]);
            }}
            searchable
            clearable
            maw={300}
          />
          {selectedWard && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setShowAdd(!showAdd);
                setError("");
              }}
              mt="xl"
            >
              Tambah Item
            </Button>
          )}
        </Group>

        {selectedWard && wardName && (
          <Text size="sm" c="dimmed">
            Wad/Jabatan: <Text component="span" fw={600} c="var(--mantine-color-text)">{wardName}</Text>
          </Text>
        )}

        {showAdd && selectedWard && (
          <Alert variant="light" color="blue" title="Tambah Item ke Katalog">
            <Stack gap="sm">
              <Select
                label="Item"
                placeholder="-- Pilih Item --"
                data={itemSelectData}
                value={addItemId}
                onChange={(val) => setAddItemId(val || "")}
                searchable
              />
              {availableItems.length === 0 && (
                <Text size="xs" c="dimmed">
                  Semua item telah ditambah ke katalog ini.
                </Text>
              )}
              <Group wrap="wrap" gap="md">
                <NumberInput
                  label="Max/Order (0 = tiada had)"
                  value={addMax}
                  onChange={(val) => setAddMax(typeof val === "number" ? val : 0)}
                  min={0}
                  w={180}
                />
              </Group>
              <Switch
                label="Tetapkan kuota bulanan"
                checked={addHasQuota}
                onChange={(event) => setAddHasQuota(event.currentTarget.checked)}
              />
              {addHasQuota && (
                <NumberInput
                  label="Kuota Bulanan"
                  value={addQuota}
                  onChange={(val) => setAddQuota(typeof val === "number" ? val : 0)}
                  min={1}
                  w={160}
                />
              )}
              <Group justify="flex-end" gap="sm">
                <Button
                  variant="subtle"
                  color="gray"
                  leftSection={<IconX size={14} />}
                  onClick={() => { setShowAdd(false); setError(""); }}
                >
                  Batal
                </Button>
                <Button
                  leftSection={<IconDeviceFloppy size={14} />}
                  onClick={addToCatalog}
                  loading={saving}
                  disabled={!addItemId}
                >
                  Simpan
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}

        {selectedWard && catalogItems.length > 0 && (
          <TextInput
            placeholder="Cari item..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            maw={300}
            size="sm"
          />
        )}

        {selectedWard && (
          <TableScrollContainer minWidth={600}>
            {loading ? (
              <Box py="xl" ta="center">
                <Stack align="center" gap="xs">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">Memuatkan katalog...</Text>
                </Stack>
              </Box>
            ) : catalogItems.length === 0 ? (
              <Stack align="center" gap="xs" py="md" c="dimmed">
                <IconAlertTriangle size={20} />
                <Text size="sm" ta="center">
                  Tiada item dalam katalog wad/jabatan ini. Klik &quot;Tambah Item&quot; untuk menambah item.
                </Text>
              </Stack>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Item</Table.Th>
                    <Table.Th>Maks/Order</Table.Th>
                    <Table.Th>Kuota Bulanan</Table.Th>
                    <Table.Th>Digunakan</Table.Th>
                    <Table.Th>Baki</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Aksi</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredCatalogItems.length === 0 && catalogItems.length > 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Text size="sm" ta="center" c="dimmed" py="xs">
                          Tiada item ditemui untuk &quot;{searchQuery}&quot;
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    filteredCatalogItems.map((ci) => {
                      const used = ci.month_used || 0;
                    const hasQuota = ci.monthly_quota != null && ci.monthly_quota > 0;
                    const baki = hasQuota ? (ci.monthly_quota as number) - used : null;
                    const usageColor = getUsageColor(used, hasQuota ? (ci.monthly_quota as number) : 0);
                    const editKey = ci.item_id;

                    return (
                      <Table.Tr key={editKey}>
                        <Table.Td fw={500}>{ci.item_name}</Table.Td>
                        <Table.Td>
                          {editingKey === editKey ? (
                            <NumberInput
                              size="xs"
                              value={editMax}
                              onChange={(val) => setEditMax(typeof val === "number" ? val : 0)}
                              min={0}
                              w={100}
                            />
                          ) : (
                            <Text className="mono" size="sm">{ci.max_per_order > 0 ? ci.max_per_order : "—"}</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {editingKey === editKey ? (
                            <Stack gap="xs">
                              <Switch
                                size="xs"
                                checked={editHasQuota}
                                onChange={(event) => setEditHasQuota(event.currentTarget.checked)}
                              />
                              {editHasQuota && (
                                <NumberInput
                                  size="xs"
                                  value={editQuota}
                                  onChange={(val) => setEditQuota(typeof val === "number" ? val : 0)}
                                  min={1}
                                  w={100}
                                />
                              )}
                            </Stack>
                          ) : hasQuota ? (
                            <Text className="mono" size="sm">{ci.monthly_quota}</Text>
                          ) : (
                            <Text c="dimmed" size="sm">Tiada</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {hasQuota ? (
                            <Badge color={usageColor} variant="light">
                              <Text component="span" className="mono" size="xs">{used}</Text>
                            </Badge>
                          ) : (
                            <Text c="dimmed" size="sm">—</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {baki !== null ? (
                            <Text
                              className="mono"
                              fw={600}
                              c={baki < 0 ? "red" : baki === 0 ? "yellow" : "green"}
                            >
                              {baki}
                            </Text>
                          ) : (
                            <Text c="dimmed" size="sm">—</Text>
                          )}
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          {editingKey === editKey ? (
                            <Group justify="flex-end" gap="xs">
                              <ActionIcon
                                color="green"
                                variant="filled"
                                size="sm"
                                onClick={() => saveEdit(ci)}
                                loading={saving}
                              >
                                <IconDeviceFloppy size={14} />
                              </ActionIcon>
                              <ActionIcon
                                color="gray"
                                variant="subtle"
                                size="sm"
                                onClick={cancelEdit}
                              >
                                <IconX size={14} />
                              </ActionIcon>
                            </Group>
                          ) : (
                            <Group justify="flex-end" gap="xs">
                              <ActionIcon
                                color="blue"
                                variant="light"
                                size="sm"
                                onClick={() => startEdit(ci)}
                              >
                                <IconEdit size={14} />
                              </ActionIcon>
                              <ActionIcon
                                color="red"
                                variant="light"
                                size="sm"
                                onClick={() => setPendingDelete(ci)}
                                loading={saving}
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Group>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                    })
                  )}
                </Table.Tbody>
              </Table>
            )}
          </TableScrollContainer>
        )}

        {selectedWard && catalogItems.length > 0 && (
          <Text size="xs" c="dimmed">
            Jumlah: <Text component="span" className="mono" size="xs">{catalogItems.length}</Text> item dalam katalog
          </Text>
        )}
      </Stack>

      <ConfirmDialog
        opened={!!pendingDelete}
        message={`Padam "${pendingDelete?.item_name ?? ""}" daripada katalog?`}
        loading={saving}
        onConfirm={() => pendingDelete && deleteCatalogItem(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </AppShell>
  );
}
