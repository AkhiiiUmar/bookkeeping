import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { BarChart3, TrendingUp, Calendar, ChevronLeft, ChevronRight, DollarSign, Package, Users, Flame } from 'lucide-react';

type DateRange = 'week' | 'month' | 'all';
type CalView = 'month' | 'week' | 'day';

function startOf(range: DateRange): Date {
    const now = new Date();
    if (range === 'week') { const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; }
    if (range === 'month') { return new Date(now.getFullYear(), now.getMonth(), 1); }
    return new Date(0);
}

export default function Analytics() {
    const { invoices, products, agencies, shopkeepers, payments } = useStore();
    const [dateRange, setDateRange] = useState<DateRange>('month');
    const [calView, setCalView] = useState<CalView>('month');
    const [calDate, setCalDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [activeTab, setActiveTab] = useState<'analytics' | 'calendar'>('analytics');

    // ── Filter invoices by range ─────────────────────────
    const rangeStart = useMemo(() => startOf(dateRange), [dateRange]);
    const filteredInvoices = useMemo(() =>
        invoices.filter(inv => new Date(inv.date) >= rangeStart),
        [invoices, rangeStart]);

    const totalRevenue = filteredInvoices.reduce((s, inv) => s + inv.total_amount, 0);

    // ── Revenue & profit per product ─────────────────────
    const productStats = useMemo(() => {
        const map: Record<string, { name: string; qty: number; revenue: number; cost: number }> = {};
        filteredInvoices.forEach(inv => {
            inv.items.forEach(item => {
                const prod = products.find(p => p.name === item.product_name);
                if (!map[item.product_name]) map[item.product_name] = { name: item.product_name, qty: 0, revenue: 0, cost: 0 };
                map[item.product_name].qty += item.quantity;
                map[item.product_name].revenue += item.amount;
                map[item.product_name].cost += (prod?.cost_price ?? 0) * item.quantity;
            });
        });
        return Object.values(map).sort((a, b) => b.revenue - a.revenue);
    }, [filteredInvoices, products]);

    // ── Revenue per agency ───────────────────────────────
    const agencyStats = useMemo(() => {
        const map: Record<string, { name: string; revenue: number; cost: number; units: number }> = {};
        filteredInvoices.forEach(inv => {
            inv.items.forEach(item => {
                const prod = products.find(p => p.name === item.product_name);
                const ag = prod ? agencies.find(a => a.id === prod.agency_id) : null;
                const key = ag?.name ?? 'Unknown';
                if (!map[key]) map[key] = { name: key, revenue: 0, cost: 0, units: 0 };
                map[key].revenue += item.amount;
                map[key].cost += (prod?.cost_price ?? 0) * item.quantity;
                map[key].units += item.quantity;
            });
        });
        return Object.values(map).sort((a, b) => b.revenue - a.revenue);
    }, [filteredInvoices, products, agencies]);

    // ── Top shopkeepers by purchase ──────────────────────
    const shopkeeperStats = useMemo(() => {
        const map: Record<string, { name: string; total: number; count: number }> = {};
        filteredInvoices.forEach(inv => {
            const sk = shopkeepers.find(s => s.id === inv.shopkeeper_id);
            const key = sk?.name ?? 'Unknown';
            if (!map[key]) map[key] = { name: key, total: 0, count: 0 };
            map[key].total += inv.total_amount;
            map[key].count += 1;
        });
        return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
    }, [filteredInvoices, shopkeepers]);

    const totalCost = productStats.reduce((s, p) => s + p.cost, 0);
    const totalProfit = totalRevenue - totalCost;
    const avgMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';

    // ── Calendar helpers ─────────────────────────────────
    const invoicesByDay = useMemo(() => {
        const map: Record<string, { total: number; count: number }> = {};
        invoices.forEach(inv => {
            const d = new Date(inv.date);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!map[key]) map[key] = { total: 0, count: 0 };
            map[key].total += inv.total_amount;
            map[key].count += 1;
        });
        return map;
    }, [invoices]);

    function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
    function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

    // Month calendar
    function getMonthDays(date: Date): (Date | null)[] {
        const year = date.getFullYear(), month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells: (Date | null)[] = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
        return cells;
    }

    // Week calendar
    function getWeekDays(date: Date): Date[] {
        const d = new Date(date);
        d.setDate(d.getDate() - d.getDay());
        return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x; });
    }

    const monthDays = getMonthDays(calDate);
    const weekDays = getWeekDays(calDate);
    const today = new Date();

    function navCal(dir: 1 | -1) {
        setCalDate(prev => {
            const d = new Date(prev);
            if (calView === 'month') d.setMonth(d.getMonth() + dir);
            else if (calView === 'week') d.setDate(d.getDate() + dir * 7);
            else d.setDate(d.getDate() + dir);
            return d;
        });
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const maxRevenue = productStats[0]?.revenue || 1;
    const maxAgencyRev = agencyStats[0]?.revenue || 1;

    const rangeOptions: { key: DateRange; label: string }[] = [
        { key: 'week', label: 'This Week' },
        { key: 'month', label: 'This Month' },
        { key: 'all', label: 'All Time' },
    ];

    return (
        <div className="space-y-6 text-foreground">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card p-6 rounded-xl shadow-sm border border-border gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Analytics & Calendar</h2>
                    <p className="text-muted-foreground text-sm">Revenue, profit, and sales timeline</p>
                </div>
                <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
                    <button onClick={() => setActiveTab('analytics')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition flex items-center gap-2 ${activeTab === 'analytics' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>
                        <BarChart3 className="w-4 h-4" /> Analytics
                    </button>
                    <button onClick={() => setActiveTab('calendar')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition flex items-center gap-2 ${activeTab === 'calendar' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>
                        <Calendar className="w-4 h-4" /> Calendar
                    </button>
                </div>
            </div>

            {/* ══════════ ANALYTICS TAB ══════════ */}
            {activeTab === 'analytics' && (
                <>
                    {/* Date range filter */}
                    <div className="flex gap-2">
                        {rangeOptions.map(r => (
                            <button key={r.key} onClick={() => setDateRange(r.key)}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition ${dateRange === r.key ? 'bg-indigo-600 text-white' : 'bg-card border border-border text-foreground hover:bg-muted/50'}`}>
                                {r.label}
                            </button>
                        ))}
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Revenue', value: `Rs ${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-indigo-650 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
                            { label: 'Total Cost', value: `Rs ${totalCost.toLocaleString()}`, icon: Package, color: 'text-slate-700 dark:text-slate-350', bg: 'bg-muted/40' },
                            { label: 'Gross Profit', value: `Rs ${totalProfit.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
                            { label: 'Avg Margin', value: `${avgMargin}%`, icon: Flame, color: 'text-orange-655 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30' },
                        ].map(k => (
                            <div key={k.label} className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center gap-4">
                                <div className={`p-3 rounded-lg ${k.bg}`}><k.icon className={`w-5 h-5 ${k.color}`} /></div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{k.label}</p>
                                    <p className={`text-xl font-bold font-mono ${k.color}`}>{k.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Revenue by Product */}
                        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-500" /> Revenue by Product</h3>
                            {productStats.length === 0 ? <p className="text-muted-foreground italic text-sm text-center py-6">No data for this period</p> : (
                                <div className="space-y-3">
                                    {productStats.map(p => {
                                        const profit = p.revenue - p.cost;
                                        const margin = p.revenue > 0 ? ((profit / p.revenue) * 100).toFixed(1) : '0';
                                        return (
                                            <div key={p.name}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="font-medium text-foreground truncate max-w-[60%]">{p.name}</span>
                                                    <div className="flex gap-3 text-xs">
                                                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">Rs {p.revenue.toLocaleString()}</span>
                                                        <span className="text-emerald-600 dark:text-emerald-400">+{margin}%</span>
                                                    </div>
                                                </div>
                                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(p.revenue / maxRevenue) * 100}%` }} />
                                                </div>
                                                <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                                                    <span>{p.qty} units sold</span>
                                                    <span>Profit: Rs {profit.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Revenue by Agency */}
                        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-purple-500" /> Revenue by Agency</h3>
                            {agencyStats.length === 0 ? <p className="text-muted-foreground italic text-sm text-center py-6">No data for this period</p> : (
                                <div className="space-y-3">
                                    {agencyStats.map((a, idx) => {
                                        const profit = a.revenue - a.cost;
                                        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                                        return (
                                            <div key={a.name}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="font-medium text-foreground">{medal} {a.name}</span>
                                                    <span className="font-mono text-purple-600 dark:text-purple-400 font-bold text-xs">Rs {a.revenue.toLocaleString()}</span>
                                                </div>
                                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(a.revenue / maxAgencyRev) * 100}%` }} />
                                                </div>
                                                <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                                                    <span>{a.units} units</span>
                                                    <span>Profit: Rs {profit.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top Shopkeepers */}
                    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-amber-500" /> Top Shopkeepers by Purchase</h3>
                        {shopkeeperStats.length === 0 ? <p className="text-muted-foreground italic text-sm text-center py-4">No data for this period</p> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {shopkeeperStats.map((s, idx) => (
                                    <div key={s.name} className="flex items-center gap-3 p-3 border border-border rounded-xl bg-muted/20">
                                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold text-sm flex-shrink-0">
                                            {idx + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-foreground text-sm truncate">{s.name}</p>
                                            <p className="text-xs text-muted-foreground">{s.count} invoices</p>
                                        </div>
                                        <p className="ml-auto font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">Rs {s.total.toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ══════════ CALENDAR TAB ══════════ */}
            {activeTab === 'calendar' && (
                <div className="space-y-4">
                    {/* Calendar controls */}
                    <div className="bg-card rounded-xl border border-border p-4 shadow-sm flex items-center justify-between">
                        <button onClick={() => navCal(-1)} className="p-2 hover:bg-muted rounded-lg transition"><ChevronLeft className="w-5 h-5 text-foreground" /></button>
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-foreground text-lg">
                                {calView === 'month' && calDate.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
                                {calView === 'week' && `Week of ${getWeekDays(calDate)[0].toLocaleDateString('en', { month: 'short', day: 'numeric' })}`}
                                {calView === 'day' && calDate.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                            </h3>
                            <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                                {(['month', 'week', 'day'] as CalView[]).map(v => (
                                    <button key={v} onClick={() => setCalView(v)}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition capitalize ${calView === v ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button onClick={() => navCal(1)} className="p-2 hover:bg-muted rounded-lg transition"><ChevronRight className="w-5 h-5 text-foreground" /></button>
                    </div>

                    {/* Month view */}
                    {calView === 'month' && (
                        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                            <div className="grid grid-cols-7 border-b border-border bg-muted/40">
                                {dayNames.map(d => <div key={d} className="p-3 text-xs font-semibold text-muted-foreground text-center">{d}</div>)}
                            </div>
                            <div className="grid grid-cols-7">
                                {monthDays.map((day, idx) => {
                                    if (!day) return <div key={idx} className="h-20 border-b border-r border-border/50 bg-muted/10" />;
                                    const data = invoicesByDay[dayKey(day)];
                                    const isToday = isSameDay(day, today);
                                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                                    return (
                                        <div key={idx} onClick={() => { setSelectedDay(day); setCalView('day'); setCalDate(day); }}
                                            className={`h-20 border-b border-r border-border/50 p-2 cursor-pointer transition hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 ${isSelected ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''}`}>
                                            <span className={`text-xs font-bold inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-foreground'}`}>
                                                {day.getDate()}
                                            </span>
                                            {data && (
                                                <div className="mt-1">
                                                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">Rs {data.total.toLocaleString()}</div>
                                                    <div className="text-xs text-muted-foreground">{data.count} sale{data.count !== 1 ? 's' : ''}</div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Week view */}
                    {calView === 'week' && (
                        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                            <div className="grid grid-cols-7 divide-x divide-border">
                                {weekDays.map((day, idx) => {
                                    const data = invoicesByDay[dayKey(day)];
                                    const isToday = isSameDay(day, today);
                                    const dayInvs = invoices.filter(inv => isSameDay(new Date(inv.date), day));
                                    return (
                                        <div key={idx} className={`min-h-40 p-3 cursor-pointer hover:bg-indigo-50/20 dark:hover:bg-indigo-950/15 transition ${isToday ? 'bg-indigo-50/10 dark:bg-indigo-950/10' : ''}`}
                                            onClick={() => { setSelectedDay(day); setCalView('day'); setCalDate(day); }}>
                                            <div className="text-center mb-2">
                                                <div className="text-xs text-muted-foreground">{dayNames[idx]}</div>
                                                <span className={`text-lg font-bold inline-flex items-center justify-center w-8 h-8 rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-foreground'}`}>
                                                    {day.getDate()}
                                                </span>
                                            </div>
                                            {data && <div className="text-center">
                                                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Rs {data.total.toLocaleString()}</div>
                                                <div className="text-xs text-muted-foreground">{data.count} sales</div>
                                            </div>}
                                            <div className="mt-2 space-y-1">
                                                {dayInvs.slice(0, 2).map(inv => {
                                                    const sk = shopkeepers.find(s => s.id === inv.shopkeeper_id);
                                                    return (
                                                        <div key={inv.id} className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded px-1.5 py-0.5 truncate border border-indigo-100 dark:border-indigo-900/50">
                                                            {sk?.name ?? 'Unknown'}
                                                        </div>
                                                    );
                                                })}
                                                {dayInvs.length > 2 && <div className="text-xs text-muted-foreground">+{dayInvs.length - 2} more</div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Day view */}
                    {calView === 'day' && (
                        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                                <h4 className="font-bold text-foreground">{calDate.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</h4>
                                {(() => {
                                    const data = invoicesByDay[dayKey(calDate)];
                                    return data ? <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">Rs {data.total.toLocaleString()} total</span> : null;
                                })()}
                            </div>
                            {(() => {
                                const dayInvs = invoices.filter(inv => isSameDay(new Date(inv.date), calDate))
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                const dayPmts = payments.filter(p => isSameDay(new Date(p.date), calDate));
                                if (dayInvs.length === 0 && dayPmts.length === 0) return (
                                    <div className="p-10 text-center text-muted-foreground italic">No activity on this day</div>
                                );
                                return (
                                    <div className="divide-y divide-border">
                                        {dayInvs.map(inv => {
                                            const sk = shopkeepers.find(s => s.id === inv.shopkeeper_id);
                                            return (
                                                <div key={inv.id} className="p-4 hover:bg-muted/10 transition">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">Invoice</span>
                                                                <span className="text-xs text-muted-foreground">{new Date(inv.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                            <p className="font-semibold text-foreground">{sk?.name ?? 'Unknown'}</p>
                                                            <p className="text-xs text-muted-foreground mt-0.5">{inv.items.length} item{inv.items.length !== 1 ? 's' : ''}</p>
                                                        </div>
                                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">Rs {inv.total_amount.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {dayPmts.map(p => {
                                            const sk = shopkeepers.find(s => s.id === p.shopkeeper_id);
                                            return (
                                                <div key={p.id} className="p-4 hover:bg-muted/10 transition">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">Payment</span>
                                                                <span className="text-xs text-muted-foreground">{new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                            <p className="font-semibold text-foreground">{sk?.name ?? 'Unknown'}</p>
                                                            {p.note && <p className="text-xs text-muted-foreground italic mt-0.5">{p.note}</p>}
                                                        </div>
                                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">Rs {p.amount.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
