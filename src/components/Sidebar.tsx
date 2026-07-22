import { useState } from "react";


type SidebarProps = {

  items: string[];

  selectedItem?: string;

  onSelect: (item:string)=>void;

};



const flags: Record<string,string> = {

  "Россия":"🇷🇺",
  "Франция":"🇫🇷",
  "Великобритания":"🇬🇧",
  "Германия":"🇩🇪",
  "США":"🇺🇸",
  "Италия":"🇮🇹",
  "Испания":"🇪🇸",
  "Япония":"🇯🇵",
  "Китай":"🇨🇳",
  "Индия":"🇮🇳",
  "Бразилия":"🇧🇷",
};



export default function Sidebar({

  items,

  selectedItem,

  onSelect,

}:SidebarProps){



  const [search,setSearch] =
    useState("");



  const filtered = items.filter(

    item =>

    item
    .toLowerCase()
    .includes(
      search.toLowerCase()
    )

  );



  return (

    <aside

      style={{

        width:"220px",

        background:"#1F103D",

        color:"#fff",

        padding:"15px",

        borderRadius:"12px",

        overflowY:"auto",

      }}

    >



      <h3>

        СТРАНЫ МИРА

      </h3>




      <input

        placeholder="Поиск страны..."

        value={search}

        onChange={

          e=>setSearch(e.target.value)

        }


        style={{

          width:"100%",

          padding:"8px",

          borderRadius:"8px",

          border:"none",

          marginBottom:"15px",

        }}

      />





      {

        filtered.map(country=>(


          <div

            key={country}

            onClick={()=>onSelect(country)}


            style={{

              display:"flex",

              justifyContent:"space-between",

              alignItems:"center",

              padding:"8px",

              marginBottom:"5px",

              cursor:"pointer",

              borderRadius:"8px",


              background:

              selectedItem===country

              ?

              "#35205F"

              :

              "transparent",

            }}

          >


            <span>

              {flags[country] ?? "🌍"}

              {" "}

              {country}

            </span>



            <small

              style={{

                color:"#E97824"

              }}

            >

              {Math.floor(

                Math.random()*50+10

              )}

            </small>


          </div>


        ))

      }




      <hr/>




      <h4>

        ☆ ИЗБРАННОЕ

      </h4>



      <p>

        ⭐ 12

      </p>





      <hr/>





      <h4>

        НЕДАВНО ПРОСМОТРЕННЫЕ

      </h4>




      <p>

        👤 Лев Толстой

      </p>


      <p>

        👤 Фёдор Достоевский

      </p>


      <p>

        👤 Александр Пушкин

      </p>


      <p>

        👤 Антон Чехов

      </p>




    </aside>

  );

}
