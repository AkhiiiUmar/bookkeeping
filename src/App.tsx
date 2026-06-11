import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useStore } from './store/useStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import DataMigration from './components/DataMigration';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Invoices from './pages/Invoices';
import Shopkeepers from './pages/Shopkeepers';
import Payments from './pages/Payments';
import Inventory from './pages/Inventory';
import Ledger from './pages/Ledger';
import Analytics from './pages/Analytics';
import Expenses from './pages/Expenses';
import AgencyLedger from './pages/AgencyLedger';
import Settings from './pages/Settings';
import BusinessLedger from './pages/BusinessLedger';

type AppPhase = 'checking' | 'login' | 'migrate' | 'loading' | 'ready' | 'reset-password';

function App() {
    const [phase, setPhase] = useState<AppPhase>('checking');
    const { isLoading, loadError, loadData } = useStore();

    // Check auth state on mount
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                // Check if there's old localStorage data to migrate
                const oldData = localStorage.getItem('pos-storage');
                if (oldData) {
                    setPhase('migrate');
                } else {
                    setPhase('loading');
                    loadData();
                }
            } else {
                // If completely offline and local cached POS data exists, bypass remote session requirement
                const hasLocalData = localStorage.getItem('pos-offline-storage');
                if (!navigator.onLine && hasLocalData) {
                    console.log('Offline startup fallback: Bypassing auth check since local data exists.');
                    setPhase('loading');
                    loadData();
                } else {
                    setPhase('login');
                }
            }
        }).catch((err) => {
            console.error('Auth session query failed, trying offline fallback:', err);
            const hasLocalData = localStorage.getItem('pos-offline-storage');
            if (hasLocalData) {
                setPhase('loading');
                loadData();
            } else {
                setPhase('login');
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setPhase('reset-password');
            } else if (!session) {
                setPhase('login');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // When phase becomes 'loading', watch for store to finish
    useEffect(() => {
        if (phase === 'loading' && !isLoading) {
            setPhase('ready');
        }
    }, [phase, isLoading]);

    // Setup global network event listeners for offline PWA sync
    useEffect(() => {
        const handleOnline = () => {
            console.log('App is back online! Syncing offline queue...');
            useStore.getState().syncOfflineQueue().then(() => {
                // Optionally reload data after sync to ensure perfect consistency
                useStore.getState().loadData();
            });
        };
        
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    // Phase: Checking auth
    if (phase === 'checking') {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    // Phase: Login
    if (phase === 'login') {
        return (
            <Login onAuth={() => {
                const oldData = localStorage.getItem('pos-storage');
                if (oldData) {
                    setPhase('migrate');
                } else {
                    setPhase('loading');
                    loadData();
                }
            }} />
        );
    }

    // Phase: Data Migration
    if (phase === 'migrate') {
        return (
            <DataMigration onComplete={() => {
                setPhase('loading');
                loadData();
            }} />
        );
    }

    // Phase: Password recovery / reset
    if (phase === 'reset-password') {
        return (
            <ResetPassword onComplete={() => {
                setPhase('loading');
                loadData();
            }} />
        );
    }

    // Phase: Loading data from Supabase
    if (phase === 'loading' || isLoading) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm">Loading your data...</p>
                </div>
            </div>
        );
    }

    // Phase: Error
    if (loadError) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="bg-card rounded-2xl shadow-xl border border-red-500/20 p-8 max-w-md w-full text-center">
                    <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-red-500 dark:text-red-400 text-2xl font-bold">!</span>
                    </div>
                    <h2 className="text-lg font-bold text-foreground mb-2">Connection Error</h2>
                    <p className="text-muted-foreground text-sm mb-4">{loadError}</p>
                    <button onClick={() => { loadData(); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition text-sm">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // Phase: Ready — render the app
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="orders" element={<Orders />} />
                    <Route path="invoices" element={<Invoices />} />
                    <Route path="shopkeepers" element={<Shopkeepers />} />
                    <Route path="shopkeepers/:id" element={<Ledger />} />
                    <Route path="payments" element={<Payments />} />
                    <Route path="inventory" element={<Inventory />} />
                    <Route path="agencies/:id" element={<AgencyLedger />} />
                    <Route path="expenses" element={<Expenses />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="business-ledger" element={<BusinessLedger />} />
                    <Route path="settings" element={<Settings />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
