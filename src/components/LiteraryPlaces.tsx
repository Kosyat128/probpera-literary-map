const places = [

  {
    name: "Ясная Поляна",
    region: "Тульская область, Россия",
    writer: "Лев Николаевич Толстой",
    years: "1828–1910",
    description:
      "Родовое имение Толстых, где писатель жил и создал многие свои произведения.",
    works: [
      "Война и мир",
      "Анна Каренина",
      "Воскресение"
    ],
    image:
      "/images/places/yasnaya-polyana.jpg"
  },


  {
    name: "Болдино",
    region: "Нижегородская область, Россия",
    writer: "Александр Сергеевич Пушкин",
    years: "1799–1837",
    description:
      "Место знаменитой Болдинской осени 1830 года — одного из самых плодотворных периодов творчества поэта.",
    works: [
      "Евгений Онегин",
      "Повести Белкина",
      "Маленькие трагедии"
    ],
    image:
      "/images/places/boldino.jpg"
  },


  {
    name: "Мелихово",
    region: "Московская область, Россия",
    writer: "Антон Павлович Чехов",
    years: "1860–1904",
    description:
      "Усадьба Чехова, где были написаны многие рассказы и пьесы периода зрелого творчества.",
    works: [
      "Чайка",
      "Дядя Ваня",
      "Палата №6"
    ],
    image:
      "/images/places/melikhovo.jpg"
  },


  {
    name: "Петербург Достоевского",
    region: "Санкт-Петербург, Россия",
    writer: "Фёдор Михайлович Достоевский",
    years: "1821–1881",
    description:
      "Городское пространство, ставшее основой многих произведений писателя.",
    works: [
      "Преступление и наказание",
      "Идиот",
      "Бедные люди"
    ],
    image:
      "/images/places/petersburg.jpg"
  },


  {
    name: "Константиново",
    region: "Рязанская область, Россия",
    writer: "Сергей Александрович Есенин",
    years: "1895–1925",
    description:
      "Родина поэта, оказавшая большое влияние на его творчество и образ русской природы.",
    works: [
      "Анна Снегина",
      "Письмо к женщине",
      "Русь"
    ],
    image:
      "/images/places/konstantinovo.jpg"
  },


  {
    name: "Стратфорд-на-Эйвоне",
    region: "Уорикшир, Англия",
    writer: "Уильям Шекспир",
    years: "1564–1616",
    description:
      "Родной город английского драматурга, один из главных литературных центров Великобритании.",
    works: [
      "Гамлет",
      "Макбет",
      "Ромео и Джульетта"
    ],
    image:
      "/images/places/stratford.jpg"
  }

];





export default function LiteraryPlaces() {


  return (

    <section

      style={{

        background:"#FFF8EE",

        borderRadius:"18px",

        padding:"20px",

        boxShadow:
        "0 5px 20px rgba(53,32,95,.12)"

      }}

    >



      <h2

        style={{

          color:"#35205F",

          marginBottom:"20px"

        }}

      >

        ПОПУЛЯРНЫЕ ЛИТЕРАТУРНЫЕ МЕСТА

      </h2>





      <div

        style={{

          display:"grid",

          gridTemplateColumns:
          "repeat(3,1fr)",

          gap:"18px"

        }}

      >



      {

        places.map(place=>(


          <article

            key={place.name}

            style={{

              background:"#F7EBDD",

              borderRadius:"15px",

              overflow:"hidden",

              border:
              "1px solid #E5C9A8"

            }}

          >



            <img

              src={place.image}

              alt={place.name}

              style={{

                width:"100%",

                height:"160px",

                objectFit:"cover"

              }}

            />




            <div

              style={{

                padding:"15px"

              }}

            >



              <h3

                style={{

                  color:"#35205F"

                }}

              >

                {place.name}

              </h3>




              <p>

                📍 {place.region}

              </p>




              <p>

                👤

                {" "}

                <b>

                {place.writer}

                </b>

              </p>



              <small>

                📅 {place.years}

              </small>




              <p>

                {place.description}

              </p>




              <strong>

                📚 Произведения:

              </strong>



              {

                place.works.map(work=>(

                  <div key={work}>

                    • {work}

                  </div>

                ))

              }




              <button

                style={{

                  marginTop:"15px",

                  background:"#E97824",

                  color:"#fff",

                  border:"none",

                  padding:"8px 16px",

                  borderRadius:"20px",

                  cursor:"pointer"

                }}

              >

                Подробнее

              </button>



            </div>



          </article>


        ))

      }


      </div>



    </section>

  );

}
