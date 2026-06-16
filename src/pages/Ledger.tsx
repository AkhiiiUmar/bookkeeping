import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import type { LedgerEntry } from '../store/useStore';
import { printHtml } from '../utils/print';
import { 
    ArrowLeft, ArrowDownRight, ArrowUpRight, Calendar, Clock, 
    CheckCircle, Receipt, Banknote, AlertTriangle, Printer,
    ChevronDown, ChevronRight, TrendingUp, IndianRupee, X, Plus
} from 'lucide-react';

type Tab = 'all' | 'invoices' | 'payments' | 'pending';

export default function Ledger() {
    const { id } = useParams<{ id: string }>();
    const shopkeepers = useStore(s => s.shopkeepers);
    const allInvoices = useStore(s => s.invoices);
    const allPayments = useStore(s => s.payments);
    const allOrders = useStore(s => s.orders);
    const products = useStore(s => s.products);
    const addPayment = useStore(s => s.addPayment);

    const invoices = useMemo(() => allInvoices.filter(i => i.shopkeeper_id === id), [allInvoices, id]);
    const payments = useMemo(() => allPayments.filter(p => p.shopkeeper_id === id), [allPayments, id]);
    const orders = useMemo(() => allOrders.filter(o => o.shopkeeper_id === id), [allOrders, id]);

    const [tab, setTab] = useState<Tab>('all');
    const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

    // Receive Payment Modal State
    const [receiveModal, setReceiveModal] = useState(false);
    const [receiveAmount, setReceiveAmount] = useState('');
    const [receiveNote, setReceiveNote] = useState('');
    const [receiveDate, setReceiveDate] = useState(() => new Date().toISOString().split('T')[0]);

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
            date: '2000-01-01T00:00:00.000Z',
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

    // ── PROFIT CALCULATION ───────────────────────────────────────────────
    const totalProfit = useMemo(() => {
        return invoices.reduce((acc, inv) => {
            return acc + inv.items.reduce((itemAcc, item) => {
                const prod = products.find(p => p.name === item.product_name);
                const cost = prod?.cost_price ?? 0;
                return itemAcc + ((item.price - cost) * item.quantity);
            }, 0);
        }, 0);
    }, [invoices, products]);

    const tagClass = (type: 'Invoice' | 'Payment') =>
        type === 'Invoice'
            ? 'bg-[#FEE4E2] text-[#D92D20] border border-[#FECDCA] px-2.5 py-0.5 rounded-full font-bold text-xs shadow-sm'
            : 'bg-[#D1FADF] text-[#027A48] border border-[#A9F5C6] px-2.5 py-0.5 rounded-full font-bold text-xs shadow-sm';

    function toggleInvoiceExpand(invoiceId: string) {
        setExpandedInvoices(prev => {
            const next = new Set(prev);
            if (next.has(invoiceId)) next.delete(invoiceId);
            else next.add(invoiceId);
            return next;
        });
    }

    function handleReceivePayment(e: React.FormEvent) {
        e.preventDefault();
        const amt = parseFloat(receiveAmount);
        if (isNaN(amt) || amt <= 0 || !shopkeeper) return;
        addPayment({
            shopkeeper_id: shopkeeper.id,
            amount: amt,
            date: new Date(receiveDate + 'T12:00:00').toISOString(),
            note: receiveNote.trim() || undefined,
        });
        setReceiveModal(false);
        setReceiveAmount('');
        setReceiveNote('');
        setReceiveDate(new Date().toISOString().split('T')[0]);
    }

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
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 bg-card p-4 sm:p-6 rounded-2xl shadow-sm border border-border">
                <div className="flex items-center gap-3">
                    <Link to="/shopkeepers" className="p-2 hover:bg-muted rounded-full transition flex-shrink-0">
                        <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                    </Link>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground truncate">{shopkeeper.name}</h2>
                            <button onClick={printShopkeeperLedger} className="p-1.5 text-muted-foreground hover:text-indigo-500 hover:bg-muted rounded-lg transition flex-shrink-0" title="Print Ledger Statement">
                                <Printer className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-muted-foreground text-sm mt-0.5">Account Statement &amp; History</p>
                        {shopkeeper.phone && <p className="text-xs text-muted-foreground/70 mt-0.5">{shopkeeper.phone}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 sm:flex-col sm:items-end">
                    {/* Quick Receive Payment Button */}
                    <button
                        onClick={() => setReceiveModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 sm:px-4 py-2 rounded-xl text-sm shadow-sm transition flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4 flex-shrink-0" /> Add Receiving
                    </button>
                    <div className="text-right">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Outstanding Balance</span>
                        <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight block ${shopkeeper.current_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            Rs {shopkeeper.current_balance.toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                {/* NEW: Profit Card */}
                <div className={`rounded-xl border p-4 shadow-sm ${totalProfit >= 0 ? 'bg-gradient-to-br from-emerald-950/60 to-teal-950/40 border-emerald-500/20' : 'bg-gradient-to-br from-red-950/60 to-rose-950/40 border-red-500/20'}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className={`w-4 h-4 ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Profit</span>
                    </div>
                    <p className={`text-xl font-bold font-mono ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        Rs {Math.abs(totalProfit).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {totalProfit >= 0 ? 'Net profit earned' : 'Net loss incurred'}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="flex border-b border-border bg-muted/30 overflow-x-auto" style={{scrollbarWidth:'none'}}>
                    {([
                        { key: 'all', label: 'All History', icon: Calendar },
                        { key: 'invoices', label: `Invoices (${invoices.length})`, icon: Receipt },
                        { key: 'payments', label: `Payments (${payments.length})`, icon: Banknote },
                        { key: 'pending', label: `Pending (${pendingOrders.length})`, icon: Clock },
                    ] as { key: Tab; label: string; icon: React.ElementType }[]).map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-1.5 px-3 sm:px-5 py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap flex-shrink-0 ${tab === t.key ? 'border-indigo-650 text-indigo-650 bg-card' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                        >
                            <t.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" /> {t.label}
                        </button>
                    ))}
                </div>

                {tab !== 'pending' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[750px]">
                            <thead className="bg-muted/50 text-muted-foreground font-bold">
                                <tr>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase w-8"></th>
                                    <th className="px-4 py-3 font-semibold text-xs uppercase">Date &amp; Time</th>
                                    <th className="px-4 py-3 font-semibold text-xs uppercase">Type</th>
                                    <th className="px-4 py-3 font-semibold text-xs uppercase">Note / Items</th>
                                    <th className="px-4 py-3 font-semibold text-xs uppercase text-right text-rose-500">Charge</th>
                                    <th className="px-4 py-3 font-semibold text-xs uppercase text-right text-emerald-500">Credit</th>
                                    <th className="px-4 py-3 font-semibold text-xs uppercase text-right">Balance</th>
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
                                        <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground italic">No entries found.</td></tr>
                                    );
                                    return rows.map((entry) => {
                                        const isOpening = entry.id === 'opening-balance';
                                        const isInvoice = entry.type === 'Invoice' && !isOpening;
                                        const invoice = isInvoice ? invoices.find(i => i.id === entry.id) : null;
                                        const isExpanded = expandedInvoices.has(entry.id);

                                        return (
                                        <>
                                        <tr key={entry.id} className={`hover:bg-muted/50 transition ${isOpening ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}>
                                            {/* Expand toggle for invoices */}
                                            <td className="px-2 py-4 text-center">
                                                {isInvoice && invoice && invoice.items.length > 0 ? (
                                                    <button
                                                        onClick={() => toggleInvoiceExpand(entry.id)}
                                                        className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                                                        title="View delivered items"
                                                    >
                                                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                    </button>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-muted-foreground text-xs font-medium">
                                                {isOpening ? (
                                                    <span className="italic text-amber-700 font-semibold">Opening Balance</span>
                                                ) : (
                                                    <>
                                                        <div>{new Date(entry.date).toLocaleDateString()}</div>
                                                        <div className="text-muted-foreground/60">{new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
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
                                            <td className="px-4 py-4 text-xs text-muted-foreground italic">
                                                {isOpening ? 'Carried forward from paper khata' : (entry.note || (entry.type === 'Invoice' ? (
                                                    invoice ? (
                                                        <span className="not-italic text-foreground/70 font-medium">
                                                            {invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''} delivered
                                                            <span className="ml-1 text-muted-foreground font-normal">
                                                                ({invoice.items.map(i => i.product_name).join(', ')})
                                                            </span>
                                                        </span>
                                                    ) : 'Sale Invoice'
                                                ) : '—'))}
                                            </td>
                                            <td className="px-4 py-4 text-right font-mono font-medium text-rose-600 dark:text-rose-455">
                                                {entry.type === 'Invoice' ? `Rs ${entry.amount.toLocaleString()}` : '—'}
                                            </td>
                                            <td className="px-4 py-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-455">
                                                {entry.type === 'Payment' ? `Rs ${entry.amount.toLocaleString()}` : '—'}
                                            </td>
                                            <td className={`px-4 py-4 text-right font-mono font-bold ${entry.running_balance > 0 ? 'text-rose-600 dark:text-rose-455' : 'text-emerald-600 dark:text-emerald-455'}`}>
                                                Rs {entry.running_balance.toLocaleString()}
                                            </td>
                                        </tr>

                                        {/* ── Expandable Invoice Item Details ── */}
                                        {isInvoice && invoice && isExpanded && (
                                            <tr key={`${entry.id}-details`} className="bg-indigo-950/10 dark:bg-indigo-950/20">
                                                <td colSpan={7} className="px-0 py-0">
                                                    <div className="mx-6 my-3 rounded-xl border border-indigo-500/20 overflow-hidden">
                                                        <div className="bg-indigo-950/30 px-4 py-2 flex items-center gap-2 border-b border-indigo-500/20">
                                                            <Receipt className="w-3.5 h-3.5 text-indigo-400" />
                                                            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                                                                Delivered Items — Invoice #{invoice.id.substring(0, 8)}
                                                            </span>
                                                            <span className="ml-auto text-xs text-indigo-300/60">
                                                                {new Date(invoice.date).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <table className="w-full text-xs">
                                                            <thead>
                                                                <tr className="bg-muted/30 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                                                                    <th className="px-4 py-2 text-left">Product</th>
                                                                    <th className="px-4 py-2 text-center">Qty</th>
                                                                    <th className="px-4 py-2 text-right">Rate</th>
                                                                    <th className="px-4 py-2 text-right">Amount</th>
                                                                    <th className="px-4 py-2 text-right text-emerald-400">Profit</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-border">
                                                                {invoice.items.map((item, idx) => {
                                                                    const prod = products.find(p => p.name === item.product_name);
                                                                    const cost = prod?.cost_price ?? 0;
                                                                    const itemProfit = (item.price - cost) * item.quantity;
                                                                    return (
                                                                        <tr key={idx} className="hover:bg-muted/20">
                                                                            <td className="px-4 py-2 font-medium text-foreground">{item.product_name}</td>
                                                                            <td className="px-4 py-2 text-center font-mono text-muted-foreground">{item.quantity}</td>
                                                                            <td className="px-4 py-2 text-right font-mono text-muted-foreground">Rs {item.price.toLocaleString()}</td>
                                                                            <td className="px-4 py-2 text-right font-mono font-bold text-foreground">Rs {item.amount.toLocaleString()}</td>
                                                                            <td className={`px-4 py-2 text-right font-mono font-semibold ${itemProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                                Rs {itemProfit.toLocaleString()}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                                <tr className="bg-indigo-500/10 font-bold">
                                                                    <td colSpan={3} className="px-4 py-2 text-right text-indigo-300 text-[10px] uppercase tracking-wider">Total</td>
                                                                    <td className="px-4 py-2 text-right font-mono text-indigo-300">Rs {invoice.total_amount.toLocaleString()}</td>
                                                                    <td className={`px-4 py-2 text-right font-mono ${invoice.items.reduce((a, item) => { const p = products.find(pr => pr.name === item.product_name); return a + ((item.price - (p?.cost_price ?? 0)) * item.quantity); }, 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                        Rs {invoice.items.reduce((a, item) => { const p = products.find(pr => pr.name === item.product_name); return a + ((item.price - (p?.cost_price ?? 0)) * item.quantity); }, 0).toLocaleString()}
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        </>
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

            {/* ── RECEIVE PAYMENT MODAL ── */}
            {receiveModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-card rounded-2xl shadow-xl w-full max-w-md border border-border overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
                            <div>
                                <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                    <IndianRupee className="w-5 h-5" /> Record Received Payment
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">From <strong className="text-foreground">{shopkeeper.name}</strong></p>
                            </div>
                            <button onClick={() => setReceiveModal(false)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
                        </div>
                        {/* Outstanding balance banner */}
                        <div className="mx-6 mt-4 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
                            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Current Balance Owed</span>
                            <span className="text-xl font-black font-mono text-rose-400">Rs {shopkeeper.current_balance.toLocaleString()}</span>
                        </div>
                        <form onSubmit={handleReceivePayment} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Payment Date</label>
                                <input
                                    type="date"
                                    value={receiveDate}
                                    max={new Date().toISOString().split('T')[0]}
                                    onChange={e => setReceiveDate(e.target.value)}
                                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Amount Received</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">Rs</span>
                                    <input
                                        type="number"
                                        autoFocus
                                        placeholder="0.00"
                                        value={receiveAmount}
                                        onChange={e => setReceiveAmount(e.target.value)}
                                        className="w-full bg-muted/30 border border-border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-foreground font-mono font-bold"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Note / Reference</label>
                                <textarea
                                    placeholder="E.g., Cheque No, Bank Transfer Ref..."
                                    value={receiveNote}
                                    onChange={e => setReceiveNote(e.target.value)}
                                    rows={2}
                                    className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-foreground"
                                />
                            </div>
                            <div className="flex gap-3 justify-end pt-2 border-t border-border">
                                <button type="button" onClick={() => setReceiveModal(false)} className="px-4 py-2 text-muted-foreground font-medium hover:bg-muted rounded-xl transition text-sm">Cancel</button>
                                <button
                                    type="submit"
                                    disabled={!receiveAmount}
                                    className="bg-emerald-600 disabled:opacity-50 text-white px-6 py-2 rounded-xl font-bold shadow-sm transition hover:bg-emerald-700 text-sm"
                                >
                                    Post Payment
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
