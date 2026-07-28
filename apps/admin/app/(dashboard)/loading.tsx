export default function DashboardLoading() {
  return (
    <div aria-label="Загрузка">
      <div className="loading-line" style={{ width: "28%", height: 48 }} />
      <div className="stats-grid">
        {[1, 2, 3, 4].map((item) => (
          <div className="stat-card" key={item}>
            <div className="loading-line" />
            <div className="loading-line" style={{ width: "55%", height: 36 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
