import { Group, Text } from "@mantine/core";

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <svg
        viewBox="0 0 512 512"
        width={compact ? 26 : 32}
        height={compact ? 26 : 32}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <rect width="512" height="512" rx="96" fill="var(--mantine-color-pink-6)" />
        <text
          x="256"
          y="310"
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="260"
          fontWeight="700"
          fontStyle="italic"
          fill="#FFFFFF"
        >
          Rx
        </text>
        <rect
          x="380"
          y="120"
          width="60"
          height="18"
          rx="9"
          fill="rgba(255,255,255,0.25)"
          transform="rotate(-28 410 129)"
        />
      </svg>
      {!compact && (
        <Text fw={700} size="sm" style={{ whiteSpace: "nowrap" }}>
          Bekalan FS, EMT & AOH
        </Text>
      )}
    </Group>
  );
}