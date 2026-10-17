"use client";

import { Group, Table } from "@mantine/core";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { IconArrowsSort } from "@tabler/icons-react";

type SortDir = "asc" | "desc";

interface SortableThProps {
  /** Column label. */
  children: ReactNode;
  /** Whether this column is the active sort column. */
  active: boolean;
  /** Current sort direction (only meaningful when `active`). */
  dir: SortDir;
  /** Toggle/cycle the sort for this column. */
  onSort: () => void;
  /**
   * Content alignment. Numeric columns pass "right" so the label and the sort
   * icon stay flush right, matching a right-aligned <td> beneath them.
   */
  align?: "left" | "right";
  /** Extra styles merged over the base (cursor, alignment, nowrap). */
  style?: CSSProperties;
}

/**
 * A `<Table.Th>` that sorts on click AND on keyboard.
 *
 * Table headers with only an onClick are invisible to keyboard and screen-
 * reader users — they aren't focusable and carry no sort state. This renders
 * a real `columnheader` with `aria-sort`, makes it tab-focusable, and handles
 * Enter/Space like a button.
 */
export default function SortableTh({
  children,
  active,
  dir,
  onSort,
  align = "left",
  style,
}: SortableThProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTableCellElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSort();
    }
  };

  return (
    <Table.Th
      // columnheader is the implicit role of <th>; stated so aria-sort is
      // announced reliably and the element is exposed as a sortable header.
      role="columnheader"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      tabIndex={0}
      onClick={onSort}
      onKeyDown={handleKeyDown}
      style={{
        cursor: "pointer",
        userSelect: "none",
        textAlign: align,
        // Visible focus ring for keyboard users (Mantine's default th has none).
        outlineOffset: "2px",
        ...style,
      }}
    >
      <Group
        gap={4}
        justify={align === "right" ? "flex-end" : undefined}
        style={{ flexWrap: "nowrap" }}
      >
        {children}
        <IconArrowsSort
          size={14}
          aria-hidden
          style={{
            opacity: active ? 1 : 0.4,
            transform: active && dir === "desc" ? "scaleY(-1)" : undefined,
          }}
        />
      </Group>
    </Table.Th>
  );
}
