"use client";

import { useState, useEffect } from "react";
import {
  Stack,
  Group,
  Paper,
  Text,
  Badge,
  Title,
  Flex,
  Button,
  PasswordInput,
  Alert,
  ThemeIcon,
  SimpleGrid,
  Box,
} from "@mantine/core";
import {
  IconShield,
  IconShieldCheck,
  IconDatabase,
  IconSettings,
  IconLogout,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import AppShell from "@/components/AppShell";

interface MaintenanceData {
  config: {
    auto_backup: boolean;
    backup_interval_hours: number;
    retention_days: number;
  };
  sizes: {
    wards: number;
    items: number;
    orders: number;
    catalog: number;
  };
  nextBackup: string;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [data, setData] = useState<MaintenanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  function getAuthHeaders(): Record<string, string> {
    const stored = localStorage.getItem("admin_password");
    return stored ? { "x-admin-password": stored } : {};
  }

  useEffect(() => {
    const stored = localStorage.getItem("admin_password");
    if (stored) {
      validatePassword(stored, true);
    }
  }, []);

  async function validatePassword(pwd: string, silent = false) {
    if (!silent) setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/admin/maintenance", {
        headers: { "x-admin-password": pwd },
      });
      if (res.ok) {
        localStorage.setItem("admin_password", pwd);
        setAuthenticated(true);
        const result = await res.json();
        setData(result);
      } else {
        if (!silent) setLoginError("Kata laluan tidak sah");
      }
    } catch {
      if (!silent) setLoginError("Ralat sambungan");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogin() {
    if (!passwordInput.trim()) {
      setLoginError("Sila masukkan kata laluan");
      return;
    }
    validatePassword(passwordInput.trim());
  }

  function handleLogout() {
    localStorage.removeItem("admin_password");
    setAuthenticated(false);
    setPasswordInput("");
    setData(null);
    setDataError("");
    setPasswordMsg("");
  }

  async function fetchData() {
    setLoading(true);
    setDataError("");
    try {
      const res = await fetch("/api/admin/maintenance", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 403) {
          handleLogout();
          return;
        }
        const err = await res.json();
        setDataError(err.error || "Ralat memuat data");
        return;
      }
      setData(await res.json());
    } catch {
      setDataError("Ralat sambungan");
    } finally {
      setLoading(false);
    }
  }

  async function changePassword() {
    if (!newPassword.trim()) {
      setPasswordMsg("Sila masukkan kata laluan baru");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg("Kata laluan tidak sepadan");
      return;
    }
    setPasswordSaving(true);
    setPasswordMsg("");
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ...data?.config,
        }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          handleLogout();
          return;
        }
        const err = await res.json();
        setPasswordMsg(err.error || "Ralat menyimpan");
        return;
      }
      localStorage.setItem("admin_password", newPassword.trim());
      setPasswordMsg("Kata laluan berjaya dikemaskini");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordMsg("Ralat sambungan");
    } finally {
      setPasswordSaving(false);
    }
  }

  if (!authenticated) {
    return (
      <AppShell>
        <Stack gap="lg" maw={480} mx="auto">
          <Group gap="sm" justify="center">
            <IconShield size={24} color="#4f87ff" />
            <Title order={2}>Pentadbiran</Title>
          </Group>

          <Paper shadow="sm" p="xl" radius="md">
            <Stack gap="md">
              <Stack align="center" gap="xs">
                <ThemeIcon size={56} variant="light" color="blue">
                  <IconShieldCheck size={32} />
                </ThemeIcon>
                <Text fw={600}>Kata Laluan Pentadbir</Text>
                <Text size="sm" c="dimmed">Masukkan kata laluan pentadbir untuk meneruskan.</Text>
              </Stack>

              {loginError && (
                <Alert color="red" variant="light">
                  {loginError}
                </Alert>
              )}

              <PasswordInput
                label="Kata Laluan"
                placeholder="Masukkan kata laluan..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />

              <Button
                fullWidth
                onClick={handleLogin}
                loading={loginLoading}
                leftSection={<IconShieldCheck size={16} />}
              >
                {loginLoading ? "Memeriksa..." : "Log Masuk"}
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Stack gap="lg">
        <Flex justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="green">
              <IconShieldCheck size={22} />
            </ThemeIcon>
            <Title order={2}>Pentadbiran</Title>
            <Badge color="green" variant="light">
              Disahkan
            </Badge>
          </Group>
          <Button
            size="sm"
            variant="light"
            color="red"
            leftSection={<IconLogout size={14} />}
            onClick={handleLogout}
          >
            Log Keluar
          </Button>
        </Flex>

        {dataError && (
          <Alert color="red" variant="light">
            {dataError}
          </Alert>
        )}

        <Group gap="md" mb="sm">
          <Button
            size="sm"
            variant="light"
            color="blue"
            leftSection={<IconDatabase size={14} />}
            onClick={fetchData}
            loading={loading}
          >
            Muat Semula Data
          </Button>
        </Group>

        <Paper shadow="sm" p="md" radius="md">
          <Group gap="sm" mb="md">
            <IconDatabase size={18} color="#4f87ff" />
            <Title order={4}>Status Pangkalan Data</Title>
          </Group>
          {loading && !data ? (
            <Text size="sm" c="dimmed">Memuat data...</Text>
          ) : data ? (
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
              {[
                { label: "Wad/Jabatan", count: data.sizes.wards },
                { label: "Item/Ubat", count: data.sizes.items },
                { label: "Pesanan", count: data.sizes.orders },
                { label: "Katalog", count: data.sizes.catalog },
              ].map((s) => (
                <Paper key={s.label} p="md" radius="md" withBorder>
                  <Text size="sm" c="dimmed" mb={4}>{s.label}</Text>
                  <Text size="xl" fw={700}>{s.count.toLocaleString()}</Text>
                </Paper>
              ))}
            </SimpleGrid>
          ) : (
            <Text size="sm" c="dimmed">Tekan &quot;Muat Semula Data&quot; untuk memaparkan statistik.</Text>
          )}
        </Paper>

        <Paper shadow="sm" p="md" radius="md">
          <Group gap="sm" mb="md">
            <IconSettings size={18} color="#4f87ff" />
            <Title order={4}>Tetapan Penyelenggaraan</Title>
          </Group>

          <Stack gap="md">
            {data && (
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <Paper p="md" radius="md" withBorder>
                  <Text size="xs" c="dimmed">Sandaran Auto</Text>
                  <Badge
                    color={data.config.auto_backup ? "green" : "gray"}
                    variant="light"
                    mt={4}
                  >
                    {data.config.auto_backup ? "Aktif" : "Nyahaktif"}
                  </Badge>
                </Paper>
                <Paper p="md" radius="md" withBorder>
                  <Text size="xs" c="dimmed">Selang Sandaran</Text>
                  <Text fw={600} mt={4}>{data.config.backup_interval_hours} jam</Text>
                </Paper>
                <Paper p="md" radius="md" withBorder>
                  <Text size="xs" c="dimmed">Pengekalan</Text>
                  <Text fw={600} mt={4}>{data.config.retention_days} hari</Text>
                </Paper>
              </SimpleGrid>
            )}

            <Paper p="md" radius="md" withBorder>
              <Text fw={600} mb="md">Tukar Kata Laluan Pentadbir</Text>
              {passwordMsg && (
                <Alert
                  color={passwordMsg.includes("berjaya") ? "green" : "red"}
                  variant="light"
                  mb="md"
                >
                  {passwordMsg}
                </Alert>
              )}
              <Stack gap="sm" maw={400}>
                <PasswordInput
                  label="Kata Laluan Baru"
                  placeholder="Kata laluan baru..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.currentTarget.value)}
                />
                <PasswordInput
                  label="Sahkan Kata Laluan"
                  placeholder="Sahkan kata laluan..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && changePassword()}
                />
                <Box>
                  <Button
                    size="sm"
                    leftSection={<IconSettings size={14} />}
                    onClick={changePassword}
                    loading={passwordSaving}
                  >
                    Kemaskini Kata Laluan
                  </Button>
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </Paper>

        <Paper shadow="sm" p="md" radius="md">
          <Group gap="sm" mb="md">
            <IconDeviceFloppy size={18} color="#4f87ff" />
            <Title order={4}>Pengurusan Sandaran</Title>
          </Group>
          <Paper p="md" radius="md" withBorder>
            <Stack gap="md">
              <Text size="sm">
                Sistem ini menggunakan MongoDB Atlas sebagai pangkalan data. MongoDB Atlas menyediakan sandaran automatik yang terbina dalam:
              </Text>
              <Stack gap="xs" ml="md">
                <Group gap="sm">
                  <Badge color="green" variant="light">Aktif</Badge>
                  <Text size="sm" c="dimmed">Sandaran Harian - Atlas M10+</Text>
                </Group>
                <Group gap="sm">
                  <Badge color="blue" variant="light">Terbina Dalam</Badge>
                  <Text size="sm" c="dimmed">Point-in-time recovery tersedia</Text>
                </Group>
                <Group gap="sm">
                  <Badge color="yellow" variant="light">Manual</Badge>
                  <Text size="sm" c="dimmed">Pulihan boleh dilakukan melalui MongoDB Atlas Console</Text>
                </Group>
              </Stack>
              {data && (
                <Text size="xs" c="dimmed">
                  Sandaran seterusnya: {new Date(data.nextBackup).toLocaleString("ms-MY")}
                </Text>
              )}
            </Stack>
          </Paper>
        </Paper>
      </Stack>
    </AppShell>
  );
}
