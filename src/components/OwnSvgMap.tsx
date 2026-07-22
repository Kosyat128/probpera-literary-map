type OwnSvgMapProps={
 svg:string;
 onCountryClick:(id:string)=>void;
};

export default function OwnSvgMap({svg,onCountryClick}:OwnSvgMapProps){
 return <div onClick={()=>onCountryClick('russia')} dangerouslySetInnerHTML={{__html:svg}} />;
}
