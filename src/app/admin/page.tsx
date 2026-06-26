"use client";

import { useState, useEffect } from "react";
import {
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Text,
  Badge,
  Heading,
  Flex,
} from "@chakra-ui/react";
import { Shield, ShieldCheck, Database, Settings, LogOut, HardDrive } from "lucide-react";
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
        <VStack align="stretch" gap={5} maxW="480px" mx="auto">
          <HStack gap={2} justify="center">
            <Shield size={24} color="#4f87ff" />
            <Heading size="lg">Pentadbiran</Heading>
          </HStack>

          <Box
            bg="#1c1f22"
            border="1px solid rgba(231,234,238,0.10)"
            borderRadius="14px"
            p={6}
          >
            <VStack align="stretch" gap={4}>
              <Box textAlign="center">
                <ShieldCheck size={40} color="#4f87ff" style={{ margin: "0 auto 12px" }} />
                <Text fontWeight={600} mb={1}>Kata Laluan Pentadbir</Text>
                <Text fontSize="sm" color="#a3aab3">Masukkan kata laluan pentadbir untuk meneruskan.</Text>
              </Box>

              {loginError && (
                <Box bg="rgba(239,83,80,0.12)" border="1px solid rgba(239,83,80,0.3)" borderRadius="10px" px={4} py={3}>
                  <Text color="#ef5350" fontSize="sm">{loginError}</Text>
                </Box>
              )}

              <Box>
                <Text fontSize="sm" color="#a3aab3" mb={1}>Kata Laluan</Text>
                <Input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Masukkan kata laluan..."
                  bg="#123a66"
                  border="1px solid rgba(79,135,255,0.12)"
                  color="#e7eaee"
                  _focus={{ borderColor: "#4f87ff", boxShadow: "0 6px 18px rgba(79,135,255,0.18)" }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </Box>

              <Button
                bg="#4f87ff"
                color="white"
                _hover={{ bg: "#3d6fcc" }}
                onClick={handleLogin}
                disabled={loginLoading}
                w="full"
              >
                <ShieldCheck size={16} />
                {loginLoading ? "Memeriksa..." : "Log Masuk"}
              </Button>
            </VStack>
          </Box>
        </VStack>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <VStack align="stretch" gap={5}>
        <Flex justify="space-between" align="center" flexWrap="wrap" gap={3}>
          <HStack gap={2}>
            <ShieldCheck size={22} color="#4caf50" />
            <Heading size="lg">Pentadbiran</Heading>
            <Badge
              bg="rgba(76,175,80,0.15)"
              color="#4caf50"
              border="1px solid"
              borderColor="rgba(76,175,80,0.3)"
              px={2.5}
              py={0.5}
              borderRadius="999px"
              fontSize="12px"
              fontWeight={600}
            >
              Disahkan
            </Badge>
          </HStack>
          <Button
            size="sm"
            bg="rgba(239,83,80,0.12)"
            color="#ef5350"
            border="1px solid rgba(239,83,80,0.3)"
            _hover={{ bg: "rgba(239,83,80,0.22)" }}
            onClick={handleLogout}
          >
            <LogOut size={14} /> Log Keluar
          </Button>
        </Flex>

        {dataError && (
          <Box bg="rgba(239,83,80,0.12)" border="1px solid rgba(239,83,80,0.3)" borderRadius="10px" px={4} py={3}>
            <Text color="#ef5350" fontSize="sm">{dataError}</Text>
          </Box>
        )}

        <HStack gap={3} mb={2}>
          <Button
            size="sm"
            bg="rgba(79,135,255,0.12)"
            color="#4f87ff"
            border="1px solid rgba(79,135,255,0.2)"
            _hover={{ bg: "rgba(79,135,255,0.22)" }}
            onClick={fetchData}
            disabled={loading}
          >
            <Database size={14} /> Muat Semula Data
          </Button>
        </HStack>

        <Box
          bg="#1c1f22"
          border="1px solid rgba(231,234,238,0.10)"
          borderRadius="14px"
          p={5}
        >
          <HStack gap={2} mb={4}>
            <Database size={18} color="#4f87ff" />
            <Heading size="md">Status Pangkalan Data</Heading>
          </HStack>
          {loading && !data ? (
            <Text color="#a3aab3" fontSize="sm">Memuat data...</Text>
          ) : data ? (
            <HStack flexWrap="wrap" gap={3}>
              {[
                { label: "Wad/Jabatan", count: data.sizes.wards, icon: "🏥" },
                { label: "Item/Ubat", count: data.sizes.items, icon: "💊" },
                { label: "Pesanan", count: data.sizes.orders, icon: "📋" },
                { label: "Katalog", count: data.sizes.catalog, icon: "📖" },
              ].map((s) => (
                <Box
                  key={s.label}
                  bg="#123a66"
                  border="1px solid rgba(79,135,255,0.12)"
                  borderRadius="10px"
                  p={4}
                  minW="130px"
                  flex={1}
                >
                  <Text fontSize="sm" color="#a3aab3" mb={1}>{s.icon} {s.label}</Text>
                  <Text fontSize="2xl" fontWeight={700}>{s.count.toLocaleString()}</Text>
                </Box>
              ))}
            </HStack>
          ) : (
            <Text color="#a3aab3" fontSize="sm">Tekan &quot;Muat Semula Data&quot; untuk memaparkan statistik.</Text>
          )}
        </Box>

        <Box
          bg="#1c1f22"
          border="1px solid rgba(231,234,238,0.10)"
          borderRadius="14px"
          p={5}
        >
          <HStack gap={2} mb={4}>
            <Settings size={18} color="#4f87ff" />
            <Heading size="md">Tetapan Penyelenggaraan</Heading>
          </HStack>

          <VStack align="stretch" gap={4}>
            {data && (
              <HStack flexWrap="wrap" gap={3}>
                <Box flex={1} minW="120px" p={3} bg="#123a66" borderRadius="10px" border="1px solid rgba(79,135,255,0.12)">
                  <Text fontSize="xs" color="#a3aab3">Sandaran Auto</Text>
                  <Badge
                    bg={data.config.auto_backup ? "rgba(76,175,80,0.15)" : "rgba(163,170,179,0.15)"}
                    color={data.config.auto_backup ? "#4caf50" : "#a3aab3"}
                    border="1px solid"
                    borderColor={data.config.auto_backup ? "rgba(76,175,80,0.3)" : "rgba(163,170,179,0.3)"}
                    mt={1}
                    px={2}
                    py={0.5}
                    borderRadius="999px"
                    fontSize="11px"
                    fontWeight={600}
                  >
                    {data.config.auto_backup ? "Aktif" : "Nyahaktif"}
                  </Badge>
                </Box>
                <Box flex={1} minW="120px" p={3} bg="#123a66" borderRadius="10px" border="1px solid rgba(79,135,255,0.12)">
                  <Text fontSize="xs" color="#a3aab3">Selang Sandaran</Text>
                  <Text fontWeight={600} mt={1}>{data.config.backup_interval_hours} jam</Text>
                </Box>
                <Box flex={1} minW="120px" p={3} bg="#123a66" borderRadius="10px" border="1px solid rgba(79,135,255,0.12)">
                  <Text fontSize="xs" color="#a3aab3">Pengekalan</Text>
                  <Text fontWeight={600} mt={1}>{data.config.retention_days} hari</Text>
                </Box>
              </HStack>
            )}

            <Box borderTop="1px solid rgba(231,234,238,0.10)" pt={4}>
              <Text fontWeight={600} mb={3}>Tukar Kata Laluan Pentadbir</Text>
              {passwordMsg && (
                <Box
                  bg={passwordMsg.includes("berjaya") ? "rgba(76,175,80,0.12)" : "rgba(239,83,80,0.12)"}
                  border={`1px solid ${passwordMsg.includes("berjaya") ? "rgba(76,175,80,0.3)" : "rgba(239,83,80,0.3)"}`}
                  borderRadius="10px"
                  px={4}
                  py={3}
                  mb={3}
                >
                  <Text
                    color={passwordMsg.includes("berjaya") ? "#4caf50" : "#ef5350"}
                    fontSize="sm"
                  >
                    {passwordMsg}
                  </Text>
                </Box>
              )}
              <VStack align="stretch" gap={3} maxW="400px">
                <Box>
                  <Text fontSize="sm" color="#a3aab3" mb={1}>Kata Laluan Baru</Text>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Kata laluan baru..."
                    bg="#123a66"
                    border="1px solid rgba(79,135,255,0.12)"
                    color="#e7eaee"
                    _focus={{ borderColor: "#4f87ff" }}
                  />
                </Box>
                <Box>
                  <Text fontSize="sm" color="#a3aab3" mb={1}>Sahkan Kata Laluan</Text>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Sahkan kata laluan..."
                    bg="#123a66"
                    border="1px solid rgba(79,135,255,0.12)"
                    color="#e7eaee"
                    _focus={{ borderColor: "#4f87ff" }}
                    onKeyDown={(e) => e.key === "Enter" && changePassword()}
                  />
                </Box>
                <Button
                  size="sm"
                  bg="#4f87ff"
                  color="white"
                  _hover={{ bg: "#3d6fcc" }}
                  onClick={changePassword}
                  disabled={passwordSaving}
                  alignSelf="flex-start"
                >
                  <Settings size={14} /> Kemaskini Kata Laluan
                </Button>
              </VStack>
            </Box>
          </VStack>
        </Box>

        <Box
          bg="#1c1f22"
          border="1px solid rgba(231,234,238,0.10)"
          borderRadius="14px"
          p={5}
        >
          <HStack gap={2} mb={3}>
            <HardDrive size={18} color="#4f87ff" />
            <Heading size="md">Pengurusan Sandaran</Heading>
          </HStack>
          <Box bg="#123a66" border="1px solid rgba(79,135,255,0.12)" borderRadius="10px" p={4}>
            <VStack align="stretch" gap={3}>
              <Text fontSize="sm" color="#e7eaee">
                Sistem ini menggunakan MongoDB Atlas sebagai pangkalan data. MongoDB Atlas menyediakan sandaran automatik yang terbina dalam:
              </Text>
              <VStack align="stretch" gap={2} pl={4}>
                <HStack gap={2}>
                  <Badge bg="rgba(76,175,80,0.15)" color="#4caf50" border="1px solid" borderColor="rgba(76,175,80,0.3)" px={2} py={0.5} borderRadius="999px" fontSize="11px" fontWeight={600}>
                    Aktif
                  </Badge>
                  <Text fontSize="sm" color="#a3aab3">Sandaran Harian - Atlas M10+</Text>
                </HStack>
                <HStack gap={2}>
                  <Badge bg="rgba(79,135,255,0.15)" color="#4f87ff" border="1px solid" borderColor="rgba(79,135,255,0.3)" px={2} py={0.5} borderRadius="999px" fontSize="11px" fontWeight={600}>
                    Terbina Dalam
                  </Badge>
                  <Text fontSize="sm" color="#a3aab3">Point-in-time recovery tersedia</Text>
                </HStack>
                <HStack gap={2}>
                  <Badge bg="rgba(240,173,78,0.15)" color="#f0ad4e" border="1px solid" borderColor="rgba(240,173,78,0.3)" px={2} py={0.5} borderRadius="999px" fontSize="11px" fontWeight={600}>
                    Manual
                  </Badge>
                  <Text fontSize="sm" color="#a3aab3">Pulihan boleh dilakukan melalui MongoDB Atlas Console</Text>
                </HStack>
              </VStack>
              {data && (
                <Text fontSize="xs" color="#a3aab3" mt={2}>
                  Sandaran seterusnya: {new Date(data.nextBackup).toLocaleString("ms-MY")}
                </Text>
              )}
            </VStack>
          </Box>
        </Box>
      </VStack>
    </AppShell>
  );
}
