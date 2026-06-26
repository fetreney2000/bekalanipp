"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import {
  Box,
  SimpleGrid,
  Text,
  Badge,
  Heading,
  Flex,
  Spinner,
  VStack,
} from "@chakra-ui/react";
import {
  ShoppingBag,
  Package,
  Hospital,
  AlertTriangle,
  AlertOctagon,
  Activity,
} from "lucide-react";

interface ItemStatus {
  item_id: string;
  item_name: string;
  total_used: number;
  total_quota: number;
  wards_using: number;
  status: string;
}

interface TopWard {
  ward_id: string;
  ward_name: string;
  order_count: number;
}

interface DashboardData {
  month: string;
  itemStatus: ItemStatus[];
  warnings: string[];
  exceeded: string[];
  orders_count: number;
  items_count: number;
  top_ward: TopWard | null;
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
}) {
  return (
    <Box
      bg="bg.card"
      border="1px solid"
      borderColor="line"
      borderRadius="14px"
      p={5}
    >
      <Flex alignItems="center" gap={3}>
        <Box
          bg={`${iconColor}22`}
          color={iconColor}
          p={2.5}
          borderRadius="10px"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Icon size={22} />
        </Box>
        <VStack align="start" gap={0}>
          <Text fontSize="12px" color="text.muted">
            {label}
          </Text>
          <Text fontSize="1.4rem" fontWeight={700}>
            {value}
          </Text>
        </VStack>
      </Flex>
    </Box>
  );
}

