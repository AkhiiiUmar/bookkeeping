import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import {
    ArrowLeft, ArrowDownRight, ArrowUpRight, Calendar, Banknote,
    Building2, AlertTriangle, Plus, X, Pencil, Trash2,
    Percent, TrendingUp, TrendingDown, BookOpen, Sparkles, RotateCcw, DollarSign
} from 'lucide-react';
import type { Product } from '../store/useStore';

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Fund Transfer', 'Bank Draft', 'Cheque', 'Online Payment', 'Other'];

interface ProductForm {
    name: string;
    agency_id: string;
    cost_price: string;
    sale_mode: 'manual' | 'percent';
    sale_price: string;
    markup_percent: string;
    current_stock: string;
    weight_kg: string;
}

const emptyProductForm: ProductForm = {
    name: '', agency_id: '', cost_price: '', sale_mode: 'manual',
    sale_price: '', markup_percent: '', current_stock: '', weight_kg: ''
};

function calcSalePrice(form: ProductForm): number {
    const cost = parseFloat(form.cost_price) || 0;
    if (form.sale_mode === 'percent') {
        const pct = parseFloat(form.markup_percent) || 0;
        return parseFloat((cost * (1 + pct / 100)).toFixed(2));
    }
    return parseFloat(form.sale_price) || 0;
}

function calcMargin(cost: number, sale: number): string {
    if (!cost || !sale || cost <= 0) return '—';
    return (((sale - cost) / cost) * 100).toFixed(1) + '%';
}

