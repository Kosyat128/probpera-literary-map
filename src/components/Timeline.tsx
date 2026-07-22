type TimelineProps = {
  name?: string;
  years?: string;
};


export default function Timeline({
  name = "Лев Толстой",
  years = "1828–1910",
}: TimelineProps) {


  const points = [
    "1700",
    "1750",
    "1800",
    "1850",
    "1900",
    "1950",
    "2000",
    "2025",
  ];



  return (

    <section

      style={{

        background:"#F7EBDD",

        padding:"20px",

        borderRadius:"12px",

        color:"#35205F",

      }}

    >


      <div

        style={{

          display:"flex",

          justifyContent:"space-between",

          alignItems:"center",

        }}

      >

        <h3>

          ЛЕНТА ВРЕМЕНИ

        </h3>


        <button>

          Показать всех

        </button>


      </div>





      <div

        style={{

          position:"relative",

          marginTop:"35px",

          padding:"0 20px",

        }}

      >


        <div

          style={{

            height:"3px",

            background:"#35205F",

            position:"absolute",

            top:"15px",

            left:"20px",

            right:"20px",

          }}

        />



        <div

          style={{

            display:"flex",

            justifyContent:"space-between",

            position:"relative",

          }}

        >



        {

          points.map(

            point => (


              <div

                key={point}

                style={{

                  textAlign:"center",

                }}

              >


                <div

                  style={{

                    width:"14px",

                    height:"14px",

                    borderRadius:"50%",

                    background:

                      point==="1850"

                      ? "#E97824"

                      : "#35205F",

                    margin:"8px auto",

                  }}

                />



                <small>

                  {point}

                </small>


              </div>


            )

          )

        }


        </div>



        <div

          style={{

            marginTop:"25px",

            textAlign:"center",

            background:"#FFF8EE",

            padding:"10px",

            borderRadius:"10px",

            border:"1px solid #E97824",

          }}

        >

          <b>

            {name}

          </b>


          <br />


          {years}


        </div>


      </div>


    </section>

  );

}
