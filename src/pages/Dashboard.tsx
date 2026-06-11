import { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import {
    Users, FileText, Receipt, AlertCircle, ShoppingCart, Package, 
    Building2, Search, X, Flame, Skull, BarChart3, TrendingUp, 
    TrendingDown, Wallet, ChevronDown
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

type FilterType = 'all' | 'shopkeepers' | 'products' | 'agencies' | 'payments';

export default function Dashboard() {
    const { shopkeepers, agencies, products, invoices, payments, dailyExpenses } = useStore();
    const navigate = useNavigate();

    const [greeting, setGreeting] = useState('Good Afternoon');
    const [userName, setUserName] = useState('Olivia Rhye');

    useEffect(() => {
        const hrs = new Date().getHours();
        if (hrs < 12) setGreeting('Good Morning');
        else if (hrs < 18) setGreeting('Good Afternoon');
        else setGreeting('Good Evening');

        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                const namePart = user.email ? user.email.split('@')[0] : 'admin';
                setUserName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
            }
        });
    }, []);

    const totalSales = invoices.reduce((acc, inv) => acc + inv.total_amount, 0);
    const totalPendingBalance = shopkeepers.reduce((acc, s) => acc + s.current_balance, 0);
    const totalPaymentsReceived = payments.reduce((acc, p) => acc + p.amount, 0);
    const totalExpenses = dailyExpenses.reduce((acc, e) => acc + e.amount, 0);
    const totalOwedAgencies = agencies.reduce((acc, a) => acc + a.current_balance, 0);

    const agencyStockData = useMemo(() => agencies.map(agency => {
        const ap = products.filter(p => p.agency_id === agency.id);
        const totalValue = ap.reduce((s, p) => s + p.current_stock * p.default_price, 0);
        const totalStock = ap.reduce((s, p) => s + p.current_stock, 0);
        return { agency, products: ap, totalValue, totalStock };
    }).sort((a, b) => b.totalValue - a.totalValue), [agencies, products]);

    const totalStockValue = agencyStockData.reduce((s, a) => s + a.totalValue, 0);

    const agencyPerformance = useMemo(() => {
        const rev: Record<string, number> = {};
        const units: Record<string, number> = {};
        invoices.forEach(inv => inv.items.forEach(item => {
            const prod = products.find(p => p.name === item.product_name);
            if (prod) {
                rev[prod.agency_id] = (rev[prod.agency_id] || 0) + item.amount;
                units[prod.agency_id] = (units[prod.agency_id] || 0) + item.quantity;
            }
        }));
        return agencies.map(a => ({ ...a, revenue: rev[a.id] || 0, unitsSold: units[a.id] || 0 }))
            .sort((a, b) => b.revenue - a.revenue);
    }, [agencies, products, invoices]);

    const hotItems = useMemo(() => {
        const map: Record<string, { name: string; qty: number; revenue: number }> = {};
        invoices.forEach(inv => inv.items.forEach(item => {
            if (!map[item.product_name]) map[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 };
            map[item.product_name].qty += item.quantity;
            map[item.product_name].revenue += item.amount;
        }));
        return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
    }, [invoices]);

    const deadItems = useMemo(() => {
        const sold = new Set(invoices.flatMap(inv => inv.items.map(i => i.product_name)));
        return products.filter(p => !sold.has(p.name));
    }, [products, invoices]);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchFilter, setSearchFilter] = useState<FilterType>('all');
    const [searchOpen, setSearchOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const h = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return null;
        const q = searchQuery.toLowerCase();
        const r: { type: string; label: string; sub: string; path: string }[] = [];
        if (searchFilter === 'all' || searchFilter === 'shopkeepers')
            shopkeepers.filter(s => s.name.toLowerCase().includes(q)).forEach(s =>
                r.push({ type: 'Shopkeeper', label: s.name, sub: `Balance: Rs ${s.current_balance}`, path: `/shopkeepers/${s.id}` }));
        if (searchFilter === 'all' || searchFilter === 'products')
            products.filter(p => p.name.toLowerCase().includes(q)).forEach(p => {
                const ag = agencies.find(a => a.id === p.agency_id);
                r.push({ type: 'Product', label: p.name, sub: `${ag?.name ?? ''} · Stock: ${p.current_stock}`, path: '/inventory' });
            });
        if (searchFilter === 'all' || searchFilter === 'agencies')
            agencies.filter(a => a.name.toLowerCase().includes(q)).forEach(a =>
                r.push({ type: 'Agency', label: a.name, sub: `${products.filter(p => p.agency_id === a.id).length} products`, path: '/inventory' }));
        if (searchFilter === 'all' || searchFilter === 'payments')
            payments.filter(p => { const sk = shopkeepers.find(s => s.id === p.shopkeeper_id); return sk?.name.toLowerCase().includes(q) || p.note?.toLowerCase().includes(q); })
                .slice(0, 5).forEach(p => { const sk = shopkeepers.find(s => s.id === p.shopkeeper_id); r.push({ type: 'Payment', label: `Rs ${p.amount} — ${sk?.name ?? ''}`, sub: new Date(p.date).toLocaleDateString(), path: '/payments' }); });
        return r;
    }, [searchQuery, searchFilter, shopkeepers, products, agencies, payments]);

    const typeColors: Record<string, string> = {
        Shopkeeper: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
        Product: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        Agency: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
        Payment: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    };
    const filters: { key: FilterType; label: string }[] = [
        { key: 'all', label: 'All' }, 
        { key: 'shopkeepers', label: 'Shopkeepers' }, 
        { key: 'products', label: 'Products' }, 
        { key: 'agencies', label: 'Agencies' }, 
        { key: 'payments', label: 'Payments' }
    ];

    return (
        <div className="space-y-6">
            {/* Header Greeting Section */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-foreground">{greeting}, {userName}!</h2>
                    <p className="text-sm text-muted-foreground mt-1.5">Welcome back! Here's an overview of your distribution business.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0 sm:items-center w-full xl:w-auto">
                    {/* Action Buttons - Hierarchy: Tertiary, Secondary, Primary */}
                    <Link to="/payments" className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition text-center">
                        Add Payment
                    </Link>
                    <Link to="/invoices" className="px-4 py-2 text-sm font-semibold border border-border bg-card text-foreground hover:bg-muted rounded-xl shadow-sm transition text-center">
                        Cash Memo
                    </Link>
                    <Link to="/orders" className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl font-semibold transition shadow-sm text-sm">
                        <ShoppingCart className="w-4 h-4" /> Add Order
                    </Link>

                    {/* Global Search and Filter System */}
                    <div ref={searchRef} className="relative w-full sm:w-auto sm:min-w-[320px]">
                        <div className="flex items-center gap-2 px-1 bg-card border border-border rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                            {/* Filter Dropdown */}
                            <div className="relative group">
                                <select 
                                    className="appearance-none bg-transparent text-xs font-semibold text-muted-foreground hover:text-foreground pl-3 pr-6 py-2.5 outline-none cursor-pointer z-10 relative"
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value as FilterType)}
                                >
                                    {filters.map(f => (
                                        <option key={f.key} value={f.key} className="bg-card text-foreground">{f.label}</option>
                                    ))}
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground group-hover:text-foreground transition-colors" />
                            </div>
                            <div className="w-px h-5 bg-border"></div>
                            
                            {/* Search Input */}
                            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-1" />
                            <input ref={searchInputRef} value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)}
                                placeholder="Search..."
                                className="flex-1 text-sm text-foreground placeholder-muted-foreground focus:outline-none bg-transparent py-2.5 min-w-[120px]" />
                            
                            {/* Actions / Shortcuts */}
                            <div className="flex items-center gap-1.5 flex-shrink-0 pr-2">
                                {searchQuery ? (
                                    <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }} className="hover:bg-muted p-1 rounded-md transition-colors"><X className="w-3.5 h-3.5 text-muted-foreground hover:text-red-400" /></button>
                                ) : (
                                    <span className="hidden sm:inline-block text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">⌘K</span>
                                )}
                            </div>
                        </div>

                        {/* Search Results Dropdown */}
                        {searchOpen && searchResults && (
                            <div className="absolute z-50 mt-2.5 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 duration-150">
                                {searchResults.length === 0 ? (
                                    <div className="px-5 py-4 text-sm text-muted-foreground text-center italic">No results for "{searchQuery}"</div>
                                ) : (
                                    <ul className="max-h-80 overflow-y-auto divide-y divide-border">
                                        {searchResults.map((r, i) => (
                                            <li key={i}>
                                                <button onClick={() => { navigate(r.path); setSearchOpen(false); setSearchQuery(''); }}
                                                    className="w-full text-left px-5 py-3 hover:bg-muted/50 transition flex items-center gap-3">
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${typeColors[r.type]}`}>{r.type}</span>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold text-foreground truncate">{r.label}</div>
                                                        <div className="text-xs text-muted-foreground truncate">{r.sub}</div>
                                                    </div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Premium KPI Box Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
                <KPIBox title="Total Sales" value={`Rs ${totalSales.toLocaleString()}`} subtext={`${invoices.length} cash memos`} icon={FileText} color="text-[#5f69e1]" />
                <KPIBox title="Pending Amount" value={`Rs ${totalPendingBalance.toLocaleString()}`} subtext="From shopkeepers" icon={AlertCircle} color="text-red-500" />
                <KPIBox title="Received Payments" value={`Rs ${totalPaymentsReceived.toLocaleString()}`} subtext="In bank/cash accounts" icon={Receipt} color="text-emerald-500" />
                <KPIBox title="Total Stock Value" value={`Rs ${totalStockValue.toLocaleString()}`} subtext="Available warehouse stock" icon={Package} color="text-indigo-500" />
                <KPIBox title="Daily Expenses" value={`Rs ${totalExpenses.toLocaleString()}`} subtext="Business & household" icon={Wallet} color="text-rose-500" />
                <KPIBox title="Owed to Agencies" value={`Rs ${totalOwedAgencies.toLocaleString()}`} subtext="Outstanding credit balances" icon={Building2} color="text-amber-500" />
            </div>

            {/* Stock Value by Agency Section */}
            <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                <div className="flex items-center gap-2 mb-5">
                    <Package className="w-5 h-5 text-[#7F56D9]" />
                    <h3 className="text-lg font-bold text-[#181D27]">Stock Value by Agency</h3>
                    <span className="ml-auto text-xs font-mono font-bold text-[#6941C6] bg-[#F4EBFF] border border-[#D6BBFB] px-3 py-1 rounded-full">Total: Rs {totalStockValue.toLocaleString()}</span>
                </div>
                {agencies.length === 0 ? <p className="text-sm text-muted-foreground italic text-center py-6">No agencies added yet</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {agencyStockData.map(({ agency, products: ap, totalValue, totalStock }) => (
                            <div key={agency.id} className="border border-[#E8E8E8] rounded-2xl p-5 bg-white hover:border-[#D6BBFB] hover:shadow-md transition duration-150">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-[#7F56D9]" />
                                        <span className="font-bold text-[#181D27] text-sm">{agency.name}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-[#6941C6] bg-[#F4EBFF] border border-[#D6BBFB] px-2.5 py-0.5 rounded-full">{ap.length} products</span>
                                </div>
                                <div className="flex justify-between items-end mb-3">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Value</p>
                                        <span className="text-xl font-extrabold font-sans text-[#5f69e1] dark:text-indigo-400">Rs {totalValue.toLocaleString()}</span>
                                    </div>
                                    <span className="text-xs font-semibold text-[#475467]">{totalStock} units</span>
                                </div>
                                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden mb-3">
                                    <div className="h-full bg-[#5f69e1] rounded-full" style={{ width: totalStockValue > 0 ? `${(totalValue / totalStockValue) * 100}%` : '0%' }} />
                                </div>
                                <div className="space-y-1.5 mt-2 border-t border-slate-100 dark:border-slate-800/55 pt-3">
                                    {ap.slice(0, 3).map(p => (
                                        <div key={p.id} className="flex justify-between text-xs text-muted-foreground">
                                            <span className="truncate mr-2 font-medium">{p.name}</span>
                                            <span className="font-mono flex-shrink-0">{p.current_stock}×{p.default_price}=<strong className="text-foreground font-semibold">Rs {(p.current_stock * p.default_price).toLocaleString()}</strong></span>
                                        </div>
                                    ))}
                                    {ap.length > 3 && (
                                        <div className="text-[10px] text-center text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer pt-1" onClick={() => navigate('/inventory')}>
                                            + {ap.length - 3} more products in inventory
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Performance Ledger Summary Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Agency Performance */}
                <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <BarChart3 className="w-5 h-5 text-purple-500" />
                        <h3 className="text-lg font-bold text-foreground">Agency Performance</h3>
                    </div>
                    {agencyPerformance.every(a => a.revenue === 0) ? <p className="text-sm text-muted-foreground italic text-center py-6">No sales data yet</p> : (
                        <div className="space-y-4.5">
                            {agencyPerformance.map((a, idx) => {
                                const maxR = agencyPerformance[0]?.revenue || 1;
                                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                                return (
                                    <div key={a.id}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-foreground"><span className="mr-1">{medal}</span>{a.name}</span>
                                            <span className="text-xs font-semibold font-mono text-[#475467]">Rs {a.revenue.toLocaleString()}</span>
                                        </div>
                                        <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${idx === 0 ? 'bg-purple-500' : idx === 1 ? 'bg-purple-400' : 'bg-purple-300'}`} style={{ width: `${(a.revenue / maxR) * 100}%` }} />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">{a.unitsSold} units sold</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Hot & Dead Items container */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Hot Items */}
                    <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Flame className="w-5 h-5 text-orange-500" />
                            <h3 className="text-lg font-bold text-foreground">🔥 Hot Items</h3>
                            <span className="text-[10px] font-bold text-muted-foreground bg-card border border-border px-2.5 py-0.5 rounded-full shadow-sm ml-auto">Top Sales</span>
                        </div>
                        {hotItems.length === 0 ? <p className="text-sm text-muted-foreground italic text-center py-4">No sales data yet</p> : (
                            <div className="space-y-4">
                                {hotItems.map((item, idx) => {
                                    const maxQ = hotItems[0]?.qty || 1;
                                    const cols = ['bg-orange-500', 'bg-orange-400', 'bg-amber-400', 'bg-yellow-400', 'bg-yellow-300'];
                                    return (
                                        <div key={item.name} className="flex items-center gap-3">
                                            <span className="text-xs font-mono font-bold text-[#475467] w-5 text-center">{idx + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-bold text-foreground truncate">{item.name}</span>
                                                    <div className="flex gap-3 flex-shrink-0 ml-2">
                                                        <span className="text-xs font-semibold text-[#475467]"><strong className="text-orange-500 font-bold">{item.qty}</strong> units</span>
                                                        <span className="text-xs font-mono font-semibold text-muted-foreground">Rs {item.revenue.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${cols[idx] || 'bg-muted-foreground'}`} style={{ width: `${(item.qty / maxQ) * 100}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Dead Items */}
                    <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Skull className="w-5 h-5 text-muted-foreground" />
                            <h3 className="text-lg font-bold text-foreground">💀 Dead Items</h3>
                            <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 px-2.5 py-0.5 rounded-full ml-auto">{deadItems.length} products · zero sales</span>
                        </div>
                        {deadItems.length === 0 ? (
                            <div className="text-center py-4"><TrendingUp className="w-8 h-8 text-emerald-400 mx-auto mb-2" /><p className="text-sm text-emerald-600 font-semibold">All products have sales!</p></div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {deadItems.slice(0, 10).map(p => {
                                    const ag = agencies.find(a => a.id === p.agency_id);
                                    return (
                                        <div key={p.id} className="flex items-center gap-1.5 bg-muted border border-border rounded-xl px-3 py-1.5 transition hover:bg-muted/50">
                                            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                                            <span className="text-xs text-foreground font-semibold">{p.name}</span>
                                            {ag && <span className="text-[10px] text-muted-foreground font-medium">({ag.name})</span>}
                                            <span className="text-[10px] font-mono text-muted-foreground ml-1">{p.current_stock} in stock</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Shopkeepers Overview */}
            <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-lg font-bold text-foreground">Shopkeepers Overview</h3>
                    <span className="text-[10px] font-bold text-muted-foreground bg-card border border-border px-2.5 py-0.5 rounded-full shadow-sm ml-auto">{shopkeepers.length} total</span>
                </div>
                {shopkeepers.length === 0 ? <p className="text-sm text-muted-foreground italic text-center py-6">No shopkeepers added yet</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {shopkeepers.slice(0, 6).map(s => (
                            <Link key={s.id} to={`/shopkeepers/${s.id}`} className="flex justify-between items-center p-4 border border-border rounded-2xl bg-card hover:border-indigo-600 hover:bg-muted/50 transition duration-150 shadow-sm">
                                <div>
                                    <p className="font-bold text-foreground text-sm">{s.name}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{s.phone || 'No phone number'}</p>
                                </div>
                                <span className={`text-sm font-mono font-bold ${s.current_balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>Rs {s.current_balance}</span>
                            </Link>
                        ))}
                    </div>
                )}
                {shopkeepers.length > 6 && (
                    <div className="mt-4.5 text-center"><Link to="/shopkeepers" className="text-sm font-bold text-[#5f69e1] hover:underline">View all {shopkeepers.length} shopkeepers →</Link></div>
                )}
            </div>
        </div>
    );
}

function KPIBox({ title, value, subtext, icon: Icon, color = 'text-primary' }: { title: string; value: string; subtext?: string; icon: React.ElementType; color?: string }) {
    return (
        <div className="bg-card p-6 rounded-2xl shadow-sm border border-border flex flex-col justify-between hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</span>
                <div className={`p-2.5 rounded-xl bg-muted ${color}`}><Icon className="w-5 h-5" /></div>
            </div>
            <div>
                <h3 className="text-2xl font-extrabold font-sans text-foreground tracking-tight">{value}</h3>
                {subtext && (
                    <p className="text-[10px] font-bold text-muted-foreground mt-2 flex items-center gap-1">
                        {subtext}
                    </p>
                )}
            </div>
        </div>
    );
}
