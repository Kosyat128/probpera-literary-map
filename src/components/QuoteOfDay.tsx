type Props = { countryName?: string; writer?: any };

export default function QuoteOfDay({ countryName, writer }: Props) {
  const name = writer?.name || writer?.fullName;

  return (
    <section style={{background:'#FFF8EE',borderRadius:'16px',padding:'16px',color:'#35205F'}}>
      <h3>💬 Цитата дня</h3>
      <p>{name ? `Цитата автора ${name}` : '«Литература — это отражение человеческой души и времени»'}</p>
      <small>{name || countryName || 'Литературная карта мира'}</small>
    </section>
  );
}
