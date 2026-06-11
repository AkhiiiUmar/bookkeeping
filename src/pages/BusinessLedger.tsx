import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { printHtml } from '../utils/print';
import { 
    TrendingUp, Calendar, Wallet, ShoppingCart, 
    BarChart3, Printer, Package 
} from 'lucide-react';

export default function BusinessLedger() {
    const { invoices, agencyPayments, dailyExpenses, products } = useStore();

    // Get list of available years from data
    const years = useMemo(() => {
        const yrSet = new Set<number>();
        // Add current year as fallback
        yrSet.add(new Date().getFullYear());
        
        invoices.forEach(i => yrSet.add(new Date(i.date).getFullYear()));
        agencyPayments.forEach(p => yrSet.add(new Date(p.date).getFullYear()));
        dailyExpenses.forEach(e => yrSet.add(new Date(e.date).getFullYear()));
        
        return Array.from(yrSet).sort((a, b) => b - a);
    }, [invoices, agencyPayments, dailyExpenses]);

    const [selectedYear, setSelectedYear] = useState<number | 'all'>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');

    const months = [
        { value: 0, label: 'January' },
        { value: 1, label: 'February' },
        { value: 2, label: 'March' },
        { value: 3, label: 'April' },
        { value: 4, label: 'May' },
        { value: 5, label: 'June' },
        { value: 6, label: 'July' },
        { value: 7, label: 'August' },
        { value: 8, label: 'September' },
        { value: 9, label: 'October' },
        { value: 10, label: 'November' },
        { value: 11, label: 'December' }
    ];

    // Filter and compute statistics
    const filteredStats = useMemo(() => {
        let salesRevenue = 0;
        let cogs = 0; // Cost of goods sold based on product purchase_price
        let operatingExpenses = 0;
        let stockPurchasedCost = 0; // Total actually spent on purchasing stock from agency
        let invoicesCount = 0;
        let purchasesCount = 0;
        let expensesCount = 0;

        // Filter invoices by date
        invoices.forEach(inv => {
            const d = new Date(inv.date);
            const y = d.getFullYear();
            const m = d.getMonth();

            if (selectedYear !== 'all' && y !== selectedYear) return;
            if (selectedMonth !== 'all' && m !== selectedMonth) return;

            salesRevenue += inv.total_amount;
            invoicesCount++;

            // Calculate COGS if possible
            inv.items.forEach(item => {
                const prod = products.find(p => p.name === item.product_name);
                if (prod && prod.cost_price) {
                    cogs += prod.cost_price * item.quantity;
                } else {
                    // Fallback to 80% if purchase price not documented
                    cogs += item.price * 0.8 * item.quantity;
                }
            });
        });

        // Filter daily expenses
        dailyExpenses.forEach(exp => {
            const d = new Date(exp.date);
            const y = d.getFullYear();
            const m = d.getMonth();

            if (selectedYear !== 'all' && y !== selectedYear) return;
            if (selectedMonth !== 'all' && m !== selectedMonth) return;

            operatingExpenses += exp.amount;
            expensesCount++;
        });

        // Filter stock purchased costs
        agencyPayments.forEach(pay => {
            const d = new Date(pay.date);
            const y = d.getFullYear();
            const m = d.getMonth();

            if (selectedYear !== 'all' && y !== selectedYear) return;
            if (selectedMonth !== 'all' && m !== selectedMonth) return;

            stockPurchasedCost += pay.amount;
            purchasesCount++;
        });

        const grossProfit = salesRevenue - cogs;
        const netProfit = grossProfit - operatingExpenses;

        return {
            salesRevenue,
            cogs,
            operatingExpenses,
            stockPurchasedCost,
            grossProfit,
            netProfit,
            landedCostOfSales: cogs,
            invoicesCount,
            purchasesCount,
            expensesCount
        };
    }, [selectedYear, selectedMonth, invoices, dailyExpenses, agencyPayments, products]);

    const monthlyBreakdown = useMemo(() => {
        if (selectedYear === 'all') return [];

        return Array.from({ length: 12 }, (_, i) => {
            const monthIndex = i;
            const monthLabel = months.find(m => m.value === monthIndex)?.label ?? '';

            let sales = 0;
            let cogs = 0;
            let expenses = 0;
            let purchases = 0;

            invoices.forEach(inv => {
                const d = new Date(inv.date);
                if (d.getFullYear() !== selectedYear) return;
                if (d.getMonth() !== monthIndex) return;

                sales += inv.total_amount;
                inv.items.forEach(item => {
                    const prod = products.find(p => p.name === item.product_name);
                    if (prod && prod.cost_price) {
                        cogs += prod.cost_price * item.quantity;
                    } else {
                        cogs += item.price * 0.8 * item.quantity;
                    }
                });
            });

            dailyExpenses.forEach(exp => {
                const d = new Date(exp.date);
                if (d.getFullYear() !== selectedYear) return;
                if (d.getMonth() !== monthIndex) return;
                expenses += exp.amount;
            });

            agencyPayments.forEach(pay => {
                const d = new Date(pay.date);
                if (d.getFullYear() !== selectedYear) return;
                if (d.getMonth() !== monthIndex) return;
                purchases += pay.amount;
            });

            const gross = sales - cogs;
            const net = gross - expenses;

            return {
                month: monthLabel,
                monthIndex,
                sales,
                purchases,
                cogs,
                expenses,
                gross,
                net
            };
        }).filter(m => m.sales > 0 || m.purchases > 0 || m.expenses > 0);
    }, [selectedYear, invoices, agencyPayments, dailyExpenses, products]);

    // Print Financial Ledger Statement
    const handlePrintLedger = () => {
        const periodLabel = selectedYear === 'all' 
            ? 'All Time Financial Report'
            : `${months.find(m => m.value === selectedMonth)?.label ?? ''} ${selectedYear} Financial Statement`;

        const tableRows = monthlyBreakdown.map(m => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eaecf0;">${m.month}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eaecf0; text-align: right; font-family: monospace;">Rs ${m.sales.toLocaleString()}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eaecf0; text-align: right; font-family: monospace;">Rs ${m.purchases.toLocaleString()}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eaecf0; text-align: right; font-family: monospace;">Rs ${m.expenses.toLocaleString()}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eaecf0; text-align: right; font-family: monospace; font-weight: bold; color: ${m.gross >= 0 ? '#027a48' : '#b42318'};">Rs ${m.gross.toLocaleString()}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eaecf0; text-align: right; font-family: monospace; font-weight: bold; color: ${m.net >= 0 ? '#027a48' : '#b42318'};">Rs ${m.net.toLocaleString()}</td>
            </tr>
        `).join('');

        printHtml(`
            <html>
            <head>
                <title>Business Ledger - ${periodLabel}</title>
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 40px; color: #101828; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eaecf0; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { margin: 0; font-size: 24px; font-weight: 800; color: #7F56D9; }
                    .header p { margin: 4px 0 0 0; font-size: 14px; color: #475467; }
                    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
                    .kpi-card { border: 1px solid #eaecf0; border-radius: 12px; padding: 20px; background: #f8f9fc; }
                    .kpi-title { font-size: 11px; font-weight: bold; color: #475467; text-transform: uppercase; margin-bottom: 8px; }
                    .kpi-value { font-size: 20px; font-weight: 800; font-family: monospace; }
                    .statement-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    .statement-table th { background: #f8f9fc; padding: 10px; border-bottom: 2px solid #eaecf0; text-align: left; font-size: 12px; font-weight: bold; color: #475467; }
                    .footer { text-align: center; margin-top: 60px; font-size: 12px; color: #475467; border-top: 1px solid #eaecf0; padding-top: 20px; }
                </style>
            </head>
            <body onload="window.print()">
                <div class="header">
                    <div>
                        <h1>DISTRIBUTION BUSINESS LEDGER</h1>
                        <p>Annual &amp; Monthly Performance Summary</p>
                    </div>
                    <div style="text-align: right;">
                        <p><strong>Statement Period:</strong> ${periodLabel}</p>
                        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-title">Total Sales Revenue</div>
                        <div class="kpi-value" style="color: #7F56D9;">Rs ${filteredStats.salesRevenue.toLocaleString()}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Acquired Stock (Purchases)</div>
                        <div class="kpi-value">Rs ${filteredStats.stockPurchasedCost.toLocaleString()}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Operating Expenses</div>
                        <div class="kpi-value" style="color: #b42318;">Rs ${filteredStats.operatingExpenses.toLocaleString()}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Net Cash Profit</div>
                        <div class="kpi-value" style="color: ${filteredStats.netProfit >= 0 ? '#027a48' : '#b42318'};">Rs ${filteredStats.netProfit.toLocaleString()}</div>
                    </div>
                </div>

                ${monthlyBreakdown.length > 0 ? `
                    <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 15px;">Monthly Performance History</h3>
                    <table class="statement-table">
                        <thead>
                            <tr>
                                <th>Month</th>
                                <th style="text-align: right;">Sales</th>
                                <th style="text-align: right;">Stock Acquired</th>
                                <th style="text-align: right;">Expenses</th>
                                <th style="text-align: right;">Gross Profit</th>
                                <th style="text-align: right;">Net Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                ` : ''}

                <div class="footer">
                    <p>Distribution POS Bookkeeping System - Verified Accountant Statement</p>
                </div>
            </body>
            </html>
        `);
    };

    const grossMarginPercent = filteredStats.salesRevenue > 0 
        ? ((filteredStats.grossProfit / filteredStats.salesRevenue) * 100).toFixed(1)
        : '0.0';

    const netMarginPercent = filteredStats.salesRevenue > 0
        ? ((filteredStats.netProfit / filteredStats.salesRevenue) * 100).toFixed(1)
        : '0.0';

    return (
        <div className="space-y-6">
            {/* Header Title & Print Button */}
            <div className="flex justify-between items-center bg-card p-6 rounded-2xl shadow-sm border border-border">
                <div>
                    <h2 className="text-2xl font-extrabold text-[#101828] dark:text-white">Business Ledger Statements</h2>
                    <p className="text-muted-foreground text-sm">Review full business volumes, investments, P&amp;L, and margins</p>
                </div>
                <button onClick={handlePrintLedger} className="text-white px-4 py-2 rounded-xl font-bold transition flex gap-2 items-center text-sm" style={{background:'#7F56D9',boxShadow:'0 1px 3px rgba(127,86,217,0.3)'}}>
                    <Printer className="w-4 h-4" /> Print Statement
                </button>
            </div>

            {/* Financial Filters */}
            <div className="bg-card rounded-2xl border border-border p-5 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-semibold text-muted-foreground">Financial Year</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setSelectedYear('all'); setSelectedMonth('all'); }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${selectedYear === 'all' ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}>
                        All Time
                    </button>
                    {years.map(y => (
                        <button key={y} onClick={() => { setSelectedYear(y); setSelectedMonth('all'); }}
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition ${selectedYear === y ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}>
                            {y}
                        </button>
                    ))}
                </div>

                {selectedYear !== 'all' && (
                    <>
                        <span className="text-border">|</span>
                        <div className="flex gap-1.5 flex-wrap items-center">
                            <button onClick={() => setSelectedMonth('all')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${selectedMonth === 'all' ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}>
                                All Months
                            </button>
                            {months.map(m => (
                                <button key={m.value} onClick={() => setSelectedMonth(m.value)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${selectedMonth === m.value ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}>
                                    {m.label.substring(0, 3)}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* P&L Financial Dashboard Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* sales */}
                <div className="bg-card p-6 rounded-2xl border border-border flex flex-col justify-between shadow-sm">
                    <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Business Sales Volume</span>
                        <h2 className="text-2xl font-extrabold text-[#5f69e1] font-mono mt-1">Rs {filteredStats.salesRevenue.toLocaleString()}</h2>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-3 flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5" /> {filteredStats.invoicesCount} Cash Memos Generated
                    </p>
                </div>

                {/* investment */}
                <div className="bg-card p-6 rounded-2xl border border-border flex flex-col justify-between shadow-sm">
                    <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Stock Investment</span>
                        <h2 className="text-2xl font-extrabold text-foreground font-mono mt-1">Rs {filteredStats.stockPurchasedCost.toLocaleString()}</h2>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-3 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" /> COGS (Landed Cost of Sales): Rs {filteredStats.landedCostOfSales.toLocaleString()}
                    </p>
                </div>

                {/* gross profit */}
                <div className="bg-card p-6 rounded-2xl border border-border flex flex-col justify-between shadow-sm">
                    <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Gross Margin profit</span>
                        <h2 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-1">Rs {filteredStats.grossProfit.toLocaleString()}</h2>
                    </div>
                    <p className="text-[10px] text-emerald-600 font-bold mt-3 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" /> {grossMarginPercent}% Gross Profit Margin
                    </p>
                </div>

                {/* net profit */}
                <div className="bg-card p-6 rounded-2xl border border-border flex flex-col justify-between shadow-sm">
                    <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Net business Cash profit</span>
                        <h2 className={`text-2xl font-extrabold font-mono mt-1 ${filteredStats.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>Rs {filteredStats.netProfit.toLocaleString()}</h2>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-3 flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5" /> Expenses: Rs {filteredStats.operatingExpenses.toLocaleString()} · {netMarginPercent}% Net
                    </p>
                </div>
            </div>

            {/* Monthly Ledger Statement Table */}
            {selectedYear !== 'all' && (
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-border flex items-center justify-between bg-muted/20">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-indigo-500" />
                            <h3 className="text-sm font-bold text-foreground">Monthly Breakdown for {selectedYear}</h3>
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground bg-card border border-border px-2.5 py-0.5 rounded-full shadow-sm">{monthlyBreakdown.length} months active</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[850px]">
                            <thead className="bg-muted/50 text-muted-foreground font-bold">
                                <tr>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase">Month</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase text-right">Sales Revenue</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase text-right">Stock Purchased</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase text-right">Landed Cost (COGS)</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase text-right">Operating Expenses</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase text-right">Gross Profit</th>
                                    <th className="px-6 py-3 font-semibold text-xs uppercase text-right">Net Profit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {monthlyBreakdown.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground italic">No transactions recorded for the year {selectedYear}.</td>
                                    </tr>
                                ) : (
                                    monthlyBreakdown.map(m => (
                                        <tr key={m.month} className="hover:bg-muted/50 transition">
                                            <td className="px-6 py-4 font-bold text-foreground">{m.month}</td>
                                            <td className="px-6 py-4 text-right font-mono font-medium text-foreground">Rs {m.sales.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono text-muted-foreground">Rs {m.purchases.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono text-muted-foreground">Rs {m.cogs.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono text-rose-500">Rs {m.expenses.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">Rs {m.gross.toLocaleString()}</td>
                                            <td className={`px-6 py-4 text-right font-mono font-extrabold ${m.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>Rs {m.net.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
