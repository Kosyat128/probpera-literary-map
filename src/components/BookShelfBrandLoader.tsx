import BrandQuillIcon from "./BrandQuillIcon";

type Props = {
  label: string;
};

export default function BookShelfBrandLoader({ label }: Props) {
  return (
    <div
      className="book-shelf-brand-loader"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="book-shelf-brand-loader__mark" aria-hidden="true">
        <BrandQuillIcon />
        <span className="book-shelf-brand-loader__progress" />
      </span>
      <span className="book-shelf-brand-loader__label">{label}</span>
    </div>
  );
}
