export type WriterImage = {
  id: string;
  portrait: string;
  source?: string;
};

export const writerImages: WriterImage[] = [
  { id: "tolstoy", portrait: "/images/writers/tolstoy.jpg" },
  { id: "dostoevsky", portrait: "/images/writers/dostoevsky.jpg" },
  { id: "shakespeare", portrait: "/images/writers/shakespeare.jpg" }
];
