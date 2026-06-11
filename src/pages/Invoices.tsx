import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { Invoice, InvoiceItem } from '../store/useStore';
import { 
    CheckCircle, Calendar, Receipt, Trash2, Printer, Eye, TrendingUp, X 
} from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { printHtml } from '../utils/print';

export default function Invoices() {
    const { invoices, shopkeepers, products, createDirectInvoice, deleteInvoice } = useStore();

    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [isModalOpen, setModalOpen] = useState(false);
    const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
    const [successInvoice, setSuccessInvoice] = useState<Omit<Invoice, 'id'> | null>(null);

    const [shopkeeperId, setShopkeeperId] = useState('');
    const [items, setItems] = useState<Omit<InvoiceItem, 'amount'>[]>([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [qty, setQty] = useState('');
    const [customPrice, setCustomPrice] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);

    const sortedInvoices = [...invoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    useEffect(() => {
        if (selectedProduct) {
            const p = products.find(prod => prod.id === selectedProduct);
            if (p) setCustomPrice(String(p.default_price));
        } else {
            setCustomPrice('');
        }
    }, [selectedProduct, products]);

    useEffect(() => {
        if (!selectedProduct || !qty || !customPrice) return;
        const qtyNum = parseInt(qty);
        const priceNum = parseFloat(customPrice);
        if (isNaN(qtyNum) || qtyNum <= 0 || isNaN(priceNum) || priceNum <= 0) return;

        const p = products.find(prod => prod.id === selectedProduct);
        if (!p) return;

        const timer = setTimeout(() => {
            setItems(prev => [...prev, { product_name: p.name, quantity: qtyNum, price: priceNum }]);
            setSelectedProduct('');
            setQty('');
            setCustomPrice('');
        }, 600);

        return () => clearTimeout(timer);
    }, [qty]);

    const handleRemoveItem = (idx: number) => {
        setItems(prev => prev.filter((_, i) => i !== idx));
    };

    const printInvoiceSlip = (inv: Omit<Invoice, 'id'> & { id?: string }) => {
        const shopkeeper = shopkeepers.find(s => s.id === inv.shopkeeper_id);
        const memoId = inv.id ? inv.id.substring(0, 8) : 'TEMP';
        const tableRows = inv.items.map(item => `
            <tr>
                <td style="padding: 6px 0; border-bottom: 1px dashed #eee;">${item.product_name}</td>
                <td style="padding: 6px 0; border-bottom: 1px dashed #eee; text-align: center;">${item.quantity}</td>
                <td style="padding: 6px 0; border-bottom: 1px dashed #eee; text-align: right;">Rs ${item.price}</td>
                <td style="padding: 6px 0; border-bottom: 1px dashed #eee; text-align: right; font-family: monospace;">Rs ${(item.price * item.quantity).toLocaleString()}</td>
            </tr>
        `).join('');

        printHtml(`
            <html>
            <head>
                <title>Cash Memo #${memoId}</title>
                <style>
                    body { font-family: 'Courier New', monospace; padding: 20px; color: #000; max-width: 80mm; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 15px; }
                    .header h2 { margin: 0; text-transform: uppercase; font-size: 16px; font-weight: bold; }
                    .header p { margin: 3px 0; font-size: 10px; }
                    .divider { border-bottom: 1px dashed #000; margin: 12px 0; }
                    .info-table, .items-table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    .info-table td { padding: 2px 0; }
                    .items-table th { border-bottom: 1px solid #000; padding: 4px 0; text-align: left; font-size: 10px; }
                    .items-table td { padding: 4px 0; }
                    .text-right { text-align: right; }
                    .total-row td { font-weight: bold; border-top: 1px dashed #000; padding-top: 8px; font-size: 11px; }
                    .footer { text-align: center; margin-top: 25px; font-size: 9px; }
                </style>
            </head>
            <body onload="window.print()">
                <div class="header">
                    <h2>DISTRIBUTION POS</h2>
                    <p>Distribution Business & Logistics</p>
                    <p>Standard Cash Memo Statement</p>
                </div>
                <div class="divider"></div>
                <table class="info-table">
                    <tr><td><strong>Memo ID:</strong> #${memoId}</td><td class="text-right"><strong>Date:</strong> ${new Date(inv.date).toLocaleDateString()}</td></tr>
                    <tr><td><strong>Customer:</strong> ${shopkeeper?.name || 'Walk-in'}</td><td class="text-right"><strong>Phone:</strong> ${shopkeeper?.phone || '—'}</td></tr>
                    ${shopkeeper?.address ? `<tr><td colspan="2"><strong>Address:</strong> ${shopkeeper.address}</td></tr>` : ''}
                </table>
                <div class="divider"></div>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th style="width: 45%;">Item</th>
                            <th style="text-align: center; width: 15%;">Qty</th>
                            <th style="text-align: right; width: 20%;">Rate</th>
                            <th style="text-align: right; width: 20%;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                        <tr class="total-row">
                            <td colspan="3" class="text-right">Grand Total:</td>
                            <td class="text-right">Rs ${inv.total_amount.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="divider"></div>
                <div class="footer">
                    <p>Thank you for your business!</p>
                    <p>System Generated Bookkeeping Slip</p>
                </div>
            </body>
            </html>
        `);
    };

    const handleGenerateInvoice = () => {
        if (!shopkeeperId || items.length === 0) return;
        const total = calculateTotal(items);
        const invPayload = {
            shopkeeper_id: shopkeeperId,
            date: new Date(invoiceDate + 'T12:00:00').toISOString(),
            source: 'Direct' as const,
            items: items.map(item => ({ ...item, amount: item.price * item.quantity })),
            total_amount: total
        };

        createDirectInvoice(invPayload);
        setModalOpen(false);
        setShopkeeperId('');
        setItems([]);
        setInvoiceDate(new Date().toISOString().split('T')[0]);
        setSuccessInvoice(invPayload);
    };

    const calculateTotal = (invItems: Omit<InvoiceItem, 'amount'>[]) =>
        invItems.reduce((acc, current) => acc + (current.price * current.quantity), 0);

    const calculateTotalProfit = (invItems: Omit<InvoiceItem, 'amount'>[]) =>
        invItems.reduce((acc, item) => {
            const prod = products.find(p => p.name === item.product_name);
            const cost = prod?.cost_price ?? 0;
            return acc + ((item.price - cost) * item.quantity);
        }, 0);

    const selectedProd = products.find(p => p.id === selectedProduct);
    const previewQty = parseInt(qty) || 0;
    const previewPrice = parseFloat(customPrice) || 0;
    const previewAmount = previewQty * previewPrice;
    const previewCost = (selectedProd?.cost_price ?? 0) * previewQty;
    const previewProfit = previewAmount - previewCost;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-card p-6 rounded-2xl shadow-sm border border-border">
                <div>
                    <h2 className="text-2xl font-extrabold text-[#101828] dark:text-white">Cash Memos (Invoices)</h2>
                    <p className="text-muted-foreground text-sm">Generate, view, and print sales invoices</p>
                </div>
                <button onClick={() => setModalOpen(true)} className="text-white px-4 py-2 rounded-xl font-bold transition flex gap-2 items-center text-sm" style={{background:'#7F56D9',boxShadow:'0 1px 3px rgba(127,86,217,0.3)'}}>
                    <Receipt className="w-4 h-4" /> Generate Cash Memo
                </button>
            </div>

            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[900px]">
                    <thead className="bg-muted/50 text-muted-foreground font-bold">
                        <tr>
                            <th className="px-6 py-3 font-semibold text-xs uppercase">Inv ID</th>
                            <th className="px-6 py-3 font-semibold text-xs uppercase">Date</th>
                            <th className="px-6 py-3 font-semibold text-xs uppercase">Shopkeeper</th>
                            <th className="px-6 py-3 font-semibold text-xs uppercase">Source</th>
                            <th className="px-6 py-3 font-semibold text-xs uppercase">Items</th>
                            <th className="px-6 py-3 font-semibold text-xs uppercase text-right">Total Amount</th>
                            <th className="px-6 py-3 font-semibold text-xs uppercase text-center w-36">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {sortedInvoices.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No invoices found.</td>
                            </tr>
                        )}
                        {sortedInvoices.map(inv => {
                            const shopkeeper = shopkeepers.find(s => s.id === inv.shopkeeper_id);
                            return (
                                <tr key={inv.id} className="hover:bg-muted/50 transition group">
                                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">#{inv.id.substring(0, 8)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground text-xs">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4" /> {new Date(inv.date).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-foreground">{shopkeeper?.name || 'Unknown'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${inv.source === 'Direct' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-muted text-muted-foreground'}`}>
                                            {inv.source}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">{inv.items.length} items</td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">Rs {inv.total_amount.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => setViewInvoice(inv)} title="View Invoice details"
                                                className="p-1.5 text-muted-foreground hover:text-indigo-500 hover:bg-muted rounded-lg transition">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => printInvoiceSlip(inv)} title="Print Memo slip"
                                                className="p-1.5 text-muted-foreground hover:text-emerald-500 hover:bg-muted rounded-lg transition">
                                                <Printer className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setDeleteConfirm(inv.id)} title="Cancel Memo"
                                                className="p-1.5 text-red-400 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                </div>
            </div>

            {/* View Details Drawer/Modal */}
            {viewInvoice && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg flex flex-col border border-border overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
                            <div>
                                <h3 className="text-lg font-bold text-foreground">Cash Memo Details</h3>
                                <p className="text-xs text-muted-foreground">ID: #{viewInvoice.id.substring(0, 12)}</p>
                            </div>
                            <button onClick={() => setViewInvoice(null)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">&times;</button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4 max-h-[60vh]">
                            <div className="flex justify-between border-b border-border pb-3 text-sm">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Shopkeeper</p>
                                    <p className="font-extrabold text-foreground mt-0.5">{shopkeepers.find(s => s.id === viewInvoice.shopkeeper_id)?.name || 'Unknown'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Date</p>
                                    <p className="font-bold text-foreground mt-0.5">{new Date(viewInvoice.date).toLocaleDateString()}</p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs min-w-[400px]">
                                <thead>
                                    <tr className="border-b border-border text-muted-foreground uppercase font-bold">
                                        <th className="py-2">Item</th>
                                        <th className="py-2 text-center">Qty</th>
                                        <th className="py-2 text-right">Rate</th>
                                        <th className="py-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {viewInvoice.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="py-2 font-medium text-foreground">{item.product_name}</td>
                                            <td className="py-2 text-center font-mono">{item.quantity}</td>
                                            <td className="py-2 text-right font-mono text-muted-foreground">Rs {item.price}</td>
                                            <td className="py-2 text-right font-mono font-bold text-foreground">Rs {(item.price * item.quantity).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                </table>
                            </div>

                            <div className="border-t border-border pt-4 flex justify-between items-center text-sm font-bold bg-muted/40 p-4 rounded-xl">
                                <span className="text-[#475467] dark:text-slate-300">Grand Total Amount</span>
                                <span className="text-lg font-extrabold text-[#5f69e1] font-mono">Rs {viewInvoice.total_amount.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-3 bg-muted/20">
                            <button onClick={() => setViewInvoice(null)} className="px-4 py-2 border border-border text-muted-foreground font-semibold hover:bg-muted rounded-xl transition text-xs">Close</button>
                            <button onClick={() => { printInvoiceSlip(viewInvoice); setViewInvoice(null); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold shadow-sm transition flex gap-1.5 items-center text-xs">
                                <Printer className="w-4 h-4" /> Print Receipt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Immediate Success Print Modal */}
            {successInvoice && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-6 border border-border text-center">
                        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                            <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-1">Cash Memo Generated!</h3>
                        <p className="text-sm text-muted-foreground mb-6">Memo has been verified and bookkeeping balance has been posted successfully.</p>
                        
                        <div className="flex flex-col gap-2.5">
                            <button onClick={() => { printInvoiceSlip(successInvoice); setSuccessInvoice(null); }}
                                className="w-full bg-[#5f69e1] hover:bg-[#5f69e1]/90 text-white py-2.5 rounded-xl font-bold transition flex justify-center items-center gap-2 text-sm shadow-sm">
                                <Printer className="w-4 h-4" /> Print Memo Receipt
                            </button>
                            <button onClick={() => setSuccessInvoice(null)}
                                className="w-full border border-border text-muted-foreground hover:bg-muted py-2.5 rounded-xl font-bold transition text-sm">
                                Dismiss / Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Cash Memo Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-border">
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2"><Receipt className="w-5 h-5" /> New Cash Memo</h3>
                            <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">&times;</button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5">
                            {/* Date picker — allows backdating old cash memos */}
                            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 flex items-center gap-3">
                                <Calendar className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">Memo Date <span className="text-muted-foreground font-normal normal-case">(change to enter old cash memos)</span></label>
                                    <input
                                        type="date"
                                        value={invoiceDate}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={e => setInvoiceDate(e.target.value)}
                                        className="w-full bg-background border border-purple-300 dark:border-purple-700 rounded-lg px-3 py-1.5 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    />
                                </div>
                                {invoiceDate !== new Date().toISOString().split('T')[0] && (
                                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full whitespace-nowrap">📅 Backdated</span>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Shopkeeper</label>
                                <SearchableSelect
                                    options={shopkeepers.map(s => ({ value: s.id, label: s.name, sub: s.phone || s.address || '' }))}
                                    value={shopkeeperId}
                                    onChange={setShopkeeperId}
                                    placeholder="Search shopkeeper…"
                                    accentColor="emerald"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Add Item</label>
                                <div className="flex gap-2 items-start">
                                    <div className="flex-1">
                                        <SearchableSelect
                                            options={products.map(p => ({ value: p.id, label: p.name, sub: `Rs ${p.default_price} · Stock: ${p.current_stock}` }))}
                                            value={selectedProduct}
                                            onChange={setSelectedProduct}
                                            placeholder="Search product…"
                                            accentColor="emerald"
                                        />
                                    </div>
                                    <div className="relative w-28">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Rs</span>
                                        <input
                                            type="number"
                                            placeholder="Rate"
                                            value={customPrice}
                                            onChange={e => setCustomPrice(e.target.value)}
                                            className="w-full bg-muted/30 border border-border rounded-lg pl-8 pr-2 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-foreground"
                                        />
                                    </div>
                                    <input
                                        type="number"
                                        placeholder="Qty"
                                        value={qty}
                                        onChange={e => setQty(e.target.value)}
                                        className="w-20 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-foreground"
                                    />
                                </div>

                                {selectedProd && previewQty > 0 && previewPrice > 0 && (
                                    <div className="mt-2 flex items-center gap-3 text-xs bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2">
                                        <span className="text-foreground">
                                            <strong>{selectedProd.name}</strong> × {previewQty} @ Rs {previewPrice}
                                        </span>
                                        <span className="text-muted-foreground">|</span>
                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">= Rs {previewAmount.toLocaleString()}</span>
                                        <span className="text-muted-foreground">|</span>
                                        <span className={`flex items-center gap-1 font-medium ${previewProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                            <TrendingUp className="w-3 h-3" />
                                            Profit: Rs {previewProfit.toLocaleString()}
                                        </span>
                                        <span className="text-muted-foreground ml-auto">Adding...</span>
                                    </div>
                                )}
                            </div>

                            {items.length > 0 && (
                                <div className="border border-emerald-200 dark:border-emerald-900 rounded-lg overflow-hidden ring-1 ring-black/5 shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm min-w-[550px]">
                                        <thead className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">Product</th>
                                                <th className="px-3 py-2 font-medium">Qty</th>
                                                <th className="px-3 py-2 font-medium">Rate</th>
                                                <th className="px-3 py-2 font-medium text-right">Amount</th>
                                                <th className="px-3 py-2 font-medium text-right">Profit</th>
                                                <th className="px-3 py-2 w-8"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50 bg-card">
                                            {items.map((item, idx) => {
                                                const prod = products.find(p => p.name === item.product_name);
                                                const cost = prod?.cost_price ?? 0;
                                                const itemProfit = (item.price - cost) * item.quantity;
                                                const isCustomRate = prod && item.price !== prod.default_price;
                                                return (
                                                    <tr key={idx}>
                                                        <td className="px-3 py-2 text-foreground">{item.product_name}</td>
                                                        <td className="px-3 py-2 text-foreground font-mono">{item.quantity}</td>
                                                        <td className="px-3 py-2 font-mono">
                                                            <span className="text-foreground">Rs {item.price}</span>
                                                            {isCustomRate && (
                                                                <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">(was {prod.default_price})</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono font-medium text-foreground">
                                                            Rs {(item.price * item.quantity).toLocaleString()}
                                                        </td>
                                                        <td className={`px-3 py-2 text-right font-mono font-medium ${itemProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                            Rs {itemProfit.toLocaleString()}
                                                        </td>
                                                        <td className="px-3 py-1">
                                                            <button onClick={() => handleRemoveItem(idx)} className="p-1 text-muted-foreground hover:text-red-500 transition">
                                                                 <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            <tr className="bg-emerald-50/50 dark:bg-emerald-950/20">
                                                <td colSpan={3} className="px-3 py-3 font-semibold text-right text-emerald-700 dark:text-emerald-400">Total</td>
                                                <td className="px-3 py-3 font-bold text-right text-emerald-700 dark:text-emerald-400 font-mono text-lg">Rs {calculateTotal(items).toLocaleString()}</td>
                                                <td className={`px-3 py-3 font-bold text-right font-mono ${calculateTotalProfit(items) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    Rs {calculateTotalProfit(items).toLocaleString()}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        </div>

                        <div className="p-6 border-t border-border bg-emerald-50/10 dark:bg-emerald-950/10 flex justify-end gap-3 rounded-b-xl">
                            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-muted-foreground font-medium hover:bg-muted rounded-lg transition">Cancel</button>
                            <button
                                onClick={handleGenerateInvoice}
                                disabled={!shopkeeperId || items.length === 0}
                                className="bg-emerald-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-bold shadow-sm transition hover:bg-emerald-700 flex items-center gap-2"
                            >
                                <CheckCircle className="w-5 h-5" /> Generate Cash Memo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-border">
                        <h3 className="text-lg font-bold text-foreground mb-2">Cancel Cash Memo?</h3>
                        <p className="text-muted-foreground text-sm">This will reverse the shopkeeper balance and restore stock. This action cannot be undone.</p>
                        <div className="flex gap-3 justify-end mt-6">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted">Keep</button>
                            <button onClick={() => { deleteInvoice(deleteConfirm); setDeleteConfirm(null); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
