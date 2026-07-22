import type { Country } from "../data/types";


type WriterPanelProps = {
  country: Country;
};



export default function WriterPanel({
  country,
}: WriterPanelProps) {


  const mainWriter = country.writers[0];



  return (

    <aside

      style={{

        width: "360px",

        padding: "18px",

        overflowY: "auto",

        background: "#F7EBDD",

        borderLeft:
          "1px solid #D8B98A",

        color: "#2B183F",

      }}

    >



      {/* Шапка страны */}

      <div

        style={{

          display: "flex",

          justifyContent: "space-between",

          marginBottom: "15px",

        }}

      >

        <button>

          ←

        </button>


        <button>

          →

        </button>


        <button>

          ✕

        </button>


      </div>




      <h2

        style={{

          color: "#35205F",

          marginBottom: "5px",

        }}

      >

        {country.name}

      </h2>




      <p>

        Писателей:

        {" "}

        <b>

          {country.writers.length}

        </b>

      </p>




      {/* Основной автор */}

      {mainWriter && (


        <div

          style={{

            background:"#FFF8EE",

            padding:"15px",

            borderRadius:"12px",

            marginBottom:"20px",

          }}

        >


          <h3

            style={{

              color:"#35205F"

            }}

          >

            {mainWriter.name}

          </h3>


          <p>

            {mainWriter.years}

          </p>



          {mainWriter.birthPlace && (

            <p>

              📍 {mainWriter.birthPlace}

            </p>

          )}



          {mainWriter.movement && (

            <span

              style={{

                background:"#35205F",

                color:"#fff",

                padding:"5px 10px",

                borderRadius:"15px",

              }}

            >

              {mainWriter.movement}

            </span>

          )}



        </div>


      )}






      {/* Вкладки */}

      <div

        style={{

          display:"flex",

          gap:"12px",

          fontSize:"13px",

          marginBottom:"20px",

        }}

      >

        <b>

          ОБЗОР

        </b>

        <span>

          ПРОИЗВЕДЕНИЯ

        </span>

        <span>

          МЕСТА

        </span>

        <span>

          СВЯЗИ

        </span>


      </div>






      {/* Шкалы */}


      <h3>

        Литературное наследие

      </h3>


      <Progress

        value={80}

      />



      <h3>

        Нобелевские лауреаты

      </h3>


      <Progress

        value={30}

      />



      <h3>

        Статьи на сайте

      </h3>


      <Progress

        value={65}

      />






      {/* Авторы */}


      <h3

        style={{

          marginTop:"20px"

        }}

      >

        Известные авторы

      </h3>



      {


        country.writers.slice(0,5).map(

          writer => (


            <div

              key={writer.id}

              style={{

                background:"#FFF8EE",

                padding:"10px",

                marginBottom:"8px",

                borderRadius:"10px",

              }}

            >


              <b>

                {writer.name}

              </b>


              <br />


              <small>

                {writer.years}

              </small>


            </div>


          )

        )

      }






      {/* Произведения */}


      <h3>

        Основные произведения

      </h3>



      {

        mainWriter?.works?.slice(0,5).map(

          work => (


            <p

              key={work}

            >

              📖 {work}

            </p>


          )

        )

      }






      {/* Связи */}


      <h3>

        Связи писателя

      </h3>



      <div

        style={{

          height:"120px",

          background:"#FFF8EE",

          borderRadius:"12px",

          display:"flex",

          alignItems:"center",

          justifyContent:"center",

        }}

      >

        Граф связей

      </div>



    </aside>

  );

}





function Progress({

  value

}:{

  value:number

}) {


  return (

    <div

      style={{

        background:"#E6D5C0",

        height:"12px",

        borderRadius:"10px",

        marginBottom:"15px",

      }}

    >

      <div

        style={{

          width:`${value}%`,

          height:"100%",

          background:"#E97824",

          borderRadius:"10px",

        }}

      />

    </div>

  );

}
