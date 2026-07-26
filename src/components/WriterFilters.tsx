type Props = {
  region?: string;
  period?: string;
  nobel?: boolean;
  onRegionChange?: (value: string) => void;
  onPeriodChange?: (value: string) => void;
  onNobelChange?: (value: boolean) => void;
};

export default function WriterFilters({
  region = "",
  period = "",
  nobel = false,
  onRegionChange,
  onPeriodChange,
  onNobelChange,
}: Props) {
  return (
    <div style={{display:"flex",gap:"12px",flexWrap:"wrap",padding:"12px",background:"#FFF8EE",borderRadius:"14px",fontFamily:"Georgia, serif"}}>
      <select value={region} onChange={(e)=>onRegionChange?.(e.target.value)}>
        <option value="">Все регионы</option>
        <option value="europe">Европа</option>
        <option value="asia">Азия</option>
        <option value="america">Америка</option>
        <option value="africa">Африка</option>
        <option value="oceania">Океания</option>
      </select>
      <select value={period} onChange={(e)=>onPeriodChange?.(e.target.value)}>
        <option value="">Все эпохи</option>
        <option value="renaissance">Возрождение</option>
        <option value="romanticism">Романтизм</option>
        <option value="realism">Реализм</option>
        <option value="modernism">Модернизм</option>
        <option value="contemporary">Современная литература</option>
      </select>
      <label>
        <input type="checkbox" checked={nobel} onChange={(e)=>onNobelChange?.(e.target.checked)} /> Нобелевские лауреаты
      </label>
    </div>
  );
}