function QuotaTable({
  items,
  type,
}: {
  items: ItemStatus[];
  type: "warning" | "exceeded";
}) {
  if (items.length === 0) return null;

  const bgColor = type === "exceeded" ? "rgba(239,83,80,0.08)" : "rgba(240,173,78,0.08)";
  const borderColor = type === "exceeded" ? "bad" : "warn";
  const Icon = type === "exceeded" ? AlertOctagon : AlertTriangle;
  const title = type === "exceeded" ? "Kuota Dilampaui" : "Amaran Kuota";
  const iconColor = type === "exceeded" ? "#ef5350" : "#f0ad4e";

  return (
    <Box
      bg={bgColor}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="14px"
      p={4}
    >
      <Flex alignItems="center" gap={2} mb={4}>
        <Icon size={18} color={iconColor} />
        <Heading fontSize="1rem" fontWeight={600}>
          {title}
        </Heading>
      </Flex>
      <Box overflowX="auto">
        <table style={{width: '100%'}}>
          <thead>
            <tr>
              <th style={{textAlign:'left',color:'var(--muted)',fontSize:'12px',fontWeight:600,padding:'8px'}}>Wad</th>
              <th style={{textAlign:'left',color:'var(--muted)',fontSize:'12px',fontWeight:600,padding:'8px'}}>Item</th>
              <th style={{textAlign:'right',color:'var(--muted)',fontSize:'12px',fontWeight:600,padding:'8px'}}>Kuota</th>
              <th style={{textAlign:'right',color:'var(--muted)',fontSize:'12px',fontWeight:600,padding:'8px'}}>Diguna</th>
              <th style={{textAlign:'right',color:'var(--muted)',fontSize:'12px',fontWeight:600,padding:'8px'}}>Baki</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.item_id}>
                <td style={{padding:'8px',borderBottom:'1px solid var(--line)',fontSize:'13px'}}>{item.wards_using} wad</td>
                <td style={{padding:'8px',borderBottom:'1px solid var(--line)',fontSize:'13px'}}>{item.item_name}</td>
                <td style={{padding:'8px',borderBottom:'1px solid var(--line)',textAlign:'right',fontSize:'13px'}}>{item.total_quota}</td>
                <td style={{padding:'8px',borderBottom:'1px solid var(--line)',textAlign:'right',fontSize:'13px'}}>{item.total_used}</td>
                <td style={{padding:'8px',borderBottom:'1px solid var(--line)',textAlign:'right',fontSize:'13px'}}>{item.total_quota - item.total_used}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </Box>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case "melebihi":
      return "red";
    case "hampir_habis":
      return "yellow";
    case "sederhana":
      return "orange";
    default:
      return "green";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "melebihi":
      return "Dilampaui";
    case "hampir_habis":
      return "Hampir Habis";
    case "sederhana":
      return "Sederhana";
    default:
      return "OK";
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    fetch(`/api/dashboard?month=${month}`)
      .then((res) => {
        if (!res.ok) throw new Error("Gagal memuatkan data");
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      {loading && (
        <Flex justify="center" align="center" minH="400px">
          <Spinner size="lg" color="brand.500" />
        </Flex>
      )}

      {error && (
        <Box
          bg="rgba(239,83,80,0.08)"
          border="1px solid"
          borderColor="bad"
          borderRadius="14px"
          p={4}
        >
          <Flex alignItems="center" gap={2}>
            <AlertOctagon size={18} color="#ef5350" />
            <Text color="bad">{error}</Text>
          </Flex>
        </Box>
      )}

      {data && (
        <VStack align="stretch" gap={6}>
          <Heading fontSize="1.3rem" fontWeight={700}>
            Dashboard — {data.month}
          </Heading>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            <StatCard
              label="Jumlah Pesanan"
              value={data.orders_count}
              icon={ShoppingBag}
              iconColor="#4f87ff"
            />
            <StatCard
              label="Jumlah Item"
              value={data.items_count}
              icon={Package}
              iconColor="#4caf50"
            />
            <StatCard
              label="Wad Paling Aktif"
              value={
                data.top_ward
                  ? `${data.top_ward.ward_name} (${data.top_ward.order_count})`
                  : "Tiada data"
              }
              icon={Hospital}
              iconColor="#f0ad4e"
            />
          </SimpleGrid>

          {data.exceeded.length > 0 && (
            <QuotaTable
              items={data.itemStatus.filter((i) => i.status === "melebihi")}
              type="exceeded"
            />
          )}

          {data.warnings.length > 0 && (
            <QuotaTable
              items={data.itemStatus.filter((i) => i.status === "hampir_habis")}
              type="warning"
            />
          )}

          <Box
            bg="bg.card"
            border="1px solid"
            borderColor="line"
            borderRadius="14px"
            p={4}
          >
            <Flex alignItems="center" gap={2} mb={4}>
              <Activity size={18} color="#4f87ff" />
              <Heading fontSize="1rem" fontWeight={600}>
                Status Kuota Bulanan
              </Heading>
            </Flex>
            <Box overflowX="auto">
              <table style={{width: '100%'}}>
                <thead>
                  <tr>
                    <th style={{textAlign:'left',color:'var(--muted)',fontSize:'12px',fontWeight:600,padding:'8px'}}>Item</th>
                    <th style={{textAlign:'right',color:'var(--muted)',fontSize:'12px',fontWeight:600,padding:'8px'}}>Diguna</th>
                    <th style={{textAlign:'right',color:'var(--muted)',fontSize:'12px',fontWeight:600,padding:'8px'}}>Kuota</th>
                    <th style={{textAlign:'right',color:'var(--muted)',fontSize:'12px',fontWeight:600,padding:'8px'}}>%</th>
                    <th style={{textAlign:'center',color:'var(--muted)',fontSize:'12px',fontWeight:600,padding:'8px'}}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.itemStatus.map((item) => {
                    const pct =
                      item.total_quota > 0
                        ? Math.round((item.total_used / item.total_quota) * 100)
                        : 0;
                    return (
                      <tr key={item.item_id}>
                        <td style={{padding:'8px',borderBottom:'1px solid var(--line)',fontSize:'13px'}}>{item.item_name}</td>
                        <td style={{padding:'8px',borderBottom:'1px solid var(--line)',textAlign:'right',fontSize:'13px'}}>{item.total_used}</td>
                        <td style={{padding:'8px',borderBottom:'1px solid var(--line)',textAlign:'right',fontSize:'13px'}}>{item.total_quota}</td>
                        <td style={{padding:'8px',borderBottom:'1px solid var(--line)',textAlign:'right',fontSize:'13px'}}>
                          {item.total_quota > 0 ? `${pct}%` : "—"}
                        </td>
                        <td style={{padding:'8px',borderBottom:'1px solid var(--line)',textAlign:'center'}}>
                          <Badge
                            colorPalette={getStatusColor(item.status)}
                            size="sm"
                            borderRadius="full"
                          >
                            {getStatusLabel(item.status)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>
          </Box>
        </VStack>
      )}
    </AppShell>
  );
}
