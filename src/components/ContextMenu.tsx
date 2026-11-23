import { useState, useEffect, useCallback } from "react";

export function useContextMenu() {
  const [menuData, setMenuData] = useState<{
    visible: boolean;
    x: number;
    y: number;
    nodeId?: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
  });

  const openContextMenu = useCallback((e: React.MouseEvent | MouseEvent, nodeId?: string) => {
    e.preventDefault();
    setMenuData({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      nodeId,
    });
  }, []);

  const openContextMenuAt = useCallback((x: number, y: number, nodeId?: string) => {
    setMenuData({ visible: true, x, y, nodeId });
  }, []);

  const closeContextMenu = useCallback(() => {
    setMenuData((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  useEffect(() => {
    document.addEventListener("click", closeContextMenu);
    document.addEventListener("contextmenu", closeContextMenu); // Close if right clicked elsewhere
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeContextMenu();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", closeContextMenu);
      document.removeEventListener("contextmenu", closeContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeContextMenu]);

  return { menuData, openContextMenu, openContextMenuAt, closeContextMenu };
}

export type ContextMenuItem = 
  | { label: string; onClick: () => void; isDivider?: false }
  | { isDivider: true; label?: never; onClick?: never };

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export function ContextMenu({ x, y, items }: ContextMenuProps) {
  return (
    <div
      className="context-menu"
      role="menu"
      style={{ top: y, left: x }}
      onContextMenu={(e) => e.preventDefault()} // Prevent native menu inside our menu
    >
      {items.map((item, i) => {
        if (item.isDivider) {
          return <div key={i} className="context-menu-divider" role="separator" />;
        }
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            className="dropdown-item"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              item.onClick();
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
