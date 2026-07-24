export type WriterImage = {
  id: string;
  portrait: string;
  source?: string;
};

export const writerImages: WriterImage[] = [
  { id: "tolstoy", portrait: "/images/writers/tolstoy.jpg" },
  { id: "dostoevsky", portrait: "/images/writers/dostoevsky.jpg" },
  { id: "shakespeare", portrait: "/images/writers/shakespeare.jpg" },
  { id: "hemingway", portrait: "/images/writers/hemingway.jpg" },
  { id: "murakami", portrait: "/images/writers/murakami.jpg" },
  { id: "marquez", portrait: "/images/writers/marquez.jpg" },
  { id: "kafka", portrait: "/images/writers/kafka.jpg" },
  { id: "orwell", portrait: "/images/writers/orwell.jpg" },
  { id: "hugo", portrait: "/images/writers/hugo.jpg" },
  { id: "goethe", portrait: "/images/writers/goethe.jpg" }
];
