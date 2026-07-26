import { useState } from "react";

type SidebarProps = {
  items: string[];
  selectedItem?: string;
  onSelect: (item: string) => void;
};

const flags: Record<string,string> = {
  Россия:"🇷🇺", Франция:"🇫🇷", Великобритания:"🇬🇧", Германия:"🇩🇪",
  США:"🇺🇸", Италия:"🇮🇹", Испания:"🇪🇸", Япония:"🇯🇵",
  Китай:"🇨🇳", Индия:"🇮🇳", Бразилия:"🇧🇷"
};

const topCountries = ["Россия","Франция","Великобритания","Германия","США","Италия","Испания","Япония","Китай","Индия"];

export default function Sidebar({items, selectedItem, onSelect}: SidebarProps){
  const [search,setSearch] = useState("");
  const [showAll,setShowAll] = useState(false);

  const visible = (showAll ? items : topCountries.filter(x=>items.includes(x)))
    .filter(item => item.toLowerCase().includes(search.toLowerCase()));

  return (
    <aside style={{width:"220px",background:"#1F103D",color:"white",padding:"15px",borderRadius:"12px",overflowY:"auto"}}>
      <h3>СТРАНЫ МИРА</h3>
      <input
        placeholder="Поиск страны..."
        value={search}
        onChange={e=>setSearch(e.target.value)}
        style={{width:"100%",padding:"8px",borderRadius:"8px",border:"none",marginBottom:"15px"}}
      />

      {visible.map(country=>(
        <div
          key={country}
          onClick={()=>onSelect(country)}
          style={{display:"flex",justifyContent:"space-between",padding:"8px",marginBottom:"5px",cursor:"pointer",borderRadius:"8px",background:selectedItem===country?"#E97824":"transparent"}}
        >
          <span>{flags[country] ?? "🌍"} {country}</span>
        </div>
      ))}

      <button
        onClick={()=>setShowAll(!showAll)}
        style={{width:"100%",marginTop:"10px",padding:"8px",borderRadius:"8px"}}
      >
        {showAll ? "Скрыть страны" : "Все страны (160+)"}
      </button>

      <hr/>
      <h4>☆ ИЗБРАННОЕ</h4>
      <p>⭐ 12</p>

      <hr/>
      <h4>НЕДАВНО ПРОСМОТРЕННЫЕ</h4>
      <p>👤 Лев Толстой</p>
      <p>👤 Фёдор Достоевский</p>
      <p>👤 Александр Пушкин</p>
      <p>👤 Антон Чехов</p>
    </aside>
  );
}
