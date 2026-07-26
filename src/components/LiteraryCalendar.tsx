import type { Writer } from "../data/countries";

type Props = { countryName?: string; writer?: Writer | null };

export default function LiteraryCalendar({ countryName, writer }: Props) {
  const name = writer?.name || writer?.fullName || countryName || "Мировая литература";

  return (
    <section style={{background:'#FFF8EE',borderRadius:'16px',padding:'16px',color:'#35205F',boxShadow:'0 10px 30px rgba(31,16,61,0.08)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
        <h3 style={{margin:0}}>📅 Литературный календарь</h3>
        <span style={{fontSize:'12px',color:'#E97824',fontWeight:700}}>AUTO</span>
      </div>
      <p style={{margin:'8px 0'}}>🎂 Дни рождения писателей</p>
      <p style={{margin:'8px 0'}}>📖 Важные даты публикаций</p>
      <p style={{margin:'8px 0'}}>🏆 Премии и знаковые события</p>
      <small>{name}</small>
    </section>
  );
}