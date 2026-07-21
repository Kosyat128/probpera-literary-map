export type WorldMapProps = {
  onCountrySelect?: (country: string) => void;
};

export default function WorldMap({ onCountrySelect }: WorldMapProps) {
  return (
    <section style={{flex:1,padding:'1rem'}}>
      <div
        style={{border:'2px dashed #5b46a5',borderRadius:12,padding:'4rem',textAlign:'center',cursor:'pointer'}}
        onClick={() => onCountrySelect?.('France')}
      >
        <h2>World Map</h2>
        <p>Placeholder for Leaflet interactive map.</p>
        <small>Click to simulate selecting France.</small>
      </div>
    </section>
  );
}
