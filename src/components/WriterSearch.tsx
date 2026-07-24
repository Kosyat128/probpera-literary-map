type Props = {
  value:string;
  onChange:(value:string)=>void;
};

export default function WriterSearch({value,onChange}:Props){
  return <input
    value={value}
    onChange={(e)=>onChange(e.target.value)}
    placeholder="Поиск писателя..."
    style={{
      padding:"10px 14px",
      width:"260px",
      borderRadius:"12px",
      border:"1px solid rgba(53,32,95,.2)",
      fontFamily:"Georgia, serif"
    }}
  />;
}
