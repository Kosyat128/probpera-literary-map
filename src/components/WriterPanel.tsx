import type { Country } from "../data/types";


type WriterPanelProps = {
  country: Country;
};


export default function WriterPanel({
  country,
}: WriterPanelProps) {


  return (

    <aside

      style={{

        width: "340px",

        padding: "20px",

        borderLeft:
          "1px solid #3b2a6b",

        overflowY: "auto",

        background:
          "#ffffff",

      }}

    >


      <h2>

        {country.name}

      </h2>



      <p>

        Писателей:

        {" "}

        {country.writers.length}

      </p>



      <h3>

        Известные авторы

      </h3>



      {country.writers.length === 0 ? (

        <p>

          Данные о писателях
          добавляются

        </p>


      ) : (


        <ul>


          {country.writers.map(
            (writer) => (

              <li

                key={writer.name}

                style={{

                  marginBottom:
                    "15px",

                }}

              >


                <strong>

                  {writer.name}

                </strong>


                <br />


                <small>

                  {writer.years}

                </small>


              </li>

            )

          )}


        </ul>


      )}


    </aside>

  );

}
