import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Link } from 'react-router-dom';
import {
    Package, Plus, Pencil, Trash2, X, ChevronDown, ChevronUp,
    Building2, Percent, DollarSign, TrendingUp, BookOpen,
    Scale, Truck, ShieldAlert, CheckCircle, Calculator, Info, HelpCircle
} from 'lucide-react';
import type { Agency, Product } from '../store/useStore';

type AgencyModalMode = 'add' | 'edit';
type ProductModalMode = 'add' | 'edit';

interface AgencyForm {
    name: string;
    opening_balance: string;
    has_builty: boolean;
    builty_rate_per_kg: string;
    company_fbr_percent: string;
    enable_company_fbr: boolean;
    fbr_percent: string;
    enable_fbr: boolean;
    sales_tax_percent: string;
    enable_sales_tax: boolean;
}

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

const emptyAgencyForm: AgencyForm = {
    name: '',
    opening_balance: '',
    has_builty: false,
    builty_rate_per_kg: '',
    company_fbr_percent: '0.1',
    enable_company_fbr: false,
    fbr_percent: '2.5',
    enable_fbr: false,
    sales_tax_percent: '',
    enable_sales_tax: false,
};

const emptyProductForm: ProductForm = {
    name: '', agency_id: '', cost_price: '', sale_mode: 'manual',
    sale_price: '', markup_percent: '', current_stock: '', weight_kg: ''
};

export function calcSalePrice(form: ProductForm): number {
    const cost = parseFloat(form.cost_price) || 0;
    if (form.sale_mode === 'percent') {
        const pct = parseFloat(form.markup_percent) || 0;
        return parseFloat((cost * (1 + pct / 100)).toFixed(2));
    }
    return parseFloat(form.sale_price) || 0;
}

export function calcMargin(cost: number, sale: number): string {
    if (!cost || !sale || cost <= 0) return '—';
    return (((sale - cost) / cost) * 100).toFixed(1) + '%';
}

interface BulkDeliveryItem {
    product_id: string;
    quantity: number;
    base_price: number;
    weight_kg: number;
    fbr_percent: number;
    include_builty: boolean;
}

