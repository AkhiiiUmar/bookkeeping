import { useState } from 'react';
import { useStore } from '../store/useStore';
import { 
    Calendar, CheckCircle, IndianRupee, AlertCircle, Clock, ChevronRight, Printer 
} from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { printHtml } from '../utils/print';
import { Link } from 'react-router-dom';

type Tab = 'pending' | 'received';

export default function Payments() {
    const { payments, shopkeepers, addPayment } = useStore();

    const [tab, setTab] = useState<Tab>('pending');
    const [isModalOpen, setModalOpen] = useState(false);
    const [shopkeeperId, setShopkeeperId] = useState('');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);

    const sortedPayments = [...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const pendingShopkeepers = shopkeepers
        .filter(s => s.current_balance > 0)
        .sort((a, b) => b.current_balance - a.current_balance);

    const totalPending = pendingShopkeepers.reduce((sum, s) => sum + s.current_balance, 0);
    const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);

    // Get selected shopkeeper for balance preview
    const selectedSk = shopkeepers.find(s => s.id === shopkeeperId);

    function openModal(preselect?: string) {
        setShopkeeperId(preselect ?? '');
        setAmount('');
        setNote('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setModalOpen(true);
    }

    function handleSave() {
        if (!shopkeeperId || !amount) return;
        addPayment({
            shopkeeper_id: shopkeeperId,
            amount: parseFloat(amount),
            date: new Date(paymentDate + 'T12:00:00').toISOString(),
            note
        });
        setModalOpen(false);
        setShopkeeperId(''); setAmount(''); setNote('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
    }

    const printPendingSlip = (s: typeof shopkeepers[0]) => {
        const skPayments = payments.filter(p => p.shopkeeper_id === s.id);
        const lastPayment = skPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        printHtml(`
            <html>
            <head>
                <title>Outstanding Slip - ${s.name}</title>
                <style>
                    body { font-family: 'Courier New', monospace; padding: 20px; color: #000; max-width: 80mm; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 15px; }
                    .header h2 { margin: 0; text-transform: uppercase; font-size: 15px; font-weight: bold; }
                    .header p { margin: 3px 0; font-size: 9px; }
                    .divider { border-bottom: 1px dashed #000; margin: 12px 0; }
                    .info-table { width: 100%; border-collapse: collapse; font-size: 9px; }
                    .info-table td { padding: 3px 0; }
                    .text-right { text-align: right; }
                    .total-box { border: 1px solid #000; padding: 10px; margin: 15px 0; text-align: center; }
                    .total-box h3 { margin: 0; font-size: 11px; text-transform: uppercase; }
                    .total-box p { margin: 5px 0 0 0; font-size: 16px; font-weight: bold; }
                    .footer { text-align: center; margin-top: 25px; font-size: 9px; }
                </style>
            </head>
            <body onload="window.print()">
                <div class="header">
                    <h2>OUTSTANDING COLLECTION SLIP</h2>
                    <p>Distribution POS Bookkeeping</p>
                </div>
                <div class="divider"></div>
                <table class="info-table">
                    <tr><td><strong>Shopkeeper:</strong> ${s.name}</td><td class="text-right"><strong>Slip Date:</strong> ${new Date().toLocaleDateString()}</td></tr>
                    <tr><td><strong>Phone:</strong> ${s.phone || '—'}</td><td class="text-right"><strong>Address:</strong> ${s.address || '—'}</td></tr>
                    <tr><td><strong>Last Payment:</strong> ${lastPayment ? new Date(lastPayment.date).toLocaleDateString() : 'None Recorded'}</td><td class="text-right"><strong>Method:</strong> Open Account</td></tr>
                </table>
                <div class="divider"></div>
                <div class="total-box">
                    <h3>Outstanding Balance Owed</h3>
                    <p>Rs ${s.current_balance.toLocaleString()}</p>
                </div>
                <div class="divider"></div>
                <div class="footer">
                    <p>Please clear the pending balance at your earliest convenience.</p>
                    <p>Thank you for your cooperation!</p>
                </div>
            </body>
            </html>
        `);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-card p-6 rounded-2xl shadow-sm border border-border">
                <div>
                    <h2 className="text-2xl font-extrabold text-[#101828] dark:text-white">Payments &amp; Ledger</h2>
                    <p className="text-muted-foreground text-sm">Track outstanding shopkeeper accounts and received payments</p>
                </div>
                <button onClick={() => openModal()} className="bg-[#7F56D9] hover:bg-[#6941C6] text-white px-4 py-2 rounded-xl font-bold transition flex gap-2 items-center text-sm" style={{boxShadow:'0 1px 3px rgba(127,86,217,0.35), 0 0 0 1px #6941C6'}}>
                    <IndianRupee className="w-4 h-4" /> Record Payment
                </button>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-card rounded-2xl border border-[#E8E8E8] dark:border-border p-5 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-red-50 rounded-lg"><AlertCircle className="w-6 h-6 text-red-500" /></div>
                    <div>
                        <p className="text-sm font-semibold text-[#535862]">Total Outstanding Pending</p>
                        <p className="text-2xl font-extrabold font-mono text-red-600">Rs {totalPending.toLocaleString()}</p>
                        <p className="text-xs text-[#A4A7AE]">{pendingShopkeepers.length} shopkeeper{pendingShopkeepers.length !== 1 ? 's' : ''} owe balances</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-card rounded-2xl border border-[#E8E8E8] dark:border-border p-5 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-[#DCFCE7] rounded-lg"><CheckCircle className="w-6 h-6 text-[#17B26A]" /></div>
                    <div>
                        <p className="text-sm font-semibold text-[#535862]">Total Cash Received</p>
                        <p className="text-2xl font-extrabold font-mono text-[#079455]">Rs {totalReceived.toLocaleString()}</p>
                        <p className="text-xs text-[#A4A7AE]">{payments.length} payment{payments.length !== 1 ? 's' : ''} recorded</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="flex border-b border-border bg-muted/30">
                    <button onClick={() => setTab('pending')}
                        className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold border-b-2 transition ${tab === 'pending' ? 'border-rose-500 text-rose-650 dark:text-rose-400 bg-card' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                        <Clock className="w-4 h-4" />
                        Pending Balances
                        {pendingShopkeepers.length > 0 && (
                            <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold ml-1">{pendingShopkeepers.length}</span>
                        )}
                    </button>
                    <button onClick={() => setTab('received')}
                        className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold border-b-2 transition ${tab === 'received' ? 'border-emerald-500 text-emerald-605 dark:text-emerald-400 bg-card' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                        <CheckCircle className="w-4 h-4" />
                        Received Payments ({sortedPayments.length})
                    </button>
                </div>

                {/* Pending Balances Tab */}
                {tab === 'pending' && (
                    <div className="divide-y divide-border">
                        {pendingShopkeepers.length === 0 ? (
                            <div className="px-6 py-12 text-center">
                                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                                <h3 className="text-muted-foreground font-semibold">All clear!</h3>
                                <p className="text-muted-foreground/70 text-sm mt-1">No shopkeeper has an outstanding balance.</p>
                            </div>
                        ) : (
                            pendingShopkeepers.map(s => {
                                const skPayments = payments.filter(p => p.shopkeeper_id === s.id);
                                const lastPayment = skPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                                return (
                                    <div key={s.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition group">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center flex-shrink-0 border border-rose-200">
                                                <span className="text-rose-600 dark:text-rose-400 font-bold text-sm">{s.name.charAt(0).toUpperCase()}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-foreground truncate">{s.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-semibold border border-rose-200 dark:border-rose-900">
                                                        <AlertCircle className="w-3 h-3" /> Pending
                                                    </span>
                                                    {lastPayment && (
                                                        <span className="text-xs text-muted-foreground">Last payment: {new Date(lastPayment.date).toLocaleDateString()}</span>
                                                    )}
                                                    {!lastPayment && <span className="text-xs text-muted-foreground">No payments yet</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 flex-shrink-0">
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">Outstanding</p>
                                                <p className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">Rs {s.current_balance.toLocaleString()}</p>
                                            </div>
                                            <div className="flex gap-1.5 items-center">
                                                <button onClick={() => openModal(s.id)}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1">
                                                    <IndianRupee className="w-3.5 h-3.5" /> Receive
                                                </button>
                                                <button onClick={() => printPendingSlip(s)}
                                                    className="p-1.5 text-muted-foreground hover:text-emerald-500 hover:bg-muted rounded-lg transition" title="Print Outstanding Balance Slip">
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                <Link to={`/shopkeepers/${s.id}`} className="p-1.5 text-muted-foreground hover:text-indigo-500 hover:bg-muted rounded-lg transition">
                                                    <ChevronRight className="w-4 h-4" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* Received Payments Tab */}
                {tab === 'received' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[600px]">
                            <thead className="bg-muted/50 text-muted-foreground font-bold">
                                <tr>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase">Date</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase">Shopkeeper</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase">Note</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {sortedPayments.length === 0 && (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground italic">No payments recorded yet.</td></tr>
                                )}
                                {sortedPayments.map(p => {
                                    const sk = shopkeepers.find(s => s.id === p.shopkeeper_id);
                                    return (
                                        <tr key={p.id} className="hover:bg-muted/50 transition">
                                            <td className="px-6 py-4 text-muted-foreground whitespace-nowrap text-xs">
                                                <div className="flex items-center gap-2"><Calendar className="w-4 h-4" />{new Date(p.date).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-foreground">{sk?.name || 'Unknown'}</td>
                                            <td className="px-6 py-4 text-muted-foreground italic text-xs">{p.note || '—'}</td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">Rs {p.amount.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl shadow-xl w-full max-w-md flex flex-col border border-border overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
                            <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2"><IndianRupee className="w-5 h-5" /> Record Received Payment</h3>
                            <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Shopkeeper selector */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Shopkeeper</label>
                                <SearchableSelect
                                    options={shopkeepers.map(s => ({ value: s.id, label: s.name, sub: `Outstanding Balance: Rs ${s.current_balance.toLocaleString()}` }))}
                                    value={shopkeeperId}
                                    onChange={setShopkeeperId}
                                    placeholder="Search shopkeeper…"
                                    accentColor="emerald"
                                />
                            </div>

                            {/* Balance banner — shows after selecting shopkeeper */}
                            {selectedSk && (
                                <div className={`rounded-xl px-4 py-3 flex items-center justify-between border ${selectedSk.current_balance > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                                    <span className={`text-xs font-bold uppercase tracking-wider ${selectedSk.current_balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        Current Balance Owed
                                    </span>
                                    <span className={`text-xl font-black font-mono ${selectedSk.current_balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        Rs {selectedSk.current_balance.toLocaleString()}
                                    </span>
                                </div>
                            )}

                            {/* Date picker */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Payment Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                    <input
                                        type="date"
                                        value={paymentDate}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={e => setPaymentDate(e.target.value)}
                                        className="w-full bg-muted/30 border border-border rounded-xl pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-foreground font-mono"
                                    />
                                </div>
                                {paymentDate !== new Date().toISOString().split('T')[0] && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">📅 Backdated payment entry</p>
                                )}
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Amount Received</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">Rs</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        className="w-full bg-muted/30 border border-border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-foreground font-mono font-bold"
                                    />
                                </div>
                                {/* Show remaining balance preview */}
                                {selectedSk && amount && parseFloat(amount) > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Remaining after payment:{' '}
                                        <strong className={`font-mono ${selectedSk.current_balance - parseFloat(amount) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                            Rs {Math.max(0, selectedSk.current_balance - parseFloat(amount)).toLocaleString()}
                                        </strong>
                                    </p>
                                )}
                            </div>

                            {/* Note */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Note / Reference</label>
                                <textarea
                                    placeholder="E.g., Cheque No, Bank Transfer Ref..."
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    rows={3}
                                    className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-foreground"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-3 bg-muted/20 rounded-b-xl">
                            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-muted-foreground font-medium hover:bg-muted rounded-xl transition text-xs">Cancel</button>
                            <button onClick={handleSave} disabled={!shopkeeperId || !amount}
                                className="bg-emerald-600 disabled:opacity-50 text-white px-5 py-2 rounded-xl font-bold shadow-sm transition hover:bg-emerald-700 text-xs">
                                Post Payment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
