import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import type { LedgerEntry } from '../store/useStore';
import { printHtml } from '../utils/print';
import { 
    ArrowLeft, ArrowDownRight, ArrowUpRight, Calendar, Clock, 
    CheckCircle, Receipt, Banknote, AlertTriangle, Printer 
} from 'lucide-react';

type Tab = 'all' | 'invoices' | 'payments' | 'pending';

export default function Ledger() {
    const { id } = useParams<{ id: string }>();
    const shopkeepers = useStore(s => s.shopkeepers);
    const allInvoices = useStore(s => s.invoices);
    const allPayments = useStore(s => s.payments);
    const allOrders = useStore(s => s.orders);
    const products = useStore(s => s.products);

    const invoices = useMemo(() => allInvoices.filter(i => i.shopkeeper_id === id), [allInvoices, id]);
    const payments = useMemo(() => allPayments.filter(p => p.shopkeeper_id === id), [allPayments, id]);
    const orders = useMemo(() => allOrders.filter(o => o.shopkeeper_id === id), [allOrders, id]);

    const [tab, setTab] = useState<Tab>('all');

    const shopkeeper = shopkeepers.find(sk => sk.id === id);

    if (shopkeepers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Loading…</p>
            </div>
        );
    }

    if (!shopkeeper) {
        return (
            <div className="space-y-4">
                <Link to="/shopkeepers" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition">
                    <ArrowLeft className="w-4 h-4" /> Back to Shopkeepers
                </Link>
                <div className="bg-card border border-red-200 dark:border-red-900 rounded-xl p-8 text-center">
                    <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-foreground">Shopkeeper not found</h3>
                    <p className="text-muted-foreground text-sm mt-1">This shopkeeper may have been deleted.</p>
                </div>
            </div>
        );
    }

    const rawEntries: LedgerEntry[] = [
        ...invoices.map(i => ({ id: i.id, date: i.date, type: 'Invoice' as const, ref_id: i.id, amount: i.total_amount, running_balance: 0 })),
        ...payments.map(p => ({ id: p.id, date: p.date, type: 'Payment' as const, ref_id: p.id, amount: p.amount, running_balance: 0, note: p.note })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Opening balance from paper khata — injected as the very first entry
    const openingBalance = shopkeeper.opening_balance ?? 0;
    if (openingBalance > 0) {
        rawEntries.unshift({
            id: 'opening-balance',
            date: '2000-01-01T00:00:00.000Z', // sorts before all real entries
            type: 'Invoice' as const,
            ref_id: 'opening-balance',
            amount: openingBalance,
            running_balance: 0,
            note: '📖 Opening Balance (from paper khata)',
        });
    }

    let bal = 0;
    rawEntries.forEach(e => {
        bal += e.type === 'Invoice' ? e.amount : -e.amount;
        e.running_balance = bal;
    });

    const displayEntries = [...rawEntries].reverse();

    const pendingOrders = orders.filter(o => o.status === 'Pending');
    const totalInvoiced = invoices.reduce((s, i) => s + i.total_amount, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

    const tagClass = (type: 'Invoice' | 'Payment') =>
        type === 'Invoice'
            ? 'bg-[#FEE4E2] text-[#D92D20] border border-[#FECDCA] px-2.5 py-0.5 rounded-full font-bold text-xs shadow-sm'
            : 'bg-[#D1FADF] text-[#027A48] border border-[#A9F5C6] px-2.5 py-0.5 rounded-full font-bold text-xs shadow-sm';

    const printShopkeeperLedger = () => {
        const tableRows = displayEntries.map(e => `
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px dashed #eee;">${new Date(e.date).toLocaleDateString()}</td>
                <td style="padding: 8px 0; border-bottom: 1px dashed #eee;">${e.type}</td>
                <td style="padding: 8px 0; border-bottom: 1px dashed #eee; font-style: italic;">${e.note || (e.type === 'Invoice' ? 'Sale Invoice' : '—')}</td>
                <td style="padding: 8px 0; border-bottom: 1px dashed #eee; text-align: right; color: #b42318; font-family: monospace;">${e.type === 'Invoice' ? `Rs ${e.amount.toLocaleString()}` : '—'}</td>
                <td style="padding: 8px 0; border-bottom: 1px dashed #eee; text-align: right; color: #027a48; font-family: monospace;">${e.type === 'Payment' ? `Rs ${e.amount.toLocaleString()}` : '—'}</td>
                <td style="padding: 8px 0; border-bottom: 1px dashed #eee; text-align: right; font-weight: bold; font-family: monospace;">Rs ${e.running_balance.toLocaleString()}</td>
            </tr>
        `).join('');

        printHtml(`
            <html>
            <head>
                <title>Account Statement - ${shopkeeper.name}</title>
                <style>
                    body { font-family: 'Courier New', monospace; padding: 30px; color: #000; }
                    .header { text-align: center; margin-bottom: 25px; }
                    .header h2 { margin: 0; text-transform: uppercase; font-size: 18px; font-weight: bold; }
                    .header p { margin: 4px 0; font-size: 11px; }
                    .divider { border-bottom: 2px dashed #000; margin: 15px 0; }
                    .info-table, .ledger-table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    .info-table td { padding: 3px 0; }
                    .ledger-table th { border-bottom: 1px solid #000; padding: 6px 0; text-align: left; font-size: 11px; }
                    .ledger-table td { padding: 6px 0; }
                    .text-right { text-align: right; }
                    .total-row td { font-weight: bold; border-top: 1px dashed #000; padding-top: 10px; font-size: 12px; }
                    .footer { text-align: center; margin-top: 40px; font-size: 10px; }
                </style>
            </head>
            <body onload="window.print()">
                <div class="header">
                    <h2>CUSTOMER LEDGER STATEMENT</h2>
                    <p>Distribution POS System</p>
                </div>
                <div class="divider"></div>
                <table class="info-table">
                    <tr><td><strong>Shopkeeper:</strong> ${shopkeeper.name}</td><td class="text-right"><strong>Statement Date:</strong> ${new Date().toLocaleDateString()}</td></tr>
                    <tr><td><strong>Phone:</strong> ${shopkeeper.phone || '—'}</td><td class="text-right"><strong>Outstanding Balance:</strong> Rs ${shopkeeper.current_balance.toLocaleString()}</td></tr>
                    ${shopkeeper.address ? `<tr><td colspan="2"><strong>Address:</strong> ${shopkeeper.address}</td></tr>` : ''}
                </table>
                <div class="divider"></div>
                <h3 style="font-size: 12px; margin: 10px 0 5px 0; text-transform: uppercase;">Transaction History</h3>
                <table class="ledger-table">
                    <thead>
                        <tr>
                            <th style="width: 15%;">Date</th>
                            <th style="width: 12%;">Type</th>
                            <th style="width: 30%;">Note</th>
                            <th style="text-align: right; width: 14%;">Charge</th>
                            <th style="text-align: right; width: 14%;">Credit</th>
                            <th style="text-align: right; width: 15%;">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                        <tr class="total-row">
                            <td colspan="5" class="text-right">Ending Outstanding Balance:</td>
                            <td class="text-right">Rs ${shopkeeper.current_balance.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="divider"></div>
                <div class="footer">
                    <p>Verified account statement. Thank you!</p>
                </div>
            </body>
            </html>
        `);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-card p-6 rounded-2xl shadow-sm border border-border">
                <div className="flex items-center gap-4">
                    <Link to="/shopkeepers" className="p-2 hover:bg-muted rounded-full transition">
                        <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-extrabold text-foreground">{shopkeeper.name}</h2>
                            <button onClick={printShopkeeperLedger} className="p-1.5 text-muted-foreground hover:text-indigo-500 hover:bg-muted rounded-lg transition" title="Print Ledger Statement">
                                <Printer className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-muted-foreground text-sm mt-0.5">Account Statement &amp; History</p>
                        {shopkeeper.phone && <p className="text-xs text-muted-foreground/70 mt-0.5">{shopkeeper.phone}</p>}
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Outstanding Balance</span>
                    <span className={`text-3xl font-extrabold tracking-tight block ${shopkeeper.current_balance > 0 ? 'text-rose-600 dark:text-rose-450' : 'text-emerald-600 dark:text-emerald-450'}`}>
                        Rs {shopkeeper.current_balance.toLocaleString()}
                    </span>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Receipt className="w-4 h-4 text-rose-500" />
                        <span className="text-xs text-[#475467] font-bold uppercase tracking-wider">Total Invoiced</span>
                    </div>
                    <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-450">Rs {totalInvoiced.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{invoices.length} invoices</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Banknote className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs text-[#475467] font-bold uppercase tracking-wider">Total Received</span>
                    </div>
                    <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-450">Rs {totalPaid.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{payments.length} payments</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span className="text-xs text-[#475467] font-bold uppercase tracking-wider">Pending Orders</span>
                    </div>
                    <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-450">{pendingOrders.length}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">awaiting delivery</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="flex border-b border-border bg-muted/30">
                    {([
                        { key: 'all', label: 'All History', icon: Calendar },
                        { key: 'invoices', label: `Invoices (${invoices.length})`, icon: Receipt },
                        { key: 'payments', label: `Payments (${payments.length})`, icon: Banknote },
                        { key: 'pending', label: `Pending Orders (${pendingOrders.length})`, icon: Clock },
                    ] as { key: Tab; label: string; icon: React.ElementType }[]).map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition ${tab === t.key ? 'border-indigo-650 text-indigo-650 dark:text-indigo-400 bg-card' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                        >
                            <t.icon className="w-4 h-4" /> {t.label}
                        </button>
                    ))}
                </div>

                {tab !== 'pending' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[750px]">
                            <thead className="bg-muted/50 text-muted-foreground font-bold">
                                <tr>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase">Date &amp; Time</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase">Type</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase">Note</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase text-right text-rose-500">Charge</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase text-right text-emerald-500">Credit</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {(() => {
                                    const rows = displayEntries.filter(e =>
                                        tab === 'all' ? true :
                                        tab === 'invoices' ? e.type === 'Invoice' :
                                        e.type === 'Payment'
                                    );
                                    if (rows.length === 0) return (
                                        <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground italic">No entries found.</td></tr>
                                    );
                                    return rows.map((entry) => {
                                        const isOpening = entry.id === 'opening-balance';
                                        return (
                                        <tr key={entry.id} className={`hover:bg-muted/50 transition ${isOpening ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-muted-foreground text-xs font-medium">
                                                {isOpening ? (
                                                    <span className="italic text-amber-700 font-semibold">Opening Balance</span>
                                                ) : (
                                                    <>
                                                        <div>{new Date(entry.date).toLocaleDateString()}</div>
                                                        <div className="text-muted-foreground/60">{new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isOpening ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                                        📖 Khata
                                                    </span>
                                                ) : (
                                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${tagClass(entry.type)}`}>
                                                        {entry.type === 'Invoice' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                        {entry.type}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-muted-foreground italic">
                                                {isOpening ? 'Carried forward from paper khata' : (entry.note || (entry.type === 'Invoice' ? 'Sale Invoice' : '—'))}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono font-medium text-rose-600 dark:text-rose-455">
                                                {entry.type === 'Invoice' ? `Rs ${entry.amount.toLocaleString()}` : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-455">
                                                {entry.type === 'Payment' ? `Rs ${entry.amount.toLocaleString()}` : '—'}
                                            </td>
                                            <td className={`px-6 py-4 text-right font-mono font-bold ${entry.running_balance > 0 ? 'text-rose-600 dark:text-rose-455' : 'text-emerald-600 dark:text-emerald-455'}`}>
                                                Rs {entry.running_balance.toLocaleString()}
                                            </td>
                                        </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>
                )}

                {tab === 'pending' && (
                    <div className="divide-y divide-border">
                        {pendingOrders.length === 0 ? (
                            <div className="px-6 py-10 text-center">
                                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                                <p className="text-muted-foreground font-medium">No pending orders</p>
                                <p className="text-muted-foreground/70 text-sm mt-1">All orders for this shopkeeper have been delivered.</p>
                            </div>
                        ) : (
                            pendingOrders.map(order => {
                                const total = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
                                return (
                                    <div key={order.id} className="p-5 hover:bg-slate-50/40 transition">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
                                                        <Clock className="w-3 h-3" /> Pending
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">{new Date(order.date).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-xs font-mono text-muted-foreground/60 mt-1">Order #{order.id.substring(0, 8)}</p>
                                            </div>
                                            <span className="text-lg font-bold font-mono text-foreground">Rs {total.toLocaleString()}</span>
                                        </div>
                                        <div className="space-y-1">
                                            {order.items.map((item, idx) => {
                                                const prod = products.find(p => p.id === item.product_id);
                                                return (
                                                    <div key={idx} className="flex justify-between text-sm text-foreground bg-muted/40 rounded-lg px-3 py-1.5">
                                                        <span>{prod?.name || 'Unknown Product'}</span>
                                                        <span className="font-mono">{item.quantity} × Rs {item.price} = <strong>Rs {item.price * item.quantity}</strong></span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
