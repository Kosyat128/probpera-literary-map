type SidebarProps = {
  items?: string[];
};

export default function Sidebar({ items = [] }: SidebarProps) {
  return (
    <aside style={{width:'280px',padding:'1rem',borderRight:'1px solid #3b2a6b'}}>
      <h2>Страны</h2>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}
