"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Plus, Edit, Trash2, BookOpen, Save, X, AlertTriangle } from "lucide-react";
import AppShell from "@/components/AppShell";

interface Ward {
  id: string;
  name: string;
  category: string;
}

interface Item {
  id: string;
  name: string;
}

interface CatalogItem {
  ward_id: string;
  item_id: string;
  item_name: string;
  max_per_order: number;
  monthly_quota: number;
  month_used?: number;
}

export default function CatalogPage() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [selectedWard, setSelectedWard] = useState("");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [wardName, setWardName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editMax, setEditMax] = useState(0);
  const [editQuota, setEditQuota] = useState(0);

  const [showAdd, setShowAdd] = useState(false);
  const [addItemId, setAddItemId] = useState("");
  const [addMax, setAddMax] = useState(10);
  const [addQuota, setAddQuota] = useState(50);

  useEffect(() => {
    fetch("/api/wards")
      .then((r) => r.json())
      .then(setWards)
      .catch(() => {});
    fetch("/api/items")
      .then((r) => r.json())
      .then(setAllItems)
      .catch(() => {});
  }, []);

  async function fetchCatalog() {
    if (!selectedWard) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/catalog/${selectedWard}?month=${currentMonth}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ralat memuat katalog");
        return;
      }
      setWardName(data.ward || "");
      setCatalogItems(data.items || []);
    } catch {
      setError("Ralat sambungan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedWard) fetchCatalog();
  }, [selectedWard, currentMonth]);

  const availableItems = useMemo(() => {
    const inCatalog = new Set(catalogItems.map((ci) => ci.item_id));
    return allItems.filter((i) => !inCatalog.has(i.id));
  }, [allItems, catalogItems]);

  function getUsageColor(used: number, quota: number) {
    if (quota === 0) return { bg: "rgba(163,170,179,0.15)", color: "#a3aab3", border: "rgba(163,170,179,0.3)" };
    const pct = (used / quota) * 100;
    if (pct >= 100) return { bg: "rgba(239,83,80,0.15)", color: "#ef5350", border: "rgba(239,83,80,0.3)" };
    if (pct >= 80) return { bg: "rgba(240,173,78,0.15)", color: "#f0ad4e", border: "rgba(240,173,78,0.3)" };
    return { bg: "rgba(76,175,80,0.15)", color: "#4caf50", border: "rgba(76,175,80,0.3)" };
  }

  function startEdit(ci: CatalogItem) {
    setEditingKey(ci.item_id);
    setEditMax(ci.max_per_order);
    setEditQuota(ci.monthly_quota);
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
        body: JSON.stringify({ max_per_order: editMax, monthly_quota: editQuota }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ralat menyimpan");
        return;
      }
      setCatalogItems((prev) =>
        prev.map((c) =>
          c.item_id === ci.item_id
            ? { ...c, max_per_order: editMax, monthly_quota: editQuota }
            : c
        )
      );
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
          item_id: addItemId,
          max_per_order: addMax,
          monthly_quota: addQuota,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ralat menyimpan");
        return;
      }
      setShowAdd(false);
      setAddItemId("");
      setAddMax(10);
      setAddQuota(50);
      fetchCatalog();
    } catch {
      setError("Ralat sambungan");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCatalogItem(ci: CatalogItem) {
    if (!confirm(`Padam "${ci.item_name}" daripada katalog?`)) return;
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
    } catch {
      setError("Ralat sambungan");
    } finally {
      setSaving(false);
    }
  }

  const thStyle: React.CSSProperties = {
    color: "#a3aab3",
    fontWeight: 600,
    fontSize: "13px",
    padding: "10px",
    borderBottom: "1px solid rgba(231,234,238,0.10)",
    textAlign: "left",
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px",
    borderBottom: "1px solid rgba(231,234,238,0.10)",
    verticalAlign: "middle",
  };

  const selectStyle: React.CSSProperties = {
    padding: "6px 8px",
    borderRadius: "10px",
    border: "1px solid rgba(79,135,255,0.12)",
    background: "#123a66",
    color: "#e7eaee",
    fontSize: "13px",
    outline: "none",
    width: "100%",
  };

  return (
    <AppShell>
      <VStack align="stretch" gap={5}>
        <Flex justify="space-between" align="center" flexWrap="wrap" gap={3}>
          <HStack gap={2}>
            <BookOpen size={22} color="#4f87ff" />
            <Heading size="lg">Katalog Wad/Jabatan</Heading>
          </HStack>
        </Flex>

        {error && (
          <Box bg="rgba(239,83,80,0.12)" border="1px solid rgba(239,83,80,0.3)" borderRadius="10px" px={4} py={3}>
            <Text color="#ef5350" fontSize="sm">{error}</Text>
          </Box>
        )}

        <HStack flexWrap="wrap" gap={3}>
          <Box flex={1} minW="200px">
            <Text fontSize="sm" color="#a3aab3" mb={1}>Pilih Wad/Jabatan</Text>
            <select
              value={selectedWard}
              onChange={(e) => {
                setSelectedWard(e.target.value);
                setShowAdd(false);
                setError("");
              }}
              style={{
                ...selectStyle,
                background: "#1c1f22",
                border: "1px solid rgba(231,234,238,0.10)",
              }}
            >
              <option value="">-- Pilih Wad/Jabatan --</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Box>
          <Box minW="160px">
            <Text fontSize="sm" color="#a3aab3" mb={1}>Bulan</Text>
            <Input
              type="month"
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
              bg="#1c1f22"
              border="1px solid rgba(231,234,238,0.10)"
              color="#e7eaee"
              _focus={{ borderColor: "#4f87ff" }}
            />
          </Box>
          {selectedWard && (
            <Box alignSelf="flex-end">
              <Button
                size="sm"
                onClick={() => {
                  setShowAdd(!showAdd);
                  setError("");
                }}
                bg="#4f87ff"
                color="white"
                _hover={{ bg: "#3d6fcc" }}
              >
                <Plus size={16} />
                Tambah Item
              </Button>
            </Box>
          )}
        </HStack>

        {selectedWard && wardName && (
          <Text fontSize="sm" color="#a3aab3">
            Wad/Jabatan: <Text as="span" color="#e7eaee" fontWeight={600}>{wardName}</Text>
          </Text>
        )}

        {showAdd && selectedWard && (
          <Box bg="#1c1f22" border="1px solid rgba(231,234,238,0.10)" borderRadius="14px" p={4}>
            <Text fontWeight={600} mb={3}>Tambah Item ke Katalog</Text>
            <VStack align="stretch" gap={3}>
              <Box>
                <Text fontSize="sm" color="#a3aab3" mb={1}>Item</Text>
                <select
                  value={addItemId}
                  onChange={(e) => setAddItemId(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">-- Pilih Item --</option>
                  {availableItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                {availableItems.length === 0 && (
                  <Text fontSize="xs" color="#a3aab3" mt={1}>Semua item telah ditambah ke katalog ini.</Text>
                )}
              </Box>
              <HStack flexWrap="wrap" gap={3}>
                <Box flex={1} minW="140px">
                  <Text fontSize="sm" color="#a3aab3" mb={1}>Max/Order</Text>
                  <Input
                    type="number"
                    value={addMax}
                    onChange={(e) => setAddMax(parseInt(e.target.value) || 0)}
                    bg="#123a66"
                    border="1px solid rgba(79,135,255,0.12)"
                    color="#e7eaee"
                    _focus={{ borderColor: "#4f87ff" }}
                  />
                </Box>
                <Box flex={1} minW="140px">
                  <Text fontSize="sm" color="#a3aab3" mb={1}>Kuota Bulanan</Text>
                  <Input
                    type="number"
                    value={addQuota}
                    onChange={(e) => setAddQuota(parseInt(e.target.value) || 0)}
                    bg="#123a66"
                    border="1px solid rgba(79,135,255,0.12)"
                    color="#e7eaee"
                    _focus={{ borderColor: "#4f87ff" }}
                  />
                </Box>
              </HStack>
              <HStack justify="flex-end" gap={2}>
                <Button
                  size="sm"
                  bg="rgba(0,0,0,0.04)"
                  border="1px solid rgba(231,234,238,0.10)"
                  color="#a3aab3"
                  onClick={() => { setShowAdd(false); setError(""); }}
                >
                  <X size={14} /> Batal
                </Button>
                <Button
                  size="sm"
                  bg="#4f87ff"
                  color="white"
                  _hover={{ bg: "#3d6fcc" }}
                  onClick={addToCatalog}
                  disabled={saving || !addItemId}
                >
                  <Save size={14} /> Simpan
                </Button>
              </HStack>
            </VStack>
          </Box>
        )}

        {selectedWard && (
          <Box overflowX="auto">
            {loading ? (
              <Box textAlign="center" py={6} color="#a3aab3">Memuat data...</Box>
            ) : catalogItems.length === 0 ? (
              <Box textAlign="center" py={6} color="#a3aab3">
                <AlertTriangle size={20} style={{ margin: "0 auto 8px" }} />
                Tiada item dalam katalog wad/jabatan ini. Klik &quot;Tambah Item&quot; untuk menambah.
              </Box>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Item</th>
                    <th style={thStyle}>Maks/Order</th>
                    <th style={thStyle}>Kuota Bulanan</th>
                    <th style={thStyle}>Digunakan</th>
                    <th style={thStyle}>Baki</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogItems.map((ci) => {
                    const used = ci.month_used || 0;
                    const baki = ci.monthly_quota - used;
                    const colors = getUsageColor(used, ci.monthly_quota);
                    const editKey = ci.item_id;

                    return (
                      <tr key={editKey} style={{ transition: "background 0.2s" }}>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{ci.item_name}</td>
                        <td style={tdStyle}>
                          {editingKey === editKey ? (
                            <Input
                              size="sm"
                              type="number"
                              value={editMax}
                              onChange={(e) => setEditMax(parseInt(e.target.value) || 0)}
                              bg="#123a66"
                              border="1px solid rgba(79,135,255,0.12)"
                              color="#e7eaee"
                              _focus={{ borderColor: "#4f87ff" }}
                              w="100px"
                            />
                          ) : (
                            ci.max_per_order
                          )}
                        </td>
                        <td style={tdStyle}>
                          {editingKey === editKey ? (
                            <Input
                              size="sm"
                              type="number"
                              value={editQuota}
                              onChange={(e) => setEditQuota(parseInt(e.target.value) || 0)}
                              bg="#123a66"
                              border="1px solid rgba(79,135,255,0.12)"
                              color="#e7eaee"
                              _focus={{ borderColor: "#4f87ff" }}
                              w="100px"
                            />
                          ) : (
                            ci.monthly_quota
                          )}
                        </td>
                        <td style={tdStyle}>
                          <Badge
                            bg={colors.bg}
                            color={colors.color}
                            border="1px solid"
                            borderColor={colors.border}
                            px={2.5}
                            py={0.5}
                            borderRadius="999px"
                            fontSize="12px"
                            fontWeight={600}
                          >
                            {used}
                          </Badge>
                        </td>
                        <td style={tdStyle}>
                          <Text
                            fontWeight={600}
                            color={baki < 0 ? "#ef5350" : baki === 0 ? "#f0ad4e" : "#4caf50"}
                          >
                            {baki}
                          </Text>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {editingKey === editKey ? (
                            <HStack justify="flex-end" gap={1}>
                              <IconButton
                                aria-label="Simpan"
                                size="sm"
                                bg="#4caf50"
                                color="white"
                                _hover={{ bg: "#43a047" }}
                                onClick={() => saveEdit(ci)}
                                disabled={saving}
                              >
                                <Save size={14} />
                              </IconButton>
                              <IconButton
                                aria-label="Batal"
                                size="sm"
                                bg="rgba(0,0,0,0.04)"
                                border="1px solid rgba(231,234,238,0.10)"
                                color="#a3aab3"
                                _hover={{ bg: "rgba(0,0,0,0.08)" }}
                                onClick={cancelEdit}
                              >
                                <X size={14} />
                              </IconButton>
                            </HStack>
                          ) : (
                            <HStack justify="flex-end" gap={1}>
                              <IconButton
                                aria-label="Edit"
                                size="sm"
                                bg="rgba(79,135,255,0.12)"
                                color="#4f87ff"
                                _hover={{ bg: "rgba(79,135,255,0.22)" }}
                                onClick={() => startEdit(ci)}
                              >
                                <Edit size={14} />
                              </IconButton>
                              <IconButton
                                aria-label="Padam"
                                size="sm"
                                bg="rgba(239,83,80,0.12)"
                                color="#ef5350"
                                _hover={{ bg: "rgba(239,83,80,0.22)" }}
                                onClick={() => deleteCatalogItem(ci)}
                                disabled={saving}
                              >
                                <Trash2 size={14} />
                              </IconButton>
                            </HStack>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Box>
        )}

        {selectedWard && catalogItems.length > 0 && (
          <Text fontSize="12px" color="#a3aab3">
            Jumlah: {catalogItems.length} item dalam katalog
          </Text>
        )}
      </VStack>
    </AppShell>
  );
}
