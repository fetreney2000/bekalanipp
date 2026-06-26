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
import { Plus, Edit, Trash2, Search, Hospital, Save, X } from "lucide-react";
import AppShell from "@/components/AppShell";

interface Ward {
  id: string;
  name: string;
  category: string;
}

export default function WardsPage() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "category">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("ward");

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState("ward");

  const [saving, setSaving] = useState(false);

  async function fetchWards() {
    try {
      setLoading(true);
      const res = await fetch("/api/wards");
      if (!res.ok) throw new Error("Gagal memuat data");
      setWards(await res.json());
    } catch {
      setError("Ralat memuat senarai wad/jabatan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWards();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = wards.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.category === "ward" ? "wad" : "bukan wad").includes(q)
    );
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [wards, search, sortKey, sortDir]);

  function handleSort(key: "name" | "category") {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function startEdit(w: Ward) {
    setEditingId(w.id);
    setEditName(w.name);
    setEditCategory(w.category);
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditCategory("ward");
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
      const res = await fetch(`/api/wards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), category: editCategory }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ralat menyimpan");
        return;
      }
      setWards((prev) =>
        prev.map((w) =>
          w.id === id
            ? { ...w, name: data.name, category: data.category }
            : w
        )
      );
      cancelEdit();
    } catch {
      setError("Ralat sambungan");
    } finally {
      setSaving(false);
    }
  }

  async function addWard() {
    if (!addName.trim()) {
      setError("Nama tidak boleh kosong");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/wards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim(), category: addCategory }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ralat menyimpan");
        return;
      }
      setWards((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setAddName("");
      setAddCategory("ward");
      setShowAdd(false);
    } catch {
      setError("Ralat sambungan");
    } finally {
      setSaving(false);
    }
  }

  async function deleteWard(id: string, name: string) {
    if (!confirm(`Padam wad/jabatan "${name}"?`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/wards/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ralat memadam");
        return;
      }
      setWards((prev) => prev.filter((w) => w.id !== id));
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
            <Hospital size={22} color="#4f87ff" />
            <Heading size="lg">Urus Wad/Jabatan</Heading>
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
            Tambah Wad/Jabatan
          </Button>
        </Flex>

        {error && (
          <Box bg="rgba(239,83,80,0.12)" border="1px solid rgba(239,83,80,0.3)" borderRadius="10px" px={4} py={3}>
            <Text color="#ef5350" fontSize="sm">{error}</Text>
          </Box>
        )}

        {showAdd && (
          <Box bg="#1c1f22" border="1px solid rgba(231,234,238,0.10)" borderRadius="14px" p={4}>
            <Text fontWeight={600} mb={3}>Tambah Wad/Jabatan Baru</Text>
            <VStack align="stretch" gap={3}>
              <Box>
                <Text fontSize="sm" color="#a3aab3" mb={1}>Nama</Text>
                <Input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Nama wad/jabatan"
                  bg="#123a66"
                  border="1px solid rgba(79,135,255,0.12)"
                  color="#e7eaee"
                  _focus={{ borderColor: "#4f87ff", boxShadow: "0 6px 18px rgba(79,135,255,0.18)" }}
                  onKeyDown={(e) => e.key === "Enter" && addWard()}
                />
              </Box>
              <Box>
                <Text fontSize="sm" color="#a3aab3" mb={1}>Kategori</Text>
                <select
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid rgba(79,135,255,0.12)",
                    background: "#123a66",
                    color: "#e7eaee",
                    fontSize: "14px",
                    outline: "none",
                  }}
                >
                  <option value="ward">Wad</option>
                  <option value="not_ward">Bukan Wad</option>
                </select>
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
                  onClick={addWard}
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
            placeholder="Cari wad/jabatan..."
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
                <th
                  style={thStyle}
                  onClick={() => handleSort("name")}
                >
                  Nama {sortKey === "name" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th
                  style={thStyle}
                  onClick={() => handleSort("category")}
                >
                  Kategori {sortKey === "category" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th style={{ ...thStyle, textAlign: "right", cursor: "default" }}>
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#a3aab3" }}>
                    Memuat data...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#a3aab3" }}>
                    Tiada wad/jabatan ditemui
                  </td>
                </tr>
              ) : (
                filtered.map((w) => (
                  <tr key={w.id} style={{ transition: "background 0.2s" }}>
                    <td style={tdStyle}>
                      {editingId === w.id ? (
                        <Input
                          size="sm"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          bg="#123a66"
                          border="1px solid rgba(79,135,255,0.12)"
                          color="#e7eaee"
                          _focus={{ borderColor: "#4f87ff" }}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit(w.id)}
                        />
                      ) : (
                        <Text fontWeight={500}>{w.name}</Text>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {editingId === w.id ? (
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          style={{
                            padding: "6px 8px",
                            borderRadius: "10px",
                            border: "1px solid rgba(79,135,255,0.12)",
                            background: "#123a66",
                            color: "#e7eaee",
                            fontSize: "13px",
                            outline: "none",
                            width: "auto",
                          }}
                        >
                          <option value="ward">Wad</option>
                          <option value="not_ward">Bukan Wad</option>
                        </select>
                      ) : (
                        <Badge
                          bg={w.category === "ward" ? "rgba(76,175,80,0.15)" : "rgba(163,170,179,0.15)"}
                          color={w.category === "ward" ? "#4caf50" : "#a3aab3"}
                          border="1px solid"
                          borderColor={w.category === "ward" ? "rgba(76,175,80,0.3)" : "rgba(163,170,179,0.3)"}
                          px={2.5}
                          py={0.5}
                          borderRadius="999px"
                          fontSize="12px"
                          fontWeight={600}
                        >
                          {w.category === "ward" ? "Wad" : "Bukan Wad"}
                        </Badge>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {editingId === w.id ? (
                        <HStack justify="flex-end" gap={1}>
                          <IconButton
                            aria-label="Simpan"
                            size="sm"
                            bg="#4caf50"
                            color="white"
                            _hover={{ bg: "#43a047" }}
                            onClick={() => saveEdit(w.id)}
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
                            onClick={() => startEdit(w)}
                          >
                            <Edit size={14} />
                          </IconButton>
                          <IconButton
                            aria-label="Padam"
                            size="sm"
                            bg="rgba(239,83,80,0.12)"
                            color="#ef5350"
                            _hover={{ bg: "rgba(239,83,80,0.22)" }}
                            onClick={() => deleteWard(w.id, w.name)}
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
          Jumlah: {filtered.length} wad/jabatan
        </Text>
      </VStack>
    </AppShell>
  );
}
