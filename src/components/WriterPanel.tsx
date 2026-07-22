import type { Country } from "../data/types";


type WriterPanelProps = {
  country: Country;
};



export default function WriterPanel({
  country,
}: WriterPanelProps) {


  const writers = country.writers;

  const mainWriter = writers[0];



  return (

    <aside

      style={{

        width:"380px",

        background:"#FFF8EE",

        borderRadius:"18px",

        padding:"20px",

        color:"#2B183F",

        overflowY:"auto",

        height:"620px",

        boxShadow:
        "0 5px 20px rgba(53,32,95,.15)",

      }}

    >



      {/* Верхняя панель */}

      <div

        style={{

          display:"flex",

          justifyContent:"space-between",

          marginBottom:"15px",

        }}

      >

        <button>←</button>

        <button>⭐</button>

        <button>↗</button>

      </div>





      <h2

        style={{

          color:"#35205F",

          marginBottom:"5px",

        }}

      >

        {country.name}

      </h2>



      <p>

        ✒️ Писателей:

        {" "}

        <b>

          {writers.length}

        </b>

      </p>






      {mainWriter && (

        <div

          style={{

            background:"#F7EBDD",

            borderRadius:"15px",

            padding:"15px",

            marginTop:"15px",

          }}

        >



          {mainWriter.portrait && (

            <img

              src={mainWriter.portrait}

              alt={mainWriter.name}

              style={{

                width:"100%",

                height:"160px",

                objectFit:"cover",

                borderRadius:"12px",

                marginBottom:"10px",

              }}

            />

          )}





          <h2

            style={{

              color:"#35205F",

            }}

          >

            {mainWriter.name}

          </h2>



          <p>

            📅 {mainWriter.years}

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

                padding:"6px 12px",

                borderRadius:"20px",

                fontSize:"13px",

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

          display:"grid",

          gridTemplateColumns:"repeat(4,1fr)",

          gap:"5px",

          margin:"20px 0",

          fontSize:"12px",

        }}

      >

        <button>Обзор</button>

        <button>Книги</button>

        <button>Места</button>

        <button>Связи</button>


      </div>







      {/* Шкалы */}


      <h3>

        Литературное наследие

      </h3>


      <Progress value={85}/>




      <h3>

        Влияние

      </h3>


      <Progress value={75}/>





      <h3>

        Материалы проекта

      </h3>


      <Progress value={60}/>








      {/* Авторы страны */}


      <h3

        style={{

          marginTop:"20px",

        }}

      >

        Известные авторы

      </h3>



      {

        writers.slice(0,6).map(writer=>(


          <div

            key={writer.id}

            style={{

              background:"#F7EBDD",

              padding:"10px",

              borderRadius:"10px",

              marginBottom:"8px",

            }}

          >

            <b>

              {writer.name}

            </b>


            <br/>


            <small>

              {writer.years}

            </small>


          </div>


        ))

      }







      {/* Произведения */}


      <h3>

        Основные произведения

      </h3>



      {

        mainWriter?.works?.map(work=>(


          <p key={work}>

            📖 {work}

          </p>


        ))

      }







      {/* Места */}


      <h3>

        Литературные места

      </h3>


      <div

        style={{

          background:"#F7EBDD",

          padding:"12px",

          borderRadius:"12px",

        }}

      >

        📍 Дом-музей писателя

        <br/>

        📍 Исторические места

      </div>







      {/* Связи */}


      <h3>

        Связи

      </h3>


      <div

        style={{

          height:"120px",

          background:"#F7EBDD",

          borderRadius:"15px",

          display:"flex",

          alignItems:"center",

          justifyContent:"center",

        }}

      >

        Граф литературных связей

      </div>




    </aside>

  );

}





function Progress({

 value

}:{

 value:number

}){


 return (

  <div

   style={{

    height:"12px",

    background:"#E6D5C0",

    borderRadius:"10px",

    marginBottom:"15px",

    overflow:"hidden",

   }}

  >

   <div

    style={{

     width:`${value}%`,

     height:"100%",

     background:"#E97824",

    }}

   />


  </div>

 );

}
