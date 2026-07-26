type Props = { countryName?: string };

export default function LiteraryCalendar({ countryName }: Props) {
  return (
    <section style={{background:'#FFF8EE',borderRadius:'16px',padding:'16px',color:'#35205F'}}>
      <h3>📅 Литературный календарь</h3>
      <p>🎂 Дни рождения писателей</p>
      <p>📖 Важные даты публикаций</p>
      <small>{countryName || 'Мировая литература'}</small>
    </section>
  );
}
