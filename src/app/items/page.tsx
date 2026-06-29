"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Stack,
  Group,
  TextInput,
  Button,
  Text,
  ActionIcon,
  Flex,
  Title,
  Alert,
  Table,
  TableScrollContainer,
  Loader,
  Paper,
} from "@mantine/core";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconPill,
  IconDeviceFloppy,
  IconX,
  IconArrowsSort,
  IconAlertCircle,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
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
      if (!res.ok) throw new Error("Gagal memuatkan data");
      setItems(await res.json());
    } catch {
      setError("Ralat memuatkan senarai item");
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
      notifications.show({ message: "Item dikemaskini", color: "green" });
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
      notifications.show({ message: "Item ditambah", color: "green" });
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
      notifications.show({ message: "Item dipadam", color: "red" });
    } catch {
      setError("Ralat sambungan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <Stack gap="md">
        <Paper shadow="sm" p="sm" radius="md" withBorder>
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <IconPill size={18} color="var(--mantine-color-gray-5)" />
              <Title order={3} fw={700}>Urus Item/Ubat</Title>
            </Group>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setShowAdd(!showAdd);
                setError("");
              }}
            >
              Tambah Item
            </Button>
          </Group>
        </Paper>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" title="Ralat">
            {error}
          </Alert>
        )}

        {showAdd && (
          <Alert variant="light" color="blue" title="Tambah Item Baru">
            <Stack gap="sm">
              <TextInput
                label="Nama Item"
                placeholder="Nama item/ubat"
                value={addName}
                onChange={(e) => setAddName(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
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
                  onClick={addItem}
                  loading={saving}
                >
                  Simpan
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}

        <TextInput
          placeholder="Cari item/ubat..."
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
                  onClick={handleSort}
                >
                  <Group gap={4} style={{ flexWrap: "nowrap" }}>
                    Nama
                    <IconArrowsSort size={14} style={{ transform: sortDir === "desc" ? "scaleY(-1)" : undefined }} />
                  </Group>
                </Table.Th>
                <Table.Th style={{ textAlign: "right" }}>
                  Aksi
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                <Table.Tr>
                  <Table.Td colSpan={2}>
                    <Flex justify="center" py="md">
                      <Loader size="sm" />
                    </Flex>
                  </Table.Td>
                </Table.Tr>
              ) : filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={2}>
                    <Text c="dimmed" ta="center">Tiada item ditemui</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      {editingId === item.id ? (
                        <TextInput
                          size="xs"
                          value={editName}
                          onChange={(e) => setEditName(e.currentTarget.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit(item.id)}
                        />
                      ) : (
                        <Text fw={500}>{item.name}</Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      {editingId === item.id ? (
                        <Group justify="flex-end" gap="xs">
                          <ActionIcon
                            color="green"
                            variant="filled"
                            size="sm"
                            onClick={() => saveEdit(item.id)}
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
                            onClick={() => startEdit(item)}
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                          <ActionIcon
                            color="red"
                            variant="light"
                            size="sm"
                            onClick={() => deleteItem(item.id, item.name)}
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
          Jumlah: {filtered.length} item
        </Text>
      </Stack>
    </AppShell>
  );
}
