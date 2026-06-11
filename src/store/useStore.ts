import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export interface OfflineAction {
    id: string;
    table: string;
    action: 'insert' | 'update' | 'delete';
    payload?: any;
    matchColumn?: string;
    matchValue?: string | number | null;
    timestamp: number;
}

export interface Shopkeeper {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    current_balance: number;
    opening_balance?: number;  // Balance migrated from paper khata
}

export interface Agency {
    id: string;
    name: string;
    current_balance: number;
    opening_balance?: number;      // Migrated opening balance / previous balance
    has_builty: boolean;
    builty_rate_per_kg: number;
    company_fbr_percent: number;  // FBR charged BY company on their invoice (e.g. 0.1%)
    fbr_percent: number;           // FBR we charge customers ourselves (e.g. 2.5%) — our cost only
    sales_tax_percent: number;
}

export interface Product {
    id: string;
    name: string;
    agency_id: string;
    cost_price: number;
    default_price: number;
    current_stock: number;
    weight_kg: number;
}

export interface OrderItem { product_id: string; quantity: number; price: number; }
export interface Order { id: string; shopkeeper_id: string; date: string; items: OrderItem[]; status: 'Pending' | 'Delivered'; }
export interface InvoiceItem { product_name: string; quantity: number; price: number; amount: number; }
export interface Invoice { id: string; shopkeeper_id: string; date: string; source: 'Direct' | 'From Order'; order_id?: string; items: InvoiceItem[]; total_amount: number; }
export interface Payment { id: string; shopkeeper_id: string; amount: number; date: string; note?: string; }

export interface DailyExpense {
    id: string;
    date: string;
    description: string;
    amount: number;
    category: string;
}

export interface AgencyPayment {
    id: string;
    agency_id: string;
    amount: number;
    date: string;
    type: 'purchase' | 'payment';
    payment_method?: string;
    bank_name?: string;
    account_number?: string;
    branch?: string;
    reference_number?: string;
    note?: string;
    stock_ref?: string;
}

export interface LedgerEntry { id: string; date: string; type: 'Invoice' | 'Payment'; ref_id: string; amount: number; running_balance: number; note?: string; }

function genId(): string { return Date.now().toString() + '-' + Math.random().toString(36).substring(2, 8); }

interface BulkRestockItem {
    product_id: string;
    quantity: number;
    new_cost_price: number; // unit cost inclusive of distributed expenses
    base_purchase_price: number;
}

interface AppState {
    shopkeepers: Shopkeeper[];
    agencies: Agency[];
    products: Product[];
    orders: Order[];
    invoices: Invoice[];
    payments: Payment[];
    dailyExpenses: DailyExpense[];
    agencyPayments: AgencyPayment[];
    offlineQueue: OfflineAction[];
    isLoading: boolean;
    loadError: string | null;

    queueOrSync: (action: Omit<OfflineAction, 'id' | 'timestamp'>) => Promise<void>;
    syncOfflineQueue: () => Promise<void>;
    clearSyncQueue: () => void;
    lastSyncError: string | null;

    loadData: () => Promise<void>;

    addShopkeeper: (s: Omit<Shopkeeper, 'id' | 'current_balance'>) => void;
    updateShopkeeper: (id: string, data: Partial<Omit<Shopkeeper, 'id' | 'current_balance'>>) => void;
    deleteShopkeeper: (id: string) => void;
    setOpeningBalance: (id: string, amount: number) => void;

    addAgency: (a: Omit<Agency, 'id' | 'current_balance'>) => void;
    updateAgency: (id: string, data: Partial<Omit<Agency, 'id' | 'current_balance'>>) => void;
    deleteAgency: (id: string) => void;
    setAgencyOpeningBalance: (id: string, amount: number) => void;

    addProduct: (p: Omit<Product, 'id'>) => void;
    updateProduct: (id: string, data: Partial<Omit<Product, 'id'>>) => void;
    deleteProduct: (id: string) => void;
    updateProductStock: (id: string, qtyDelta: number) => void;
    restockProduct: (id: string, qty: number, newCostPrice: number, agencyPurchaseAmount?: number) => void;
    bulkRestock: (agencyId: string, items: BulkRestockItem[], totalTruckCost: number, paidAmount: number, paymentDetails?: Omit<AgencyPayment, 'id' | 'agency_id' | 'amount' | 'date' | 'type'>, unloadingCost?: number, totalBuilty?: number, agencyPaysBuilty?: boolean) => void;

    addOrder: (o: Omit<Order, 'id' | 'status'>) => void;
    markOrderDelivered: (id: string) => void;
    createDirectInvoice: (i: Omit<Invoice, 'id' | 'source' | 'total_amount'> & { source: 'Direct' }) => void;
    addPayment: (p: Omit<Payment, 'id'>) => void;
    deleteInvoice: (id: string) => void;

    addDailyExpense: (e: Omit<DailyExpense, 'id'>) => void;
    deleteDailyExpense: (id: string) => void;

