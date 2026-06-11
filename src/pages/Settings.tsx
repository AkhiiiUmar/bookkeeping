import { useState } from 'react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import {
    Settings as SettingsIcon, Bell, Mail, LogOut,
    Trash2, AlertTriangle, ShieldAlert, CheckCircle, RefreshCw, Send,
    Lock, Eye, EyeOff
} from 'lucide-react';

interface ReminderSettings {
    enableEmails: boolean;
    enableWhatsApp: boolean;
    reminderEmail: string;
    thresholdDays: number;
}

export default function Settings() {
    const shopkeepers = useStore(s => s.shopkeepers);
    const invoices = useStore(s => s.invoices);
    const resetAllData = useStore(s => s.resetAllData);

    // Theme is permanently dark

    // 2. Reminder Settings State
    const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(() => {
        const stored = localStorage.getItem('pos-reminder-settings');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error(e);
            }
        }
        return {
            enableEmails: true,
            enableWhatsApp: true,
            reminderEmail: '',
            thresholdDays: 15
        };
    });

    // 3. Danger Zone Reset State
    const [confirmText, setConfirmText] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetSuccess, setResetSuccess] = useState(false);
    const [resetError, setResetError] = useState('');

    // 5. Password Update State
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [passLoading, setPassLoading] = useState(false);
    const [passSuccess, setPassSuccess] = useState('');
    const [passError, setPassError] = useState('');

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPassError('');
        setPassSuccess('');

        if (newPassword.length < 6) {
            setPassError('Password must be at least 6 characters long.');
            return;
        }

        if (newPassword !== confirmNewPassword) {
            setPassError('Passwords do not match.');
            return;
        }

        setPassLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            setPassSuccess('Your password has been updated successfully!');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (err: any) {
            setPassError(err.message || 'Failed to update password');
        } finally {
            setPassLoading(false);
        }
    };

    // Save reminder settings
    const saveReminderSettings = (updated: ReminderSettings) => {
        setReminderSettings(updated);
        localStorage.setItem('pos-reminder-settings', JSON.stringify(updated));
    };

    // Theme is globally enforced to dark mode

    // Handle Logout
    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to sign out from Distribution POS?')) {
            await supabase.auth.signOut();
        }
    };

    // Handle Safe Factory Reset
    const handleFactoryReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (confirmText !== 'DELETE ALL DATA') return;

        if (!window.confirm('CRITICAL WARNING: Are you absolutely sure you want to proceed? This will delete all agencies, products, transactions, and shopkeeper logs permanently!')) {
            return;
        }

        setResetLoading(true);
        setResetError('');
        setResetSuccess(false);

        try {
            await resetAllData();
            setResetSuccess(true);
            setConfirmText('');
        } catch (err: any) {
            setResetError(err.message || 'Failed to factory reset the database.');
        } finally {
            setResetLoading(false);
        }
    };

    // Calculate pending/overdue shopkeepers based on settings
    const overdueShopkeepers = (() => {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - reminderSettings.thresholdDays);

        return shopkeepers.filter(s => s.current_balance > 0).map(s => {
            // Find invoices for this shopkeeper to see oldest unpaid balance
            const shopkeeperInvoices = invoices
                .filter(i => i.shopkeeper_id === s.id)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const oldestInvoice = shopkeeperInvoices[0];
            const daysOverdue = oldestInvoice
                ? Math.floor((Date.now() - new Date(oldestInvoice.date).getTime()) / (1000 * 60 * 60 * 24))
                : 0;

            const isOverdue = daysOverdue >= reminderSettings.thresholdDays;

            return {
                ...s,
                daysOverdue,
                isOverdue,
                oldestInvoiceDate: oldestInvoice ? new Date(oldestInvoice.date).toLocaleDateString() : 'N/A'
            };
        }).filter(s => s.isOverdue).sort((a, b) => b.daysOverdue - a.daysOverdue);
    })();

    // WhatsApp Reminder share link generator
    const getWhatsAppLink = (name: string, phone: string | undefined, balance: number, days: number) => {
        if (!phone) return null;
        const msg = `Dear ${name},\nThis is a gentle payment reminder from Distribution POS. You have an outstanding pending balance of Rs ${balance.toLocaleString()} which is currently overdue by ${days} days.\nKindly arrange for the payment collection at your earliest convenience.\nThank you!`;
        return `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
    };

    // Email Reminder generator
    const getEmailLink = (name: string, balance: number, days: number) => {
        const subject = `Pending Balance Overdue Notice - ${name}`;
        const body = `Dear ${name},\n\nThis is an automated payment alert from Distribution POS.\n\nOur records show a pending balance of Rs ${balance.toLocaleString()} which has been outstanding for more than ${days} days.\n\nPlease reply to this email or contact us directly to coordinate the payment collection.\n\nBest Regards,\nPOS Distribution Team`;
        return `mailto:${reminderSettings.reminderEmail || 'info@distribution.com'}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-primary tracking-tight flex items-center gap-2">
                        <SettingsIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        Application Settings
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Manage theme preferences, automated overdue payment reminders, secure session logouts, and database backups.
                    </p>
                </div>
            </div>

            {/* Config Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Theme & Notifications */}
                <div className="space-y-8">
                    {/* Theme configuration removed as Dark Mode is permanently enforced globally */}

                    {/* 2. Automated Reminders Card */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
                        <div>
                            <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                                <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                Payment Reminders & Alerts
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Customize metrics for overdue payment collections and generate reminders.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {/* Overdue Threshold */}
                            <div>
                                <label className="block text-xs font-semibold text-foreground mb-2">
                                    Overdue Threshold (Days Pending)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={reminderSettings.thresholdDays}
                                    onChange={e => saveReminderSettings({ ...reminderSettings, thresholdDays: parseInt(e.target.value) || 1 })}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-foreground"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Shopkeepers with unpaid invoices older than this number will be flagged as overdue.
                                </p>
                            </div>

                            {/* Default Target Email */}
                            <div>
                                <label className="block text-xs font-semibold text-foreground mb-2">
                                    Reminders Target Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="email"
                                        placeholder="your-reminders@mail.com"
                                        value={reminderSettings.reminderEmail}
                                        onChange={e => saveReminderSettings({ ...reminderSettings, reminderEmail: e.target.value })}
                                        className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-foreground"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Email address pre-filled when sending emails to collection agents or shopkeepers.
                                </p>
                            </div>

                            {/* Action Switches */}
                            <div className="pt-2 space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={reminderSettings.enableWhatsApp}
                                        onChange={e => saveReminderSettings({ ...reminderSettings, enableWhatsApp: e.target.checked })}
                                        className="rounded border-border bg-background text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                    />
                                    <span className="text-xs text-foreground">Enable WhatsApp quick-action alerts</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={reminderSettings.enableEmails}
                                        onChange={e => saveReminderSettings({ ...reminderSettings, enableEmails: e.target.checked })}
                                        className="rounded border-border bg-background text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                    />
                                    <span className="text-xs text-foreground">Enable dynamic Email collection notifications</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* 3. Change Password Card */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
                        <div>
                            <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                                <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                Change Account Password
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Update your password directly without sending any email recovery links.
                            </p>
                        </div>

                        {passSuccess && (
                            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 p-3 rounded-xl text-xs font-semibold">
                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                {passSuccess}
                            </div>
                        )}

                        {passError && (
                            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-305 p-3 rounded-xl text-xs font-semibold animate-pulse">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                {passError}
                            </div>
                        )}

                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-foreground mb-2">New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl pl-11 pr-12 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition text-foreground"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                                    >
                                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-foreground mb-2">Confirm New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                        value={confirmNewPassword}
                                        onChange={e => setConfirmNewPassword(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl pl-11 pr-12 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition text-foreground"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={passLoading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed border border-border text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
                            >
                                {passLoading ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        Updating Password...
                                    </>
                                ) : (
                                    'Update Password'
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Column: Collection Preview & Danger Zone */}
                <div className="space-y-8">
                    {/* 3. Pending Overdue Preview */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                        <div>
                            <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                                <Send className="w-5 h-5 text-indigo-650 dark:text-indigo-400" />
                                Payment Collection Center
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Live preview of active shopkeepers with balances overdue by more than {reminderSettings.thresholdDays} days.
                            </p>
                        </div>

                        <div className="divide-y divide-border max-h-60 overflow-y-auto pr-1 space-y-3">
                            {overdueShopkeepers.length === 0 ? (
                                <div className="text-center py-8 text-xs text-muted-foreground italic">
                                    All clear! No pending payments currently exceed your overdue threshold.
                                </div>
                            ) : overdueShopkeepers.map(s => (
                                <div key={s.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 first:pt-0 gap-3">
                                    <div>
                                        <h4 className="text-xs font-bold text-foreground">{s.name}</h4>
                                        <div className="flex gap-2 items-center text-[10px] text-muted-foreground mt-0.5">
                                            <span>Oldest invoice: {s.oldestInvoiceDate}</span>
                                            <span>•</span>
                                            <span className="text-red-500 dark:text-red-400 font-semibold">{s.daysOverdue} days overdue</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <span className="text-xs font-extrabold font-mono text-foreground mr-2">Rs {s.current_balance.toLocaleString()}</span>
                                        {reminderSettings.enableWhatsApp && s.phone && (
                                            <a
                                                href={getWhatsAppLink(s.name, s.phone, s.current_balance, s.daysOverdue) || '#'}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded text-[10px] font-bold border border-emerald-200 dark:border-emerald-900 transition flex items-center gap-1"
                                            >
                                                WhatsApp
                                            </a>
                                        )}
                                        {reminderSettings.enableEmails && (
                                            <a
                                                href={getEmailLink(s.name, s.current_balance, s.daysOverdue)}
                                                className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-650 dark:text-indigo-400 px-2 py-1 rounded text-[10px] font-bold border border-indigo-200 dark:border-indigo-900 transition flex items-center gap-1"
                                            >
                                                Email
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 4. Danger Zone & Logout */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
                        <div>
                            <h3 className="font-bold text-red-600 dark:text-red-400 text-base flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5" />
                                Security & Danger Zone
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Securely sign out from your active POS session or erase all database logs.
                            </p>
                        </div>

                        {/* Sign Out Action */}
                        <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-xl">
                            <div>
                                <span className="text-sm font-semibold text-foreground block">Sign Out</span>
                                <span className="text-[10px] text-muted-foreground">Exit your active session securely</span>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 py-2 rounded-xl text-xs transition shadow-sm"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                Log Out
                            </button>
                        </div>

                        {/* Reset DB Action */}
                        <div className="border-t border-border pt-6 space-y-4">
                            <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 p-4 rounded-xl text-xs space-y-2">
                                <div className="flex items-center gap-2 font-bold">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                    CRITICAL WARNING: FACTORY RESET
                                </div>
                                <p className="leading-relaxed">
                                    This action will **permanently erase** all your products, agencies, sales invoices, ledger statements, payments, daily expenses, and shopkeeper logs. This action cannot be reversed.
                                </p>
                            </div>

                            {/* Deletion feedback alerts */}
                            {resetSuccess && (
                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 p-3 rounded-xl text-xs font-semibold">
                                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                    Factory reset complete! All database data has been securely deleted.
                                </div>
                            )}

                            {resetError && (
                                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 p-3 rounded-xl text-xs font-semibold">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                    {resetError}
                                </div>
                            )}

                            <form onSubmit={handleFactoryReset} className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-semibold text-muted-foreground mb-2">
                                        Type <span className="font-mono text-red-600 dark:text-red-400 font-bold select-none">DELETE ALL DATA</span> to unlock factory reset
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Type exactly: DELETE ALL DATA"
                                        value={confirmText}
                                        onChange={e => setConfirmText(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs font-semibold text-red-600 placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500/30"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={confirmText !== 'DELETE ALL DATA' || resetLoading}
                                    className="w-full bg-red-600 hover:bg-red-500 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed border border-border text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
                                >
                                    {resetLoading ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            Erasing Database...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Erase Database & Factory Reset
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
