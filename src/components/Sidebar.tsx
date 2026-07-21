type SidebarProps = {
  items: string[];
  selectedItem?: string;
  onSelect?: (item: string) => void;
};

export default function Sidebar({
  items,
  selectedItem,
  onSelect,
}: SidebarProps) {
  return (
    <aside
      style={{
        width: "260px",
        borderRight: "1px solid #3b2a6b",
        padding: "20px",
      }}
    >
      <h2>Страны</h2>

      {items.map((item) => (
        <div
          key={item}
          onClick={() => onSelect?.(item)}
          style={{
            padding: "10px",
            cursor: "pointer",
            borderBottom: "1px solid #333",
            background: item === selectedItem ? "#3b2a6b" : "transparent",
            color: item === selectedItem ? "#fff" : "inherit",
          }}
        >
          {item}
        </div>
      ))}
    </aside>
  );
}