    addAgencyPayment: (p: Omit<AgencyPayment, 'id'>) => void;
    deleteAgencyPayment: (id: string) => void;
    clearAgencyLedger: (agencyId: string) => void;
    resetAllData: () => Promise<void>;
}

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            shopkeepers: [], agencies: [], products: [], orders: [], invoices: [], payments: [],
            dailyExpenses: [], agencyPayments: [], offlineQueue: [],
            isLoading: true, loadError: null, lastSyncError: null,

            queueOrSync: async ({ table, action, payload, matchColumn, matchValue }) => {
                const isOnline = navigator.onLine;
                if (!isOnline) {
                    // Offline: queue for later
                    set(state => ({
                        offlineQueue: [...state.offlineQueue, {
                            id: genId(), table, action, payload, matchColumn, matchValue, timestamp: Date.now()
                        }]
                    }));
                    return;
                }
                try {
                    let res;
                    if (action === 'insert') res = await supabase.from(table).upsert(payload, { onConflict: 'id' });
                    else if (action === 'update' && matchColumn) res = await supabase.from(table).update(payload).eq(matchColumn, matchValue);
                    else if (action === 'delete' && matchColumn) res = await supabase.from(table).delete().eq(matchColumn, matchValue);
                    if (res?.error) {
                        // Server-side error (RLS, schema issue, etc.)
                        // Log the full error but do NOT queue for infinite retry — the same request will just fail again.
                        // Instead mark it as a sync error so the user knows about it.
                        const errMsg = `[${table}/${action}] ${res.error.message} (code: ${res.error.code})`;
                        console.error('Supabase server error (not queuing for retry):', errMsg, { table, action, payload });
                        set({ lastSyncError: errMsg });
                    }
                } catch (err: any) {
                    // Network/connection error — queue for retry when back online
                    console.error('Network sync failed, queuing action for retry:', err);
                    set(state => ({
                        offlineQueue: [...state.offlineQueue, {
                            id: genId(), table, action, payload, matchColumn, matchValue, timestamp: Date.now()
                        }]
                    }));
                }
            },
            
            syncOfflineQueue: async () => {
                const { offlineQueue } = get();
                if (offlineQueue.length === 0 || !navigator.onLine) return;
                
                const queue = [...offlineQueue].sort((a, b) => a.timestamp - b.timestamp);
                const failedItems: OfflineAction[] = [];
                let firstError: string | null = null;

                for (const item of queue) {
                    try {
                        let res;
                        // Use upsert for inserts so retries are idempotent (won't fail on duplicate key)
                        if (item.action === 'insert') res = await supabase.from(item.table).upsert(item.payload, { onConflict: 'id' });
                        else if (item.action === 'update' && item.matchColumn) res = await supabase.from(item.table).update(item.payload).eq(item.matchColumn, item.matchValue);
                        else if (item.action === 'delete' && item.matchColumn) res = await supabase.from(item.table).delete().eq(item.matchColumn, item.matchValue);
                        if (res?.error) {
                            // Server-side error (RLS, constraint, etc.)
                            // For permanent errors (42501 = insufficient privilege, 23505 = unique violation already done),
                            // we skip them rather than keep looping forever.
                            const code = res.error.code;
                            const isPermanentError = ['42501', '42P01', '23503', '23514', 'PGRST116'].includes(code || '');
                            console.error('Failed to sync queue item:', res.error.message, { table: item.table, action: item.action, code, isPermanentError });
                            if (!firstError) firstError = `[${item.table}/${item.action}] ${res.error.message} (code: ${code})`;
                            if (!isPermanentError) {
                                // Transient error — keep for retry
                                failedItems.push(item);
                            } else {
                                // Permanent error — skip this item (data is already saved locally)
                                console.warn('Skipping permanently-failed sync item:', item);
                            }
                        }
                        // If no error: item synced successfully, do NOT add to failedItems
                    } catch (err: any) {
                        // Network error — stop processing, keep all remaining items
                        console.error('Network error during sync, pausing sync:', err);
                        if (!firstError) firstError = `Network error: ${err?.message || 'connection failed'}`;
                        failedItems.push(item);
                        // Also keep all subsequent unprocessed items
                        const processedIds = new Set(queue.slice(0, queue.indexOf(item)).map(q => q.id));
                        queue.filter(q => !processedIds.has(q.id) && q.id !== item.id).forEach(q => failedItems.push(q));
                        break;
                    }
                }
                // Only keep the items that failed — successfully synced ones are removed
                set({ offlineQueue: failedItems, lastSyncError: firstError });
            },

            clearSyncQueue: () => {
                set({ offlineQueue: [], lastSyncError: null });
                console.log('Sync queue manually cleared by user.');
            },

            loadData: async () => {
                const isOnline = navigator.onLine;
                const { offlineQueue } = get();

                // 1. If offline, use local cached data immediately
                if (!isOnline) {
                    console.log('App is completely offline. Skipping remote queries to preserve local cached tables.');
                    set({ isLoading: false, loadError: null });
                    return;
                }

                // 2. If online and has offline queue, sync first to protect local changes
                if (offlineQueue.length > 0) {
                    try {
                        console.log('Offline queue detected. Syncing offline changes before fetching fresh data...');
                        await get().syncOfflineQueue();
                        if (get().offlineQueue.length > 0) {
                            console.warn('Offline queue sync was not fully completed. Skipping fresh database load to preserve local changes.');
                            set({ isLoading: false, loadError: null });
                            return;
                        }
                    } catch (err) {
                        console.warn('Failed to sync offline queue on load. Skipping fresh database load to preserve local changes:', err);
                        set({ isLoading: false, loadError: null });
                        return;
                    }
                }

                try {
                    set({ isLoading: true, loadError: null });
                    const [shopRes, agRes, prodRes, ordRes, oiRes, invRes, iiRes, payRes, expRes, apRes] = await Promise.all([
                        supabase.from('shopkeepers').select('*'),
                        supabase.from('agencies').select('*'),
                        supabase.from('products').select('*'),
                        supabase.from('orders').select('*'),
                        supabase.from('order_items').select('*'),
                        supabase.from('invoices').select('*'),
                        supabase.from('invoice_items').select('*'),
                        supabase.from('payments').select('*'),
                        supabase.from('daily_expenses').select('*'),
                        supabase.from('agency_payments').select('*'),
                    ]);

                    const errors = [shopRes, agRes, prodRes, ordRes, oiRes, invRes, iiRes, payRes, expRes, apRes]
                        .filter(r => r.error).map(r => r.error!.message);

                    if (errors.length > 0) {
                        const { shopkeepers } = get();
                        if (shopkeepers && shopkeepers.length > 0) {
                            console.warn('Supabase fetch returned errors but cached local data exists. Continuing in offline mode:', errors.join('; '));
                            set({ isLoading: false, loadError: null });
                            return;
                        }
                        set({ isLoading: false, loadError: errors.join('; ') });
                        return;
                    }
                    const ordersRaw = ordRes.data || [];
                    const orderItemsRaw = oiRes.data || [];
            const orders: Order[] = ordersRaw.map(o => ({
                id: o.id, shopkeeper_id: o.shopkeeper_id, date: o.date, status: o.status as 'Pending' | 'Delivered',
                items: orderItemsRaw.filter(oi => oi.order_id === o.id).map(oi => ({ product_id: oi.product_id, quantity: oi.quantity, price: Number(oi.price) })),
            }));

            const invoicesRaw = invRes.data || [];
            const invoiceItemsRaw = iiRes.data || [];
            const invoices: Invoice[] = invoicesRaw.map(inv => ({
                id: inv.id, shopkeeper_id: inv.shopkeeper_id, date: inv.date, source: inv.source as 'Direct' | 'From Order',
                order_id: inv.order_id || undefined, total_amount: Number(inv.total_amount),
                items: invoiceItemsRaw.filter(ii => ii.invoice_id === inv.id).map(ii => ({
                    product_name: ii.product_name, quantity: ii.quantity, price: Number(ii.price), amount: Number(ii.amount),
                })),
            }));

            const shopkeepers: Shopkeeper[] = (shopRes.data || []).map(s => ({
                id: s.id, name: s.name, phone: s.phone || undefined, address: s.address || undefined,
                current_balance: Number(s.current_balance), opening_balance: Number(s.opening_balance || 0),
            }));
            const agencies: Agency[] = (agRes.data || []).map(a => ({
                id: a.id, name: a.name, current_balance: Number(a.current_balance || 0),
                opening_balance: Number(a.opening_balance || 0),
                has_builty: a.has_builty || false, builty_rate_per_kg: Number(a.builty_rate_per_kg || 0),
                company_fbr_percent: Number(a.company_fbr_percent || 0),
                fbr_percent: Number(a.fbr_percent || 0), sales_tax_percent: Number(a.sales_tax_percent || 0),
            }));
            const products: Product[] = (prodRes.data || []).map(p => ({
                id: p.id, name: p.name, agency_id: p.agency_id, cost_price: Number(p.cost_price),
                default_price: Number(p.default_price), current_stock: Number(p.current_stock), weight_kg: Number(p.weight_kg || 0),
            }));
            const payments: Payment[] = (payRes.data || []).map(p => ({
                id: p.id, shopkeeper_id: p.shopkeeper_id, amount: Number(p.amount), date: p.date, note: p.note || undefined,
            }));
            const dailyExpenses: DailyExpense[] = (expRes.data || []).map(e => ({
                id: e.id, date: e.date, description: e.description, amount: Number(e.amount), category: e.category,
            }));
            const agencyPayments: AgencyPayment[] = (apRes.data || []).map(ap => ({
                id: ap.id, agency_id: ap.agency_id, amount: Number(ap.amount), date: ap.date,
                type: ap.type as 'purchase' | 'payment', payment_method: ap.payment_method || undefined,
                bank_name: ap.bank_name || undefined, account_number: ap.account_number || undefined,
                branch: ap.branch || undefined, reference_number: ap.reference_number || undefined,
                note: ap.note || undefined, stock_ref: ap.stock_ref || undefined,
            }));

            // ── Safety check: never overwrite more local data with less remote data ──
            // This protects against the case where Supabase was not properly receiving writes
            // (e.g. due to missing columns / schema mismatch) and returned fewer records than
            // what we have locally cached. Without this guard the fresh fetch would silently
            // wipe locally-entered data on every restart.
            const localState = get();
            const remoteIsSignificantlySmaller =
                shopkeepers.length < localState.shopkeepers.length ||
                invoices.length < localState.invoices.length ||
                products.length < localState.products.length;

            if (remoteIsSignificantlySmaller && localState.shopkeepers.length > 0) {
                console.warn(
                    `⚠️ Remote DB has FEWER records than local cache (remote shopkeepers: ${shopkeepers.length}, local: ${localState.shopkeepers.length}; remote invoices: ${invoices.length}, local: ${localState.invoices.length}). Keeping local data to prevent data loss. This usually means Supabase was not receiving writes correctly — run migration_004_fix_missing_columns.sql in Supabase.`
                );
                // Queue all local data to re-sync to Supabase now that we're online
                set({ isLoading: false, loadError: null, lastSyncError: 'Remote DB has fewer records than local — schema fix required. See migration_004_fix_missing_columns.sql' });
                return;
            }

            set({ shopkeepers, agencies, products, orders, invoices, payments, dailyExpenses, agencyPayments, isLoading: false });
                } catch (err: any) {
                    const { shopkeepers } = get();
                    if (shopkeepers && shopkeepers.length > 0) {
                        console.warn('Supabase request failed but cached local data exists. Suppressing connection error:', err);
                        set({ isLoading: false, loadError: null });
                        return;
                    }
                    set({ isLoading: false, loadError: err.message || 'Failed to load data' });
                }
            },

    // ── Shopkeepers ─────────────────────────────────────────
    addShopkeeper: (s) => {
        const openingBal = s.opening_balance ?? 0;
        const n: Shopkeeper = { ...s, id: genId(), current_balance: openingBal, opening_balance: openingBal };
        set(st => ({ shopkeepers: [...st.shopkeepers, n] }));
        get().queueOrSync({ table: 'shopkeepers', action: 'insert', payload: { id: n.id, name: n.name, phone: n.phone || null, address: n.address || null, current_balance: openingBal, opening_balance: openingBal } });
    },
    updateShopkeeper: (id, data) => {
        set(st => ({ shopkeepers: st.shopkeepers.map(s => s.id === id ? { ...s, ...data } : s) }));
        get().queueOrSync({ table: 'shopkeepers', action: 'update', payload: data, matchColumn: 'id', matchValue: id });
    },
    deleteShopkeeper: (id) => {
        set(st => ({ shopkeepers: st.shopkeepers.filter(s => s.id !== id) }));
        get().queueOrSync({ table: 'shopkeepers', action: 'delete', matchColumn: 'id', matchValue: id });
    },
    setOpeningBalance: (id, amount) => {
        const state = get();
        const sk = state.shopkeepers.find(s => s.id === id);
        if (!sk) return;
        // Adjust current_balance: remove old opening, add new opening
        const oldOpening = sk.opening_balance ?? 0;
        const delta = amount - oldOpening;
        const newBalance = sk.current_balance + delta;
        set(st => ({ shopkeepers: st.shopkeepers.map(s => s.id === id ? { ...s, opening_balance: amount, current_balance: newBalance } : s) }));
        get().queueOrSync({ table: 'shopkeepers', action: 'update', payload: { opening_balance: amount, current_balance: newBalance }, matchColumn: 'id', matchValue: id });
    },

    // ── Agencies ────────────────────────────────────────────
    addAgency: (a) => {
        const openingBal = a.opening_balance ?? 0;
        const n: Agency = { ...a, id: genId(), current_balance: openingBal, opening_balance: openingBal };
        set(st => ({ agencies: [...st.agencies, n] }));
        get().queueOrSync({
            table: 'agencies', action: 'insert',
            payload: {
                id: n.id, name: n.name, current_balance: openingBal, opening_balance: openingBal, has_builty: n.has_builty,
                builty_rate_per_kg: n.builty_rate_per_kg, company_fbr_percent: n.company_fbr_percent ?? 0,
                fbr_percent: n.fbr_percent, sales_tax_percent: n.sales_tax_percent,
            }
        });
    },
    updateAgency: (id, data) => {
        set(st => ({ agencies: st.agencies.map(a => a.id === id ? { ...a, ...data } : a) }));
        get().queueOrSync({ table: 'agencies', action: 'update', payload: data, matchColumn: 'id', matchValue: id });
    },
    deleteAgency: (id) => {
        set(st => ({ agencies: st.agencies.filter(a => a.id !== id), products: st.products.filter(p => p.agency_id !== id) }));
        get().queueOrSync({ table: 'agencies', action: 'delete', matchColumn: 'id', matchValue: id });
    },
    setAgencyOpeningBalance: (id, amount) => {
        const state = get();
        const ag = state.agencies.find(a => a.id === id);
        if (!ag) return;
        const oldOpening = ag.opening_balance ?? 0;
        const delta = amount - oldOpening;
        const newBalance = ag.current_balance + delta;
        set(st => ({ agencies: st.agencies.map(a => a.id === id ? { ...a, opening_balance: amount, current_balance: newBalance } : a) }));
        get().queueOrSync({ table: 'agencies', action: 'update', payload: { opening_balance: amount, current_balance: newBalance }, matchColumn: 'id', matchValue: id });
    },

    // ── Products ────────────────────────────────────────────
    addProduct: (p) => {
        const n: Product = { ...p, id: genId() };
        set(st => ({ products: [...st.products, n] }));
        get().queueOrSync({
            table: 'products', action: 'insert',
            payload: {
                id: n.id, name: n.name, agency_id: n.agency_id, cost_price: n.cost_price,
                default_price: n.default_price, current_stock: n.current_stock, weight_kg: n.weight_kg || 0
            }
        });
    },
    updateProduct: (id, data) => {
        set(st => ({ products: st.products.map(p => p.id === id ? { ...p, ...data } : p) }));
        get().queueOrSync({ table: 'products', action: 'update', payload: data, matchColumn: 'id', matchValue: id });
    },
    deleteProduct: (id) => {
        set(st => ({ products: st.products.filter(p => p.id !== id) }));
        get().queueOrSync({ table: 'products', action: 'delete', matchColumn: 'id', matchValue: id });
    },
    updateProductStock: (id, qtyDelta) => {
        const product = get().products.find(p => p.id === id);
        if (!product) return;
        const newStock = product.current_stock + qtyDelta;
        set(st => ({ products: st.products.map(p => p.id === id ? { ...p, current_stock: newStock } : p) }));
        get().queueOrSync({ table: 'products', action: 'update', payload: { current_stock: newStock }, matchColumn: 'id', matchValue: id });
    },
    restockProduct: (id, qty, newCostPrice, agencyPurchaseAmount) => {
        const product = get().products.find(p => p.id === id);
        if (!product) return;
        const oldTotal = product.current_stock * (product.cost_price ?? 0);
        const newTotal = qty * newCostPrice;
        const newStock = product.current_stock + qty;
        const weightedCost = newStock > 0 ? (oldTotal + newTotal) / newStock : newCostPrice;
        const updatedCost = parseFloat(weightedCost.toFixed(2));
        set(st => ({ products: st.products.map(p => p.id !== id ? p : { ...p, current_stock: newStock, cost_price: updatedCost }) }));
        get().queueOrSync({ table: 'products', action: 'update', payload: { current_stock: newStock, cost_price: updatedCost }, matchColumn: 'id', matchValue: id });

        // If agency purchase amount provided, update agency balance
        if (agencyPurchaseAmount && agencyPurchaseAmount > 0) {
            const agency = get().agencies.find(a => a.id === product.agency_id);
            if (agency) {
                const newBal = agency.current_balance + agencyPurchaseAmount;
                set(st => ({ agencies: st.agencies.map(a => a.id === agency.id ? { ...a, current_balance: newBal } : a) }));
                get().queueOrSync({ table: 'agencies', action: 'update', payload: { current_balance: newBal }, matchColumn: 'id', matchValue: agency.id });

                // Record as purchase in agency_payments
                const apId = genId();
                const ap: AgencyPayment = {
                    id: apId, agency_id: agency.id, amount: agencyPurchaseAmount,
                    date: new Date().toISOString(), type: 'purchase',
                    note: `Restock: ${product.name} (${qty} units @ Rs ${newCostPrice})`,
                    stock_ref: product.id,
                };
                set(st => ({ agencyPayments: [...st.agencyPayments, ap] }));
                get().queueOrSync({
                    table: 'agency_payments', action: 'insert',
                    payload: {
                        id: apId, agency_id: agency.id, amount: agencyPurchaseAmount,
                        date: ap.date, type: 'purchase', note: ap.note, stock_ref: product.id,
                    }
                });
            }
        }
    },

    // ── Bulk Restock / Truck Delivery Action ────────────────
    bulkRestock: (agencyId, items, totalTruckCost, paidAmount, paymentDetails, unloadingCost = 0, totalBuilty = 0, agencyPaysBuilty = false) => {
        const state = get();
        const agency = state.agencies.find(a => a.id === agencyId);
        if (!agency) return;

        // Perform stock merging & weighted average calculation for each item
        const updatedProducts = [...state.products];
        items.forEach(item => {
            const idx = updatedProducts.findIndex(p => p.id === item.product_id);
            if (idx !== -1) {
                const p = updatedProducts[idx];
                const oldTotal = p.current_stock * p.cost_price;
                const newTotal = item.quantity * item.new_cost_price;
                const combinedStock = p.current_stock + item.quantity;
                const newWeightedCost = combinedStock > 0 ? parseFloat(((oldTotal + newTotal) / combinedStock).toFixed(2)) : item.new_cost_price;

                updatedProducts[idx] = {
                    ...p,
                    current_stock: combinedStock,
                    cost_price: newWeightedCost
                };

                // Sync each product to Supabase
                get().queueOrSync({
                    table: 'products', action: 'update',
                    payload: { current_stock: combinedStock, cost_price: newWeightedCost },
                    matchColumn: 'id', matchValue: p.id
                });
            }
        });

        // 1. Calculate new agency balance
        // If agency pays builty, we technically paid the truck driver on their behalf.
        // So the amount we owe the agency for this truck is reduced by the builty amount.
        const netOwedToAgency = agencyPaysBuilty ? (totalTruckCost - totalBuilty) : totalTruckCost;
        const newBal = agency.current_balance + netOwedToAgency;
        const updatedAgencies = state.agencies.map(a => a.id === agencyId ? { ...a, current_balance: newBal } : a);

        set({ products: updatedProducts, agencies: updatedAgencies });
        get().queueOrSync({ table: 'agencies', action: 'update', payload: { current_balance: newBal }, matchColumn: 'id', matchValue: agencyId });

        // 2. Record purchase transaction in agency ledger
        const purchaseApId = genId();
        const purchaseNote = agencyPaysBuilty 
            ? `Truck Delivery: Loaded ${items.length} items. Total Bill Rs ${totalTruckCost.toLocaleString()} (Minus Rs ${totalBuilty.toLocaleString()} Builty paid by us. Unloading: Rs ${unloadingCost}). Net: Rs ${netOwedToAgency.toLocaleString()}`
            : `Truck Delivery: Loaded ${items.length} items. Total Bill Rs ${totalTruckCost.toLocaleString()} (Unloading: Rs ${unloadingCost}).`;
            
        const purchaseAp: AgencyPayment = {
            id: purchaseApId,
            agency_id: agencyId,
            amount: netOwedToAgency,
            date: new Date().toISOString(),
            type: 'purchase',
            note: purchaseNote
        };
        set(st => ({ agencyPayments: [...st.agencyPayments, purchaseAp] }));
        get().queueOrSync({
            table: 'agency_payments', action: 'insert',
            payload: {
                id: purchaseApId, agency_id: agencyId, amount: netOwedToAgency,
                date: purchaseAp.date, type: 'purchase', note: purchaseNote
            }
        });

        // 2.5 If agency paid builty, record our physical cash payment to driver as a Daily Expense (per user request for cash balancing)
        if (agencyPaysBuilty && totalBuilty > 0) {
            const expenseId = genId();
            const e: DailyExpense = {
                id: expenseId,
                date: new Date().toISOString(),
                description: `Paid Truck Builty to driver on behalf of agency (${agency.name})`,
                amount: totalBuilty,
                category: 'Freight / Transport'
            };
            set(st => ({ dailyExpenses: [...st.dailyExpenses, e] }));
            get().queueOrSync({
                table: 'daily_expenses', action: 'insert',
                payload: { id: expenseId, date: e.date, description: e.description, amount: e.amount, category: e.category }
            });
        }

        // 3. Record payment if paidAmount > 0
        if (paidAmount > 0 && paymentDetails) {
            const finalBal = newBal - paidAmount;
            set(st => ({ agencies: st.agencies.map(a => a.id === agencyId ? { ...a, current_balance: finalBal } : a) }));
            get().queueOrSync({ table: 'agencies', action: 'update', payload: { current_balance: finalBal }, matchColumn: 'id', matchValue: agencyId });

            const paymentApId = genId();
            const paymentAp: AgencyPayment = {
                id: paymentApId,
                agency_id: agencyId,
                amount: paidAmount,
                date: new Date().toISOString(),
                type: 'payment',
                payment_method: paymentDetails.payment_method,
                bank_name: paymentDetails.bank_name,
                account_number: paymentDetails.account_number,
                branch: paymentDetails.branch,
                reference_number: paymentDetails.reference_number,
                note: paymentDetails.note || `Paid installment Rs ${paidAmount.toLocaleString()} for truck delivery.`
            };
            set(st => ({ agencyPayments: [...st.agencyPayments, paymentAp] }));
            get().queueOrSync({
                table: 'agency_payments', action: 'insert',
                payload: {
                    id: paymentApId, agency_id: agencyId, amount: paidAmount,
                    date: paymentAp.date, type: 'payment',
                    payment_method: paymentAp.payment_method || null, bank_name: paymentAp.bank_name || null,
                    account_number: paymentAp.account_number || null, branch: paymentAp.branch || null,
                    reference_number: paymentAp.reference_number || null, note: paymentAp.note || null
                }
            });
        }
    },

    // ── Orders ──────────────────────────────────────────────
    addOrder: (o) => {
        const orderId = genId();
        const newOrder: Order = { ...o, id: orderId, status: 'Pending' };
        set(st => ({ orders: [...st.orders, newOrder] }));
        (async () => {
            await get().queueOrSync({ table: 'orders', action: 'insert', payload: { id: orderId, shopkeeper_id: o.shopkeeper_id, date: o.date, status: 'Pending' } });
            await get().queueOrSync({ table: 'order_items', action: 'insert', payload: o.items.map(item => ({ order_id: orderId, product_id: item.product_id, quantity: item.quantity, price: item.price })) });
        })().catch(err => console.error(err));
    },

    markOrderDelivered: (orderId) => {
        const state = get();
        const order = state.orders.find(o => o.id === orderId);
        if (!order || order.status === 'Delivered') return;
        const updatedOrders = state.orders.map(o => o.id === orderId ? { ...o, status: 'Delivered' as const } : o);
        let totalVal = 0;
        const invItems: InvoiceItem[] = order.items.map(item => {
            const p = state.products.find(prod => prod.id === item.product_id);
            const amount = item.price * item.quantity; totalVal += amount;
            return { product_name: p?.name || 'Unknown Product', quantity: item.quantity, price: item.price, amount };
        });
        const invoiceId = genId() + '-inv';
        const newInvoice: Invoice = { id: invoiceId, shopkeeper_id: order.shopkeeper_id, date: new Date().toISOString(), source: 'From Order', order_id: order.id, items: invItems, total_amount: totalVal };
        const updatedShopkeepers = state.shopkeepers.map(s => s.id === order.shopkeeper_id ? { ...s, current_balance: s.current_balance + totalVal } : s);
        const updatedProducts = [...state.products];
        order.items.forEach(item => { const idx = updatedProducts.findIndex(p => p.id === item.product_id); if (idx !== -1) updatedProducts[idx] = { ...updatedProducts[idx], current_stock: updatedProducts[idx].current_stock - item.quantity }; });
        set({ orders: updatedOrders, invoices: [...state.invoices, newInvoice], shopkeepers: updatedShopkeepers, products: updatedProducts });
        (async () => {
            await get().queueOrSync({ table: 'orders', action: 'update', payload: { status: 'Delivered' }, matchColumn: 'id', matchValue: orderId });
            await get().queueOrSync({ table: 'invoices', action: 'insert', payload: { id: invoiceId, shopkeeper_id: order.shopkeeper_id, date: newInvoice.date, source: 'From Order', order_id: order.id, total_amount: totalVal } });
            await get().queueOrSync({ table: 'invoice_items', action: 'insert', payload: invItems.map(ii => ({ invoice_id: invoiceId, product_name: ii.product_name, quantity: ii.quantity, price: ii.price, amount: ii.amount })) });
            const sk = updatedShopkeepers.find(s => s.id === order.shopkeeper_id);
            if (sk) await get().queueOrSync({ table: 'shopkeepers', action: 'update', payload: { current_balance: sk.current_balance }, matchColumn: 'id', matchValue: sk.id });
            for (const item of order.items) { const prod = updatedProducts.find(p => p.id === item.product_id); if (prod) await get().queueOrSync({ table: 'products', action: 'update', payload: { current_stock: prod.current_stock }, matchColumn: 'id', matchValue: prod.id }); }
        })().catch(err => console.error(err));
    },

    // ── Direct Invoice ──────────────────────────────────────
    createDirectInvoice: (invInfo) => {
        const state = get();
        let totalVal = 0;
        const invItems = invInfo.items.map(item => { const val = item.price * item.quantity; totalVal += val; return { ...item, amount: val }; });
        const invoiceId = genId();
        const newInvoice: Invoice = { ...invInfo, id: invoiceId, items: invItems, total_amount: totalVal };
        const orderId = genId() + '-ord';
        const orderItems: OrderItem[] = invInfo.items.map(i => { const prod = state.products.find(p => p.name === i.product_name); return { product_id: prod ? prod.id : 'unknown', quantity: i.quantity, price: i.price }; });
        const newOrder: Order = { id: orderId, shopkeeper_id: invInfo.shopkeeper_id, date: invInfo.date, status: 'Delivered', items: orderItems };
        const updatedShopkeepers = state.shopkeepers.map(s => s.id === invInfo.shopkeeper_id ? { ...s, current_balance: s.current_balance + totalVal } : s);
        const updatedProducts = [...state.products];
        orderItems.forEach(item => { if (item.product_id !== 'unknown') { const idx = updatedProducts.findIndex(p => p.id === item.product_id); if (idx !== -1) updatedProducts[idx] = { ...updatedProducts[idx], current_stock: updatedProducts[idx].current_stock - item.quantity }; } });
        set({ invoices: [...state.invoices, newInvoice], orders: [...state.orders, newOrder], shopkeepers: updatedShopkeepers, products: updatedProducts });
        (async () => {
            await get().queueOrSync({ table: 'invoices', action: 'insert', payload: { id: invoiceId, shopkeeper_id: invInfo.shopkeeper_id, date: invInfo.date, source: 'Direct', order_id: null, total_amount: totalVal } });
            await get().queueOrSync({ table: 'invoice_items', action: 'insert', payload: invItems.map(ii => ({ invoice_id: invoiceId, product_name: ii.product_name, quantity: ii.quantity, price: ii.price, amount: ii.amount })) });
            await get().queueOrSync({ table: 'orders', action: 'insert', payload: { id: orderId, shopkeeper_id: invInfo.shopkeeper_id, date: invInfo.date, status: 'Delivered' } });
            await get().queueOrSync({ table: 'order_items', action: 'insert', payload: orderItems.map(oi => ({ order_id: orderId, product_id: oi.product_id, quantity: oi.quantity, price: oi.price })) });
            const sk = updatedShopkeepers.find(s => s.id === invInfo.shopkeeper_id); if (sk) await get().queueOrSync({ table: 'shopkeepers', action: 'update', payload: { current_balance: sk.current_balance }, matchColumn: 'id', matchValue: sk.id });
            for (const item of orderItems) { if (item.product_id !== 'unknown') { const prod = updatedProducts.find(p => p.id === item.product_id); if (prod) await get().queueOrSync({ table: 'products', action: 'update', payload: { current_stock: prod.current_stock }, matchColumn: 'id', matchValue: prod.id }); } }
        })().catch(err => console.error(err));
    },

    // ── Payments ────────────────────────────────────────────
    addPayment: (p) => {
        const n: Payment = { ...p, id: genId() };
        const state = get();
        const updatedShopkeepers = state.shopkeepers.map(s => s.id === p.shopkeeper_id ? { ...s, current_balance: s.current_balance - p.amount } : s);
        set({ payments: [...state.payments, n], shopkeepers: updatedShopkeepers });
        (async () => {
            await get().queueOrSync({ table: 'payments', action: 'insert', payload: { id: n.id, shopkeeper_id: p.shopkeeper_id, amount: p.amount, date: p.date, note: p.note || null } });
            const sk = updatedShopkeepers.find(s => s.id === p.shopkeeper_id); if (sk) await get().queueOrSync({ table: 'shopkeepers', action: 'update', payload: { current_balance: sk.current_balance }, matchColumn: 'id', matchValue: sk.id });
        })().catch(err => console.error(err));
    },

    // ── Delete Invoice ──────────────────────────────────────
    deleteInvoice: (invoiceId) => {
        const state = get();
        const invoice = state.invoices.find(i => i.id === invoiceId);
        if (!invoice) return;
        const updatedShopkeepers = state.shopkeepers.map(s => s.id === invoice.shopkeeper_id ? { ...s, current_balance: s.current_balance - invoice.total_amount } : s);
        const updatedProducts = [...state.products];
        invoice.items.forEach(item => { const idx = updatedProducts.findIndex(p => p.name === item.product_name); if (idx !== -1) updatedProducts[idx] = { ...updatedProducts[idx], current_stock: updatedProducts[idx].current_stock + item.quantity }; });
        set({ invoices: state.invoices.filter(i => i.id !== invoiceId), shopkeepers: updatedShopkeepers, products: updatedProducts });
        (async () => {
            await get().queueOrSync({ table: 'invoices', action: 'delete', matchColumn: 'id', matchValue: invoiceId });
            const sk = updatedShopkeepers.find(s => s.id === invoice.shopkeeper_id); if (sk) await get().queueOrSync({ table: 'shopkeepers', action: 'update', payload: { current_balance: sk.current_balance }, matchColumn: 'id', matchValue: sk.id });
            for (const item of invoice.items) { const prod = updatedProducts.find(p => p.name === item.product_name); if (prod) await get().queueOrSync({ table: 'products', action: 'update', payload: { current_stock: prod.current_stock }, matchColumn: 'id', matchValue: prod.id }); }
        })().catch(err => console.error(err));
    },

    // ── Daily Expenses ──────────────────────────────────────
    addDailyExpense: (e) => {
        const n: DailyExpense = { ...e, id: genId() };
        set(st => ({ dailyExpenses: [...st.dailyExpenses, n] }));
        get().queueOrSync({ table: 'daily_expenses', action: 'insert', payload: { id: n.id, date: n.date, description: n.description, amount: n.amount, category: n.category } });
    },
    deleteDailyExpense: (id) => {
        set(st => ({ dailyExpenses: st.dailyExpenses.filter(e => e.id !== id) }));
        get().queueOrSync({ table: 'daily_expenses', action: 'delete', matchColumn: 'id', matchValue: id });
    },

    // ── Agency Payments ─────────────────────────────────────
    addAgencyPayment: (p) => {
        const n: AgencyPayment = { ...p, id: genId() };
        set(st => ({ agencyPayments: [...st.agencyPayments, n] }));

        // Update agency balance (payment reduces what we owe)
        if (p.type === 'payment') {
            const agency = get().agencies.find(a => a.id === p.agency_id);
            if (agency) {
                const newBal = agency.current_balance - p.amount;
                set(st => ({ agencies: st.agencies.map(a => a.id === agency.id ? { ...a, current_balance: newBal } : a) }));
                get().queueOrSync({ table: 'agencies', action: 'update', payload: { current_balance: newBal }, matchColumn: 'id', matchValue: agency.id });
            }
        }

        get().queueOrSync({
            table: 'agency_payments', action: 'insert',
            payload: {
                id: n.id, agency_id: p.agency_id, amount: p.amount, date: p.date, type: p.type,
                payment_method: p.payment_method || null, bank_name: p.bank_name || null,
                account_number: p.account_number || null, branch: p.branch || null,
                reference_number: p.reference_number || null, note: p.note || null, stock_ref: p.stock_ref || null,
            }
        });
    },

    deleteAgencyPayment: (id) => {
        const state = get();
        const payment = state.agencyPayments.find(p => p.id === id);
        if (!payment) return;

        // Reverse the balance effect of the deleted payment
        const agency = state.agencies.find(a => a.id === payment.agency_id);
        if (agency) {
            const balanceDelta = payment.type === 'purchase' ? -payment.amount : payment.amount;
            const newBal = agency.current_balance + balanceDelta;
            set(st => ({ agencies: st.agencies.map(a => a.id === agency.id ? { ...a, current_balance: newBal } : a) }));
            get().queueOrSync({ table: 'agencies', action: 'update', payload: { current_balance: newBal }, matchColumn: 'id', matchValue: agency.id });
        }

        set(st => ({ agencyPayments: st.agencyPayments.filter(p => p.id !== id) }));
        get().queueOrSync({ table: 'agency_payments', action: 'delete', matchColumn: 'id', matchValue: id });
    },

    clearAgencyLedger: (agencyId) => {
        const state = get();
        const agency = state.agencies.find(a => a.id === agencyId);
        if (!agency) return;

        // Remove all payments for this agency
        const toDelete = state.agencyPayments.filter(p => p.agency_id === agencyId);
        set(st => ({ agencyPayments: st.agencyPayments.filter(p => p.agency_id !== agencyId) }));

        // Delete from Supabase
        toDelete.forEach(p => {
            get().queueOrSync({ table: 'agency_payments', action: 'delete', matchColumn: 'id', matchValue: p.id });
        });

        // Reset balance to opening_balance
        const resetBalance = agency.opening_balance ?? 0;
        set(st => ({ agencies: st.agencies.map(a => a.id === agencyId ? { ...a, current_balance: resetBalance } : a) }));
        get().queueOrSync({ table: 'agencies', action: 'update', payload: { current_balance: resetBalance }, matchColumn: 'id', matchValue: agencyId });
    },

    resetAllData: async () => {
        // Safe cascading order: Children tables first to guarantee no FK violations
        const tables = [
            'invoice_items',
            'order_items',
            'invoices',
            'orders',
            'payments',
            'agency_payments',
            'products',
            'daily_expenses',
            'agencies',
            'shopkeepers'
        ];

        // Delete all data sequentially to prevent concurrent FK locks
        for (const table of tables) {
            const { error } = await supabase.from(table).delete().neq('id', 'null');
            if (error) {
                console.error(`Error deleting from ${table}:`, error);
                throw error;
            }
        }

        // Reset Zustand store state to brand new
        set({
            shopkeepers: [],
            agencies: [],
            products: [],
            orders: [],
            invoices: [],
            payments: [],
            dailyExpenses: [],
            agencyPayments: [],
            offlineQueue: [],
        });
    }
        }),
        {
            name: 'pos-offline-storage',
            partialize: (state) => ({ 
                shopkeepers: state.shopkeepers, agencies: state.agencies, products: state.products, orders: state.orders,
                invoices: state.invoices, payments: state.payments, dailyExpenses: state.dailyExpenses, agencyPayments: state.agencyPayments,
                offlineQueue: state.offlineQueue
            })
        }
    )
);
