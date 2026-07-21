type HeaderProps = {
  title?: string;
};

export default function Header({ title = 'LiteraryMap' }: HeaderProps) {
  return (
    <header style={{padding:'1rem 2rem',borderBottom:'1px solid #3b2a6b'}}>
      <h1>{title}</h1>
    </header>
  );
}
