"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Text,
  IconButton,
  Flex,
  Heading,
} from "@chakra-ui/react";
import { Plus, Edit, Trash2, Search, Pill, Save, X } from "lucide-react";
import AppShell from "@/components/AppShell";

interface Item {
  id: string;
  name: string;
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");

  const [saving, setSaving] = useState(false);

  async function fetchItems() {
    try {
      setLoading(true);
      const res = await fetch("/api/items");
      if (!res.ok) throw new Error("Gagal memuat data");
      setItems(await res.json());
    } catch {
      setError("Ralat memuat senarai item");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = items.filter((i) => i.name.toLowerCase().includes(q));
    list.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [items, search, sortDir]);

  function handleSort() {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setEditName(item.name);
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setError("");
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) {
      setError("Nama tidak boleh kosong");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ralat menyimpan");
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, name: data.name } : i))
      );
      cancelEdit();
    } catch {
      setError("Ralat sambungan");
    } finally {
      setSaving(false);
    }
  }

  async function addItem() {
    if (!addName.trim()) {
      setError("Nama tidak boleh kosong");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ralat menyimpan");
        return;
      }
      setItems((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setAddName("");
      setShowAdd(false);
    } catch {
      setError("Ralat sambungan");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string, name: string) {
    if (!confirm(`Padam item "${name}"?`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ralat memadam");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
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
    cursor: "pointer",
    userSelect: "none",
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px",
    borderBottom: "1px solid rgba(231,234,238,0.10)",
    verticalAlign: "middle",
  };

  return (
    <AppShell>
      <VStack align="stretch" gap={5}>
        <Flex justify="space-between" align="center" flexWrap="wrap" gap={3}>
          <HStack gap={2}>
            <Pill size={22} color="#4f87ff" />
            <Heading size="lg">Urus Item/Ubat</Heading>
          </HStack>
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
        </Flex>

        {error && (
          <Box bg="rgba(239,83,80,0.12)" border="1px solid rgba(239,83,80,0.3)" borderRadius="10px" px={4} py={3}>
            <Text color="#ef5350" fontSize="sm">{error}</Text>
          </Box>
        )}

        {showAdd && (
          <Box bg="#1c1f22" border="1px solid rgba(231,234,238,0.10)" borderRadius="14px" p={4}>
            <Text fontWeight={600} mb={3}>Tambah Item Baru</Text>
            <VStack align="stretch" gap={3}>
              <Box>
                <Text fontSize="sm" color="#a3aab3" mb={1}>Nama Item</Text>
                <Input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Nama item/ubat"
                  bg="#123a66"
                  border="1px solid rgba(79,135,255,0.12)"
                  color="#e7eaee"
                  _focus={{ borderColor: "#4f87ff", boxShadow: "0 6px 18px rgba(79,135,255,0.18)" }}
                  onKeyDown={(e) => e.key === "Enter" && addItem()}
                />
              </Box>
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
                  onClick={addItem}
                  disabled={saving}
                >
                  <Save size={14} /> Simpan
                </Button>
              </HStack>
            </VStack>
          </Box>
        )}

        <Box position="relative">
          <Search size={16} color="#a3aab3" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <Input
            placeholder="Cari item/ubat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            pl={9}
            bg="#1c1f22"
            border="1px solid rgba(231,234,238,0.10)"
            color="#e7eaee"
            _focus={{ borderColor: "#4f87ff", boxShadow: "0 6px 18px rgba(79,135,255,0.18)" }}
            maxW="360px"
          />
        </Box>

        <Box overflowX="auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle} onClick={handleSort}>
                  Nama {sortDir === "asc" ? "▲" : "▼"}
                </th>
                <th style={{ ...thStyle, textAlign: "right", cursor: "default" }}>
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={2} style={{ ...tdStyle, textAlign: "center", color: "#a3aab3" }}>
                    Memuat data...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ ...tdStyle, textAlign: "center", color: "#a3aab3" }}>
                    Tiada item ditemui
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} style={{ transition: "background 0.2s" }}>
                    <td style={tdStyle}>
                      {editingId === item.id ? (
                        <Input
                          size="sm"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          bg="#123a66"
                          border="1px solid rgba(79,135,255,0.12)"
                          color="#e7eaee"
                          _focus={{ borderColor: "#4f87ff" }}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit(item.id)}
                        />
                      ) : (
                        <Text fontWeight={500}>{item.name}</Text>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {editingId === item.id ? (
                        <HStack justify="flex-end" gap={1}>
                          <IconButton
                            aria-label="Simpan"
                            size="sm"
                            bg="#4caf50"
                            color="white"
                            _hover={{ bg: "#43a047" }}
                            onClick={() => saveEdit(item.id)}
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
                            onClick={() => startEdit(item)}
                          >
                            <Edit size={14} />
                          </IconButton>
                          <IconButton
                            aria-label="Padam"
                            size="sm"
                            bg="rgba(239,83,80,0.12)"
                            color="#ef5350"
                            _hover={{ bg: "rgba(239,83,80,0.22)" }}
                            onClick={() => deleteItem(item.id, item.name)}
                            disabled={saving}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </HStack>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Box>

        <Text fontSize="12px" color="#a3aab3">
          Jumlah: {filtered.length} item
        </Text>
      </VStack>
    </AppShell>
  );
}
