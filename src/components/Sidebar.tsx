type SidebarProps = {
  items: string[];
};

export default function Sidebar({
  items,
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
          style={{
            padding: "10px",
            cursor: "pointer",
            borderBottom: "1px solid #333",
          }}
        >
          {item}
        </div>
      ))}
    </aside>
  );
}
