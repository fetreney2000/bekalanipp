"use client";

import { Button, Flex, Group, Stack, Text, Modal } from "@mantine/core";
import { IconAlertTriangle, IconTrash, IconX } from "@tabler/icons-react";

interface ConfirmDialogProps {
  opened: boolean;
  /** Short question shown as the modal title and body. */
  message: string;
  /** Label for the destructive confirm button. */
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shared replacement for native window.confirm().
 *
 * The app already used a Mantine Modal for the records-page confirm; the
 * ward/item/catalog pages still called confirm(), which is untranslated, not
 * themeable, and blocks the event loop. One component keeps them consistent.
 */
export default function ConfirmDialog({
  opened,
  message,
  confirmLabel = "Ya, Padam",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal opened={opened} onClose={onCancel} title="Sahkan Tindakan" size="sm" centered>
      <Stack gap="md">
        <Group gap="sm">
          <IconAlertTriangle size={20} color="var(--mantine-color-yellow)" />
          <Text fw={600} size="sm">
            Sahkan Tindakan
          </Text>
        </Group>
        <Text size="sm" c="dimmed">
          {message}
        </Text>
        <Flex justify="flex-end" gap="sm">
          <Button
            size="compact-sm"
            variant="subtle"
            leftSection={<IconX size={14} />}
            onClick={onCancel}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            size="compact-sm"
            color="red"
            leftSection={<IconTrash size={14} />}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
