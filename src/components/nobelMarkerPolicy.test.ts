import { describe, expect, it } from "vitest";

import {
  buildNobelMarkerPlan,
  nobelCoordinateDistanceDegrees,
  resolveNobelMarkerAnimation,
  resolveNobelMarkerDetailMode,
  type NobelMarkerSource,
} from "./nobelMarkerPolicy";

type CountryStub = { id: string };
type WriterStub = { id: string };

function laureate(
  countryId: string,
  writerId: string,
  lat: number,
  lng: number,
  year: number
): NobelMarkerSource<CountryStub, WriterStub> {
  return {
    countryId,
    countryName: `Country ${countryId}`,
    writerId,
    writerName: `Writer ${writerId}`,
    year,
    coordinates: { lat, lng },
    country: { id: countryId },
    writer: { id: writerId },
  };
}

describe("Nobel marker detail policy", () => {
  it("uses hysteresis so small zoom noise does not remount every marker", () => {
    expect(resolveNobelMarkerDetailMode(3.2)).toBe("individual");
    expect(resolveNobelMarkerDetailMode(3.2, "clustered")).toBe("clustered");
    expect(resolveNobelMarkerDetailMode(3.2, "individual")).toBe("individual");
    expect(resolveNobelMarkerDetailMode(3.36, "individual")).toBe("clustered");
    expect(resolveNobelMarkerDetailMode(3.04, "clustered")).toBe("individual");
  });
});

