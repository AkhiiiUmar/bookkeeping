import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Trash2, X, Wallet, Calendar, Filter } from 'lucide-react';

const SUGGESTED_CATEGORIES = [
    'Rent', 'Electricity', 'Gas', 'Water', 'Internet', 'Phone',
    'Transport', 'Fuel', 'Salary', 'Food', 'Groceries', 'Medical',
    'Education', 'Maintenance', 'Office Supplies', 'Marketing',
    'Insurance', 'Tax', 'Loan Payment', 'Charity', 'Entertainment',
    'Home', 'Personal', 'Misc',
];

export default function Expenses() {
    const { dailyExpenses, addDailyExpense, deleteDailyExpense, agencies, addAgencyPayment } = useStore();
    const [modalOpen, setModalOpen] = useState(false);
    const [desc, setDesc] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('Misc');
    const [customCategory, setCustomCategory] = useState('');
    const [filterCat, setFilterCat] = useState('all');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);

    // Agency association for company expenses
    const [selectedAgencyId, setSelectedAgencyId] = useState('');
    const [deductFromAgencyLedger, setDeductFromAgencyLedger] = useState(false);

    const sorted = useMemo(() =>
        [...dailyExpenses]
            .filter(e => filterCat === 'all' || e.category === filterCat)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        [dailyExpenses, filterCat]
    );

    const totalExpenses = sorted.reduce((s, e) => s + e.amount, 0);
    const usedCategories = [...new Set(dailyExpenses.map(e => e.category))];

    const grouped = useMemo(() => {
        const map: Record<string, typeof sorted> = {};
        sorted.forEach(e => {
            const key = new Date(e.date).toLocaleDateString();
            if (!map[key]) map[key] = [];
            map[key].push(e);
        });
        return Object.entries(map);
    }, [sorted]);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const amt = parseFloat(amount);
        if (!desc.trim() || isNaN(amt) || amt <= 0) return;
        const cat = category === '__custom__' ? (customCategory.trim() || 'Misc') : category;

        const agency = agencies.find(a => a.id === selectedAgencyId);
        const finalDesc = agency ? `[${agency.name}] ${desc.trim()}` : desc.trim();

        addDailyExpense({ date: new Date(expenseDate + 'T12:00:00').toISOString(), description: finalDesc, amount: amt, category: cat });

        if (agency && deductFromAgencyLedger) {
            addAgencyPayment({
                agency_id: agency.id,
                amount: amt,
                date: new Date(expenseDate + 'T12:00:00').toISOString(),
                type: 'payment',
                note: `Company Expense: ${desc.trim()}`
            });
        }

        setDesc('');
        setAmount('');
        setCategory('Misc');
        setCustomCategory('');
        setSelectedAgencyId('');
        setDeductFromAgencyLedger(false);
        setExpenseDate(new Date().toISOString().split('T')[0]);
        setModalOpen(false);
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-card p-6 rounded-xl shadow-sm border border-border">
                <div>
                    <h2 className="text-2xl font-bold text-primary">Daily Expenses</h2>
                    <p className="text-muted-foreground text-sm">Track business &amp; personal expenses</p>
                </div>
                <button onClick={() => setModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition flex gap-2 items-center">
                    <Plus className="w-4 h-4" /> Add Expense
                </button>
            </div>

            {/* Summary + Filter */}
            <div className="flex gap-4 items-start flex-wrap">
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 text-red-500" /><span className="text-xs text-muted-foreground font-medium">Total Expenses</span></div>
                    <p className="text-2xl font-bold font-mono text-red-600 dark:text-red-400">Rs {totalExpenses.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{sorted.length} entries</p>
                </div>
                <div className="flex-1 bg-card rounded-xl border border-border p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2"><Filter className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">Filter by Category</span></div>
                    <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => setFilterCat('all')} className={`px-3 py-1 text-xs rounded-full font-medium transition ${filterCat === 'all' ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>All</button>
                        {usedCategories.map(cat => (
                            <button key={cat} onClick={() => setFilterCat(cat)} className={`px-3 py-1 text-xs rounded-full font-medium transition ${filterCat === cat ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{cat}</button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Expense List grouped by date */}
            {grouped.length === 0 ? (
                <div className="bg-card rounded-xl border border-dashed border-border p-12 text-center">
                    <Wallet className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <h3 className="text-muted-foreground font-semibold text-lg">No expenses recorded</h3>
                    <p className="text-muted-foreground/70 text-sm mt-1">Click <strong>Add Expense</strong> to start tracking</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {grouped.map(([dateStr, expenses]) => {
                        const dayTotal = expenses.reduce((s, e) => s + e.amount, 0);
                        return (
                            <div key={dateStr} className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                                <div className="bg-muted/40 border-b border-border px-5 py-3 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm font-semibold text-foreground">{dateStr}</span>
                                    </div>
                                    <span className="text-sm font-mono font-bold text-red-600 dark:text-red-400">Rs {dayTotal.toLocaleString()}</span>
                                </div>
                                <ul className="divide-y divide-border">
                                    {expenses.map(exp => (
                                        <li key={exp.id} className="px-5 py-3 flex items-center justify-between hover:bg-muted/30 transition group">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border flex-shrink-0">{exp.category}</span>
                                                <span className="text-sm text-foreground truncate">{exp.description}</span>
                                            </div>
                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                <span className="text-sm font-mono font-bold text-red-600 dark:text-red-400">Rs {exp.amount.toLocaleString()}</span>
                                                <button onClick={() => setDeleteConfirm(exp.id)} className="p-1 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add Expense Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl shadow-xl w-full max-w-md border border-border">
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <h3 className="text-lg font-bold text-foreground">Add Expense</h3>
                            <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Date picker — allows entering backdated expenses */}
                            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 flex items-center gap-3">
                                <Calendar className="w-4 h-4 text-red-500 flex-shrink-0" />
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Expense Date <span className="text-muted-foreground font-normal normal-case">(change to enter old Roz Namha entries)</span></label>
                                    <input
                                        type="date"
                                        value={expenseDate}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={e => setExpenseDate(e.target.value)}
                                        className="w-full bg-background border border-red-300 dark:border-red-800 rounded-lg px-3 py-1.5 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
                                    />
                                </div>
                                {expenseDate !== new Date().toISOString().split('T')[0] && (
                                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full whitespace-nowrap">📅 Backdated</span>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                                <input autoFocus value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Electricity bill" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-background text-foreground" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Amount (Rs)</label>
                                <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 font-mono bg-background text-foreground" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-background text-foreground">
                                    {SUGGESTED_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    <option value="__custom__">+ Custom Category</option>
                                </select>
                                {category === '__custom__' && (
                                    <input value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="Enter category name" className="w-full mt-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-background text-foreground" />
                                )}
                            </div>

                            {/* Associate with Agency / Company */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Associate with Agency / Company (Optional)</label>
                                <select value={selectedAgencyId} onChange={e => {
                                    setSelectedAgencyId(e.target.value);
                                    if (e.target.value) {
                                        setCategory('Freight / Transport');
                                        setDeductFromAgencyLedger(true); // default to deducting
                                    } else {
                                        setDeductFromAgencyLedger(false);
                                    }
                                }} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-background text-foreground">
                                    <option value="">None / General Expense</option>
                                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>

                            {selectedAgencyId && (
                                <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                                        <input type="checkbox" checked={deductFromAgencyLedger} onChange={e => setDeductFromAgencyLedger(e.target.checked)}
                                            className="rounded border-border bg-background text-red-600 focus:ring-red-500 w-4 h-4" />
                                        <span>Cut / Deduct from Company's Ledger?</span>
                                    </label>
                                    <p className="text-[10px] text-muted-foreground leading-snug">
                                        If checked, this payment will cut from the amount you owe this agency in their ledger, and register as a Daily Expense.
                                    </p>
                                </div>
                            )}
                            <div className="flex gap-3 justify-end pt-2">
                                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted">Cancel</button>
                                <button type="submit" className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Add Expense</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-border">
                        <h3 className="text-lg font-bold text-foreground mb-2">Delete Expense?</h3>
                        <p className="text-muted-foreground text-sm">This cannot be undone.</p>
                        <div className="flex gap-3 justify-end mt-6">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted">Cancel</button>
                            <button onClick={() => { deleteDailyExpense(deleteConfirm); setDeleteConfirm(null); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
