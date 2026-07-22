import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";

import { countries } from "../data/countries";

export type WorldMapProps = {
  selectedCountry?: string;
  onCountrySelect?: (country: string) => void;
};


const countryIcon = new L.Icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",

  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});


function Recenter({
  center,
}: {
  center: LatLngExpression;
}) {
  const map = useMap();

  map.setView(center, 3);

  return null;
}


export default function WorldMap({
  selectedCountry = "France",
  onCountrySelect,
}: WorldMapProps) {

  const activeCountry =
    countries.find(
      (country) => country.name === selectedCountry
    ) ?? countries[0];


  return (
    <section
      style={{
        flex: 1,
        padding: "1rem",
      }}
    >

      <MapContainer
        center={activeCountry.coordinates}
        zoom={3}
        style={{
          height: "100%",
          minHeight: "600px",
          borderRadius: 12,
        }}
      >

        <Recenter
          center={activeCountry.coordinates}
        />


        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />


        {countries.map((country) => (

          <Marker

            key={country.id}

            position={country.coordinates}

            icon={countryIcon}

            eventHandlers={{
              click: () =>
                onCountrySelect?.(
                  country.name
                ),
            }}

          />

        ))}


      </MapContainer>

    </section>
  );
}
