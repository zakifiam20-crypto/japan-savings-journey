import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Transaction, User, GOAL_AMOUNT, INDIVIDUAL_GOAL } from './types';
import { 
  Plus, 
  History, 
  TrendingUp, 
  Users, 
  Camera, 
  LogOut, 
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, isWithinInterval } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function App() {
  const [started, setStarted] = useState(() => localStorage.getItem('japan-journey-started') === 'true');
  const [user, setUser] = useState<User | null>(() => localStorage.getItem('japan-journey-user') as User | null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    image: null as File | null
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    localStorage.setItem('japan-journey-started', started.toString());
  }, [started]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('japan-journey-user', user);
    } else {
      localStorage.removeItem('japan-journey-user');
    }
  }, [user]);

  useEffect(() => {
    fetchTransactions();
    
    // Request Notification Permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    
    // Real-time subscription
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `proofs/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('savings-proofs')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('savings-proofs')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      alert('Supabase belum dikonfigurasi. Silakan atur API Key di menu Secrets.');
      return;
    }
    if (!user || !formData.amount) return;

    setSubmitting(true);
    try {
      let imageUrl = null;
      if (formData.image) {
        imageUrl = await handleUpload(formData.image);
      }

      const { error } = await supabase.from('transactions').insert([
        {
          user_name: user,
          amount: parseFloat(formData.amount),
          date: formData.date,
          proof_image_url: imageUrl
        }
      ]);

      if (error) throw error;

      setFormData({
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        image: null
      });
      setIsAdding(false);
      fetchTransactions();
      alert('Tabungan berhasil disimpan! 🎉');
    } catch (err: any) {
      console.error('Error adding transaction:', err);
      alert(`Gagal menyimpan: ${err.message || 'Terjadi kesalahan'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const totalUser1 = transactions
    .filter(t => t.user_name === 'Fiam Zaki')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalUser2 = transactions
    .filter(t => t.user_name === 'Ario Maulana')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalCombined = totalUser1 + totalUser2;
  const progressPercent = Math.min((totalCombined / GOAL_AMOUNT) * 100, 100);

  // Prepare chart data (Last 8 weeks)
  const chartData = (() => {
    if (transactions.length === 0) return [];
    
    const now = new Date();
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(now.getDate() - (7 * 7)); // 8 weeks total including current

    const weeks = eachWeekOfInterval({
      start: startOfWeek(eightWeeksAgo),
      end: startOfWeek(now)
    });

    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart);
      const weekAmount = transactions
        .filter(t => {
          const d = new Date(t.date);
          return isWithinInterval(d, { start: weekStart, end: weekEnd });
        })
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        name: format(weekStart, 'dd MMM'),
        amount: weekAmount
      };
    });
  })();

  const lastWeekTransactions = transactions.filter(t => {
    const transDate = new Date(t.date);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return transDate >= oneWeekAgo;
  });

  const hasSavedThisWeek = lastWeekTransactions.length > 0;

  useEffect(() => {
    if (!loading && !hasSavedThisWeek && "Notification" in window && Notification.permission === "granted") {
      new Notification("Japan Savings Journey 🇯🇵", {
        body: "Sudah seminggu belum menabung nih! Yuk tambah tabunganmu biar cepat ke Jepang! 🏯",
        icon: "https://cdn-icons-png.flaticon.com/512/290/290116.png"
      });
    }
  }, [loading, hasSavedThisWeek]);

  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[url('https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-10 w-full max-w-lg relative z-10 text-center border-none bg-white/90"
        >
          <div className="w-24 h-24 bg-japan-red rounded-full mx-auto mb-8 flex items-center justify-center shadow-2xl shadow-japan-red/40">
            <TrendingUp className="text-white w-12 h-12" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Our Japan Saving Journey 🇯🇵</h1>
          <p className="text-slate-600 mb-10 text-lg leading-relaxed">
            Bismillah tidak ada halangan.
          </p>
          
          <button 
            onClick={() => setStarted(true)}
            className="w-full btn-primary text-xl py-4 flex items-center justify-center gap-3 group"
          >
            Continue to App
            <motion.div
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Plus className="w-6 h-6" />
            </motion.div>
          </button>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-japan-cream">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 w-full max-w-md relative z-10 text-center"
        >
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Who are you?</h2>
          <p className="text-slate-500 mb-8">Select your profile to start tracking</p>
          
          <div className="space-y-4">
            <button 
              onClick={() => setUser('Fiam Zaki')}
              className="w-full btn-primary flex items-center justify-center gap-3"
            >
              <Users className="w-5 h-5" />
              Fiam Zaki
            </button>
            <button 
              onClick={() => setUser('Ario Maulana')}
              className="w-full bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-2xl font-semibold transition-all hover:bg-slate-50 flex items-center justify-center gap-3 shadow-sm"
            >
              <Users className="w-5 h-5" />
              Ario Maulana
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-japan-red rounded-full flex items-center justify-center shadow-lg shadow-japan-red/20">
              <TrendingUp className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl hidden sm:block">Our Japan Journey 🇯🇵</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Logged in as</p>
              <p className="font-semibold text-japan-red">{user}</p>
            </div>
            <button 
              onClick={() => setUser(null)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Supabase Config Warning */}
        {!isSupabaseConfigured && (
          <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-red-800 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h3 className="font-bold text-lg">Supabase Belum Dikonfigurasi</h3>
            </div>
            <p className="text-sm leading-relaxed">
              Aplikasi ini membutuhkan Supabase untuk menyimpan data. Silakan atur <strong>VITE_SUPABASE_URL</strong> dan <strong>VITE_SUPABASE_ANON_KEY</strong> di menu Secrets AI Studio.
            </p>
          </div>
        )}

        {/* Inactivity Notification */}
        {!hasSavedThisWeek && !loading && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-4 text-amber-800 shadow-sm"
          >
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="font-bold">No savings this week! ⚠️</p>
              <p className="text-sm opacity-90">Don't let the dream fade. Let's add some savings to reach Japan! 🇯🇵</p>
            </div>
          </motion.div>
        )}

        {/* Goal Card */}
        <section className="glass-card p-8 overflow-hidden relative">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <h2 className="text-slate-500 font-medium mb-1">Total Savings Goal</h2>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-900">Rp {totalCombined.toLocaleString('id-ID')}</span>
                <span className="text-slate-400 font-medium">/ Rp {GOAL_AMOUNT.toLocaleString('id-ID')}</span>
              </div>
            </div>
            <div className="bg-japan-red/10 px-4 py-2 rounded-full">
              <span className="text-japan-red font-bold text-lg">{progressPercent.toFixed(1)}% Completed</span>
            </div>
          </div>

          <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden mb-8">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute top-0 left-0 h-full bg-japan-red shadow-[0_0_15px_rgba(188,0,45,0.4)]"
            />
          </div>

          {/* Savings Trend Chart */}
          <div className="mt-8">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Weekly Savings Trend</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#BC002D" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#BC002D" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                  />
                  <YAxis 
                    hide 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`Rp ${value.toLocaleString('id-ID')}`, 'Tabungan']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#BC002D" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorAmount)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Fiam Zaki Contribution</p>
                <p className="text-xl font-bold">Rp {totalUser1.toLocaleString('id-ID')}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-tighter">
                <span>Progress</span>
                <span>{Math.min((totalUser1 / INDIVIDUAL_GOAL) * 100, 100).toFixed(1)}% of 25M</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((totalUser1 / INDIVIDUAL_GOAL) * 100, 100)}%` }}
                  className="h-full bg-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Ario Maulana Contribution</p>
                <p className="text-xl font-bold">Rp {totalUser2.toLocaleString('id-ID')}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-tighter">
                <span>Progress</span>
                <span>{Math.min((totalUser2 / INDIVIDUAL_GOAL) * 100, 100).toFixed(1)}% of 25M</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((totalUser2 / INDIVIDUAL_GOAL) * 100, 100)}%` }}
                  className="h-full bg-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* History Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-400" />
            <h3 className="font-bold text-lg">Saving History</h3>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="btn-primary flex items-center gap-2 py-2"
          >
            <Plus className="w-5 h-5" />
            Add Saving
          </button>
        </div>

        {/* Transaction List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p>Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="glass-card p-12 text-center text-slate-400">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No transactions yet. Start saving for Japan!</p>
            </div>
          ) : (
            transactions.map((t) => (
              <motion.div 
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={t.id}
                className="glass-card p-5 flex items-center justify-between group hover:border-japan-red/30 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                    t.user_name === 'Fiam Zaki' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {t.user_name.split(' ')[0]}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Rp {t.amount.toLocaleString('id-ID')}</p>
                    <p className="text-sm text-slate-500">{format(new Date(t.date), 'dd MMM yyyy')}</p>
                  </div>
                </div>
                
                {t.proof_image_url && (
                  <a 
                    href={t.proof_image_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-100 shadow-sm hover:scale-110 transition-transform"
                  >
                    <img 
                      src={t.proof_image_url} 
                      alt="Proof" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="text-white w-4 h-4" />
                    </div>
                  </a>
                )}
              </motion.div>
            ))
          )}
        </div>
      </main>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card p-8 w-full max-w-md relative z-10"
            >
              <h3 className="text-2xl font-bold mb-6">Add New Saving</h3>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Amount (Rp)</label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[50000, 100000, 150000, 200000, 500000, 1000000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setFormData({ ...formData, amount: amt.toString() })}
                        className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                          formData.amount === amt.toString()
                            ? 'bg-japan-red text-white border-japan-red'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-japan-red/50 hover:bg-japan-red/5'
                        }`}
                      >
                        {amt >= 1000000 ? `${amt / 1000000}jt` : `${amt / 1000}rb`}
                      </button>
                    ))}
                  </div>
                  <input 
                    type="number" 
                    required
                    placeholder="e.g. 1000000"
                    className="input-field"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Transfer Date</label>
                  <input 
                    type="date" 
                    required
                    className="input-field"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Proof of Transfer</label>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      className="hidden"
                      id="proof-upload"
                      onChange={e => setFormData({ ...formData, image: e.target.files?.[0] || null })}
                    />
                    <label 
                      htmlFor="proof-upload"
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-japan-red/50 hover:bg-japan-red/5 transition-all cursor-pointer text-slate-500"
                    >
                      <Camera className="w-5 h-5" />
                      {formData.image ? formData.image.name : 'Upload Image'}
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 px-6 py-3 rounded-2xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Save
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Decoration */}
      <div className="fixed bottom-0 left-0 w-full h-1 bg-japan-red opacity-20" />
    </div>
  );
}
