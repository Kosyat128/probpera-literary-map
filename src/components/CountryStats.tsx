import type { Country } from "../data/types";

type Props = {
  country: Country;
};

export default function CountryStats({country}: Props){
  const data = country as Country & {
    nobel?: number;
    places?: number;
    influence?: number;
    flag?: string;
  };

  return (
    <div style={{
      background:"#FFF8EE",
      borderRadius:"16px",
      padding:"15px",
      marginBottom:"18px"
    }}>
      <h3 style={{color:"#35205F"}}>
        {data.flag ?? "🌍"} {country.name}
      </h3>

      <div>✒️ Авторов: <b>{country.writers.length}</b></div>
      <div>🏅 Нобелевских лауреатов: <b>{data.nobel ?? 0}</b></div>
      <div>📍 Литературных мест: <b>{data.places ?? 0}</b></div>

      <p style={{marginTop:"15px"}}>
        Литературное влияние
      </p>

      <div style={{
        height:"10px",
        background:"#E6D5C0",
        borderRadius:"10px"
      }}>
        <div style={{
          height:"100%",
          width:`${data.influence ?? 70}%`,
          background:"#E97824",
          borderRadius:"10px"
        }}/>
      </div>
    </div>
  );
}
