type Props = {
  filled?: boolean;
  className?: string;
};

export default function BrandHeartIcon({
  filled = false,
  className = "",
}: Props) {
  return (
    <svg
      className={`brand-heart-icon${filled ? " is-filled" : ""}${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 20.25C9.8 18.32 4.25 14.14 4.25 9.1A4.35 4.35 0 0 1 12 6.38 4.35 4.35 0 0 1 19.75 9.1c0 5.04-5.55 9.22-7.75 11.15Z" />
    </svg>
  );
}
