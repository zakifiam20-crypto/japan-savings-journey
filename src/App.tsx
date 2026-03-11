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
import confetti from 'canvas-confetti';

function TypewriterText() {
  const texts = [
    'Bismillah tidak ada halangan.',
    'Menabung hari ini, terbang besok.',
    'Satu langkah lebih dekat ke Jepang 🗻'
  ];
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = texts[index];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        setDisplayed(current.slice(0, displayed.length + 1));
        if (displayed.length + 1 === current.length) {
          setTimeout(() => setIsDeleting(true), 1500);
        }
      } else {
        setDisplayed(current.slice(0, displayed.length - 1));
        if (displayed.length === 0) {
          setIsDeleting(false);
          setIndex((prev) => (prev + 1) % texts.length);
        }
      }
    }, isDeleting ? 40 : 80);
    return () => clearTimeout(timeout);
  }, [displayed, isDeleting, index]);

  return (
    <p className="text-white/80 text-lg min-h-[32px]">
      {displayed}<span className="animate-pulse">|</span>
    </p>
  );
}

export default function App() {
  const [started, setStarted] = useState(false);
  const [profiles, setProfiles] = useState<{[key: string]: string}>({});
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
    if (user) {
      localStorage.setItem('japan-journey-user', user);
    } else {
      localStorage.removeItem('japan-journey-user');
    }
  }, [user]);

  useEffect(() => {
    fetchTransactions();
    fetchProfiles();
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

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) {
      const map: {[key: string]: string} = {};
      data.forEach((p: any) => { if (p.avatar_url) map[p.user_name] = p.avatar_url; });
      setProfiles(map);
    }
  };

  const handleAvatarUpload = async (file: File, userName: string) => {
    const fileExt = file.name.split('.').pop();
    const filePath = `${userName}-${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    await supabase.from('profiles').upsert({ user_name: userName, avatar_url: data.publicUrl });
    fetchProfiles();
  };



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
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#BC002D', '#ff4d6d', '#fff', '#FFD700']
      });
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
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-black/50" />

      {/* Sakura particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl pointer-events-none"
          initial={{ 
            top: -50, 
            left: `${Math.random() * 100}%`,
            rotate: 0,
            opacity: 0.8
          }}
          animate={{ 
            top: '110%',
            rotate: 360,
            opacity: [0.8, 0.8, 0],
            left: `${Math.random() * 100}%`
          }}
          transition={{ 
            duration: 4 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: 'linear'
          }}
        >
          🌸
        </motion.div>
      ))}

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 text-center w-full max-w-lg"
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '32px',
          padding: '48px 40px'
        }}
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 3 }}
          className="text-6xl mb-6"
        >
          🗼
        </motion.div>

        <motion.h1
          className="text-4xl font-black text-white mb-4 tracking-tight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Our Japan Saving Journey 🇯🇵
        </motion.h1>

        <TypewriterText />

        <motion.button
          onClick={() => setStarted(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          className="w-full mt-10 py-4 text-xl font-bold rounded-2xl text-white flex items-center justify-center gap-3"
          style={{
            background: 'linear-gradient(135deg, #BC002D, #ff4d6d)',
            boxShadow: '0 0 30px rgba(188,0,45,0.5)'
          }}
        >
          ✈️ Mulai Perjalanan
        </motion.button>
      </motion.div>
    </div>
  );
}

  if (!user) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-black/50" />

      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl pointer-events-none"
          initial={{ top: -50, left: `${Math.random() * 100}%`, rotate: 0, opacity: 0.8 }}
          animate={{ top: '110%', rotate: 360, opacity: [0.8, 0.8, 0], left: `${Math.random() * 100}%` }}
          transition={{ duration: 4 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 5, ease: 'linear' }}
        >
          🌸
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center w-full max-w-md"
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '32px',
          padding: '48px 40px'
        }}
      >
        <h2 className="text-3xl font-black text-white mb-2">Who are you? 👤</h2>
        <p className="text-white/60 mb-8">Pilih profilmu untuk mulai tracking</p>

        <div className="space-y-3">
          {[
            { name: 'Fiam Zaki', emoji: '🧑‍✈️' },
            { name: 'Ario Maulana', emoji: '👨‍🚀' }
          ].map((u) => (
            <div key={u.name} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Avatar upload area */}
              <label
                htmlFor={`avatar-${u.name}`}
                onClick={(e) => e.stopPropagation()}
                style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
              >
                {profiles[u.name] ? (
                  <img src={profiles[u.name]} alt={u.name}
                    style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(188,0,45,0.6)', display: 'block' }} />
                ) : (
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(188,0,45,0.15)', border: '2px dashed rgba(188,0,45,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                    {u.emoji}
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: '18px', height: '18px', borderRadius: '50%', background: '#BC002D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', border: '1.5px solid rgba(255,255,255,0.3)' }}>
                  📷
                </div>
                <input
                  id={`avatar-${u.name}`}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await handleAvatarUpload(file, u.name);
                  }}
                />
              </label>

              {/* Name button */}
              <motion.button
                onClick={() => setUser(u.name as User)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  flex: 1, padding: '16px 20px',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(10px)',
                  color: 'white', fontSize: '17px', fontWeight: '700',
                  cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}
              >
                <span>{u.name}</span>
                <span style={{ fontSize: '18px', opacity: 0.6 }}>→</span>
              </motion.button>
            </div>
          ))}
        </div>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '16px', textAlign: 'center' }}>
          Tap foto untuk ganti profile picture
        </p>
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

          <div className="relative h-6 bg-slate-100 rounded-full overflow-hidden mb-8 shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="absolute top-0 left-0 h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #BC002D, #ff4d6d, #FFD700)',
                boxShadow: '0 0 20px rgba(188,0,45,0.6)'
              }}
            >
              {/* Shimmer effect */}
              <motion.div
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                className="absolute inset-0 w-1/3"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)'
                }}
              />
            </motion.div>
            {/* Percentage label */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white drop-shadow">
                {progressPercent.toFixed(1)}%
              </span>
            </div>
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
              {profiles['Fiam Zaki'] ? (
                <img src={profiles['Fiam Zaki']} alt="Fiam Zaki"
                  style={{ width: '48px', height: '48px', borderRadius: '16px', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <Users className="w-6 h-6" />
                </div>
              )}
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
              {profiles['Ario Maulana'] ? (
                <img src={profiles['Ario Maulana']} alt="Ario Maulana"
                  style={{ width: '48px', height: '48px', borderRadius: '16px', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                  <Users className="w-6 h-6" />
                </div>
              )}
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
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
      />
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "460px",
          background: "linear-gradient(160deg, #141418 0%, #1a1a24 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "28px",
          overflow: "hidden",
          boxShadow: "0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(188,0,45,0.15)",
          position: "relative", zIndex: 10
        }}
      >
        {/* Top accent bar */}
        <div style={{ height: "3px", background: "linear-gradient(90deg, #BC002D, #ff4d6d, #FFD700)" }} />

        <div style={{ padding: "32px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
            <div>
              <p style={{ color: "#BC002D", fontSize: "11px", fontWeight: "700", letterSpacing: "3px", textTransform: "uppercase", margin: "0 0 4px 0" }}>
                JAPAN SAVINGS
              </p>
              <h2 style={{ color: "white", fontSize: "26px", fontWeight: "900", margin: 0, letterSpacing: "-0.5px" }}>
                Tambah Tabungan
              </h2>
            </div>
            <div style={{ fontSize: "36px" }}>🗼</div>
          </div>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", marginTop: "8px", fontStyle: "italic" }}>
            {["一歩一歩 — Selangkah demi selangkah 🗻", "夢に向かって — Menuju impian ✈️", "頑張って — Semangat terus! 🌸", "もうすぐ — Sebentar lagi sampai! 🇯🇵"][Math.floor(Math.random() * 4)]}
          </p>

          <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "20px 0" }} />

          {/* Amount */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", display: "block", marginBottom: "10px" }}>
              Jumlah
            </label>
            <input
              type="text"
              required
              placeholder="Rp 0"
              style={{
                width: "100%", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "14px", padding: "14px 18px",
                color: "white", fontSize: "22px", fontWeight: "800",
                outline: "none", boxSizing: "border-box", letterSpacing: "-0.5px"
              }}
              value={formData.amount ? `Rp ${Number(formData.amount).toLocaleString('id-ID')}` : ''}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, "");
                setFormData({ ...formData, amount: raw });
              }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginTop: "10px" }}>
              {[50000, 100000, 150000, 200000, 500000, 1000000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setFormData({ ...formData, amount: amt.toString() })}
                  style={{
                    background: formData.amount === amt.toString() ? "rgba(188,0,45,0.3)" : "rgba(255,255,255,0.04)",
                    border: formData.amount === amt.toString() ? "1px solid rgba(188,0,45,0.6)" : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "10px", padding: "8px",
                    color: formData.amount === amt.toString() ? "#ff4d6d" : "rgba(255,255,255,0.5)",
                    fontSize: "12px", fontWeight: "700", cursor: "pointer"
                  }}
                >
                  {amt >= 1000000 ? `${amt/1000000}jt` : `${amt/1000}rb`}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", display: "block", marginBottom: "10px" }}>
              Tanggal Transfer
            </label>
            <input
              type="date"
              required
              style={{
                width: "100%", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "14px", padding: "14px 18px",
                color: "white", fontSize: "15px",
                outline: "none", boxSizing: "border-box",
                colorScheme: "dark"
              }}
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
            />
          </div>

          {/* Proof Upload */}
          <div style={{ marginBottom: "28px" }}>
            <label style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", display: "block", marginBottom: "10px" }}>
              Bukti Transfer (Opsional)
            </label>
            <label
              htmlFor="proof-upload"
              style={{
                display: "block", cursor: "pointer",
                border: "1px dashed rgba(255,255,255,0.15)",
                borderRadius: "14px", overflow: "hidden"
              }}
            >
              {formData.image ? (
                <div style={{ position: "relative", height: "120px" }}>
                  <img
                    src={URL.createObjectURL(formData.image)}
                    alt="preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: "13px", fontWeight: "600"
                  }}>
                    📷 Ganti foto
                  </div>
                </div>
              ) : (
                <div style={{ padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.25)" }}>
                  <div style={{ fontSize: "28px", marginBottom: "6px" }}>📎</div>
                  <p style={{ margin: 0, fontSize: "13px" }}>Upload bukti transfer</p>
                </div>
              )}
            </label>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="proof-upload"
              onChange={e => setFormData({ ...formData, image: e.target.files?.[0] || null })}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              style={{
                flex: 1, padding: "14px",
                borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.5)", fontSize: "15px",
                fontWeight: "600", cursor: "pointer"
              }}
            >
              Batal
            </button>
            <motion.button
              onClick={handleSubmit}
              disabled={!formData.amount || submitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                flex: 2, padding: "14px",
                borderRadius: "14px", border: "none",
                background: "linear-gradient(135deg, #BC002D, #ff4d6d)",
                color: "white", fontSize: "15px", fontWeight: "800",
                cursor: !formData.amount || submitting ? "not-allowed" : "pointer",
                opacity: !formData.amount ? 0.4 : 1,
                boxShadow: "0 0 30px rgba(188,0,45,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
              }}
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Menyimpan...</>
              ) : (
                <>💾 Simpan Tabungan</>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>

      {/* Footer Decoration */}
      <div className="fixed bottom-0 left-0 w-full h-1 bg-japan-red opacity-20" />
    </div>
  );
}