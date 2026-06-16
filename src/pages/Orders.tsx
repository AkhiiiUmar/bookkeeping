import { useState } from 'react';
import { useStore } from '../store/useStore';
import type { OrderItem } from '../store/useStore';
import { Plus, Check, Calendar } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';

export default function Orders() {
    const { orders, shopkeepers, products, addOrder, markOrderDelivered } = useStore();
    const [filter, setFilter] = useState<'All' | 'Pending' | 'Delivered'>('All');

    const [isModalOpen, setModalOpen] = useState(false);

    // New Order State
    const [shopkeeperId, setShopkeeperId] = useState('');
    const [items, setItems] = useState<OrderItem[]>([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [qty, setQty] = useState('');
    const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split('T')[0]);

    const filteredOrders = orders.filter(o => {
        if (filter === 'All') return true;
        return o.status === filter;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const handleAddItem = () => {
        const p = products.find(prod => prod.id === selectedProduct);
        if (!p || !qty) return;
        setItems([...items, { product_id: p.id, quantity: parseInt(qty), price: p.default_price }]);
        setSelectedProduct('');
        setQty('');
    };

    const handleSaveOrder = () => {
        if (!shopkeeperId || items.length === 0) return;
        addOrder({
            shopkeeper_id: shopkeeperId,
            date: new Date(orderDate + 'T12:00:00').toISOString(),
            items: items
        });
        setModalOpen(false);
        setShopkeeperId('');
        setItems([]);
        setOrderDate(new Date().toISOString().split('T')[0]);
    };

    const calculateTotal = (orderItems: OrderItem[]) => {
        return orderItems.reduce((acc, current) => acc + (current.price * current.quantity), 0);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-primary">Roz Namcha (Orders)</h2>
                    <p className="text-muted-foreground text-sm mt-0.5">Manage daily shopkeeper orders</p>
                </div>
                <button onClick={() => setModalOpen(true)} className="self-start sm:self-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition flex gap-2 items-center whitespace-nowrap">
                    <Plus className="w-4 h-4 flex-shrink-0" /> Add Order
                </button>
            </div>

            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="p-4 border-b border-border flex flex-wrap gap-2 md:gap-4 bg-muted/20">
                    <button onClick={() => setFilter('All')} className={`px-4 py-2 transition rounded-md text-sm font-medium ${filter === 'All' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>All</button>
                    <button onClick={() => setFilter('Pending')} className={`px-4 py-2 transition rounded-md text-sm font-medium ${filter === 'Pending' ? 'bg-yellow-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}>Pending</button>
                    <button onClick={() => setFilter('Delivered')} className={`px-4 py-2 transition rounded-md text-sm font-medium ${filter === 'Delivered' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}>Delivered</button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[750px]">
                        <thead className="bg-muted text-muted-foreground">
                            <tr>
                                <th className="px-6 py-3 font-medium">Date</th>
                                <th className="px-6 py-3 font-medium">Shopkeeper</th>
                                <th className="px-6 py-3 font-medium">Items</th>
                                <th className="px-6 py-3 font-medium">Total Cost</th>
                                <th className="px-6 py-3 font-medium">Status</th>
                                <th className="px-6 py-3 font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredOrders.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No orders found.</td>
                                </tr>
                            )}
                            {filteredOrders.map(order => {
                                const shopkeeper = shopkeepers.find(s => s.id === order.shopkeeper_id);
                                const totalVal = calculateTotal(order.items);
                                return (
                                    <tr key={order.id} className="hover:bg-muted/30 transition">
                                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4" /> {new Date(order.date).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-foreground">{shopkeeper?.name || 'Unknown'}</td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                                        </td>
                                        <td className="px-6 py-4 font-mono font-medium text-foreground">Rs {totalVal}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 text-xs font-bold border rounded-full ${order.status === 'Delivered' ? 'bg-[#D1FADF] text-[#027A48] border-[#A9F5C6]' : 'bg-[#FEF0C7] text-[#B54708] border-[#FEDF89]'}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {order.status === 'Pending' && (
                                                <button
                                                    onClick={() => markOrderDelivered(order.id)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition shadow-sm font-semibold"
                                                >
                                                    <Check className="w-3.5 h-3.5" /> Mark Delivered
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl shadow-xl w-full max-w-xl flex flex-col max-h-[90vh] border border-border">
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <h3 className="text-xl font-bold text-primary flex items-center gap-2"><Calendar className="w-5 h-5 text-indigo-500" /> Add New Order</h3>
                            <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">&times;</button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Date picker — allows backdating */}
                            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 flex items-center gap-3">
                                <Calendar className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">Order Date <span className="text-muted-foreground font-normal normal-case">(can backdate for old entries)</span></label>
                                    <input
                                        type="date"
                                        value={orderDate}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={e => setOrderDate(e.target.value)}
                                        className="w-full bg-background border border-indigo-300 dark:border-indigo-700 rounded-lg px-3 py-1.5 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    />
                                </div>
                                {orderDate !== new Date().toISOString().split('T')[0] && (
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
                                        />
                                    </div>
                                    <input
                                        type="number"
                                        placeholder="Qty"
                                        value={qty}
                                        onChange={e => setQty(e.target.value)}
                                        className="w-20 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                                    />
                                    <button onClick={handleAddItem} className="bg-slate-700 dark:bg-slate-600 text-white px-3 py-2 rounded-lg font-medium flex-shrink-0"><Plus className="w-4 h-4" /></button>
                                </div>
                            </div>

                            {items.length > 0 && (
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm min-w-[450px]">
                                            <thead className="bg-muted text-muted-foreground">
                                                <tr>
                                                    <th className="px-4 py-2">Product</th>
                                                    <th className="px-4 py-2">Qty</th>
                                                    <th className="px-4 py-2">Price</th>
                                                    <th className="px-4 py-2 text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {items.map((item, idx) => {
                                                    const pName = products.find(p => p.id === item.product_id)?.name;
                                                    return (
                                                        <tr key={idx}>
                                                            <td className="px-4 py-2 text-foreground">{pName}</td>
                                                            <td className="px-4 py-2 text-foreground font-mono">{item.quantity}</td>
                                                            <td className="px-4 py-2 text-foreground font-mono">Rs {item.price}</td>
                                                            <td className="px-4 py-2 text-foreground text-right font-mono font-medium">Rs {item.price * item.quantity}</td>
                                                        </tr>
                                                    );
                                                })}
                                                <tr className="bg-muted/50">
                                                    <td colSpan={3} className="px-4 py-3 font-semibold text-right text-foreground">Total</td>
                                                    <td className="px-4 py-3 font-bold text-right text-indigo-600 dark:text-indigo-400 font-mono">Rs {calculateTotal(items)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-border bg-muted/20 flex justify-end gap-3 rounded-b-xl">
                            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-muted-foreground font-medium hover:bg-muted rounded-lg transition">Cancel</button>
                            <button
                                onClick={handleSaveOrder}
                                disabled={!shopkeeperId || items.length === 0}
                                className="bg-indigo-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-bold shadow-sm transition hover:bg-indigo-700"
                            >
                                Save Pending Order
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
