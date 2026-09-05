import { CanvasTexture, ClampToEdgeWrapping, LinearMipmapLinearFilter, SRGBColorSpace } from "three";

/** Original, quiet bookbinding ornament; no external artwork or text. */
export function createBookEndpaperTexture(paperColor: string, bindingColor: string): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = paperColor;
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Open diamond lattice and pin dots stay subordinate to the facing text.
  context.strokeStyle = bindingColor;
  context.fillStyle = bindingColor;
  context.globalAlpha = 0.075;
  context.lineWidth = 0.8;
  for (let row = -1; row < 17; row += 1) {
    for (let column = -1; column < 12; column += 1) {
      const x = column * 48 + (row % 2 === 0 ? 0 : 24);
      const y = row * 48;
      context.beginPath();
      context.moveTo(x, y - 17);
      context.lineTo(x + 13, y);
      context.lineTo(x, y + 17);
      context.lineTo(x - 13, y);
      context.closePath();
      context.stroke();
      context.beginPath();
      context.arc(x, y, 1.1, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.globalAlpha = 0.11;
  context.lineWidth = 1;
  context.strokeRect(21.5, 21.5, canvas.width - 43, canvas.height - 43);
  context.globalAlpha = 1;

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  texture.name = "book-inspection-endpaper";
  return texture;
}