export default function AgencyLedger() {
    const { id } = useParams<{ id: string }>();
    const agencies = useStore(s => s.agencies);
    const products = useStore(s => s.products);
    const invoices = useStore(s => s.invoices);
    const agencyPayments = useStore(s => s.agencyPayments);
    const addAgencyPayment = useStore(s => s.addAgencyPayment);
    const addDailyExpense = useStore(s => s.addDailyExpense);
    const updateProduct = useStore(s => s.updateProduct);
    const deleteProduct = useStore(s => s.deleteProduct);
    const setAgencyOpeningBalance = useStore(s => s.setAgencyOpeningBalance);
    const clearAgencyLedger = useStore(s => s.clearAgencyLedger);

    const agency = agencies.find(a => a.id === id);
    const payments = useMemo(() => agencyPayments.filter(p => p.agency_id === id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [agencyPayments, id]);
    const agencyProducts = useMemo(() => products.filter(p => p.agency_id === id), [products, id]);

    // Active Dashboard Tab
    const [activeTab, setActiveTab] = useState<'products' | 'ledger'>('products');

    // Opening Balance Edit Modal
    const [openingBalModal, setOpeningBalModal] = useState(false);
    const [openingBalValue, setOpeningBalValue] = useState('');

    // Clear Ledger Confirmation Modal
    const [clearLedgerConfirm, setClearLedgerConfirm] = useState(false);

    // Record Payment Modal State
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [transactionType, setTransactionType] = useState<'payment' | 'purchase' | 'expense'>('payment');
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [branch, setBranch] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [note, setNote] = useState('');

    // Product Edit Modal State
    const [productModal, setProductModal] = useState<{ open: boolean; editing?: Product }>({ open: false });
    const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
    const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);

    const showBankFields = ['Bank Transfer', 'Fund Transfer', 'Bank Draft', 'Cheque', 'Online Payment'].includes(paymentMethod) && transactionType === 'payment';

    // Calculate premium product landing rates dynamically for the catalog
    const productLandingStats = useMemo(() => {
        if (!agency) return [];
        return agencyProducts.map(p => {
            const rawCost = p.cost_price || 0;
            // standard dynamic transport/builty share per carton
            const builtyShare = agency.has_builty ? (p.weight_kg * agency.builty_rate_per_kg) : 0;
            const subtotal = rawCost + builtyShare;

            // standard dynamic FBR tax per carton
            const fbrTax = subtotal * (agency.fbr_percent / 100);
            const salesTax = rawCost * (agency.sales_tax_percent / 100);

            // Total after-tax cost (Landed Carton Cost)
            const landedCost = parseFloat((subtotal + fbrTax + salesTax).toFixed(2));
            const salePrice = p.default_price || 0;
            const profit = salePrice - landedCost;
            const marginPercent = landedCost > 0 ? ((profit / landedCost) * 100).toFixed(1) : '0';
            const totalStockValueInvoice = p.current_stock * rawCost;
            const totalStockValueLanded = p.current_stock * landedCost;

            return {
                ...p,
                builtyShare,
                fbrTax,
                salesTax,
                landedCost,
                profit,
                marginPercent,
                totalStockValueInvoice,
                totalStockValueLanded
            };
        });
    }, [agency, agencyProducts]);

    // Summary calculation aggregates
    const summaryStats = useMemo(() => {
        const totalStockCartons = agencyProducts.reduce((acc, p) => acc + p.current_stock, 0);
        const totalInvoiceValue = productLandingStats.reduce((acc, p) => acc + p.totalStockValueInvoice, 0);
        const totalLandedValue = productLandingStats.reduce((acc, p) => acc + p.totalStockValueLanded, 0);
        return {
            totalStockCartons,
            totalInvoiceValue,
            totalLandedValue
        };
    }, [agencyProducts, productLandingStats]);

    // ── PROFIT CALCULATIONS ─────────────────────────────────────────────────
    const profitStats = useMemo(() => {
        if (!agency) return { totalProfit: 0, thisMonthProfit: 0, lastMonthProfit: 0, growthPct: 0 };

        // Get product IDs belonging to this agency
        const agencyProductIds = new Set(agencyProducts.map(p => p.id));

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        let totalProfit = 0;
        let thisMonthProfit = 0;
        let lastMonthProfit = 0;

        invoices.forEach(inv => {
            const invDate = new Date(inv.date);
            inv.items.forEach(item => {
                // Find matching product
                const prod = agencyProducts.find(p => p.name === item.product_name);
                if (!prod && !agencyProducts.some(p => agencyProductIds.has(p.id))) return;

                // Match product by name across agency products
                const matchedProd = agencyProducts.find(p => p.name === item.product_name);
                if (!matchedProd) return;

                const profit = (item.price - matchedProd.cost_price) * item.quantity;
                totalProfit += profit;

                if (invDate >= thisMonthStart) {
                    thisMonthProfit += profit;
                } else if (invDate >= lastMonthStart && invDate <= lastMonthEnd) {
                    lastMonthProfit += profit;
                }
            });
        });

        const growthPct = lastMonthProfit === 0
            ? (thisMonthProfit > 0 ? 100 : 0)
            : parseFloat((((thisMonthProfit - lastMonthProfit) / Math.abs(lastMonthProfit)) * 100).toFixed(1));

        return { totalProfit, thisMonthProfit, lastMonthProfit, growthPct };
    }, [agency, agencyProducts, invoices]);

    if (!agency) {
        return (
        <div className="space-y-4">
                <Link to="/inventory" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition"><ArrowLeft className="w-4 h-4" /> Back to Inventory</Link>
                <div className="bg-card border border-red-500/20 rounded-xl p-8 text-center shadow-sm">
                    <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-foreground">Agency not found</h3>
                </div>
            </div>
        );
    }

    // Build ledger with running balance
    const chronological = [...payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let bal = agency.opening_balance || 0;
    const balanceMap: Record<string, number> = {};
    chronological.forEach(e => {
        bal += e.type === 'purchase' ? e.amount : -e.amount;
        balanceMap[e.id] = bal;
    });

    const totalPurchases = payments.filter(p => p.type === 'purchase').reduce((s, p) => s + p.amount, 0);
    const totalPaid = payments.filter(p => p.type === 'payment').reduce((s, p) => s + p.amount, 0);

    function handlePaymentSubmit(e: React.FormEvent) {
        e.preventDefault();
        const amt = parseFloat(amount);
        if (isNaN(amt) || amt <= 0) return;

        const isExpense = transactionType === 'expense';
        const finalType = isExpense ? 'payment' : transactionType;
        const finalNote = isExpense ? `[Company Expense] ${note.trim()}` : note.trim();

        addAgencyPayment({
            agency_id: agency!.id, amount: amt, date: new Date().toISOString(), type: finalType,
            payment_method: finalType === 'payment' ? paymentMethod : undefined,
            bank_name: finalType === 'payment' ? (bankName || undefined) : undefined,
            account_number: finalType === 'payment' ? (accountNumber || undefined) : undefined,
            branch: finalType === 'payment' ? (branch || undefined) : undefined,
            reference_number: finalType === 'payment' ? (referenceNumber || undefined) : undefined,
            note: finalNote || undefined,
        });

        if (isExpense) {
            addDailyExpense({
                date: new Date().toISOString(),
                description: `[${agency!.name}] ${note.trim() || 'Company Expense'}`,
                amount: amt,
                category: 'Freight / Transport'
            });
        }

        setAmount(''); setPaymentMethod('Cash'); setBankName(''); setAccountNumber('');
        setBranch(''); setReferenceNumber(''); setNote(''); setTransactionType('payment'); setPaymentModalOpen(false);
    }

    // Product edit trigger
    function startEditProduct(p: Product) {
        const hasPct = p.cost_price > 0 && p.default_price > p.cost_price;
        const pct = hasPct ? (((p.default_price - p.cost_price) / p.cost_price) * 100).toFixed(1) : '';
        setProductForm({
            name: p.name,
            agency_id: p.agency_id,
            cost_price: String(p.cost_price ?? ''),
            sale_mode: pct ? 'percent' : 'manual',
            sale_price: String(p.default_price),
            markup_percent: pct || '20',
            current_stock: String(p.current_stock),
            weight_kg: String(p.weight_kg ?? '')
        });
        setProductModal({ open: true, editing: p });
    }

    function handleProductEditSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!productModal.editing) return;
        const cost = parseFloat(productForm.cost_price);
        const sale = calcSalePrice(productForm);
        const stock = parseInt(productForm.current_stock);
        const weight = parseFloat(productForm.weight_kg) || 0;

        if (!productForm.name.trim() || isNaN(cost) || isNaN(sale) || sale <= 0 || isNaN(stock)) return;

        updateProduct(productModal.editing.id, {
            name: productForm.name.trim(),
            cost_price: cost,
            default_price: sale,
            current_stock: stock,
            weight_kg: weight
        });
        setProductModal({ open: false });
    }

    function handleProductDelete() {
        if (!deleteConfirm) return;
        deleteProduct(deleteConfirm.id);
        setDeleteConfirm(null);
    }

    const previewSalePrice = calcSalePrice(productForm);
    const previewMargin = calcMargin(parseFloat(productForm.cost_price) || 0, previewSalePrice);

    // Growth meter bar width clamped 0-100%
    const growthPositive = profitStats.growthPct >= 0;
    const growthBarWidth = Math.min(Math.abs(profitStats.growthPct), 100);

    return (
        <div className="space-y-6">
            {/* Navigation Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-card p-6 rounded-2xl shadow-sm border border-border gap-4">
                <div className="flex items-center gap-4">
                    <Link to="/inventory" className="p-2.5 hover:bg-muted rounded-full transition flex-shrink-0"><ArrowLeft className="w-5 h-5 text-muted-foreground" /></Link>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Link to="/inventory" className="text-xs text-muted-foreground hover:text-foreground font-medium transition">Inventory &amp; Agencies</Link>
                            <span className="text-xs text-muted-foreground">/</span>
                            <span className="text-xs text-foreground font-bold">{agency.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">Agency Dashboard</span>
                        </div>
                        <h2 className="text-2xl font-black text-foreground flex items-center gap-2 mt-1 leading-none">
                            <Building2 className="w-6 h-6 text-indigo-400" />
                            {agency.name}
                        </h2>
                    </div>
                </div>
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-4 border border-slate-800 text-right min-w-[200px] shadow-md">
                    <span className="text-[10px] font-bold text-indigo-300 block uppercase tracking-wider">Outstanding Balance Owed</span>
                    <span className="text-2xl font-mono font-bold text-amber-400 mt-1 block">
                        Rs {agency.current_balance.toLocaleString()}
                    </span>
                </div>
            </div>

            {/* Premium Dynamic Performance Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-md transition xl:col-span-1">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Catalog</span>
                        <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg"><BookOpen className="w-4 h-4" /></div>
                    </div>
                    <p className="text-2xl font-black text-foreground font-mono">{agencyProducts.length} <span className="text-xs font-medium text-muted-foreground">Products</span></p>
                    <span className="text-[11px] text-muted-foreground block mt-1">Total cartons: <strong className="text-foreground">{summaryStats.totalStockCartons.toLocaleString()}</strong></span>
                </div>
                <div className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-md transition xl:col-span-1">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Landed Stock Value</span>
                        <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg"><Sparkles className="w-4 h-4" /></div>
                    </div>
                    <p className="text-2xl font-black text-emerald-500 font-mono">Rs {summaryStats.totalLandedValue.toLocaleString()}</p>
                    <span className="text-[11px] text-muted-foreground block mt-1">Landed (after-tax) cost value</span>
                </div>
                <div className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-md transition xl:col-span-1">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Raw Invoice Value</span>
                        <div className="p-1.5 bg-muted text-muted-foreground rounded-lg"><Banknote className="w-4 h-4" /></div>
                    </div>
                    <p className="text-2xl font-black text-foreground font-mono">Rs {summaryStats.totalInvoiceValue.toLocaleString()}</p>
                    <span className="text-[11px] text-muted-foreground block mt-1">Raw base cost value of stock</span>
                </div>
                <div className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-md transition xl:col-span-1">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">FBR Landed Markup</span>
                        <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg"><Percent className="w-4 h-4" /></div>
                    </div>
                    <p className="text-2xl font-black text-amber-500 font-mono">+{agency.fbr_percent}% <span className="text-xs font-medium text-muted-foreground">FBR</span></p>
                    <span className="text-[11px] text-muted-foreground block mt-1">Applied on transport + base price</span>
                </div>

                {/* ── NEW: Total Profit Card ─────────────────────────────── */}
                <div className="bg-gradient-to-br from-emerald-950 to-teal-950 rounded-2xl border border-emerald-500/20 p-5 shadow-md hover:shadow-lg transition xl:col-span-1">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Total Profit</span>
                        <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg"><DollarSign className="w-4 h-4" /></div>
                    </div>
                    <p className={`text-2xl font-black font-mono ${profitStats.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        Rs {Math.abs(profitStats.totalProfit).toLocaleString()}
                    </p>
                    <span className="text-[11px] text-emerald-500/70 block mt-1">
                        {profitStats.totalProfit >= 0 ? 'Net profit from this agency' : 'Net loss from this agency'}
                    </span>
                </div>

                {/* ── NEW: Growth Meter Card ─────────────────────────────── */}
                <div className="bg-gradient-to-br from-indigo-950 to-purple-950 rounded-2xl border border-indigo-500/20 p-5 shadow-md hover:shadow-lg transition xl:col-span-1">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Monthly Growth</span>
                        <div className={`p-1.5 rounded-lg ${growthPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {growthPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        </div>
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                        <span className={`text-2xl font-black font-mono ${growthPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {growthPositive ? '+' : ''}{profitStats.growthPct}%
                        </span>
                        <span className="text-[10px] text-indigo-300/60 mb-1">vs last month</span>
                    </div>
                    {/* Animated growth bar */}
                    <div className="w-full h-2 bg-indigo-900/60 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${growthPositive ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-red-600 to-rose-400'}`}
                            style={{ width: `${growthBarWidth}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[9px] text-indigo-300/50">
                        <span>This: Rs {profitStats.thisMonthProfit.toLocaleString()}</span>
                        <span>Last: Rs {profitStats.lastMonthProfit.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Custom Interactive Tab Controls */}
            <div className="flex justify-between items-center border-b border-border pb-px">
                <div className="flex gap-2">
                    <button onClick={() => setActiveTab('products')}
                        className={`pb-3 text-sm font-bold border-b-2 px-4 transition ${activeTab === 'products' ? 'border-indigo-500 text-indigo-400 font-black' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                        📦 Products &amp; Prices Catalog
                    </button>
                    <button onClick={() => setActiveTab('ledger')}
                        className={`pb-3 text-sm font-bold border-b-2 px-4 transition ${activeTab === 'ledger' ? 'border-indigo-500 text-indigo-400 font-black' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                        📖 Ledger &amp; Financial Statements
                    </button>
                </div>
                {activeTab === 'ledger' && (
                    <div className="mb-2 flex gap-2 items-center">
                        <button onClick={() => setPaymentModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm transition flex gap-1.5 items-center">
                            <Plus className="w-3.5 h-3.5" /> Record Payment to Agency
                        </button>
                        <button
                            onClick={() => { setOpeningBalValue((agency.opening_balance ?? 0).toString()); setOpeningBalModal(true); }}
                            title="Edit opening/previous balance owed to agency"
                            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 font-bold px-4 py-2 rounded-lg text-xs shadow-sm transition flex gap-1.5 items-center"
                        >
                            <BookOpen className="w-3.5 h-3.5" /> Edit Opening Balance
                        </button>
                        <button
                            onClick={() => setClearLedgerConfirm(true)}
                            title="Clear all ledger records for this agency"
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold px-4 py-2 rounded-lg text-xs shadow-sm transition flex gap-1.5 items-center"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> Clear Ledger Records
                        </button>
                    </div>
                )}
            </div>

            {/* ──────── TAB 1: PRODUCTS DETAILS DASHBOARD ──────── */}
            {activeTab === 'products' && (
                <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                    <div className="p-5 border-b border-border flex justify-between items-center bg-muted/20">
                        <div>
                            <h3 className="font-bold text-foreground text-sm">Product Valuation &amp; Landed Price Metrics</h3>
                            <p className="text-xs text-muted-foreground">Live calculator breaking down carton landing expenses, FBR taxes, profit margins, and inventory asset values.</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
                            <thead>
                                <tr className="bg-muted/50 text-muted-foreground font-bold uppercase tracking-wider text-[10px] border-b border-border">
                                    <th className="px-5 py-3.5">Product Name</th>
                                    <th className="px-4 py-3.5 text-center">Carton Weight</th>
                                    <th className="px-4 py-3.5 text-right">Invoice Rate</th>
                                    <th className="px-4 py-3.5 text-right">Builty Cost</th>
                                    <th className="px-4 py-3.5 text-right">FBR Tax</th>
                                    <th className="px-4 py-3.5 text-right bg-indigo-500/10 text-indigo-400 font-extrabold">Landed Carton</th>
                                    <th className="px-4 py-3.5 text-right text-emerald-400">Sale Price</th>
                                    <th className="px-4 py-3.5 text-center">Margin %</th>
                                    <th className="px-4 py-3.5 text-right">Profit / Carton</th>
                                    <th className="px-4 py-3.5 text-center">Stock</th>
                                    <th className="px-4 py-3.5 text-right font-extrabold text-foreground">Total Asset Value</th>
                                    <th className="px-5 py-3.5 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {productLandingStats.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} className="px-5 py-12 text-center text-muted-foreground italic">
                                            No products registered under this agency yet. Please add them in the main Inventory tab.
                                        </td>
                                    </tr>
                                ) : productLandingStats.map(p => (
                                    <tr key={p.id} className="hover:bg-muted/50 transition">
                                        <td className="px-5 py-4 font-semibold text-foreground whitespace-nowrap">{p.name}</td>
                                        <td className="px-4 py-4 text-center font-medium font-mono text-muted-foreground">{p.weight_kg} kg</td>
                                        <td className="px-4 py-4 text-right font-mono text-muted-foreground">Rs {p.cost_price.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-right font-mono text-muted-foreground">+Rs {p.builtyShare.toFixed(1)}</td>
                                        <td className="px-4 py-4 text-right font-mono text-muted-foreground">+Rs {p.fbrTax.toFixed(1)}</td>
                                        <td className="px-4 py-4 text-right font-mono bg-indigo-500/10 text-indigo-400 font-black">Rs {p.landedCost.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-right font-mono text-emerald-400 font-semibold">Rs {p.default_price.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full font-bold font-mono text-[10px] ${parseFloat(p.marginPercent) > 10 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                                +{p.marginPercent}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono font-semibold text-emerald-500">Rs {p.profit.toFixed(1)}</td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`inline-block px-2.5 py-0.5 rounded font-bold font-mono text-xs ${p.current_stock < 50 ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-muted border border-border text-foreground'}`}>
                                                {p.current_stock}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono font-extrabold text-foreground">Rs {p.totalStockValueLanded.toLocaleString()}</td>
                                        <td className="px-5 py-4 whitespace-nowrap text-center">
                                            <div className="flex gap-2 justify-center">
                                                <button onClick={() => startEditProduct(p)} title="Edit Price / Product parameters"
                                                    className="p-1.5 bg-muted border border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-lg transition shadow-sm">
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => setDeleteConfirm(p)} title="Delete Product"
                                                    className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-lg transition shadow-sm">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ──────── TAB 2: LEDGER AND BANK DETAILS ──────── */}
            {activeTab === 'ledger' && (
                <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                    <div className="p-5 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center bg-muted/20 gap-4">
                        <div>
                            <h3 className="font-bold text-foreground text-sm">Account Ledger Statement</h3>
                            <p className="text-xs text-muted-foreground">Statement history of purchases (debits) and pay-offs (credits) in chronological ledger order.</p>
                        </div>
                        <div className="flex gap-4 items-center bg-card px-3 py-1.5 rounded-lg border border-border text-xs">
                            <div>
                                <span className="text-muted-foreground font-bold">Total Purchases:</span> <span className="text-red-400 font-bold font-mono">Rs {totalPurchases.toLocaleString()}</span>
                            </div>
                            <div className="text-border">|</div>
                            <div>
                                <span className="text-muted-foreground font-bold">Total Paid:</span> <span className="text-emerald-400 font-bold font-mono">Rs {totalPaid.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                            <thead>
                                <tr className="bg-muted/50 text-muted-foreground font-bold uppercase tracking-wider text-[10px] border-b border-border">
                                    <th className="px-5 py-3.5">Date</th>
                                    <th className="px-4 py-3.5">Type</th>
                                    <th className="px-4 py-3.5">Payment Method</th>
                                    <th className="px-5 py-3.5">Ref Details / Remarks</th>
                                    <th className="px-4 py-3.5 text-right text-red-400 font-bold">Debit (Purchase)</th>
                                    <th className="px-4 py-3.5 text-right text-emerald-400 font-bold">Credit (Paid)</th>
                                    <th className="px-5 py-3.5 text-right font-extrabold text-foreground">Running Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {(payments.length === 0 && !agency.opening_balance) ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground italic">
                                            No ledger statements or transactions recorded.
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {payments.map(entry => (
                                            <tr key={entry.id} className="hover:bg-muted/50 transition">
                                                <td className="px-5 py-4 whitespace-nowrap text-xs">
                                                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                                        {new Date(entry.date).toLocaleDateString()}
                                                    </div>
                                                    <div className="text-muted-foreground mt-0.5 ml-5 text-[10px]">
                                                        {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${entry.type === 'purchase' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                                        {entry.type === 'purchase' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                        {entry.type === 'purchase' ? 'Purchase' : 'Payment'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-foreground font-semibold">{entry.payment_method || '—'}</td>
                                                <td className="px-5 py-4 text-muted-foreground max-w-[280px]">
                                                    {entry.note && <div className="font-medium text-foreground break-words">{entry.note}</div>}
                                                    {entry.bank_name && (
                                                        <div className="text-muted-foreground mt-1 flex items-center gap-1 text-[10px]">
                                                            <span className="font-semibold text-foreground">Bank:</span> {entry.bank_name} {entry.branch ? `(${entry.branch})` : ''}
                                                        </div>
                                                    )}
                                                    {entry.account_number && (
                                                        <div className="text-muted-foreground font-mono text-[10px]">
                                                            <span className="font-semibold text-foreground">Acct:</span> {entry.account_number}
                                                        </div>
                                                    )}
                                                    {entry.reference_number && (
                                                        <div className="text-muted-foreground font-mono text-[10px] mt-0.5">
                                                            <span className="font-semibold text-foreground">Ref #:</span> {entry.reference_number}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-right font-mono font-bold text-red-400 whitespace-nowrap">{entry.type === 'purchase' ? `Rs ${entry.amount.toLocaleString()}` : '—'}</td>
                                                <td className="px-4 py-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">{entry.type === 'payment' ? `Rs ${entry.amount.toLocaleString()}` : '—'}</td>
                                                <td className={`px-5 py-4 text-right font-mono font-extrabold text-sm whitespace-nowrap ${(balanceMap[entry.id] ?? 0) > 0 ? 'text-red-450' : 'text-emerald-450'}`}>
                                                    Rs {(balanceMap[entry.id] ?? 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Opening Balance Row – always show so user can see/edit it */}
                                        <tr className="bg-amber-500/5 text-muted-foreground border-t border-dashed border-border transition">
                                            <td className="px-5 py-4 whitespace-nowrap text-xs">
                                                <div className="flex items-center gap-1.5 font-semibold">
                                                    —
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                    <BookOpen className="w-3.5 h-3.5" />
                                                    Opening Balance
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 font-semibold">—</td>
                                            <td className="px-5 py-4 font-medium text-amber-600 dark:text-amber-400">
                                                <div className="flex items-center gap-2">
                                                    <span>Previous migrated paper balance</span>
                                                    <button
                                                        onClick={() => { setOpeningBalValue((agency.opening_balance ?? 0).toString()); setOpeningBalModal(true); }}
                                                        title="Edit opening balance"
                                                        className="p-1 rounded hover:bg-amber-500/20 text-amber-500 transition"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right font-mono font-bold text-red-400">
                                                {agency.opening_balance ? `Rs ${agency.opening_balance.toLocaleString()}` : <span className="text-muted-foreground italic text-[11px]">Not set</span>}
                                            </td>
                                            <td className="px-4 py-4 text-right font-mono font-bold text-emerald-400">—</td>
                                            <td className="px-5 py-4 text-right font-mono font-extrabold text-sm text-red-450">
                                                {agency.opening_balance ? `Rs ${agency.opening_balance.toLocaleString()}` : '—'}
                                            </td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── PAYMENT MODAL (Same custom premium design system) ── */}
            {paymentModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col border border-border overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
                            <div>
                                <h3 className="text-lg font-bold text-foreground">
                                    {transactionType === 'payment' ? 'Record Payment to Supplier' : 'Record Purchase / Expense / Claim'}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {transactionType === 'payment'
                                        ? `Deduct transaction amount from outstanding ledger balance for ${agency.name}`
                                        : `Add purchase or custom expense/charges to the ledger balance for ${agency.name}`}
                                </p>
                            </div>
                            <button onClick={() => setPaymentModalOpen(false)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Transaction Type</label>
                                <select
                                    value={transactionType}
                                    onChange={e => setTransactionType(e.target.value as 'payment' | 'purchase' | 'expense')}
                                    className={`w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 ${transactionType === 'purchase' ? 'focus:ring-indigo-500' : 'focus:ring-emerald-500'} font-semibold`}
                                >
                                    <option value="payment">Payment to Supplier (Subtracts from Owed Balance)</option>
                                    <option value="purchase">Purchase / Invoice Bill (Adds to Owed Balance)</option>
                                    <option value="expense">Expense paid on behalf of Company (Subtracts from Owed &amp; records Daily Expense)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                    {transactionType === 'purchase' ? 'Purchase Amount (Rs)' : transactionType === 'expense' ? 'Expense Paid (Rs)' : 'Payment Amount (Rs)'}
                                </label>
                                <input type="number" required autoFocus min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className={`w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 ${transactionType === 'purchase' ? 'focus:ring-indigo-500' : 'focus:ring-emerald-500'}`} />
                            </div>
                            {transactionType === 'payment' && (
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Payment Method</label>
                                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold">
                                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            )}
                            {transactionType === 'payment' && showBankFields && (
                                <div className="space-y-4 bg-muted/30 p-4 rounded-xl border border-border">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Bank Name</label>
                                            <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Bank Al Habib" className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Account Number</label>
                                            <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Acct #" className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Branch</label>
                                            <input value={branch} onChange={e => setBranch(e.target.value)} placeholder="Branch name/code" className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Cheque / Ref Number</label>
                                            <input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="Ref/Draft #" className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Remarks / Note</label>
                                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder={transactionType === 'purchase' ? "e.g. Received new stock, manual bill adjustment..." : transactionType === 'expense' ? "e.g. Unloading paid, freight paid to transporter directly..." : "e.g. Paid amount for Soap carton delivery..."} className={`w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${transactionType === 'purchase' ? 'focus:ring-indigo-500' : 'focus:ring-emerald-500'}`} />
                            </div>
                            <div className="flex gap-3 justify-end pt-4 border-t border-border">
                                <button type="button" onClick={() => setPaymentModalOpen(false)} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition">Cancel</button>
                                <button type="submit" className={`px-4 py-2 text-sm text-white rounded-lg font-bold transition ${transactionType === 'purchase' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                                    {transactionType === 'purchase' ? 'Record Purchase' : transactionType === 'expense' ? 'Record Expense & Deduct' : 'Record Payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── EDIT OPENING BALANCE MODAL ── */}
            {openingBalModal && agency && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm border border-border overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-amber-500" />
                                <h3 className="text-base font-bold text-foreground">Edit Opening Balance</h3>
                            </div>
                            <button onClick={() => setOpeningBalModal(false)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Set the previous balance you owed <strong className="text-foreground">{agency.name}</strong> before starting this ledger. This amount becomes the opening debit in their ledger statement.
                            </p>
                            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400">
                                ⚠ This adjusts the current outstanding balance by the difference from the previous opening balance.
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Opening Balance (Rs)</label>
                                <input
                                    autoFocus
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={openingBalValue}
                                    onChange={e => setOpeningBalValue(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            setAgencyOpeningBalance(agency.id, parseFloat(openingBalValue) || 0);
                                            setOpeningBalModal(false);
                                        }
                                    }}
                                    placeholder="e.g. 50000"
                                    className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                            </div>
                            <div className="flex gap-3 justify-end pt-1">
                                <button onClick={() => setOpeningBalModal(false)} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition">Cancel</button>
                                <button
                                    onClick={() => {
                                        setAgencyOpeningBalance(agency.id, parseFloat(openingBalValue) || 0);
                                        setOpeningBalModal(false);
                                    }}
                                    className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition"
                                >
                                    Save Opening Balance
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CLEAR LEDGER CONFIRMATION MODAL ── */}
            {clearLedgerConfirm && agency && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-card rounded-2xl shadow-xl w-full max-w-md border border-border overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
                            <div className="flex items-center gap-2">
                                <RotateCcw className="w-5 h-5 text-red-400" />
                                <h3 className="text-base font-bold text-foreground">Clear All Ledger Records</h3>
                            </div>
                            <button onClick={() => setClearLedgerConfirm(false)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Are you absolutely sure you want to clear all ledger records for <strong className="text-foreground">{agency.name}</strong>?
                            </p>
                            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 space-y-1.5">
                                <p className="text-xs font-bold text-red-400 uppercase tracking-wider">⚠ This will permanently:</p>
                                <ul className="text-xs text-red-400 space-y-1 list-disc list-inside">
                                    <li>Delete all <strong>{payments.length}</strong> transaction records (purchases &amp; payments)</li>
                                    <li>Reset outstanding balance to the opening balance ({agency.opening_balance ? `Rs ${agency.opening_balance.toLocaleString()}` : 'Rs 0'})</li>
                                    <li>This action cannot be undone</li>
                                </ul>
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setClearLedgerConfirm(false)} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/50 font-semibold transition">Cancel</button>
                                <button
                                    onClick={() => {
                                        clearAgencyLedger(agency.id);
                                        setClearLedgerConfirm(false);
                                    }}
                                    className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition shadow-sm flex items-center gap-1.5"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" /> Yes, Clear All Records
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── EDIT PRODUCT MODAL (Same premium design system as Inventory) ── */}
            {productModal.open && productModal.editing && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg border border-border overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
                            <div>
                                <h3 className="text-lg font-bold text-foreground">Edit Product catalog</h3>
                                <p className="text-xs text-muted-foreground mt-1">Configure pricing parameters for <strong className="text-foreground">{productModal.editing.name}</strong></p>
                            </div>
                            <button onClick={() => setProductModal({ open: false })} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleProductEditSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Product Name</label>
                                <input autoFocus value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Soap 20kg Carton"
                                    className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Carton Weight (kg)</label>
                                    <input type="number" step="any" min="0" value={productForm.weight_kg} onChange={e => setProductForm(f => ({ ...f, weight_kg: e.target.value }))}
                                        placeholder="e.g. 20"
                                        className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Base Price (Invoice Cost)</label>
                                    <input type="number" min="0" value={productForm.cost_price} onChange={e => setProductForm(f => ({ ...f, cost_price: e.target.value }))}
                                        placeholder="0"
                                        className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                                </div>
                            </div>

                            {/* Sale price configurations */}
                            <div className="bg-muted/20 p-4 rounded-xl border border-border space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-muted-foreground uppercase">Retail Sale Price</label>
                                    <div className="flex items-center bg-muted/80 rounded-lg p-0.5 gap-0.5 border border-border">
                                        <button type="button" onClick={() => setProductForm(f => ({ ...f, sale_mode: 'manual' }))}
                                            className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition ${productForm.sale_mode === 'manual' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>
                                            Manual
                                        </button>
                                        <button type="button" onClick={() => setProductForm(f => ({ ...f, sale_mode: 'percent' }))}
                                            className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition ${productForm.sale_mode === 'percent' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>
                                            Markup %
                                        </button>
                                    </div>
                                </div>

                                {productForm.sale_mode === 'manual' ? (
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">Rs</span>
                                        <input type="number" min="0" value={productForm.sale_price}
                                            onChange={e => setProductForm(f => ({ ...f, sale_price: e.target.value }))}
                                            placeholder="0"
                                            className="w-full bg-background border border-border text-foreground rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-semibold" />
                                    </div>
                                ) : (
                                    <div className="flex gap-3 items-center">
                                        <div className="relative flex-1">
                                            <input type="number" min="0" max="100" value={productForm.markup_percent}
                                                onChange={e => setProductForm(f => ({ ...f, markup_percent: e.target.value }))}
                                                placeholder="e.g. 20"
                                                className="w-full bg-background border border-border text-foreground rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono" />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">%</span>
                                        </div>
                                        <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 font-mono font-extrabold min-w-[100px] text-center shadow-sm">
                                            = Rs {previewSalePrice > 0 ? previewSalePrice : '—'}
                                        </div>
                                    </div>
                                )}

                                {parseFloat(productForm.cost_price) > 0 && previewSalePrice > 0 && (
                                    <div className="text-xs text-emerald-500 font-medium flex items-center gap-1 mt-1">
                                        <TrendingUp className="w-3.5 h-3.5" /> Margin Markup: <span className="font-bold font-mono">{previewMargin}</span> · Margin Profit: <span className="font-bold font-mono">Rs {(previewSalePrice - parseFloat(productForm.cost_price)).toFixed(2)}</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Current Stock (units)</label>
                                <input type="number" min="0" value={productForm.current_stock}
                                    onChange={e => setProductForm(f => ({ ...f, current_stock: e.target.value }))}
                                    placeholder="0"
                                    className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-border">
                                <button type="button" onClick={() => setProductModal({ open: false })} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition">Cancel</button>
                                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold transition">Save &amp; Sync</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── DELETE CONFIRMATION MODAL ── */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-card rounded-2xl shadow-xl w-full max-w-md border border-border overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
                            <h3 className="text-base font-bold text-foreground">Confirm Deletion</h3>
                            <button onClick={() => setDeleteConfirm(null)} className="p-1 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Are you absolutely sure you want to delete <strong className="text-foreground">{deleteConfirm.name}</strong> from the catalog? This action will permanently remove all stock records and cannot be undone.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/50 font-semibold transition">Cancel</button>
                                <button onClick={handleProductDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold transition shadow-sm">Delete Forever</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
