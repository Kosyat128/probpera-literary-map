import type { WriterProfile } from "./types";
import type { Writer } from "../types";

export function convertWriter(profile: WriterProfile): Writer {
  return {
    id: profile.id,
    name: profile.fullName,
    fullName: profile.fullName,
    years: `${profile.birth}${profile.death ? " — " + profile.death : ""}`,
    birth: profile.birth,
    death: profile.death,
    birthPlace: profile.birthPlace || "",
    deathPlace: profile.deathPlace,
    coordinates: [0,0],
    portrait: profile.portrait || "",
    bio: profile.biography,
    biography: profile.biography,
    works: profile.works,
    movement: profile.movement,
    languages: profile.languages,
    genres: profile.genres,
    nobel: Boolean(profile.nobelYear),
    nobelYear: profile.nobelYear
  };
}

export function convertWriters(profiles: WriterProfile[]): Writer[] {
  return profiles.map(convertWriter);
}
