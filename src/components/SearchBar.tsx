import { Search } from 'lucide-react';

export function SearchBar({ value, onChange, placeholder = 'Search...' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="search-box">
      <Search size={17} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}
