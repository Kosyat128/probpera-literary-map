import { useState } from "react";


type SidebarProps = {
  items: string[];
  selectedItem?: string;
  onSelect?: (item: string) => void;
};


export default function Sidebar({

  items,

  selectedItem,

  onSelect,

}: SidebarProps) {


  const [search, setSearch] = useState("");



  const filteredItems = items.filter(

    (item) =>

      item
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )

  );



  return (

    <aside

      style={{

        width: "280px",

        borderRight:
          "1px solid #3b2a6b",

        padding: "20px",

        overflowY: "auto",

        background:
          "#ffffff",

      }}

    >


      <h2>

        🌍 Страны

      </h2>



      <input

        type="text"

        placeholder="Поиск страны..."

        value={search}

        onChange={(e) =>
          setSearch(e.target.value)
        }


        style={{

          width: "100%",

          padding: "10px",

          marginBottom: "15px",

          borderRadius: "6px",

          border:
            "1px solid #ccc",

        }}

      />



      <div>


        {filteredItems.length === 0 ? (


          <p>

            Страна не найдена

          </p>


        ) : (


          filteredItems.map((item) => (


            <button

              key={item}

              onClick={() =>
                onSelect?.(item)
              }


              style={{

                width: "100%",

                textAlign:
                  "left",

                padding: "12px",

                marginBottom:
                  "5px",

                cursor:
                  "pointer",


                borderRadius:
                  "6px",


                border:
                  "none",


                background:

                  item === selectedItem

                    ? "#3b2a6b"

                    : "transparent",


                color:

                  item === selectedItem

                    ? "#ffffff"

                    : "#222",


                fontSize:
                  "15px",

              }}

            >

              {item}

            </button>


          ))

        )}


      </div>


    </aside>

  );

}
