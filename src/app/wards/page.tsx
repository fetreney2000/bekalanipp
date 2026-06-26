"use client";

import { useState, useEffect, useMemo } from "react";
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
  Alert,
  Table,
  TableScrollContainer,
  Select,
} from "@mantine/core";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconHospital,
  IconDeviceFloppy,
  IconX,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
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
      notifications.show({ message: "Wad/jabatan dikemaskini", color: "green" });
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
      notifications.show({ message: "Wad/jabatan ditambah", color: "green" });
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
      notifications.show({ message: "Wad/jabatan dipadam", color: "red" });
    } catch {
      setError("Ralat sambungan");
    } finally {
      setSaving(false);
    }
  }

  const categoryOptions = [
    { value: "ward", label: "Wad" },
    { value: "not_ward", label: "Bukan Wad" },
  ];

  return (
    <AppShell>
      <Stack gap="md">
        <Flex justify="space-between" align="center" wrap="wrap" gap="sm">
          <Group gap="sm">
            <IconHospital size={22} color="var(--mantine-color-blue-6)" />
            <Title order={3}>Urus Wad/Jabatan</Title>
          </Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setShowAdd(!showAdd);
              setError("");
            }}
          >
            Tambah Wad/Jabatan
          </Button>
        </Flex>

        {error && (
          <Alert color="red" variant="light" title="Ralat">
            {error}
          </Alert>
        )}

        {showAdd && (
          <Alert variant="light" color="blue" title="Tambah Wad/Jabatan Baru">
            <Stack gap="sm">
              <TextInput
                label="Nama"
                placeholder="Nama wad/jabatan"
                value={addName}
                onChange={(e) => setAddName(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && addWard()}
              />
              <Select
                label="Kategori"
                data={categoryOptions}
                value={addCategory}
                onChange={(val) => setAddCategory(val || "ward")}
              />
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
                  onClick={addWard}
                  loading={saving}
                >
                  Simpan
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}

        <TextInput
          placeholder="Cari wad/jabatan..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          maw={360}
        />

        <TableScrollContainer minWidth={500}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th
                  style={{ cursor: "pointer", userSelect: "none" }}
                  onClick={() => handleSort("name")}
                >
                  Nama {sortKey === "name" && (sortDir === "asc" ? "▲" : "▼")}
                </Table.Th>
                <Table.Th
                  style={{ cursor: "pointer", userSelect: "none" }}
                  onClick={() => handleSort("category")}
                >
                  Kategori {sortKey === "category" && (sortDir === "asc" ? "▲" : "▼")}
                </Table.Th>
                <Table.Th style={{ textAlign: "right" }}>
                  Aksi
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                <Table.Tr>
                  <Table.Td colSpan={3}>
                    <Text c="dimmed" ta="center">Memuat data...</Text>
                  </Table.Td>
                </Table.Tr>
              ) : filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={3}>
                    <Text c="dimmed" ta="center">Tiada wad/jabatan ditemui</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((w) => (
                  <Table.Tr key={w.id}>
                    <Table.Td>
                      {editingId === w.id ? (
                        <TextInput
                          size="xs"
                          value={editName}
                          onChange={(e) => setEditName(e.currentTarget.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit(w.id)}
                        />
                      ) : (
                        <Text fw={500}>{w.name}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {editingId === w.id ? (
                        <Select
                          size="xs"
                          data={categoryOptions}
                          value={editCategory}
                          onChange={(val) => setEditCategory(val || "ward")}
                        />
                      ) : (
                        <Badge
                          color={w.category === "ward" ? "green" : "gray"}
                          variant="light"
                        >
                          {w.category === "ward" ? "Wad" : "Bukan Wad"}
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      {editingId === w.id ? (
                        <Group justify="flex-end" gap="xs">
                          <ActionIcon
                            color="green"
                            variant="filled"
                            size="sm"
                            onClick={() => saveEdit(w.id)}
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
                            onClick={() => startEdit(w)}
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                          <ActionIcon
                            color="red"
                            variant="light"
                            size="sm"
                            onClick={() => deleteWard(w.id, w.name)}
                            loading={saving}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </TableScrollContainer>

        <Text size="xs" c="dimmed">
          Jumlah: {filtered.length} wad/jabatan
        </Text>
      </Stack>
    </AppShell>
  );
}
