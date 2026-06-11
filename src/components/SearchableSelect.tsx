import { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

export interface SelectOption {
    value: string;
    label: string;
    sub?: string;
}

interface Props {
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    accentColor?: 'indigo' | 'emerald';
}

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = 'Search…',
    className = '',
    accentColor = 'indigo',
}: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selected = options.find(o => o.value === value);

    const filtered = query.trim()
        ? options.filter(o =>
              o.label.toLowerCase().includes(query.toLowerCase()) ||
              (o.sub && o.sub.toLowerCase().includes(query.toLowerCase()))
          )
        : options;

    const ring = accentColor === 'emerald' ? 'focus-within:ring-emerald-400' : 'focus-within:ring-indigo-400';
    const activeBg = accentColor === 'emerald'
        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
        : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300';
    const hoverBg = accentColor === 'emerald'
        ? 'hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
        : 'hover:bg-indigo-50 dark:hover:bg-indigo-950/30';

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    function handleOpen() {
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
    }

    function handleSelect(val: string) {
        onChange(val);
        setOpen(false);
        setQuery('');
    }

    function handleClear(e: React.MouseEvent) {
        e.stopPropagation();
        onChange('');
        setQuery('');
    }

    return (
        <div ref={ref} className={`relative ${className}`}>
            {/* Trigger */}
            <button
                type="button"
                onClick={handleOpen}
                className={`w-full flex items-center justify-between bg-muted/30 border border-border rounded-lg px-3 py-2 text-left transition hover:border-muted-foreground/40 focus:outline-none focus:ring-2 ${ring}`}
            >
                <span className={`text-sm truncate ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {selected ? selected.label : placeholder}
                </span>
                <span className="flex items-center gap-1 ml-2 flex-shrink-0">
                    {value && (
                        <X
                            className="w-3.5 h-3.5 text-muted-foreground hover:text-red-400 transition"
                            onClick={handleClear}
                        />
                    )}
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                </span>
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-[100] mt-1 w-full min-w-[200px] bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                    {/* Search input */}
                    <div className="p-2 border-b border-border">
                        <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-1.5">
                            <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Type to search…"
                                className="flex-1 bg-transparent text-sm focus:outline-none text-foreground placeholder-muted-foreground min-w-0"
                            />
                            {query && (
                                <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Options */}
                    <ul className="max-h-52 overflow-y-auto divide-y divide-border/50">
                        {filtered.length === 0 ? (
                            <li className="px-4 py-3 text-sm text-muted-foreground text-center italic">No results found</li>
                        ) : (
                            filtered.map(o => (
                                <li
                                    key={o.value}
                                    onClick={() => handleSelect(o.value)}
                                    className={`px-4 py-2.5 cursor-pointer transition ${
                                        value === o.value ? activeBg : `text-foreground ${hoverBg}`
                                    }`}
                                >
                                    <div className="text-sm font-medium">{o.label}</div>
                                    {o.sub && <div className="text-xs text-muted-foreground mt-0.5">{o.sub}</div>}
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
