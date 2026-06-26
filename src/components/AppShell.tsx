"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Flex,
  Text,
  IconButton,
  HStack,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import {
  LayoutDashboard,
  FileText,
  Package,
  ShoppingCart,
  BarChart3,
  Hospital,
  Pill,
  BookOpen,
  Menu,
  X,
  Shield,
} from "lucide-react";
import { useState, useEffect } from "react";
import React from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/records", label: "Senarai Inden", icon: FileText },
  { href: "/supply", label: "Rekod Inden", icon: Package },
  { href: "/orders", label: "Butiran Inden", icon: ShoppingCart },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
  { href: "/wards", label: "Senarai Wad/Jabatan", icon: Hospital },
  { href: "/items", label: "Senarai Item/Ubat", icon: Pill },
  { href: "/catalog", label: "Katalog Wad/Jabatan", icon: BookOpen },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <Box
        px={5}
        pt={3}
        pb={1}
        fontWeight={700}
        fontSize="1.1rem"
        display="flex"
        alignItems="center"
        gap={2.5}
      >
        <Box color="#4f87ff">
          <Pill size={22} />
        </Box>
        <Text>Rekod FS, EMT, AOH - Hospital Keningau</Text>
      </Box>

      <Box
        px={5}
        pb={3}
        borderBottom="1px solid"
        borderColor="line"
        bg="bg"
        position="relative"
        zIndex={200}
      >
        <Flex alignItems="center" gap={4} flexWrap="wrap">
          <IconButton
            aria-label="Menu"
            display={{ base: "inline-flex", md: "none" }}
            onClick={() => setMobileOpen(!mobileOpen)}
            bg="transparent"
            border="1px solid"
            borderColor="line"
            color="text"
            size="sm"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </IconButton>

          <HStack
            gap={1.5}
            flexWrap="wrap"
            display={{ base: mobileOpen ? "flex" : "none", md: "flex" }}
            flexDirection={{ base: "column", md: "row" }}
            position={{ base: "absolute", md: "relative" }}
            top={{ base: "100%", md: "auto" }}
            left={{ base: 4, md: "auto" }}
            right={{ base: 4, md: "auto" }}
            bg={{ base: "card", md: "transparent" }}
            border={{ base: "1px solid", md: "none" }}
            borderColor={{ base: "line", md: "transparent" }}
            borderRadius={{ base: "10px", md: 0 }}
            boxShadow={{ base: "0 8px 24px rgba(0,0,0,0.12)", md: "none" }}
            p={{ base: 2, md: 0 }}
            zIndex={210}
          >
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <HStack
                    gap={2}
                    px={3}
                    py={2}
                    borderRadius="10px"
                    bg={isActive ? "#4f87ff" : "transparent"}
                    color={isActive ? "white" : "muted"}
                    fontSize="13px"
                    _hover={
                      isActive
                        ? {}
                        : { bg: "rgba(0,0,0,0.04)", color: "text" }
                    }
                    transition="all 0.2s"
                    onClick={() => setMobileOpen(false)}
                    cursor="pointer"
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </HStack>
                </Link>
              );
            })}
          </HStack>
        </Flex>
      </Box>

      <Box flex={1} display="flex" flexDirection="column" minW={0}>
        <Box
          p={5}
          maxW="min(1400px, 100vw)"
          width="100%"
          mx="auto"
        >
          {children}
        </Box>
      </Box>

      <Box
        borderTop="1px solid"
        borderColor="line"
        px={3}
        py={1.5}
        display="flex"
        alignItems="center"
        justifyContent="flex-end"
        gap={2}
      >
        <Text fontSize="11px" color="muted" mr={2}>
          Ahmad Fetre Bin Mohammad Zime - 2026
        </Text>
        <Link href="/admin">
          <HStack
            gap={1}
            px={2}
            py={1}
            borderRadius="4px"
            cursor="pointer"
            _hover={{ bg: "rgba(0,0,0,0.04)" }}
          >
            <Shield size={14} />
          </HStack>
        </Link>
      </Box>
    </Box>
  );
}
