import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Upload, CheckCircle, AlertCircle, Database, ArrowRight, Loader2 } from 'lucide-react';

interface OldStoreData {
    state: {
        shopkeepers: any[];
        agencies: any[];
        products: any[];
        orders: any[];
        invoices: any[];
        payments: any[];
    };
}

export default function DataMigration({ onComplete }: { onComplete: () => void }) {
    const [oldData, setOldData] = useState<OldStoreData | null>(null);
    const [migrating, setMigrating] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    useEffect(() => {
        // Check for old localStorage data
        const raw = localStorage.getItem('pos-storage');
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                setOldData(parsed);
            } catch {
                setOldData(null);
            }
        }
    }, []);

    // No old data found
    if (!oldData || !oldData.state) {
        return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="bg-card rounded-2xl shadow-xl border border-border p-8 max-w-md w-full text-center">
                    <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-foreground mb-2">No Local Data Found</h2>
                    <p className="text-muted-foreground text-sm mb-6">
                        No existing data was found in your browser. You're starting fresh with the cloud database.
                    </p>
                    <button
                        onClick={onComplete}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition flex items-center gap-2 mx-auto"
                    >
                        Continue to App <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    const { shopkeepers, agencies, products, orders, invoices, payments } = oldData.state;

    async function handleMigrate() {
        setMigrating(true);
        setError('');

        try {
            // 1. Migrate Agencies
            if (agencies.length > 0) {
                setProgress(`Migrating ${agencies.length} agencies...`);
                const rows = agencies.map((a: any) => ({ id: a.id, name: a.name }));
                const { error } = await supabase.from('agencies').upsert(rows);
                if (error) throw new Error(`Agencies: ${error.message}`);
            }

            // 2. Migrate Shopkeepers
            if (shopkeepers.length > 0) {
                setProgress(`Migrating ${shopkeepers.length} shopkeepers...`);
                const rows = shopkeepers.map((s: any) => ({
                    id: s.id, name: s.name, phone: s.phone || null,
                    address: s.address || null, current_balance: s.current_balance || 0,
                }));
                const { error } = await supabase.from('shopkeepers').upsert(rows);
                if (error) throw new Error(`Shopkeepers: ${error.message}`);
            }

            // 3. Migrate Products
            if (products.length > 0) {
                setProgress(`Migrating ${products.length} products...`);
                const rows = products.map((p: any) => ({
                    id: p.id, name: p.name, agency_id: p.agency_id,
                    cost_price: p.cost_price || 0, default_price: p.default_price || 0,
                    current_stock: p.current_stock || 0,
                }));
                const { error } = await supabase.from('products').upsert(rows);
                if (error) throw new Error(`Products: ${error.message}`);
            }

            // 4. Migrate Orders + Order Items
            if (orders.length > 0) {
                setProgress(`Migrating ${orders.length} orders...`);
                const orderRows = orders.map((o: any) => ({
                    id: o.id, shopkeeper_id: o.shopkeeper_id,
                    date: o.date, status: o.status || 'Pending',
                }));
                const { error: oErr } = await supabase.from('orders').upsert(orderRows);
                if (oErr) throw new Error(`Orders: ${oErr.message}`);

                // Order items
                const allItems: any[] = [];
                orders.forEach((o: any) => {
                    if (o.items) {
                        o.items.forEach((item: any) => {
                            allItems.push({
                                order_id: o.id, product_id: item.product_id,
                                quantity: item.quantity, price: item.price,
                            });
                        });
                    }
                });
                if (allItems.length > 0) {
                    setProgress(`Migrating ${allItems.length} order items...`);
                    const { error: oiErr } = await supabase.from('order_items').upsert(allItems);
                    if (oiErr) throw new Error(`Order Items: ${oiErr.message}`);
                }
            }

            // 5. Migrate Invoices + Invoice Items
            if (invoices.length > 0) {
                setProgress(`Migrating ${invoices.length} invoices...`);
                const invRows = invoices.map((inv: any) => ({
                    id: inv.id, shopkeeper_id: inv.shopkeeper_id,
                    date: inv.date, source: inv.source || 'Direct',
                    order_id: inv.order_id || null, total_amount: inv.total_amount || 0,
                }));
                const { error: invErr } = await supabase.from('invoices').upsert(invRows);
                if (invErr) throw new Error(`Invoices: ${invErr.message}`);

                // Invoice items
                const allInvItems: any[] = [];
                invoices.forEach((inv: any) => {
                    if (inv.items) {
                        inv.items.forEach((item: any) => {
                            allInvItems.push({
                                invoice_id: inv.id, product_name: item.product_name,
                                quantity: item.quantity, price: item.price,
                                amount: item.amount || item.price * item.quantity,
                            });
                        });
                    }
                });
                if (allInvItems.length > 0) {
                    setProgress(`Migrating ${allInvItems.length} invoice items...`);
                    const { error: iiErr } = await supabase.from('invoice_items').upsert(allInvItems);
                    if (iiErr) throw new Error(`Invoice Items: ${iiErr.message}`);
                }
            }

            // 6. Migrate Payments
            if (payments.length > 0) {
                setProgress(`Migrating ${payments.length} payments...`);
                const rows = payments.map((p: any) => ({
                    id: p.id, shopkeeper_id: p.shopkeeper_id,
                    amount: p.amount, date: p.date, note: p.note || null,
                }));
                const { error } = await supabase.from('payments').upsert(rows);
                if (error) throw new Error(`Payments: ${error.message}`);
            }

            // Clear old localStorage
            localStorage.removeItem('pos-storage');
            setProgress('');
            setDone(true);

            // Reload store from Supabase
            useStore.getState().loadData();

        } catch (err: any) {
            setError(err.message || 'Migration failed');
            setMigrating(false);
        }
    }

    if (done) {
        return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="bg-card rounded-2xl shadow-xl border border-border p-8 max-w-md w-full text-center">
                    <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-foreground mb-2">Migration Complete!</h2>
                    <p className="text-muted-foreground text-sm mb-6">
                        All your data has been safely moved to the cloud database.
                    </p>
                    <button
                        onClick={onComplete}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition flex items-center gap-2 mx-auto"
                    >
                        Open POS System <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl shadow-xl border border-border p-8 max-w-lg w-full">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-500/10 rounded-xl">
                        <Database className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Data Migration</h2>
                        <p className="text-muted-foreground text-sm">Move your local data to the cloud</p>
                    </div>
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-6">
                    <p className="text-sm text-indigo-400 font-medium mb-3">Found existing local data:</p>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: 'Shopkeepers', count: shopkeepers.length },
                            { label: 'Agencies', count: agencies.length },
                            { label: 'Products', count: products.length },
                            { label: 'Orders', count: orders.length },
                            { label: 'Invoices', count: invoices.length },
                            { label: 'Payments', count: payments.length },
                        ].map(item => (
                            <div key={item.label} className="bg-card rounded-lg p-2 text-center border border-border">
                                <div className="text-lg font-bold text-indigo-400 font-mono">{item.count}</div>
                                <div className="text-xs text-muted-foreground">{item.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-4">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {migrating && progress && (
                    <div className="flex items-center gap-2 text-indigo-600 text-sm mb-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {progress}
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={onComplete}
                        className="flex-1 px-4 py-3 text-muted-foreground border border-border rounded-xl hover:bg-muted/50 transition font-medium text-sm"
                    >
                        Skip (Start Fresh)
                    </button>
                    <button
                        onClick={handleMigrate}
                        disabled={migrating}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 text-sm"
                    >
                        {migrating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Upload className="w-4 h-4" />
                        )}
                        {migrating ? 'Migrating...' : 'Migrate Data'}
                    </button>
                </div>
            </div>
        </div>
    );
}
