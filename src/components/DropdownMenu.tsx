import { useState, useRef, useEffect } from "react";

interface MenuItem {
  label: string;
  onClick: () => void;
}

interface DropdownMenuProps {
  label: string;
  items: MenuItem[];
}

export function DropdownMenu({ label, items }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className="menubar-item" ref={containerRef}>
      <button 
        className="menubar-btn"
        onClick={() => setOpen(!open)}
      >
        {label}
      </button>
      
      {open && (
        <div className="dropdown-menu">
          {items.map((item, i) => (
            <button
              key={i}
              className="dropdown-item"
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
