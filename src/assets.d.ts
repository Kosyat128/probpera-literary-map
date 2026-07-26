declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.geojson?raw" {
  const content: string;
  export default content;
}

declare module "*.geojson?url" {
  const url: string;
  export default url;
}
