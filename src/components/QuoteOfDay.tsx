import type { Writer } from "../data/countries";

type Props = { countryName?: string; writer?: Writer | null };

export default function QuoteOfDay({ countryName, writer }: Props) {
  const name = writer?.name || writer?.fullName;
  const quote = (writer as Writer & { quote?: string })?.quote || (writer as Writer & { quotes?: string[] })?.quotes?.[0];

  return (
    <section style={{background:'#FFF8EE',borderRadius:'16px',padding:'16px',color:'#35205F',boxShadow:'0 10px 30px rgba(31,16,61,0.08)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
        <h3 style={{margin:0}}>💬 Цитата дня</h3>
        <span style={{fontSize:'12px',color:'#E97824',fontWeight:700}}>LIVE</span>
      </div>
      <p style={{fontSize:'18px',lineHeight:1.6,margin:'8px 0 12px'}}>{quote || (name ? `Цитата автора ${name}` : '«Литература — это отражение человеческой души и времени»')}</p>
      <small>{name || countryName || 'Литературная карта мира'}</small>
    </section>
  );
}