// Aparece na hora do clique, enquanto o servidor monta o painel.
export default function Loading() {
  return (
    <div className="view" aria-busy="true" aria-label="Carregando painel">
      <div className="viewbar">
        <div>
          <div className="sk" style={{ width: 220, height: 28, marginBottom: 8 }} />
          <div className="sk" style={{ width: 320, height: 14 }} />
        </div>
      </div>
      <div className="grid g4">
        {[0, 1, 2, 3].map((i) => (
          <div className="card" key={i}>
            <div className="sk" style={{ width: "60%", height: 13, marginBottom: 14 }} />
            <div className="sk" style={{ width: "70%", height: 30, marginBottom: 10 }} />
            <div className="sk" style={{ width: "90%", height: 10 }} />
          </div>
        ))}
      </div>
      <div className="grid g21">
        <div className="card"><div className="sk" style={{ height: 180 }} /></div>
        <div className="card"><div className="sk" style={{ height: 180 }} /></div>
      </div>
    </div>
  );
}