describe("Nobel marker clustering", () => {
  const entries = [
    laureate("fr", "alpha", 48.86, 2.35, 1901),
    laureate("fr", "beta", 49.1, 2.7, 1904),
    laureate("fr", "remote", 43.3, -1.6, 1910),
    laureate("be", "neighbour", 50.85, 4.35, 1912),
  ];

  it("keeps near view individual and produces stable ids independent of input order", () => {
    const forward = buildNobelMarkerPlan({ entries, mode: "individual" });
    const reverse = buildNobelMarkerPlan({
      entries: [...entries].reverse(),
      mode: "individual",
    });

    expect(forward.markers).toHaveLength(4);
    expect(forward.markers.every((marker) => marker.kind === "individual")).toBe(
      true
    );
    expect(reverse.markers.map((marker) => marker.id)).toEqual(
      forward.markers.map((marker) => marker.id)
    );
    expect(new Set(forward.markers.map((marker) => marker.id)).size).toBe(4);
  });

  it("renders one far marker per country even when its laureates are far apart", () => {
    const plan = buildNobelMarkerPlan({
      entries,
      mode: "clustered",
      clusterRadiusDegrees: 2,
    });
    const clusters = plan.markers.filter((marker) => marker.kind === "cluster");

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({ countryId: "fr", count: 3 });
    expect(plan.renderedMarkerCount).toBe(2);
    expect(plan.visibleLaureateCount).toBe(4);
    expect(plan.accessibleRows).toHaveLength(4);
  });

  it("treats longitude wrap-around as geographic proximity", () => {
    const dateLinePlan = buildNobelMarkerPlan({
      entries: [
        laureate("islands", "east", 10, 179.4, 1920),
        laureate("islands", "west", 10.1, -179.6, 1921),
      ],
      mode: "clustered",
      clusterRadiusDegrees: 2,
    });
    const marker = dateLinePlan.markers[0];

    expect(nobelCoordinateDistanceDegrees({ lat: 10, lng: 179.4 }, { lat: 10.1, lng: -179.6 })).toBeLessThan(2);
    expect(marker.kind).toBe("cluster");
    expect(Math.abs(marker.coordinates.lng)).toBeGreaterThan(179);
  });

  it("always peels the selected writer out into an individual marker", () => {
    const plan = buildNobelMarkerPlan({
      entries: entries.slice(0, 3),
      mode: "clustered",
      selectedWriterId: "alpha",
      clusterRadiusDegrees: 2,
    });

    expect(plan.clusterCount).toBe(1);
    expect(plan.markers).toHaveLength(2);
    expect(
      plan.markers.find((marker) => marker.kind === "cluster")
    ).toMatchObject({ kind: "cluster", countryId: "fr", count: 2 });
    expect(
      plan.markers.find(
        (marker) =>
          marker.kind === "individual" && marker.member.writerId === "alpha"
      )
    ).toMatchObject({ kind: "individual", selected: true });
  });

  it("deterministically displaces coincident near markers without changing source data", () => {
    const coincident = [
      laureate("se", "alpha", 59.3293, 18.0686, 1909),
      laureate("se", "beta", 59.3293, 18.0686, 1931),
      laureate("se", "gamma", 59.3293, 18.0686, 1974),
    ];
    const forward = buildNobelMarkerPlan({
      entries: coincident,
      mode: "individual",
    });
    const reverse = buildNobelMarkerPlan({
      entries: [...coincident].reverse(),
      mode: "individual",
    });
    const displayCoordinates = forward.markers.map((marker) => marker.coordinates);

    expect(
      new Set(displayCoordinates.map(({ lat, lng }) => `${lat}:${lng}`)).size
    ).toBe(3);
    expect(reverse.markers.map((marker) => marker.coordinates)).toEqual(
      displayCoordinates
    );
    for (const marker of forward.markers) {
      expect(marker.kind).toBe("individual");
      if (marker.kind !== "individual") continue;
      expect(marker.member.coordinates.lat).toBeCloseTo(59.3293, 8);
      expect(marker.member.coordinates.lng).toBeCloseTo(18.0686, 8);
    }
  });

  it("exposes one stable accessible row per laureate even when markers cluster", () => {
    const first = buildNobelMarkerPlan({
      entries: entries.slice(0, 2),
      mode: "clustered",
      clusterRadiusDegrees: 2,
    });
    const second = buildNobelMarkerPlan({
      entries: entries.slice(0, 2).reverse(),
      mode: "clustered",
      clusterRadiusDegrees: 2,
    });

    expect(first.accessibleRows.map((row) => row.id)).toEqual(
      second.accessibleRows.map((row) => row.id)
    );
    expect(first.accessibleRows.every((row) => row.clustered)).toBe(true);
    expect(
      first.accessibleRows.every(
        (row) => row.markerId === first.markers[0].id && row.label.includes("—")
      )
    ).toBe(true);
  });

  it("filters invalid coordinates and collapses duplicate identities deterministically", () => {
    const valid = laureate("fr", "alpha", 48.86, 2.35, 1901);
    const plan = buildNobelMarkerPlan({
      entries: [
        { ...valid, coordinates: { lat: 120, lng: 2 } },
        valid,
        valid,
      ],
      mode: "individual",
    });

    expect(plan).toMatchObject({
      sourceCount: 3,
      visibleLaureateCount: 1,
      skippedInvalidCount: 1,
      renderedMarkerCount: 1,
    });
  });
});

describe("Nobel marker animation policy", () => {
  it("allows only finite event-driven transitions and never a frame loop", () => {
    expect(resolveNobelMarkerAnimation("revealed")).toMatchObject({
      durationMs: 220,
      iterationCount: 1,
      requiresContinuousFrameLoop: false,
    });
    expect(resolveNobelMarkerAnimation("hovered")).toMatchObject({
      toScale: 1.08,
      iterationCount: 1,
      requiresContinuousFrameLoop: false,
    });
    expect(resolveNobelMarkerAnimation("idle")).toMatchObject({
      durationMs: 0,
      iterationCount: 0,
      requiresContinuousFrameLoop: false,
    });
  });

  it("turns all marker motion off under reduced motion", () => {
    expect(resolveNobelMarkerAnimation("selected", true)).toEqual({
      fromScale: 1.16,
      toScale: 1.16,
      durationMs: 0,
      iterationCount: 0,
      requiresContinuousFrameLoop: false,
    });
  });
});
