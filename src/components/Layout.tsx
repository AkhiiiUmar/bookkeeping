import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
    LayoutDashboard, Users, FileText, Receipt, BookOpen, Package, BarChart3, 
    Wallet, Settings, LogOut, Bell, HelpCircle, TrendingUp,
    ChevronLeft, ChevronRight, Wifi, WifiOff, Loader2, Menu, X, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    const [userEmail, setUserEmail] = useState('admin@pos.com');
    const [userName, setUserName] = useState('Olivia Rhye');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const { offlineQueue, syncOfflineQueue, clearSyncQueue, lastSyncError } = useStore();
    const [showSyncError, setShowSyncError] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const syncErrorRef = useRef<HTMLDivElement>(null);

    // Close popover when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (syncErrorRef.current && !syncErrorRef.current.contains(e.target as Node)) {
                setShowSyncError(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    async function handleSyncRetry() {
        setIsSyncing(true);
        setShowSyncError(false);
        try {
            await syncOfflineQueue();
        } finally {
            setIsSyncing(false);
        }
    }

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Auto-retry sync when we come back online
            const { offlineQueue } = useStore.getState();
            if (offlineQueue.length > 0) {
                syncOfflineQueue();
            }
        };
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [syncOfflineQueue]);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                setUserEmail(user.email || 'admin@pos.com');
                const namePart = user.email ? user.email.split('@')[0] : 'admin';
                setUserName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
            }
        });
    }, []);

    async function handleSignOut() {
        await supabase.auth.signOut();
        navigate('/');
    }

    const navItems = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Roz Namcha (Orders)', path: '/orders', icon: BookOpen },
        { name: 'Cash Memo (Invoices)', path: '/invoices', icon: Receipt },
        { name: 'Payments', path: '/payments', icon: FileText },
        { name: 'Shopkeepers & Ledger', path: '/shopkeepers', icon: Users },
        { name: 'Inventory & Agencies', path: '/inventory', icon: Package },
        { name: 'Daily Expenses', path: '/expenses', icon: Wallet },
        { name: 'Business Ledger (P&L)', path: '/business-ledger', icon: TrendingUp },
        { name: 'Analytics & Calendar', path: '/analytics', icon: BarChart3 },
        { name: 'Settings & Backups', path: '/settings', icon: Settings },
    ];

    const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase() || 'O';

    return (
        <div className="flex h-screen bg-background font-sans overflow-hidden relative">
            {/* Mobile Sidebar Overlay Backdrop */}
            {isMobileOpen && (
                <div 
                    className="fixed inset-0 bg-black/40 z-40 md:hidden animate-fadeIn" 
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`bg-white border-r border-slate-200 flex flex-col h-full z-50 md:z-20 transition-all duration-300 fixed md:static inset-y-0 left-0 ${
                isMobileOpen ? 'translate-x-0' : '-translate-x-full'
            } md:translate-x-0 ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'} w-64`}>
                
                {/* Collapse Toggle */}
                <button 
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="absolute -right-3 top-6 bg-white border border-slate-200 rounded-full p-1 text-slate-400 hover:text-slate-600 z-30 shadow-sm hidden md:block"
                >
                    {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>

                {/* Brand Selector Header */}
                <div className={`p-6 border-b border-slate-100 flex items-center ${isSidebarCollapsed ? 'md:justify-center md:px-4' : 'justify-between'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100 flex-shrink-0">
                            <span className="font-bold text-sm text-indigo-600">DP</span>
                        </div>
                        {(!isSidebarCollapsed || isMobileOpen) && (
                            <div className="min-w-0 transition-opacity duration-300">
                                <h2 className="text-sm font-bold text-slate-900 truncate">Distribution POS</h2>
                                <p className="text-[10px] text-slate-400 font-medium truncate">Bookkeeping & Analytics</p>
                            </div>
                        )}
                    </div>
                    {/* Mobile Close Button */}
                    <button 
                        onClick={() => setIsMobileOpen(false)} 
                        className="p-1 md:hidden text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation Menu */}
                <nav className={`flex-1 space-y-1.5 mt-6 overflow-y-auto ${isSidebarCollapsed ? 'md:px-2' : 'px-3'}`}>
                    {(!isSidebarCollapsed || isMobileOpen) && <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase px-4.5 block mb-2.5 transition-opacity duration-300">Main Menu</span>}
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                        const showText = !isSidebarCollapsed || isMobileOpen;
                        return (
                            <Link
                                key={item.name}
                                to={item.path}
                                title={isSidebarCollapsed ? item.name : undefined}
                                onClick={() => setIsMobileOpen(false)}
                                className={`flex items-center gap-3 transition-all duration-150 relative text-sm ${
                                    isSidebarCollapsed 
                                        ? 'md:justify-center md:p-3 p-3.5 py-2.5 rounded-xl' 
                                        : 'px-4 py-2.5 rounded-xl'
                                } ${
                                    isActive 
                                        ? 'bg-[#F4EBFF] text-[#6941C6]' 
                                        : 'text-[#535862] hover:bg-[#F5F5F5] hover:text-[#181D27]'
                                }`}
                            >
                                {/* Left active accent bar */}
                                {isActive && !isSidebarCollapsed && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#7F56D9] rounded-r-full" />
                                )}
                                <item.icon className={`h-4.5 w-4.5 flex-shrink-0 transition-colors ${isActive ? 'text-[#7F56D9]' : 'text-[#A4A7AE]'}`} />
                                {showText && <span className="truncate font-medium">{item.name}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom User Profile Section */}
                <div className={`p-4 border-t border-slate-100 flex items-center bg-white ${isSidebarCollapsed ? 'md:justify-center md:flex-col md:gap-3' : 'justify-between'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 flex-shrink-0">
                            <span className="font-bold text-sm text-indigo-600">{initials}</span>
                        </div>
                        {(!isSidebarCollapsed || isMobileOpen) && (
                            <div className="min-w-0">
                                <h4 className="text-xs font-bold text-slate-700 truncate">{userName}</h4>
                                <p className="text-[10px] text-slate-400 font-medium truncate">{userEmail}</p>
                            </div>
                        )}
                    </div>
                    <button onClick={handleSignOut} title="Sign Out" className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Global Top Navbar */}
                <header className="bg-white border-b border-slate-100 px-3 sm:px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button 
                            onClick={() => setIsMobileOpen(true)}
                            className="p-2 -ml-1 text-slate-400 hover:text-slate-700 md:hidden rounded-lg hover:bg-slate-50 flex-shrink-0"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="min-w-0">
                            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider hidden md:inline">Workspace</span>
                            <h3 className="text-sm md:text-base font-bold text-slate-800 capitalize flex items-center gap-1.5 truncate max-w-[150px] sm:max-w-xs md:max-w-none">
                                {location.pathname === '/' ? 'Dashboard' : location.pathname.substring(1).replace(/-/g, ' ')}
                            </h3>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 md:gap-4 flex-shrink-0">
                        {/* Network Status Indicator */}
                        <div className="flex items-center">
                            {!isOnline ? (
                                <div className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-[10px] font-bold">
                                    <WifiOff className="w-3 h-3 flex-shrink-0" />
                                    <span className="hidden sm:inline">Offline</span>
                                    {offlineQueue.length > 0 && (
                                        <span className="bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[9px]">
                                            {offlineQueue.length}
                                        </span>
                                    )}
                                </div>
                            ) : offlineQueue.length > 0 ? (
                                <div className="relative flex items-center gap-1" ref={syncErrorRef}>
                                    <button
                                        onClick={() => setShowSyncError(v => !v)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-colors ${
                                            lastSyncError
                                                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                                                : 'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100'
                                        }`}
                                    >
                                        {isSyncing
                                            ? <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                                            : lastSyncError
                                                ? <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                                : <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                                        }
                                        <span className="hidden sm:inline">{lastSyncError ? 'Sync Failed' : 'Syncing...'} ({offlineQueue.length})</span>
                                        <span className="sm:hidden">{offlineQueue.length}</span>
                                    </button>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); clearSyncQueue(); setShowSyncError(false); }}
                                        title="Discard stuck sync items"
                                        className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-500 hover:bg-red-200 hover:text-red-700 transition-colors flex-shrink-0"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>

                                    {showSyncError && (
                                        <div className="absolute right-0 top-full mt-2 w-72 md:w-80 bg-white border border-red-200 rounded-xl shadow-xl z-50 p-4">
                                            <div className="flex items-start gap-2 mb-3">
                                                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-red-600 mb-1">Sync Error Details</p>
                                                    {lastSyncError && (
                                                        <p className="text-[11px] text-slate-600 font-mono break-all leading-relaxed">{lastSyncError}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-500 border-t border-slate-100 pt-2 mb-3">
                                                <strong>{offlineQueue.length}</strong> item(s) pending. Data is saved locally.
                                                {lastSyncError && ' The ✕ button next to the badge will discard stuck items.'}
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { setShowSyncError(false); handleSyncRetry(); }}
                                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                                                >
                                                    <RefreshCw className="w-3 h-3" /> Retry Sync
                                                </button>
                                                <button
                                                    onClick={() => { clearSyncQueue(); setShowSyncError(false); }}
                                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors"
                                                >
                                                    Discard All
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                 <div className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 text-slate-400 text-[10px] font-medium">
                                    <Wifi className="w-3 h-3" />
                                    <span className="hidden sm:inline">Online</span>
                                </div>
                            )}
                        </div>

                        <div className="w-px h-6 bg-slate-200"></div>

                        <button title="Notifications" className="p-1.5 md:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors relative">
                            <Bell className="w-4 md:w-5 h-4 md:h-5" />
                            <span className="absolute top-1 right-1 md:top-1.5 md:right-1.5 w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-red-500 animate-pulse" />
                        </button>
                        <button title="Help & Documentation" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors hidden sm:block">
                            <HelpCircle className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Dynamic Page Container */}
                <div className="flex-1 overflow-auto" style={{background:'#F5F5F5'}}>
                    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 md:space-y-6">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}
