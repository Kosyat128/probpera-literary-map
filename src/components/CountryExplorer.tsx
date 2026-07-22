type CountryExplorerProps={
 country:string;
 count:number;
};

export default function CountryExplorer({country,count}:CountryExplorerProps){
 return <div>
  <h2>{country}</h2>
  <p>Количество писателей: {count}</p>
 </div>;
}
