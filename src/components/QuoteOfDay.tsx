type Props = { countryName?: string };

export default function QuoteOfDay({ countryName }: Props) {
  return (
    <section style={{background:'#FFF8EE',borderRadius:'16px',padding:'16px',color:'#35205F'}}>
      <h3>💬 Цитата дня</h3>
      <p>«Литература — это отражение человеческой души и времени»</p>
      <small>{countryName || 'Литературная карта мира'}</small>
    </section>
  );
}
