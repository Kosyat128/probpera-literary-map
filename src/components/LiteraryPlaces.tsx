const places = [
  {
    name: "Ясная Поляна",
    region: "Тульская область",
    writer: "Лев Толстой",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Yasnaya_Polyana_2018.jpg/640px-Yasnaya_Polyana_2018.jpg",
  },

  {
    name: "Болдино",
    region: "Нижегородская область",
    writer: "Александр Пушкин",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Boldino_Pushkin.jpg/640px-Boldino_Pushkin.jpg",
  },

  {
    name: "Мелихово",
    region: "Московская область",
    writer: "Антон Чехов",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Melikhovo.jpg/640px-Melikhovo.jpg",
  },

  {
    name: "Петербург Достоевского",
    region: "Санкт-Петербург",
    writer: "Фёдор Достоевский",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Saint_Petersburg_view.jpg/640px-Saint_Petersburg_view.jpg",
  },

  {
    name: "Таганрог",
    region: "Ростовская область",
    writer: "Антон Чехов",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Taganrog_view.jpg/640px-Taganrog_view.jpg",
  },

  {
    name: "Константиново",
    region: "Рязанская область",
    writer: "Сергей Есенин",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Konstantinovo.jpg/640px-Konstantinovo.jpg",
  },
];



export default function LiteraryPlaces() {


  return (

    <section

      style={{

        background:"#F7EBDD",

        padding:"20px",

        borderRadius:"12px",

      }}

    >

      <h3

        style={{

          color:"#35205F",

        }}

      >

        ПОПУЛЯРНЫЕ ЛИТЕРАТУРНЫЕ МЕСТА

      </h3>



      <div

        style={{

          display:"grid",

          gridTemplateColumns:
          "repeat(6,1fr)",

          gap:"12px",

        }}

      >

        {

          places.map(place => (

            <div

              key={place.name}

              style={{

                background:"#FFF8EE",

                borderRadius:"12px",

                overflow:"hidden",

                border:
                "1px solid #E5C9A5",

              }}

            >


              <img

                src={place.image}

                alt={place.name}

                style={{

                  width:"100%",

                  height:"120px",

                  objectFit:"cover",

                }}

              />



              <div

                style={{

                  padding:"10px",

                  color:"#35205F",

                }}

              >


                <b>

                  {place.name}

                </b>


                <p>

                  {region(place.region)}

                </p>


                <small>

                  👤 {place.writer}

                </small>


              </div>


            </div>

          ))

        }


      </div>


    </section>

  );

}



function region(text:string){

  return text;

}