export default function Inventory() {
    const {
        products, agencies, addAgency, updateAgency, deleteAgency, setAgencyOpeningBalance,
        addProduct, updateProduct, deleteProduct, restockProduct, addAgencyPayment, addDailyExpense, bulkRestock
    } = useStore();

    // Modals
    const [agencyModal, setAgencyModal] = useState<{ open: boolean; mode: AgencyModalMode; editing?: Agency }>({ open: false, mode: 'add' });
    const [agencyForm, setAgencyForm] = useState<AgencyForm>(emptyAgencyForm);

    const [productModal, setProductModal] = useState<{ open: boolean; mode: ProductModalMode; editing?: Product }>({ open: false, mode: 'add' });
    const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);

    // Single Restock Modal State
    const [restockModal, setRestockModal] = useState<{ open: boolean; product?: Product; agency?: Agency }>({ open: false });
    const [restockQty, setRestockQty] = useState('');
    const [restockBasePrice, setRestockBasePrice] = useState('');
    const [restockNewSalePrice, setRestockNewSalePrice] = useState('');
    const [restockWeight, setRestockWeight] = useState('');
    const [restockUnloading, setRestockUnloading] = useState('');
    const [restockPayImmediately, setRestockPayImmediately] = useState(false);
    // Per-restock builty override
    const [restockIncludeBuilty, setRestockIncludeBuilty] = useState(false);
    const [restockBuiltyAmount, setRestockBuiltyAmount] = useState('');
    const [restockAgencyPaysBuilty, setRestockAgencyPaysBuilty] = useState(false); // true = agency/company absorbs builty cost
    // Per-restock tax overrides (default from agency; blank = use agency)
    const [restockCoFbr, setRestockCoFbr] = useState('');
    const [restockCustFbr, setRestockCustFbr] = useState('');
    const [restockSalesTax, setRestockSalesTax] = useState('');

    // Bulk Truck Delivery Modal State
    const [truckModalOpen, setTruckModalOpen] = useState(false);
    const [truckAgencyId, setTruckAgencyId] = useState('');
    const [truckTotalBuilty, setTruckTotalBuilty] = useState('');
    const [truckTotalWeight, setTruckTotalWeight] = useState('');
    const [truckTotalUnloading, setTruckTotalUnloading] = useState('');
    const [truckItems, setTruckItems] = useState<BulkDeliveryItem[]>([]);
    const [truckAgencyPaysBuilty, setTruckAgencyPaysBuilty] = useState(false);
    const [truckDistributeByCartons, setTruckDistributeByCartons] = useState(false);
    const [truckPaidAmount, setTruckPaidAmount] = useState('');
    // Per-truck-delivery tax overrides (blank = use agency defaults)
    const [truckCoFbr, setTruckCoFbr] = useState('');
    const [truckCustFbr, setTruckCustFbr] = useState('');
    const [truckSalesTax, setTruckSalesTax] = useState('');

    // Bank Payment Details (Shared between Restock & Bulk Truck modals)
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [branch, setBranch] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [paymentNote, setPaymentNote] = useState('');

    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'agency' | 'product'; id: string; name: string } | null>(null);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const toggleCollapse = (agencyId: string) => {
        setCollapsed(prev => ({ ...prev, [agencyId]: !prev[agencyId] }));
    };

    const restockDetails = calculateRestockCosts();
    const previewSalePrice = calcSalePrice(productForm);
    const previewMargin = calcMargin(parseFloat(productForm.cost_price) || 0, previewSalePrice);

    // ── Agency Handlers ──────────────────────────────────────
    function openAddAgency() {
        setAgencyForm(emptyAgencyForm);
        setAgencyModal({ open: true, mode: 'add' });
    }

    function openEditAgency(a: Agency) {
        setAgencyForm({
            name: a.name,
            opening_balance: String(a.opening_balance || ''),
            has_builty: a.has_builty,
            builty_rate_per_kg: String(a.builty_rate_per_kg || ''),
            company_fbr_percent: String(a.company_fbr_percent ?? '0.1'),
            enable_company_fbr: (a.company_fbr_percent ?? 0) > 0,
            fbr_percent: String(a.fbr_percent ?? '2.5'),
            enable_fbr: (a.fbr_percent ?? 0) > 0,
            sales_tax_percent: String(a.sales_tax_percent || ''),
            enable_sales_tax: (a.sales_tax_percent ?? 0) > 0,
        });
        setAgencyModal({ open: true, mode: 'edit', editing: a });
    }

    function submitAgency(e: React.FormEvent) {
        e.preventDefault();
        if (!agencyForm.name.trim()) return;

        const data = {
            name: agencyForm.name.trim(),
            opening_balance: parseFloat(agencyForm.opening_balance) || 0,
            has_builty: agencyForm.has_builty,
            builty_rate_per_kg: parseFloat(agencyForm.builty_rate_per_kg) || 0,
            company_fbr_percent: agencyForm.enable_company_fbr ? (parseFloat(agencyForm.company_fbr_percent) || 0) : 0,
            fbr_percent: agencyForm.enable_fbr ? (parseFloat(agencyForm.fbr_percent) || 0) : 0,
            sales_tax_percent: agencyForm.enable_sales_tax ? (parseFloat(agencyForm.sales_tax_percent) || 0) : 0,
        };

        if (agencyModal.mode === 'add') {
            addAgency(data);
        } else if (agencyModal.editing) {
            // Only update non-balance fields; opening balance delta is handled separately
            updateAgency(agencyModal.editing.id, {
                name: data.name,
                has_builty: data.has_builty,
                builty_rate_per_kg: data.builty_rate_per_kg,
                company_fbr_percent: data.company_fbr_percent,
                fbr_percent: data.fbr_percent,
                sales_tax_percent: data.sales_tax_percent,
            });
            if (agencyForm.opening_balance !== '') {
                const opBal = parseFloat(agencyForm.opening_balance) || 0;
                setAgencyOpeningBalance(agencyModal.editing.id, opBal);
            }
        }
        setAgencyModal({ open: false, mode: 'add' });
    }

    // ── Product Handlers ─────────────────────────────────────
    function openAddProduct(agencyId?: string) {
        setProductForm({ ...emptyProductForm, agency_id: agencyId ?? (agencies[0]?.id ?? '') });
        setProductModal({ open: true, mode: 'add' });
    }

    function openEditProduct(p: Product) {
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
        setProductModal({ open: true, mode: 'edit', editing: p });
    }

    function submitProduct(e: React.FormEvent) {
        e.preventDefault();
        const cost = parseFloat(productForm.cost_price);
        const sale = calcSalePrice(productForm);
        const stock = parseInt(productForm.current_stock);
        const weight = parseFloat(productForm.weight_kg) || 0;
        if (!productForm.name.trim() || !productForm.agency_id || isNaN(cost) || isNaN(sale) || sale <= 0 || isNaN(stock)) return;
        const data = { name: productForm.name.trim(), agency_id: productForm.agency_id, cost_price: cost, default_price: sale, current_stock: stock, weight_kg: weight };
        if (productModal.mode === 'add') addProduct(data);
        else if (productModal.editing) updateProduct(productModal.editing.id, data);
        setProductModal({ open: false, mode: 'add' });
    }

    // ── Single Restock Handling ──────────────────────────────
    function openRestock(p: Product) {
        const agency = agencies.find(a => a.id === p.agency_id);
        setRestockQty('');
        setRestockBasePrice(String(p.cost_price || ''));
        setRestockNewSalePrice(String(p.default_price || ''));
        setRestockWeight(String(p.weight_kg || ''));
        setRestockUnloading('');
        setRestockPayImmediately(false);
        setRestockIncludeBuilty(false);
        setRestockBuiltyAmount('');
        setRestockAgencyPaysBuilty(false);
        setRestockCoFbr('');
        setRestockCustFbr('');
        setRestockSalesTax('');
        setPaymentMethod('Cash');
        setBankName('');
        setAccountNumber('');
        setBranch('');
        setReferenceNumber('');
        setPaymentNote('');
        setRestockModal({ open: true, product: p, agency });
    }

    function calculateRestockCosts() {
        const { product, agency } = restockModal;
        if (!product || !agency) return null;

        const qty = parseInt(restockQty) || 0;
        const base = parseFloat(restockBasePrice) || 0;
        const weight = parseFloat(restockWeight) || 0;
        const unloading = parseFloat(restockUnloading) || 0;

        const baseTotal = qty * base;

        // Builty: use override amount directly if include_builty is checked
        const builtyTotal = restockIncludeBuilty ? (parseFloat(restockBuiltyAmount) || 0) : 0;

        // Subtotal for FBR Calculation
        const subtotal = baseTotal + builtyTotal + unloading;

        // Tax rates: use override if provided, else fall back to agency defaults
        const coFbrPct = restockCoFbr !== '' ? (parseFloat(restockCoFbr) || 0) : (agency.company_fbr_percent ?? 0);
        const custFbrPct = restockCustFbr !== '' ? (parseFloat(restockCustFbr) || 0) : (agency.fbr_percent ?? 0);
        const salesTaxPct = restockSalesTax !== '' ? (parseFloat(restockSalesTax) || 0) : (agency.sales_tax_percent ?? 0);

        // Company FBR (on base only — what agency charges on invoice)
        const coFbrTotal = baseTotal * (coFbrPct / 100);
        // Customer FBR (our cost absorbed for shopkeepers)
        const fbrTotal = subtotal * (custFbrPct / 100);
        // Sales Tax
        const salesTaxTotal = baseTotal * (salesTaxPct / 100);

        const totalCost = subtotal + coFbrTotal + fbrTotal + salesTaxTotal;
        const unitCost = qty > 0 ? parseFloat((totalCost / qty).toFixed(2)) : base;

        // New Weighted Average
        const oldTotalStockValue = product.current_stock * product.cost_price;
        const finalNewCostPrice = parseFloat(unitCost.toFixed(2));
        const combinedStock = product.current_stock + qty;
        const newWeightedCost = combinedStock > 0 ? parseFloat(((oldTotalStockValue + totalCost) / combinedStock).toFixed(2)) : finalNewCostPrice;

        return {
            baseTotal, builtyTotal, coFbrTotal, fbrTotal, salesTaxTotal,
            totalCost, unitCost, newWeightedCost, combinedStock,
            coFbrPct, custFbrPct, salesTaxPct
        };
    }

    function handleRestockSubmit(e: React.FormEvent) {
        e.preventDefault();
        const { product, agency } = restockModal;
        const costs = calculateRestockCosts();
        if (!product || !agency || !costs) return;

        const qtyVal = parseInt(restockQty);
        if (isNaN(qtyVal) || qtyVal <= 0) return;

        // If agency/company pays builty: they absorb it, so we deduct it from what we owe them.
        // Builty still contributes to stock unit cost (it's a real cost we absorbed).
        // Agency ledger amount = totalCost - builtyTotal (since they're not billing us for it)
        const agencyLedgerAmount = restockIncludeBuilty && restockAgencyPaysBuilty
            ? costs.totalCost - costs.builtyTotal
            : costs.totalCost;

        restockProduct(product.id, qtyVal, costs.unitCost, agencyLedgerAmount);

        // If agency pays builty: we physically paid the truck driver in cash — record as daily expense
        if (restockIncludeBuilty && restockAgencyPaysBuilty && costs.builtyTotal > 0) {
            addDailyExpense({
                date: new Date().toISOString(),
                description: `Builty paid to driver for ${product.name} restock (on behalf of ${agency.name})`,
                amount: costs.builtyTotal,
                category: 'Freight / Transport'
            });
        }

        // If user entered a new sale price, update it
        const newSalePrice = parseFloat(restockNewSalePrice);
        if (!isNaN(newSalePrice) && newSalePrice > 0 && newSalePrice !== product.default_price) {
            updateProduct(product.id, { default_price: newSalePrice });
        }

        if (restockPayImmediately) {
            addAgencyPayment({
                agency_id: agency.id,
                amount: agencyLedgerAmount,
                date: new Date().toISOString(),
                type: 'payment',
                payment_method: paymentMethod,
                bank_name: bankName || undefined,
                account_number: accountNumber || undefined,
                branch: branch || undefined,
                reference_number: referenceNumber || undefined,
                note: paymentNote || `Immediate payment for ${product.name} restock.`
            });
        }

        setRestockModal({ open: false });
    }

    // ── Bulk Truck Delivery Calculator ───────────────────────
    const activeTruckAgency = agencies.find(a => a.id === truckAgencyId);
    const agencyProducts = products.filter(p => p.agency_id === truckAgencyId);

    // Resolved tax rates for bulk truck (override or agency default)
    const resolvedTruckCoFbr = truckCoFbr !== '' ? (parseFloat(truckCoFbr) || 0) : (activeTruckAgency?.company_fbr_percent ?? 0);
    const resolvedTruckCustFbr = truckCustFbr !== '' ? (parseFloat(truckCustFbr) || 0) : (activeTruckAgency?.fbr_percent ?? 0);
    const resolvedTruckSalesTax = truckSalesTax !== '' ? (parseFloat(truckSalesTax) || 0) : (activeTruckAgency?.sales_tax_percent ?? 0);

    function addTruckItemRow() {
        const firstProd = agencyProducts[0];
        if (!firstProd) return;
        setTruckItems([...truckItems, {
            product_id: firstProd.id,
            quantity: 1,
            base_price: firstProd.cost_price,
            weight_kg: firstProd.weight_kg || 20,
            fbr_percent: activeTruckAgency?.fbr_percent ?? 2.5,
            include_builty: true,
        }]);
    }

    function removeTruckItemRow(idx: number) {
        setTruckItems(truckItems.filter((_, i) => i !== idx));
    }

    function updateTruckItem(idx: number, field: keyof BulkDeliveryItem, val: any) {
        setTruckItems(truckItems.map((item, i) => {
            if (i !== idx) return item;
            if (field === 'product_id') {
                const prod = agencyProducts.find(p => p.id === val);
                return {
                    ...item,
                    product_id: val,
                    base_price: prod ? prod.cost_price : 0,
                    weight_kg: prod ? prod.weight_kg : 20,
                    fbr_percent: activeTruckAgency?.fbr_percent ?? 2.5,
                    include_builty: item.include_builty,
                };
            }
            return { ...item, [field]: val };
        }));
    }

    // Live Bulk Cost Calculations
    const bulkDeliveryCalculations = (() => {
        if (!activeTruckAgency) return null;
        const totalBuiltyPaid = parseFloat(truckTotalBuilty) || 0;
        const totalWeightEntered = parseFloat(truckTotalWeight) || 0;
        const totalUnloadingPaid = parseFloat(truckTotalUnloading) || 0;

        const totalSumWeight = truckItems.reduce((acc, item) => acc + (item.weight_kg * item.quantity), 0);
        const effectiveWeight = totalWeightEntered > 0 ? totalWeightEntered : (totalSumWeight || 1);

        // Combined rate: (builty + unloading) ÷ total weight — distributed by weight per carton
        const combinedRate = (totalBuiltyPaid + totalUnloadingPaid) / effectiveWeight;

        // Alternative Carton Rate: (builty + unloading) ÷ total cartons
        const totalCartons = truckItems.reduce((acc, item) => acc + item.quantity, 0);
        const cartonRate = (totalBuiltyPaid + totalUnloadingPaid) / (totalCartons || 1);

        const companyFbrPct = resolvedTruckCoFbr;
        const customerFbrPct = resolvedTruckCustFbr;

        let baseBillTotal = 0;        // pure base price sum (matches company invoice)
        let agencyLedgerTotal = 0;    // base + company FBR (what we owe them)
        let overallOurCost = 0;       // base + builty/unloading + company FBR + customer FBR

        const calculatedItems = truckItems.map(item => {
            const prod = products.find(p => p.id === item.product_id);

            // Base total for this item
            const itemBaseTotal = item.base_price * item.quantity;

            // Builty + Unloading share per carton (distributed by weight OR by carton count)
            // Only apply logistics if this item has include_builty enabled
            const rawLogisticsPerCarton = truckDistributeByCartons ? cartonRate : (item.weight_kg * combinedRate);
            const logisticsPerCarton = item.include_builty ? rawLogisticsPerCarton : 0;
            const logisticsTotal = logisticsPerCarton * item.quantity;

            // Company FBR (on base price only — what company charges on invoice)
            const companyFbrPerCarton = item.base_price * (companyFbrPct / 100);
            const companyFbrTotal = companyFbrPerCarton * item.quantity;

            // Customer FBR (what we absorb for shopkeepers — our internal cost only)
            const customerFbrPerCarton = item.base_price * (customerFbrPct / 100);
            const customerFbrTotal = customerFbrPerCarton * item.quantity;

            // Agency ledger = base + company FBR (no logistics, no customer FBR)
            const agencyItemBillTotal = itemBaseTotal + companyFbrTotal;

            // Our true cost per carton = base + logistics + company FBR + customer FBR
            const itemUnitCost = parseFloat((item.base_price + logisticsPerCarton + companyFbrPerCarton + customerFbrPerCarton).toFixed(2));
            const itemTotalCost = itemUnitCost * item.quantity;

            baseBillTotal += itemBaseTotal;
            agencyLedgerTotal += agencyItemBillTotal;
            overallOurCost += itemTotalCost;

            let newWeightedCost = itemUnitCost;
            if (prod) {
                const oldVal = prod.current_stock * prod.cost_price;
                const totalCombinedStock = prod.current_stock + item.quantity;
                newWeightedCost = totalCombinedStock > 0
                    ? parseFloat(((oldVal + itemTotalCost) / totalCombinedStock).toFixed(2))
                    : itemUnitCost;
            }

            return {
                ...item,
                name: prod?.name || 'Unknown',
                logisticsTotal,
                companyFbrTotal,
                customerFbrTotal,
                itemTotalCost,
                itemUnitCost,
                newWeightedCost,
                agencyItemBillTotal,
                current_stock: prod?.current_stock || 0
            };
        });

        return { combinedRate, cartonRate, baseBillTotal, agencyLedgerTotal, overallOurCost, calculatedItems };
    })();


    function handleBulkRestockSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!truckAgencyId || !bulkDeliveryCalculations) return;

        const restockPayload = bulkDeliveryCalculations.calculatedItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            new_cost_price: item.itemUnitCost,
            base_purchase_price: item.base_price
        }));

        const paidVal = parseFloat(truckPaidAmount) || 0;
        // Agency ledger = base + company FBR only (no logistics, no customer FBR)
        const netAgencyBill = bulkDeliveryCalculations.agencyLedgerTotal;

        bulkRestock(
            truckAgencyId,
            restockPayload,
            netAgencyBill,
            paidVal,
            paidVal > 0 ? {
                payment_method: paymentMethod,
                bank_name: bankName || undefined,
                account_number: accountNumber || undefined,
                branch: branch || undefined,
                reference_number: referenceNumber || undefined,
                note: paymentNote || `Paid installment Rs ${paidVal.toLocaleString()} for truck delivery.`
            } : undefined,
            parseFloat(truckTotalUnloading) || 0,
            parseFloat(truckTotalBuilty) || 0,
            truckAgencyPaysBuilty
        );

        setTruckModalOpen(false);
        setTruckItems([]);
        setTruckTotalBuilty('');
        setTruckTotalWeight('');
        setTruckTotalUnloading('');
        setTruckDistributeByCartons(false);
    }

    function openTruckWizard() {
        setTruckAgencyId(agencies[0]?.id || '');
        setTruckTotalBuilty('');
        setTruckTotalWeight('');
        setTruckTotalUnloading('');
        setTruckItems([]);
        setTruckAgencyPaysBuilty(false);
        setTruckDistributeByCartons(false);
        setTruckPaidAmount('');
        setTruckCoFbr('');
        setTruckCustFbr('');
        setTruckSalesTax('');
        setPaymentMethod('Cash');
        setBankName('');
        setAccountNumber('');
        setBranch('');
        setReferenceNumber('');
        setPaymentNote('');
        setTruckModalOpen(true);
    }

    function handleConfirmDelete() {
        if (!deleteConfirm) return;
        if (deleteConfirm.type === 'agency') {
            deleteAgency(deleteConfirm.id);
        } else {
            deleteProduct(deleteConfirm.id);
        }
        setDeleteConfirm(null);
    }

    return (
        <div className="space-y-6 text-foreground">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card p-6 rounded-xl shadow-sm border border-border gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Inventory & Agencies</h2>
                    <p className="text-muted-foreground text-sm">Manage agencies, standard carton weights, cost calculations, and supplier ledgers</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={openTruckWizard} disabled={agencies.length === 0} className="text-white px-4 py-2 rounded-lg font-bold transition flex gap-2 items-center text-sm disabled:opacity-40 disabled:cursor-not-allowed" style={{background:'#7F56D9',boxShadow:'0 1px 3px rgba(127,86,217,0.3)'}}>
                        <Truck className="w-4 h-4" /> Receive Truck Delivery (Bulk)
                    </button>
                    <button onClick={openAddAgency} className="text-white px-4 py-2 rounded-lg font-semibold transition flex gap-2 items-center text-sm" style={{background:'#7F56D9',boxShadow:'0 1px 3px rgba(127,86,217,0.3)'}}>
                        <Building2 className="w-4 h-4" /> Add Agency
                    </button>
                    <button onClick={() => openAddProduct()} disabled={agencies.length === 0} className="text-white px-4 py-2 rounded-lg font-semibold transition flex gap-2 items-center text-sm disabled:opacity-40 disabled:cursor-not-allowed" style={{background:'#7F56D9',boxShadow:'0 1px 3px rgba(127,86,217,0.3)'}}>
                        <Plus className="w-4 h-4" /> Add Product
                    </button>
                </div>
            </div>

            {agencies.length === 0 && (
                <div className="bg-card rounded-xl border border-dashed border-border p-12 text-center">
                    <Building2 className="w-12 h-12 text-muted-foreground/45 mx-auto mb-3" />
                    <h3 className="text-muted-foreground font-semibold text-lg">No agencies yet</h3>
                    <p className="text-muted-foreground text-sm mt-1">Click <strong>Add Agency</strong> to get started</p>
                </div>
            )}

            {/* Agency cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {agencies.map(agency => {
                    const agencyProducts = products.filter(p => p.agency_id === agency.id);
                    const isCollapsed = collapsed[agency.id];
                    return (
                        <div key={agency.id} className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                            <div className="bg-muted/50 border-b border-border p-4 flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Package className="w-5 h-5 text-indigo-550 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-bold text-foreground text-base truncate leading-none">{agency.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs font-mono text-muted-foreground">Owed: Rs {agency.current_balance.toLocaleString()}</span>
                                            {agency.opening_balance ? (
                                                <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold">Paper Khata: Rs {agency.opening_balance.toLocaleString()}</span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <span className="text-xs text-foreground bg-muted border border-border px-2 py-0.5 rounded-full font-medium ml-2">{agencyProducts.length} items</span>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <Link to={`/agencies/${agency.id}`} title="View Agency Ledger" className="p-1.5 text-emerald-600 dark:text-emerald-450 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition"><BookOpen className="w-4 h-4" /></Link>
                                    <button onClick={() => openAddProduct(agency.id)} title="Add Product to Agency" className="p-1.5 text-indigo-650 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition"><Plus className="w-4 h-4" /></button>
                                    <button onClick={() => openEditAgency(agency)} title="Edit Agency Settings" className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition"><Pencil className="w-4 h-4" /></button>
                                    <button onClick={() => setDeleteConfirm({ type: 'agency', id: agency.id, name: agency.name })} title="Delete Agency" className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                                    <button onClick={() => toggleCollapse(agency.id)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition">
                                        {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {!isCollapsed && (
                                <ul className="divide-y divide-border">
                                    {agencyProducts.length === 0 ? (
                                        <li className="p-6 text-center text-sm text-muted-foreground italic">
                                            No products yet — <button onClick={() => openAddProduct(agency.id)} className="text-indigo-600 dark:text-indigo-455 underline">add one</button>
                                        </li>
                                    ) : (
                                        agencyProducts.map(p => {
                                            const margin = p.cost_price > 0 ? (((p.default_price - p.cost_price) / p.cost_price) * 100).toFixed(1) : null;
                                            return (
                                                <li key={p.id} className="p-4 hover:bg-muted/30 transition group">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-semibold text-foreground truncate">{p.name}</p>
                                                            {/* Dual pricing row */}
                                                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                    <DollarSign className="w-3 h-3 text-muted-foreground" />
                                                                    Cost: <span className="font-mono font-medium text-foreground">Rs {p.cost_price ?? '—'}</span>
                                                                </span>
                                                                {p.weight_kg > 0 && (
                                                                    <>
                                                                        <span className="text-border">|</span>
                                                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                            <Scale className="w-3 h-3 text-muted-foreground" />
                                                                            Carton: <span className="font-medium text-foreground">{p.weight_kg} kg</span>
                                                                        </span>
                                                                    </>
                                                                )}
                                                                <span className="text-border">|</span>
                                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                                                                    Sale: <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">Rs {p.default_price}</span>
                                                                </span>
                                                                {margin && (
                                                                    <>
                                                                        <span className="text-border">|</span>
                                                                        <span className="text-xs bg-[#D1FADF] text-[#027A48] border border-[#A9F5C6] px-2 py-0.5 rounded-full font-semibold">
                                                                            +{margin}% margin
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            <div className="text-right">
                                                                <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Stock</span>
                                                                <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold border font-mono ${p.current_stock < 50 ? 'bg-[#FEE4E2] border-[#FECDCA] text-[#D92D20]' : 'bg-[#F5F5F5] border-[#E8E8E8] text-[#535862]'}`}>
                                                                    {p.current_stock}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <button onClick={() => openRestock(p)} title="Merge New Stock / Restock" className="p-1.5 text-emerald-600 dark:text-emerald-450 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg"><Plus className="w-3.5 h-3.5" /></button>
                                                                <button onClick={() => openEditProduct(p)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                                                                <button onClick={() => setDeleteConfirm({ type: 'product', id: p.id, name: p.name })} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })
                                    )}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Agency Modal ─────────────────────────────── */}
            {agencyModal.open && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col border border-border">
                        <div className="flex justify-between items-center p-6 border-b border-border">
                            <h3 className="text-lg font-bold text-foreground">{agencyModal.mode === 'add' ? 'Add Agency' : 'Edit Agency'}</h3>
                            <button onClick={() => setAgencyModal({ open: false, mode: 'add' })} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={submitAgency} className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Agency Name</label>
                                <input autoFocus value={agencyForm.name} onChange={e => setAgencyForm({ ...agencyForm, name: e.target.value })} placeholder="e.g. ACPL Soap Co"
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                            </div>

                            {/* Opening Balance (Paper Khata Balance equivalent for Agencies) */}
                            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-amber-600" />
                                    <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Supplier Opening Balance</span>
                                </div>
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                    {agencyModal.mode === 'add'
                                        ? "If you already owe this agency, enter the starting balance. This becomes the opening balance in their ledger."
                                        : "Setting the opening balance will adjust their current ledger balance. Any previous opening balance will be replaced."
                                    }
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Rs</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={agencyForm.opening_balance}
                                        onChange={e => setAgencyForm({ ...agencyForm, opening_balance: e.target.value })}
                                        placeholder="0"
                                        className="flex-1 border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-background text-foreground"
                                    />
                                </div>
                            </div>

                            {/* Transport / Builty Toggle */}
                            <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-3">
                                <label className="flex items-center gap-2 font-medium text-sm text-foreground cursor-pointer">
                                    <input type="checkbox" checked={agencyForm.has_builty} onChange={e => setAgencyForm({ ...agencyForm, has_builty: e.target.checked })}
                                        className="rounded border-border bg-background text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                                    <span>Has Transport / Builty charges?</span>
                                </label>
                            </div>

                            {/* Taxes */}
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tax Settings</p>

                                {/* Company FBR */}
                                <div className={`rounded-xl border p-3 transition-colors ${agencyForm.enable_company_fbr ? 'border-amber-200 bg-amber-50/40 dark:bg-amber-950/10' : 'border-border bg-muted/20'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Percent className="w-3.5 h-3.5 text-amber-500" />
                                            <div>
                                                <span className="text-xs font-semibold text-foreground">Company FBR %</span>
                                                <span className="text-[10px] text-muted-foreground ml-1">(on invoice — added to agency ledger)</span>
                                            </div>
                                        </div>
                                        {/* Toggle switch */}
                                        <button
                                            type="button"
                                            onClick={() => setAgencyForm(f => ({ ...f, enable_company_fbr: !f.enable_company_fbr }))}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                                agencyForm.enable_company_fbr ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                                            }`}
                                        >
                                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                                agencyForm.enable_company_fbr ? 'translate-x-4' : 'translate-x-0.5'
                                            }`} />
                                        </button>
                                    </div>
                                    {agencyForm.enable_company_fbr && (
                                        <div className="mt-2.5">
                                            <input type="number" step="any" min="0"
                                                value={agencyForm.company_fbr_percent}
                                                onChange={e => setAgencyForm({ ...agencyForm, company_fbr_percent: e.target.value })}
                                                placeholder="e.g. 0.1"
                                                className="w-full bg-background border border-amber-200 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono" />
                                        </div>
                                    )}
                                    {!agencyForm.enable_company_fbr && (
                                        <p className="text-[10px] text-muted-foreground mt-1">Disabled — Company FBR will be 0%</p>
                                    )}
                                </div>

                                {/* Customer FBR */}
                                <div className={`rounded-xl border p-3 transition-colors ${agencyForm.enable_fbr ? 'border-indigo-200 bg-indigo-50/40 dark:bg-indigo-950/10' : 'border-border bg-muted/20'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Percent className="w-3.5 h-3.5 text-indigo-500" />
                                            <div>
                                                <span className="text-xs font-semibold text-foreground">Customer FBR %</span>
                                                <span className="text-[10px] text-muted-foreground ml-1">(we charge — our cost only)</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAgencyForm(f => ({ ...f, enable_fbr: !f.enable_fbr }))}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                                agencyForm.enable_fbr ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'
                                            }`}
                                        >
                                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                                agencyForm.enable_fbr ? 'translate-x-4' : 'translate-x-0.5'
                                            }`} />
                                        </button>
                                    </div>
                                    {agencyForm.enable_fbr && (
                                        <div className="mt-2.5">
                                            <input type="number" step="any" min="0"
                                                value={agencyForm.fbr_percent}
                                                onChange={e => setAgencyForm({ ...agencyForm, fbr_percent: e.target.value })}
                                                placeholder="e.g. 2.5"
                                                className="w-full bg-background border border-indigo-200 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono" />
                                        </div>
                                    )}
                                    {!agencyForm.enable_fbr && (
                                        <p className="text-[10px] text-muted-foreground mt-1">Disabled — Customer FBR will be 0%</p>
                                    )}
                                </div>

                                {/* Sales Tax */}
                                <div className={`rounded-xl border p-3 transition-colors ${agencyForm.enable_sales_tax ? 'border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/10' : 'border-border bg-muted/20'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Percent className="w-3.5 h-3.5 text-emerald-500" />
                                            <div>
                                                <span className="text-xs font-semibold text-foreground">Sales Tax %</span>
                                                <span className="text-[10px] text-muted-foreground ml-1">(on base price)</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAgencyForm(f => ({ ...f, enable_sales_tax: !f.enable_sales_tax }))}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                                agencyForm.enable_sales_tax ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                                            }`}
                                        >
                                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                                agencyForm.enable_sales_tax ? 'translate-x-4' : 'translate-x-0.5'
                                            }`} />
                                        </button>
                                    </div>
                                    {agencyForm.enable_sales_tax && (
                                        <div className="mt-2.5">
                                            <input type="number" step="any" min="0"
                                                value={agencyForm.sales_tax_percent}
                                                onChange={e => setAgencyForm({ ...agencyForm, sales_tax_percent: e.target.value })}
                                                placeholder="e.g. 17"
                                                className="w-full bg-background border border-emerald-200 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                                        </div>
                                    )}
                                    {!agencyForm.enable_sales_tax && (
                                        <p className="text-[10px] text-muted-foreground mt-1">Disabled — Sales Tax will be 0%</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-2">
                                <button type="button" onClick={() => setAgencyModal({ open: false, mode: 'add' })} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/50">Cancel</button>
                                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                                    {agencyModal.mode === 'add' ? 'Add Agency' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Product Modal ─────────────────────────────── */}
            {productModal.open && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border">
                        <div className="flex justify-between items-center p-6 border-b border-border">
                            <h3 className="text-lg font-bold text-foreground">{productModal.mode === 'add' ? 'Add Product' : 'Edit Product'}</h3>
                            <button onClick={() => setProductModal({ open: false, mode: 'add' })} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={submitProduct} className="p-6 space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Product Name</label>
                                <input autoFocus value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Soap 20kg Carton"
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* Agency */}
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Agency</label>
                                    <select value={productForm.agency_id} onChange={e => setProductForm(f => ({ ...f, agency_id: e.target.value }))}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                        <option value="">Select agency…</option>
                                        {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                {/* Weight */}
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1"><Scale className="w-4 h-4 text-muted-foreground" /> Weight per Carton (kg)</label>
                                    <input type="number" step="any" min="0" value={productForm.weight_kg} onChange={e => setProductForm(f => ({ ...f, weight_kg: e.target.value }))}
                                        placeholder="e.g. 20"
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono" />
                                </div>
                            </div>

                            {/* Purchase Price */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                    <DollarSign className="w-3.5 h-3.5 text-muted-foreground" /> Purchase Price (Cost)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rs</span>
                                    <input type="number" min="0" value={productForm.cost_price}
                                        onChange={e => setProductForm(f => ({ ...f, cost_price: e.target.value }))}
                                        placeholder="0"
                                        className="w-full bg-background border border-border rounded-lg pl-10 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono" />
                                </div>
                            </div>

                            {/* Sale Price with Toggle */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Sale Price
                                    </label>
                                    {/* Toggle */}
                                    <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                                        <button type="button" onClick={() => setProductForm(f => ({ ...f, sale_mode: 'manual' }))}
                                            className={`px-3 py-1 text-xs font-medium rounded-md transition ${productForm.sale_mode === 'manual' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>
                                            Manual
                                        </button>
                                        <button type="button" onClick={() => setProductForm(f => ({ ...f, sale_mode: 'percent' }))}
                                            className={`px-3 py-1 text-xs font-medium rounded-md transition flex items-center gap-1 ${productForm.sale_mode === 'percent' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>
                                            <Percent className="w-3 h-3" /> Markup %
                                        </button>
                                    </div>
                                </div>

                                {productForm.sale_mode === 'manual' ? (
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rs</span>
                                        <input type="number" min="0" value={productForm.sale_price}
                                            onChange={e => setProductForm(f => ({ ...f, sale_price: e.target.value }))}
                                            placeholder="0"
                                            className="w-full bg-background border border-border rounded-lg pl-10 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                                    </div>
                                ) : (
                                    <div className="flex gap-2 items-center">
                                        <div className="relative flex-1">
                                            <input type="number" min="0" max="1000" value={productForm.markup_percent}
                                                onChange={e => setProductForm(f => ({ ...f, markup_percent: e.target.value }))}
                                                placeholder="e.g. 20"
                                                className="w-full bg-background border border-border rounded-lg pl-3 pr-10 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                                        </div>
                                        <div className="text-sm text-emerald-800 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg px-3 py-2 font-mono font-semibold min-w-[100px] text-center">
                                            = Rs {previewSalePrice > 0 ? previewSalePrice : '—'}
                                        </div>
                                    </div>
                                )}

                                {/* Margin preview */}
                                {parseFloat(productForm.cost_price) > 0 && previewSalePrice > 0 && (
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" />
                                        Margin: <strong>{previewMargin}</strong> · Profit per unit: <strong>Rs {(previewSalePrice - parseFloat(productForm.cost_price)).toFixed(2)}</strong>
                                    </p>
                                )}
                            </div>

                            {/* Current Stock */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Current Stock (units)</label>
                                <input type="number" min="0" value={productForm.current_stock}
                                    onChange={e => setProductForm(f => ({ ...f, current_stock: e.target.value }))}
                                    placeholder="0"
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono" />
                            </div>

                            <div className="flex gap-3 justify-end pt-2">
                                <button type="button" onClick={() => setProductModal({ open: false, mode: 'add' })} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/50">Cancel</button>
                                <button type="submit" className="px-4 py-2 text-sm bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-900 dark:hover:bg-slate-600 font-medium">
                                    {productModal.mode === 'add' ? 'Add Product' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Single Restock Modal ──────────────────────── */}
            {restockModal.open && restockModal.product && restockModal.agency && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-border">
                        <div className="flex justify-between items-center p-6 border-b border-border bg-muted/40 rounded-t-2xl">
                            <div>
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><Calculator className="w-5 h-5 text-emerald-555" /> Restock: {restockModal.product.name}</h3>
                                <p className="text-xs text-muted-foreground mt-1">Weighted stock merger for agency: <strong>{restockModal.agency.name}</strong></p>
                            </div>
                            <button onClick={() => setRestockModal({ open: false })} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleRestockSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                            {/* Basic Form Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-muted-foreground mb-1">New Stock Quantity (units)</label>
                                    <input type="number" required min="1" value={restockQty} onChange={e => setRestockQty(e.target.value)} placeholder="e.g. 100"
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-muted-foreground mb-1">Base Purchase Price (per unit)</label>
                                    <input type="number" step="any" required min="0" value={restockBasePrice} onChange={e => setRestockBasePrice(e.target.value)} placeholder="Rs"
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                                </div>
                            </div>

                            {/* New Sale Price field */}
                            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                        <TrendingUp className="w-4 h-4" />
                                        New Sale Price (per unit)
                                    </label>
                                    <span className="text-[10px] text-indigo-500 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full font-semibold">
                                        Current: Rs {restockModal.product?.default_price?.toLocaleString()}
                                    </span>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rs</span>
                                    <input
                                        type="number" step="any" min="0"
                                        value={restockNewSalePrice}
                                        onChange={e => setRestockNewSalePrice(e.target.value)}
                                        placeholder={String(restockModal.product?.default_price || '')}
                                        className="w-full bg-background border border-indigo-200 dark:border-indigo-800 rounded-lg pl-10 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                                    />
                                </div>
                                {restockNewSalePrice && parseFloat(restockNewSalePrice) > 0 && restockDetails && (
                                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1.5 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        Sale price will be updated to <strong>Rs {parseFloat(restockNewSalePrice).toLocaleString()}</strong>
                                        {restockDetails.newWeightedCost > 0 && (
                                            <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                                                · Margin: {(((parseFloat(restockNewSalePrice) - restockDetails.newWeightedCost) / restockDetails.newWeightedCost) * 100).toFixed(1)}%
                                            </span>
                                        )}
                                    </p>
                                )}
                                {!restockNewSalePrice && (
                                    <p className="text-[10px] text-muted-foreground mt-1">Leave blank to keep current sale price unchanged.</p>
                                )}
                            </div>

                            {/* Transport & Builty & Tax Override Section */}
                            <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-4">
                                <h4 className="text-xs font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1"><Truck className="w-4 h-4 text-muted-foreground/60" /> Transport &amp; Unloading</h4>

                                {/* Builty toggle + amount */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={restockIncludeBuilty} onChange={e => { setRestockIncludeBuilty(e.target.checked); if (!e.target.checked) setRestockAgencyPaysBuilty(false); }}
                                            className="w-4 h-4 rounded text-indigo-600 border-border bg-background focus:ring-indigo-500" />
                                        <span className="text-xs font-bold text-foreground">Include Builty / Transport Cost</span>
                                    </label>

                                    {restockIncludeBuilty && (
                                        <div className="pl-6 space-y-3">
                                            {/* Builty amount input */}
                                            <div>
                                                <label className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Scale className="w-3 h-3 text-indigo-500" /> Total Builty Cost (Rs)</label>
                                                <input type="number" min="0" value={restockBuiltyAmount} onChange={e => setRestockBuiltyAmount(e.target.value)} placeholder="e.g. 7500"
                                                    className="w-full bg-background border border-indigo-400 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono" />
                                            </div>

                                            {/* Who pays builty? */}
                                            <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3 space-y-2">
                                                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Who pays the Builty?</p>
                                                <div className="flex flex-col gap-2">
                                                    <label className="flex items-start gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="restockBuiltyPayer"
                                                            checked={!restockAgencyPaysBuilty}
                                                            onChange={() => setRestockAgencyPaysBuilty(false)}
                                                            className="mt-0.5 w-3.5 h-3.5 text-indigo-600 border-border bg-background focus:ring-indigo-500"
                                                        />
                                                        <div>
                                                            <span className="text-xs font-semibold text-foreground">Agency / Company bills us for builty</span>
                                                            <p className="text-[10px] text-muted-foreground">Builty is on their invoice → added to agency ledger &amp; stock cost</p>
                                                        </div>
                                                    </label>
                                                    <label className="flex items-start gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="restockBuiltyPayer"
                                                            checked={restockAgencyPaysBuilty}
                                                            onChange={() => setRestockAgencyPaysBuilty(true)}
                                                            className="mt-0.5 w-3.5 h-3.5 text-amber-600 border-border bg-background focus:ring-amber-500"
                                                        />
                                                        <div>
                                                            <span className="text-xs font-semibold text-foreground">We paid driver in cash (Agency absorbs it)</span>
                                                            <p className="text-[10px] text-muted-foreground">Deducted from agency ledger + auto-recorded as Daily Expense (Freight)</p>
                                                        </div>
                                                    </label>
                                                </div>
                                                {restockAgencyPaysBuilty && restockDetails && restockDetails.builtyTotal > 0 && (
                                                    <div className="mt-2 bg-amber-100/60 dark:bg-amber-900/20 rounded-lg px-3 py-2 text-[10px] text-amber-800 dark:text-amber-300 space-y-0.5">
                                                        <p>✓ Agency ledger will be reduced by <strong>Rs {restockDetails.builtyTotal.toLocaleString()}</strong></p>
                                                        <p>✓ <strong>Rs {restockDetails.builtyTotal.toLocaleString()}</strong> will be recorded as <em>Daily Expense → Freight / Transport</em></p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {!restockIncludeBuilty && (
                                        <p className="text-xs text-muted-foreground italic flex items-center gap-1 pl-6"><ShieldAlert className="w-3 h-3" /> No builty added to this restock.</p>
                                    )}
                                </div>

                                {/* Unloading */}
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Unloading / Labour Cost (Rs)</label>
                                    <input type="number" min="0" value={restockUnloading} onChange={e => setRestockUnloading(e.target.value)} placeholder="Rs"
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                                </div>

                                {/* Tax Overrides */}
                                <div className="border-t border-border pt-3">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Tax Rates (leave blank to use agency defaults)</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-amber-600 dark:text-amber-400 mb-1">Co. FBR% <span className="text-muted-foreground normal-case font-normal">(default: {restockModal.agency?.company_fbr_percent ?? 0}%)</span></label>
                                            <input type="number" step="0.01" min="0" value={restockCoFbr} onChange={e => setRestockCoFbr(e.target.value)}
                                                placeholder={String(restockModal.agency?.company_fbr_percent ?? 0)}
                                                className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-blue-500 mb-1">Cust. FBR% <span className="text-muted-foreground normal-case font-normal">(default: {restockModal.agency?.fbr_percent ?? 0}%)</span></label>
                                            <input type="number" step="0.01" min="0" value={restockCustFbr} onChange={e => setRestockCustFbr(e.target.value)}
                                                placeholder={String(restockModal.agency?.fbr_percent ?? 0)}
                                                className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Sales Tax% <span className="text-muted-foreground normal-case font-normal">(default: {restockModal.agency?.sales_tax_percent ?? 0}%)</span></label>
                                            <input type="number" step="0.01" min="0" value={restockSalesTax} onChange={e => setRestockSalesTax(e.target.value)}
                                                placeholder={String(restockModal.agency?.sales_tax_percent ?? 0)}
                                                className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cost Summary Breakdown Box */}
                            {restockDetails && (
                                <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-xs space-y-2 text-foreground">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Base Cost ({restockQty || 0} units):</span>
                                        <span className="font-mono">Rs {restockDetails.baseTotal.toLocaleString()}</span>
                                    </div>
                                    {restockIncludeBuilty && restockDetails.builtyTotal > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Builty / Transport:</span>
                                            <span className="font-mono text-indigo-600">Rs {restockDetails.builtyTotal.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {parseFloat(restockUnloading) > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Unloading Cost:</span>
                                            <span className="font-mono">Rs {parseFloat(restockUnloading).toLocaleString()}</span>
                                        </div>
                                    )}
                                    {restockDetails.coFbrPct > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Co. FBR ({restockDetails.coFbrPct}%):</span>
                                            <span className="font-mono text-amber-600">Rs {restockDetails.coFbrTotal.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {restockDetails.custFbrPct > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Cust. FBR ({restockDetails.custFbrPct}%):</span>
                                            <span className="font-mono text-blue-500">Rs {restockDetails.fbrTotal.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {restockDetails.salesTaxPct > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Sales Tax ({restockDetails.salesTaxPct}%):</span>
                                            <span className="font-mono text-emerald-600">Rs {restockDetails.salesTaxTotal.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="border-t border-emerald-100 dark:border-emerald-900/40 my-2 pt-2 flex justify-between font-bold text-sm text-emerald-800 dark:text-emerald-400">
                                        <span>Total Cost of Batch:</span>
                                        <span className="font-mono">Rs {restockDetails.totalCost.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-foreground">
                                        <span>New Batch Cost (per unit):</span>
                                        <span className="font-mono font-semibold">Rs {restockDetails.unitCost.toLocaleString()}</span>
                                    </div>
                                    <div className="bg-card p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/35 flex justify-between items-center mt-2">
                                        <div>
                                            <span className="text-muted-foreground block text-[10px]">Weighted Average unit cost (Old Stock + New Stock)</span>
                                            <span className="font-semibold text-foreground text-sm font-mono">Rs {restockDetails.newWeightedCost.toLocaleString()}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-muted-foreground block text-[10px]">Total Stock after merge</span>
                                            <span className="font-semibold text-foreground text-sm font-mono">{restockDetails.combinedStock} units</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Payment Method Option */}
                            <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-3">
                                <label className="flex items-center gap-2 font-medium text-sm text-foreground cursor-pointer">
                                    <input type="checkbox" checked={restockPayImmediately} onChange={e => setRestockPayImmediately(e.target.checked)}
                                        className="rounded border-border bg-background text-emerald-600 focus:ring-emerald-500 w-4 h-4" />
                                    <span>Pay Immediately? (If unchecked, this records as Credit under Owed Balance)</span>
                                </label>

                                {restockPayImmediately && (
                                    <div className="pt-3 animate-fadeIn border-t border-border space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Payment Method</label>
                                                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                                                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400">
                                                    <option value="Cash">Cash</option>
                                                    <option value="Bank Transfer">Bank Transfer</option>
                                                    <option value="Fund Transfer">Fund Transfer</option>
                                                    <option value="Bank Draft">Bank Draft</option>
                                                    <option value="Cheque">Cheque</option>
                                                </select>
                                            </div>
                                            {['Bank Transfer', 'Fund Transfer', 'Bank Draft', 'Cheque'].includes(paymentMethod) && (
                                                <div>
                                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Bank Name</label>
                                                    <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. HBL"
                                                        className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                                </div>
                                            )}
                                        </div>

                                        {['Bank Transfer', 'Fund Transfer', 'Bank Draft', 'Cheque'].includes(paymentMethod) && (
                                            <div className="grid grid-cols-3 gap-3 animate-fadeIn">
                                                <div>
                                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Account Number</label>
                                                    <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Account #"
                                                        className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Branch</label>
                                                    <input value={branch} onChange={e => setBranch(e.target.value)} placeholder="Branch name"
                                                        className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Ref / Receipt #</label>
                                                    <input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="Ref #"
                                                        className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Payment Note</label>
                                            <input value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="Optional note details…"
                                                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-border">
                                <button type="button" onClick={() => setRestockModal({ open: false })} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/50">Cancel</button>
                                <button type="submit" className="px-6 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm transition flex gap-2 items-center">
                                    <CheckCircle className="w-4 h-4" /> Merge & Update Stock
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── 🚚 Advanced Bulk Truck Delivery Wizard Modal ── */}
            {truckModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-border">
                        <div className="flex justify-between items-center p-6 border-b border-border bg-slate-900 dark:bg-slate-950 text-white rounded-t-2xl">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2"><Truck className="w-6 h-6 text-emerald-400" /> Receive Truck Delivery (Multi-Product Wizard)</h3>
                                <p className="text-xs text-slate-400 mt-1">Distribute dynamic Builty / Unloading / Tax costs proportionally across all incoming items</p>
                            </div>
                            <button onClick={() => setTruckModalOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleBulkRestockSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* Step 1: select agency & global truck costs */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-xl border border-border">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground mb-1">Select Agency</label>
                                    <select value={truckAgencyId} onChange={e => { setTruckAgencyId(e.target.value); setTruckItems([]); setTruckCoFbr(''); setTruckCustFbr(''); setTruckSalesTax(''); }}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium">
                                        {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                    <div className="mt-2.5">
                                        <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                                            <input type="checkbox" checked={truckDistributeByCartons} onChange={e => setTruckDistributeByCartons(e.target.checked)}
                                                className="rounded border-border bg-background text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5" />
                                            <span className="font-semibold text-muted-foreground text-[10px]">Distribute logistics by carton count</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground mb-1">Total Truck Builty (Rs)</label>
                                    <input type="number" min="0" value={truckTotalBuilty} onChange={e => setTruckTotalBuilty(e.target.value)} placeholder="e.g. 18000"
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono mb-2" />
                                    <label className="flex items-start gap-1.5 text-xs text-foreground cursor-pointer">
                                        <input type="checkbox" checked={truckAgencyPaysBuilty} onChange={e => setTruckAgencyPaysBuilty(e.target.checked)}
                                            className="rounded border-border bg-background text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 mt-0.5" />
                                        <span className="font-semibold text-muted-foreground text-[10px] leading-tight">Builty is cut from Agency Ledger (paid at receiving &amp; recorded as company expense)</span>
                                    </label>
                                </div>
                                <div className={truckDistributeByCartons ? "opacity-45 pointer-events-none" : ""}>
                                    <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">Total Weight of Truck (kg) <span title="If left blank, system sums up items automatically"><HelpCircle className="w-3.5 h-3.5 text-muted-foreground" /></span></label>
                                    <input type="number" min="0" disabled={truckDistributeByCartons} value={truckTotalWeight} onChange={e => setTruckTotalWeight(e.target.value)} placeholder={truckDistributeByCartons ? "N/A (Carton Mode)" : "e.g. 6085"}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground mb-1">Total Unloading Cost (Rs)</label>
                                    <input type="number" min="0" value={truckTotalUnloading} onChange={e => setTruckTotalUnloading(e.target.value)} placeholder="e.g. 2000"
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono" />
                                </div>
                            </div>

                            {/* Tax Rate Overrides for this delivery */}
                            <div className="grid grid-cols-3 gap-3 bg-muted/20 px-4 py-3 rounded-xl border border-border">
                                <div>
                                    <label className="block text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Co. FBR% <span className="text-muted-foreground normal-case font-normal">(agency: {activeTruckAgency?.company_fbr_percent ?? 0}%)</span></label>
                                    <input type="number" step="0.01" min="0" value={truckCoFbr} onChange={e => setTruckCoFbr(e.target.value)}
                                        placeholder={String(activeTruckAgency?.company_fbr_percent ?? 0)}
                                        className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Cust. FBR% <span className="text-muted-foreground normal-case font-normal">(agency: {activeTruckAgency?.fbr_percent ?? 0}%)</span></label>
                                    <input type="number" step="0.01" min="0" value={truckCustFbr} onChange={e => setTruckCustFbr(e.target.value)}
                                        placeholder={String(activeTruckAgency?.fbr_percent ?? 0)}
                                        className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Sales Tax% <span className="text-muted-foreground normal-case font-normal">(agency: {activeTruckAgency?.sales_tax_percent ?? 0}%)</span></label>
                                    <input type="number" step="0.01" min="0" value={truckSalesTax} onChange={e => setTruckSalesTax(e.target.value)}
                                        placeholder={String(activeTruckAgency?.sales_tax_percent ?? 0)}
                                        className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                                </div>
                            </div>

                            {/* Live calculation info bar */}
                            {bulkDeliveryCalculations && activeTruckAgency && (
                                <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40 p-3 rounded-lg flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-400">
                                    <div className="flex items-center gap-1"><Info className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                                        {truckDistributeByCartons ? (
                                            <span>Logistics Rate (builty+unloading): <strong className="font-mono text-sm">Rs {bulkDeliveryCalculations.cartonRate.toFixed(2)}</strong>/carton</span>
                                        ) : (
                                            <span>Logistics Rate (builty+unloading): <strong className="font-mono text-sm">Rs {bulkDeliveryCalculations.combinedRate.toFixed(4)}</strong>/kg</span>
                                        )}
                                    </div>
                                    <span>Co. FBR: <strong>{resolvedTruckCoFbr}%</strong> · Cust. FBR: <strong>{resolvedTruckCustFbr}%</strong> · Sales Tax: <strong>{resolvedTruckSalesTax}%</strong></span>
                                </div>
                            )}

                            {/* Step 2: Items in truck */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center border-b border-border pb-2">
                                    <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">📦 Delivery Items list</h4>
                                    <button type="button" onClick={addTruckItemRow} disabled={agencyProducts.length === 0}
                                        className="text-white disabled:opacity-40 disabled:cursor-not-allowed font-semibold px-3 py-1.5 rounded-lg text-xs shadow-sm transition flex gap-1.5 items-center bg-indigo-600 hover:bg-indigo-700">
                                        <Plus className="w-3.5 h-3.5" /> Add Product Carton Row
                                    </button>
                                </div>

                                {agencyProducts.length === 0 ? (
                                    <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
                                        <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" />
                                        <div>
                                            <span className="font-bold text-sm text-amber-900 dark:text-amber-300 block">No Products for {activeTruckAgency?.name}!</span>
                                            <p className="mt-1">Add at least one product under this agency first.</p>
                                        </div>
                                    </div>
                                ) : truckItems.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground italic bg-muted/10 border border-dashed border-border rounded-xl">
                                        No items yet. Click <strong>+ Add Product Carton Row</strong>.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-border max-h-[35vh] overflow-y-auto">
                                        <table className="w-full text-xs min-w-[720px]">
                                            <thead className="bg-muted/60 sticky top-0 z-10">
                                                <tr className="text-left text-muted-foreground font-bold uppercase tracking-wide">
                                                    <th className="px-3 py-2">Product</th>
                                                    <th className="px-3 py-2 w-20">Cartons</th>
                                                    <th className="px-3 py-2 w-28">Base Price</th>
                                                    <th className="px-3 py-2 w-16">Wt (kg)</th>
                                                    <th className="px-3 py-2 w-20">Cust FBR%</th>
                                                    <th className="px-3 py-2 w-10 text-center text-indigo-500" title="Include Builty/Logistics cost for this product">Builty</th>
                                                    <th className="px-3 py-2 w-28 text-right text-indigo-600">Logistics/ctn</th>
                                                    <th className="px-3 py-2 w-28 text-right text-emerald-600">Unit Cost</th>
                                                    <th className="px-3 py-2 w-28 text-right text-purple-600">Weighted</th>
                                                    <th className="px-3 py-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border bg-card">
                                                {truckItems.map((item, idx) => {
                                                    const calc = bulkDeliveryCalculations?.calculatedItems[idx];
                                                    return (
                                                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                                            <td className="px-3 py-2">
                                                                <select value={item.product_id} onChange={e => updateTruckItem(idx, 'product_id', e.target.value)}
                                                                    className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:ring-2 focus:ring-emerald-400 focus:outline-none">
                                                                    {agencyProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.weight_kg}kg)</option>)}
                                                                </select>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <input type="number" min="1" value={item.quantity} onChange={e => updateTruckItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                                                    className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs font-mono focus:ring-2 focus:ring-emerald-400 focus:outline-none" />
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <input type="number" min="0" value={item.base_price} onChange={e => updateTruckItem(idx, 'base_price', parseFloat(e.target.value) || 0)}
                                                                    className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs font-mono focus:ring-2 focus:ring-emerald-400 focus:outline-none" />
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <input type="number" step="any" min="0" disabled={truckDistributeByCartons} value={item.weight_kg} onChange={e => updateTruckItem(idx, 'weight_kg', parseFloat(e.target.value) || 0)}
                                                                    className={`w-full bg-background border border-border rounded-md px-2 py-1 text-xs font-mono focus:ring-2 focus:ring-emerald-400 focus:outline-none ${truckDistributeByCartons ? 'opacity-40 cursor-not-allowed' : ''}`} />
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <input type="number" step="any" min="0" value={item.fbr_percent} onChange={e => updateTruckItem(idx, 'fbr_percent', parseFloat(e.target.value) || 0)}
                                                                    className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs font-mono focus:ring-2 focus:ring-emerald-400 focus:outline-none" />
                                                            </td>
                                                            {/* Per-product Builty toggle */}
                                                            <td className="px-3 py-2 text-center">
                                                                <label title={item.include_builty ? 'Builty included in cost — click to exclude' : 'Builty excluded — click to include'}
                                                                    className="inline-flex flex-col items-center gap-0.5 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={item.include_builty}
                                                                        onChange={e => updateTruckItem(idx, 'include_builty', e.target.checked)}
                                                                        className="w-3.5 h-3.5 rounded text-indigo-600 border-border bg-background focus:ring-indigo-500 cursor-pointer"
                                                                    />
                                                                    <span className={`text-[9px] font-bold uppercase ${item.include_builty ? 'text-indigo-500' : 'text-muted-foreground line-through'}`}>
                                                                        {item.include_builty ? 'Yes' : 'No'}
                                                                    </span>
                                                                </label>
                                                            </td>
                                                            <td className={`px-3 py-2 text-right font-mono ${item.include_builty ? 'text-indigo-600' : 'text-muted-foreground line-through'}`}>
                                                                {calc ? `Rs ${calc.logisticsTotal.toFixed(1)}` : '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">
                                                                {calc ? `Rs ${calc.itemUnitCost}` : '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono text-purple-600">
                                                                {calc ? `Rs ${calc.newWeightedCost}` : '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-center">
                                                                <button type="button" onClick={() => removeTruckItemRow(idx)} className="p-1 text-muted-foreground hover:text-red-500 transition">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Total summary calculations */}
                            {bulkDeliveryCalculations && bulkDeliveryCalculations.calculatedItems.length > 0 && (
                                <div className="bg-slate-950 text-slate-300 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start text-sm font-semibold gap-4">
                                    <div className="space-y-1 w-full md:w-auto text-xs">
                                        <div>Total Cartons: <span className="text-white font-mono">{truckItems.reduce((s, i) => s + i.quantity, 0)}</span></div>
                                        <div>Calculated Weight: <span className="text-white font-mono">{truckItems.reduce((s, i) => s + (i.quantity * i.weight_kg), 0)} kg</span></div>
                                        <div className="text-slate-500 text-[10px] pt-1">Logistics rate: Rs {bulkDeliveryCalculations.combinedRate.toFixed(4)}/kg (builty+unloading)</div>
                                    </div>
                                    <div className="text-right w-full md:w-auto space-y-1">
                                        <div className="flex justify-between md:justify-end gap-6 text-xs text-slate-400">
                                            <span>Base Price Total (company invoice):</span>
                                            <span className="font-mono text-white">Rs {bulkDeliveryCalculations.baseBillTotal.toLocaleString()}</span>
                                        </div>
                                        {(activeTruckAgency?.company_fbr_percent ?? 0) > 0 && (
                                            <div className="flex justify-between md:justify-end gap-6 text-xs text-amber-400">
                                                <span>+ Company FBR ({activeTruckAgency?.company_fbr_percent}%):</span>
                                                <span className="font-mono">Rs {(bulkDeliveryCalculations.agencyLedgerTotal - bulkDeliveryCalculations.baseBillTotal).toLocaleString()}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between md:justify-end gap-6 text-xs text-slate-300 border-t border-slate-800 pt-1">
                                            <span>Agency Ledger (base + co. FBR):</span>
                                            <span className="font-mono text-white">Rs {bulkDeliveryCalculations.agencyLedgerTotal.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between md:justify-end gap-6 text-xs text-indigo-400">
                                            <span>Our Total Cost (incl. logistics + all FBR):</span>
                                            <span className="font-mono">Rs {bulkDeliveryCalculations.overallOurCost.toLocaleString()}</span>
                                        </div>
                                        {parseFloat(truckPaidAmount) > 0 && (
                                            <div className="flex justify-between md:justify-end gap-6 text-xs text-amber-400">
                                                <span>Minus Paid Installment:</span>
                                                <span className="font-mono">- Rs {parseFloat(truckPaidAmount).toLocaleString()}</span>
                                            </div>
                                        )}
                                        <div className="pt-2 border-t border-slate-700 mt-1">
                                            <span className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider">NET PENDING (Added to Agency Ledger)</span>
                                            <span className="text-2xl font-bold font-mono text-emerald-400">
                                                Rs {(bulkDeliveryCalculations.agencyLedgerTotal - (parseFloat(truckPaidAmount) || 0)).toLocaleString()}
                                            </span>
                                            <span className="text-[10px] text-slate-500 block mt-0.5">Customer FBR 2.5% & logistics tracked in product cost only</span>
                                        </div>
                                    </div>
                                </div>
                            )}


                            {/* Step 3: Payments details */}
                            <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-3">
                                <div>
                                    <label className="block text-sm font-bold text-foreground mb-1">Paid Installment (Rs)</label>
                                    <p className="text-xs text-muted-foreground mb-2">Enter amount paid now. Remaining balance will be added to the agency ledger.</p>
                                    <input type="number" min="0" value={truckPaidAmount} onChange={e => setTruckPaidAmount(e.target.value)} placeholder="Amount paid..."
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono max-w-sm" />
                                </div>

                                {parseFloat(truckPaidAmount) > 0 && (
                                    <div className="pt-3 animate-fadeIn border-t border-border space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Payment Method</label>
                                                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                                                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-450">
                                                    <option value="Cash">Cash</option>
                                                    <option value="Bank Transfer">Bank Transfer</option>
                                                    <option value="Fund Transfer">Fund Transfer</option>
                                                    <option value="Bank Draft">Bank Draft</option>
                                                    <option value="Cheque">Cheque</option>
                                                </select>
                                            </div>
                                            {['Bank Transfer', 'Fund Transfer', 'Bank Draft', 'Cheque'].includes(paymentMethod) && (
                                                <div>
                                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Bank Name</label>
                                                    <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. HBL"
                                                        className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-450" />
                                                </div>
                                            )}
                                        </div>

                                        {['Bank Transfer', 'Fund Transfer', 'Bank Draft', 'Cheque'].includes(paymentMethod) && (
                                            <div className="grid grid-cols-3 gap-3 animate-fadeIn">
                                                <div>
                                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Account Number</label>
                                                    <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Account #"
                                                        className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-450 font-mono" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Branch</label>
                                                    <input value={branch} onChange={e => setBranch(e.target.value)} placeholder="Branch name"
                                                        className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-450" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Ref / Receipt #</label>
                                                    <input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="Ref #"
                                                        className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-450 font-mono" />
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Payment Note</label>
                                            <input value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="Optional note details…"
                                                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-450" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-border">
                                <button type="button" onClick={() => setTruckModalOpen(false)} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/50">Cancel</button>
                                <button type="submit" disabled={truckItems.length === 0}
                                    className="px-6 py-2 text-sm bg-emerald-605 hover:bg-emerald-700 disabled:opacity-55 text-white rounded-lg font-bold shadow-sm transition flex gap-2 items-center">
                                    <CheckCircle className="w-4 h-4" /> Save & Update All Truck Stock
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete Confirm ─────────────────────────────── */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-border">
                        <h3 className="text-lg font-bold text-foreground mb-2">Confirm Delete</h3>
                        <p className="text-muted-foreground text-sm">Delete <strong className="text-foreground">"{deleteConfirm.name}"</strong>?</p>
                        {deleteConfirm.type === 'agency' && <p className="text-red-500 text-xs mt-1">All products in this agency will also be deleted.</p>}
                        <div className="flex gap-3 justify-end mt-6">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/50">Cancel</button>
                            <button onClick={handleConfirmDelete} className="px-4 py-2 text-sm bg-red-655 text-white rounded-lg hover:bg-red-700 font-medium">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
