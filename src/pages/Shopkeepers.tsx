import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, X, User, Download, Search, MapPin, ChevronRight, Phone, SlidersHorizontal, ChevronDown, BookOpen } from 'lucide-react';
import type { Shopkeeper } from '../store/useStore';
import { printHtml } from '../utils/print';

interface ShopkeeperForm { name: string; phone: string; address: string; opening_balance: string; }
const emptyForm: ShopkeeperForm = { name: '', phone: '', address: '', opening_balance: '' };

/** Extract the last meaningful word/segment from an address for a location pill */
function extractLocation(address: string): string {
    // Take everything after last comma, or full string if no comma
    const parts = address.split(',').map(p => p.trim()).filter(Boolean);
    return parts[parts.length - 1] ?? address.trim();
}

/** Get initials from a name */
function initials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase() ?? '')
        .join('');
}

/** A stable colour from a string (cycles through brand-friendly hues) */
const AVATAR_COLORS: [string, string][] = [
    ['#EDE9FE', '#6D28D9'],
    ['#D1FAE5', '#065F46'],
    ['#FEF3C7', '#92400E'],
    ['#DBEAFE', '#1E40AF'],
    ['#FCE7F3', '#9D174D'],
    ['#E0F2FE', '#075985'],
];
function avatarColor(name: string): [string, string] {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default function Shopkeepers() {
    const { shopkeepers, addShopkeeper, updateShopkeeper, deleteShopkeeper, setOpeningBalance } = useStore();

    const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; editing?: Shopkeeper }>({ open: false, mode: 'add' });
    const [form, setForm] = useState<ShopkeeperForm>(emptyForm);
    const [deleteConfirm, setDeleteConfirm] = useState<Shopkeeper | null>(null);
    const [search, setSearch] = useState('');
    const [locationFilter, setLocationFilter] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [khataModal, setKhataModal] = useState<{ open: boolean; shopkeeper: Shopkeeper | null; value: string }>({ open: false, shopkeeper: null, value: '' });

    // ── Derive unique location chips from addresses ──────────────────────
    const locationOptions = useMemo(() => {
        const set = new Set<string>();
        shopkeepers.forEach(s => {
            if (s.address) set.add(extractLocation(s.address));
        });
        return Array.from(set).sort();
    }, [shopkeepers]);

    // ── Filtered list ────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        return shopkeepers.filter(s => {
            const matchSearch =
                !q ||
                s.name.toLowerCase().includes(q) ||
                (s.phone ?? '').includes(q) ||
                (s.address ?? '').toLowerCase().includes(q);
            const matchLocation =
                locationFilter === 'all' ||
                (s.address && extractLocation(s.address) === locationFilter);
            return matchSearch && matchLocation;
        });
    }, [shopkeepers, search, locationFilter]);

    // ── Modal helpers ────────────────────────────────────────────────────
    function openAdd() {
        setForm(emptyForm);
        setModal({ open: true, mode: 'add' });
    }
    function openEdit(s: Shopkeeper) {
        setForm({ name: s.name, phone: s.phone ?? '', address: s.address ?? '', opening_balance: '' });
        setModal({ open: true, mode: 'edit', editing: s });
    }
    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name.trim()) return;
        const opening = parseFloat(form.opening_balance) || 0;
        const data = { name: form.name.trim(), phone: form.phone.trim() || undefined, address: form.address.trim() || undefined, opening_balance: opening };
        if (modal.mode === 'add') addShopkeeper(data);
        else if (modal.editing) updateShopkeeper(modal.editing.id, { name: data.name, phone: data.phone, address: data.address });
        setModal({ open: false, mode: 'add' });
    }
    function openKhata(s: Shopkeeper) {
        setKhataModal({ open: true, shopkeeper: s, value: (s.opening_balance ?? 0).toString() });
    }
    function handleSaveKhata() {
        if (!khataModal.shopkeeper) return;
        const amount = parseFloat(khataModal.value) || 0;
        setOpeningBalance(khataModal.shopkeeper.id, amount);
        setKhataModal({ open: false, shopkeeper: null, value: '' });
    }

    // ── Export ───────────────────────────────────────────────────────────
    function exportPendingBills() {
        const pending = shopkeepers.filter(s => s.current_balance > 0).sort((a, b) => b.current_balance - a.current_balance);
        if (pending.length === 0) { alert('No pending bills found!'); return; }
        const totalPending = pending.reduce((acc, s) => acc + s.current_balance, 0);
        const tableRows = pending.map(s => `
            <tr>
                <td style="padding:8px;border-bottom:1px solid #eaecf0">${s.name}</td>
                <td style="padding:8px;border-bottom:1px solid #eaecf0">${s.phone || '-'}</td>
                <td style="padding:8px;border-bottom:1px solid #eaecf0">${s.address || '-'}</td>
                <td style="padding:8px;border-bottom:1px solid #eaecf0;text-align:right;font-weight:bold;color:#b42318">Rs ${s.current_balance.toLocaleString()}</td>
            </tr>`).join('');
        printHtml(`<html><head><title>Pending Bills Report</title><style>
            body{font-family:'Inter',sans-serif;padding:40px;color:#101828}
            .header{text-align:center;margin-bottom:30px;border-bottom:2px solid #eaecf0;padding-bottom:20px}
            h1{color:#b42318;margin:0 0 10px 0}
            table{width:100%;border-collapse:collapse;margin-top:20px;text-align:left}
            th{background:#f8f9fc;padding:10px 8px;border-bottom:2px solid #eaecf0;color:#475467;font-size:14px}
            .total{font-size:18px;font-weight:bold;text-align:right;margin-top:20px;color:#b42318}
        </style></head><body onload="window.print()">
            <div class="header"><h1>PENDING BILLS REPORT</h1>
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p></div>
            <table><thead><tr>
                <th>Shopkeeper Name</th><th>Phone</th><th>Address</th>
                <th style="text-align:right">Pending Amount</th>
            </tr></thead><tbody>${tableRows}</tbody></table>
            <div class="total">Total Market Pending: Rs ${totalPending.toLocaleString()}</div>
        </body></html>`);
    }

    // ── Summary stats ─────────────────────────────────────────────────────
    const totalPending = shopkeepers.filter(s => s.current_balance > 0).reduce((a, s) => a + s.current_balance, 0);
    const pendingCount = shopkeepers.filter(s => s.current_balance > 0).length;
    const clearedCount = shopkeepers.filter(s => s.current_balance === 0).length;

    return (
        <div className="space-y-5">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">Shopkeepers</h2>
                        <p className="text-muted-foreground text-sm mt-0.5">Manage customers and view their ledgers</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={exportPendingBills} className="border border-border hover:bg-muted text-foreground px-3 py-2 rounded-lg font-medium flex gap-2 items-center text-sm transition bg-card">
                            <Download className="w-4 h-4" /> Export Pending
                        </button>
                        <button onClick={openAdd} className="text-white px-4 py-2 rounded-lg font-semibold flex gap-2 items-center text-sm transition" style={{ background: '#7F56D9', boxShadow: '0 1px 4px rgba(127,86,217,0.35)' }}>
                            <Plus className="w-4 h-4" /> Add Shopkeeper
                        </button>
                    </div>
                </div>

                {/* ── Summary pills ──────────────────────────────────────── */}
                <div className="flex flex-wrap gap-3 mt-5">
                    <div className="flex items-center gap-2 bg-[#F5F5F5] border border-[#E8E8E8] rounded-xl px-4 py-2 text-sm">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-bold text-foreground">{shopkeepers.length}</span>
                    </div>
                    {pendingCount > 0 && (
                        <div className="flex items-center gap-2 bg-[#FEF0C7] border border-[#FDE68A] rounded-xl px-4 py-2 text-sm">
                            <span className="text-[#B54708] font-medium">{pendingCount} pending</span>
                            <span className="font-bold text-[#B54708]">Rs {totalPending.toLocaleString()}</span>
                        </div>
                    )}
                    {clearedCount > 0 && (
                        <div className="flex items-center gap-2 bg-[#D1FADF] border border-[#A6F4C5] rounded-xl px-4 py-2 text-sm">
                            <span className="text-[#027A48] font-medium">{clearedCount} cleared</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Search + Filter bar ─────────────────────────────────────── */}
            <div className="space-y-2">
                {/* Unified pill bar */}
                <div className="flex items-stretch h-12 bg-card border border-border rounded-2xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-[#7F56D9]/30 focus-within:border-[#7F56D9]/50 transition-all">

                    {/* Left: Filter toggle button */}
                    <button
                        onClick={() => setShowFilters(v => !v)}
                        className={`flex items-center gap-2 px-4 border-r border-border text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                            showFilters || locationFilter !== 'all'
                                ? 'text-[#7F56D9] bg-[#F5F0FF]'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                        }`}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        <span>{locationFilter === 'all' ? 'All' : locationFilter}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Centre: Search input */}
                    <div className="relative flex-1 flex items-center">
                        <Search className="absolute left-4 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name, phone or address…"
                            className="w-full h-full pl-11 pr-4 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
                        />
                    </div>

                    {/* Right: keyboard shortcut hint */}
                    <div className="flex items-center pr-4 pl-2 flex-shrink-0">
                        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded-md">
                            <span style={{fontFamily:'sans-serif'}}>⌘</span>K
                        </kbd>
                    </div>
                </div>

                {/* Expandable location chips panel */}
                {showFilters && locationOptions.length > 0 && (
                    <div className="bg-card border border-border rounded-2xl px-4 py-3 flex flex-wrap gap-2 items-center animate-in fade-in slide-in-from-top-1 duration-150">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <button
                            onClick={() => setLocationFilter('all')}
                            className="px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all"
                            style={locationFilter === 'all'
                                ? { background: '#7F56D9', color: '#fff', borderColor: '#7F56D9' }
                                : { background: 'transparent', color: '#6B7280', borderColor: '#E5E7EB' }
                            }
                        >
                            All Areas
                        </button>
                        {locationOptions.map(loc => (
                            <button
                                key={loc}
                                onClick={() => setLocationFilter(loc === locationFilter ? 'all' : loc)}
                                className="px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all"
                                style={locationFilter === loc
                                    ? { background: '#7F56D9', color: '#fff', borderColor: '#7F56D9' }
                                    : { background: 'transparent', color: '#6B7280', borderColor: '#E5E7EB' }
                                }
                            >
                                {loc}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Empty state ─────────────────────────────────────────────── */}
            {shopkeepers.length === 0 && (
                <div className="bg-card rounded-2xl border border-dashed border-border p-14 text-center">
                    <User className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                    <h3 className="text-muted-foreground font-semibold text-lg">No shopkeepers yet</h3>
                    <p className="text-muted-foreground/70 text-sm mt-1">Click <strong>Add Shopkeeper</strong> to get started</p>
                </div>
            )}

            {/* ── No results state ────────────────────────────────────────── */}
            {shopkeepers.length > 0 && filtered.length === 0 && (
                <div className="bg-card rounded-2xl border border-border p-10 text-center">
                    <Search className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground font-semibold">No results found</p>
                    <p className="text-muted-foreground/60 text-sm mt-1">Try a different name or change the area filter</p>
                </div>
            )}

            {/* ── Card grid ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(s => {
                    const [bgCol, textCol] = avatarColor(s.name);
                    const hasPending = s.current_balance > 0;
                    return (
                        <div
                            key={s.id}
                            className="bg-card rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-[#C4B5FD] transition-all group relative flex flex-col"
                        >
                            {/* Edit / Delete / Khata hover actions */}
                            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <button
                                    onClick={() => openKhata(s)}
                                    title="Set opening balance from paper khata"
                                    className="p-1.5 text-muted-foreground hover:text-[#7F56D9] hover:bg-[#F5F0FF] rounded-lg transition"
                                >
                                    <BookOpen className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => openEdit(s)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition">
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setDeleteConfirm(s)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <Link to={`/shopkeepers/${s.id}`} className="flex flex-col flex-1 p-5 min-w-0">
                                {/* Top row: avatar + name */}
                                <div className="flex items-center gap-3 pr-10">
                                    <div
                                        className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                                        style={{ background: bgCol, color: textCol }}
                                    >
                                        {initials(s.name)}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-foreground truncate text-[15px] leading-tight">{s.name}</h3>
                                        {s.phone ? (
                                            <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                                <Phone className="w-3 h-3" /> {s.phone}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground/50 mt-0.5 block">No phone</span>
                                        )}
                                    </div>
                                </div>

                                {/* Address */}
                                {s.address && (
                                    <div className="flex items-start gap-1.5 mt-3">
                                        <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0 mt-0.5" />
                                        <span className="text-xs text-muted-foreground truncate">{s.address}</span>
                                    </div>
                                )}

                                {/* Divider */}
                                <div className="border-t border-border mt-4 pt-3 flex items-center justify-between">
                                    {/* Balance badge */}
                                    <div>
                                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide block">Balance</span>
                                        <span
                                            className="text-base font-bold font-mono"
                                            style={{ color: hasPending ? '#B42318' : '#027A48' }}
                                        >
                                            Rs {s.current_balance.toLocaleString()}
                                        </span>
                                    </div>

                                    {/* Status pill + arrow */}
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                                            style={hasPending
                                                ? { background: '#FEF0C7', color: '#B54708' }
                                                : { background: '#D1FADF', color: '#027A48' }
                                            }
                                        >
                                            {hasPending ? 'Pending' : 'Cleared'}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-[#7F56D9] transition-colors" />
                                    </div>
                                </div>
                            </Link>
                        </div>
                    );
                })}
            </div>

            {/* Result count footer */}
            {shopkeepers.length > 0 && filtered.length > 0 && (
                <p className="text-xs text-muted-foreground text-center pb-2">
                    Showing {filtered.length} of {shopkeepers.length} shopkeepers
                    {locationFilter !== 'all' && ` · ${locationFilter}`}
                    {search && ` · "${search}"`}
                </p>
            )}

            {/* ── Add / Edit Modal ──────────────────────────────────────────── */}
            {modal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border">
                        <div className="flex justify-between items-center p-6 border-b border-border">
                            <h3 className="text-lg font-bold text-foreground">{modal.mode === 'add' ? 'Add Shopkeeper' : 'Edit Shopkeeper'}</h3>
                            <button onClick={() => setModal({ open: false, mode: 'add' })} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Name <span className="text-red-500">*</span></label>
                                <input
                                    autoFocus
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Al-Hadeed Store"
                                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7F56D9]/40 bg-background text-foreground"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                                <input
                                    value={form.phone}
                                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                    placeholder="e.g. 0300-1234567"
                                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7F56D9]/40 bg-background text-foreground"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Address</label>
                                <input
                                    value={form.address}
                                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                                    placeholder="e.g. Railway Road, Itwar Bazar"
                                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7F56D9]/40 bg-background text-foreground"
                                />
                            </div>
                            {/* Opening balance – only shown when adding a new shopkeeper */}
                            {modal.mode === 'add' && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-amber-600" />
                                        <span className="text-sm font-semibold text-amber-800">Paper Khata Balance</span>
                                    </div>
                                    <p className="text-xs text-amber-700">If this shopkeeper already owes you from a paper khata, enter that amount here. It will appear as the opening balance in their ledger.</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-amber-800">Rs</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={form.opening_balance}
                                            onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
                                            placeholder="0"
                                            className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-foreground"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-3 justify-end pt-2">
                                <button type="button" onClick={() => setModal({ open: false, mode: 'add' })} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted">Cancel</button>
                                <button type="submit" className="px-4 py-2 text-sm text-white rounded-lg font-medium transition" style={{ background: '#7F56D9' }}>
                                    {modal.mode === 'add' ? 'Add Shopkeeper' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Khata (Opening Balance) Modal ─────────────────────────── */}
            {khataModal.open && khataModal.shopkeeper && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border">
                        <div className="flex justify-between items-center p-6 border-b border-border">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-amber-500" />
                                <h3 className="text-lg font-bold text-foreground">Paper Khata Balance</h3>
                            </div>
                            <button onClick={() => setKhataModal({ open: false, shopkeeper: null, value: '' })} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Set the amount <strong className="text-foreground">{khataModal.shopkeeper.name}</strong> already owes you from your paper khata. This becomes the opening balance in their digital ledger.
                            </p>
                            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                                ⚠ This will adjust their current balance to reflect the old debt. Any previous opening balance will be replaced.
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Opening Balance (Rs)</label>
                                <input
                                    autoFocus
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={khataModal.value}
                                    onChange={e => setKhataModal(m => ({ ...m, value: e.target.value }))}
                                    onKeyDown={e => e.key === 'Enter' && handleSaveKhata()}
                                    placeholder="e.g. 15000"
                                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-background text-foreground font-mono text-base"
                                />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setKhataModal({ open: false, shopkeeper: null, value: '' })} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted">Cancel</button>
                                <button onClick={handleSaveKhata} className="px-4 py-2 text-sm text-white rounded-lg font-medium transition" style={{ background: '#D97706' }}>
                                    Save Opening Balance
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirm Modal ─────────────────────────────────────── */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-border">
                        <h3 className="text-lg font-bold text-foreground mb-2">Confirm Delete</h3>
                        <p className="text-muted-foreground text-sm">
                            Are you sure you want to delete <strong className="text-foreground">"{deleteConfirm.name}"</strong>?
                        </p>
                        <p className="text-red-500 text-xs mt-1">⚠ Their ledger entries and balance will be lost.</p>
                        <div className="flex gap-3 justify-end mt-6">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted">Cancel</button>
                            <button onClick={() => { deleteShopkeeper(deleteConfirm.id); setDeleteConfirm(null); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
