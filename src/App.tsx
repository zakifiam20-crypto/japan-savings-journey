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
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: '18px', height: '18px', borderRadius: '50%', background: '#BC002D', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(255,255,255,0.5)' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><path d="M12 15.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4zm6-11.2h-1.5l-1.7-2H9.2L7.5 4H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3z"/></svg>
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
    <div style={{ minHeight: '100vh', paddingBottom: '80px', background: '#0a0a0f', color: 'white' }}>
      {/* Header */}
      <header style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #BC002D, #ff4d6d)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp className="text-white w-4 h-4" />
            </div>
            <span style={{ fontWeight: '700', fontSize: '16px', color: 'white', letterSpacing: '-0.3px' }}>Our Japan Journey <span style={{ opacity: 0.8 }}>🇯🇵</span></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {profiles[user!] ? (
              <img src={profiles[user!]} alt={user!} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(188,0,45,0.6)' }} />
            ) : (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(188,0,45,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                {user === 'Fiam Zaki' ? '🧑‍✈️' : '👨‍🚀'}
              </div>
            )}
            <div>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', margin: 0 }}>Logged in as</p>
              <p style={{ color: '#ff6b81', fontWeight: '700', margin: 0, fontSize: '13px' }}>{user}</p>
            </div>
            <button
              onClick={() => setUser(null)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '7px', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex', marginLeft: '4px' }}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Supabase Config Warning */}
        {!isSupabaseConfigured && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '16px 20px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p style={{ color: '#f87171', fontWeight: '700', margin: '0 0 2px 0', fontSize: '13px' }}>Supabase Belum Dikonfigurasi</p>
              <p style={{ color: 'rgba(248,113,113,0.6)', margin: 0, fontSize: '12px' }}>Atur VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di menu Secrets.</p>
            </div>
          </div>
        )}

        {/* Inactivity Notification */}
        {!hasSavedThisWeek && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: '14px', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <span style={{ fontSize: '16px' }}>✦</span>
            <p style={{ color: 'rgba(251,191,36,0.8)', margin: 0, fontSize: '13px', fontWeight: '500' }}>
              Belum nabung minggu ini — jangan biarkan mimpi ke Jepang pudar! 🇯🇵
            </p>
          </motion.div>
        )}

        {/* Goal Card */}
        <section style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '28px', overflow: 'hidden', position: 'relative' }}>
          {/* Subtle top accent */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #BC002D, #ff4d6d, transparent)' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Amount row */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: '600', letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 6px 0' }}>Total Tabungan</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '36px', fontWeight: '800', color: 'white', letterSpacing: '-1px', lineHeight: 1 }}>Rp {totalCombined.toLocaleString('id-ID')}</span>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px' }}>/ Rp {GOAL_AMOUNT.toLocaleString('id-ID')}</span>
                </div>
              </div>
              <div style={{ background: 'rgba(188,0,45,0.1)', border: '1px solid rgba(188,0,45,0.2)', borderRadius: '8px', padding: '6px 12px' }}>
                <span style={{ color: '#ff6b81', fontWeight: '700', fontSize: '13px' }}>{progressPercent.toFixed(1)}% tercapai</span>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ position: 'relative', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                style={{ position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: '99px', background: 'linear-gradient(90deg, #BC002D, #ff4d6d)' }}
              >
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  style={{ position: 'absolute', inset: 0, width: '40%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)' }}
                />
              </motion.div>
            </div>

            {/* Chart */}
            <div>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 12px 0' }}>Tren Mingguan</p>
              <div style={{ height: '140px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#BC002D" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#BC002D" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.2)' }} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: '#111118', color: 'white', fontSize: '12px' }}
                      formatter={(value: number) => [`Rp ${value.toLocaleString('id-ID')}`, 'Tabungan']}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#BC002D" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" animationDuration={1500} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* Contribution Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {[
            { name: 'Fiam Zaki', emoji: '🧑‍✈️', total: totalUser1, color: '#3b82f6' },
            { name: 'Ario Maulana', emoji: '👨‍🚀', total: totalUser2, color: '#10b981' }
          ].map((person) => (
            <div key={person.name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '18px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                {profiles[person.name] ? (
                  <img src={profiles[person.name]} alt={person.name}
                    style={{ width: '42px', height: '42px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: `${person.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                    {person.emoji}
                  </div>
                )}
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 2px 0' }}>{person.name.split(' ')[0]}</p>
                  <p style={{ color: 'white', fontWeight: '700', fontSize: '15px', margin: 0 }}>Rp {person.total.toLocaleString('id-ID')}</p>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>Progress</span>
                  <span style={{ color: `${person.color}cc`, fontSize: '10px', fontWeight: '700' }}>{Math.min((person.total / INDIVIDUAL_GOAL) * 100, 100).toFixed(1)}%</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((person.total / INDIVIDUAL_GOAL) * 100, 100)}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    style={{ height: '100%', borderRadius: '99px', background: person.color }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* History Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <h3 style={{ fontWeight: '700', fontSize: '15px', margin: 0, color: 'rgba(255,255,255,0.7)' }}>Riwayat Tabungan</h3>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            style={{ background: 'linear-gradient(135deg, #BC002D, #ff4d6d)', border: 'none', borderRadius: '10px', padding: '9px 16px', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 0 20px rgba(188,0,45,0.3)' }}
          >
            <Plus className="w-4 h-4" />
            Tambah
          </button>
        </div>

        {/* Transaction List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <p style={{ margin: 0, fontSize: '13px' }}>Memuat data...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '18px', padding: '48px', textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>
              <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p style={{ margin: 0, fontSize: '13px' }}>Belum ada tabungan. Mulai sekarang!</p>
            </div>
          ) : (
            transactions.map((t) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                key={t.id}
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '12px', flexShrink: 0,
                    background: t.user_name === 'Fiam Zaki' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)',
                    color: t.user_name === 'Fiam Zaki' ? '#60a5fa' : '#34d399'
                  }}>
                    {t.user_name.split(' ')[0].slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontWeight: '700', fontSize: '15px', margin: '0 0 2px 0', color: 'white' }}>Rp {t.amount.toLocaleString('id-ID')}</p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>{t.user_name} · {format(new Date(t.date), 'dd MMM yyyy')}</p>
                  </div>
                </div>
                
                {t.proof_image_url && (
                  <a
                    href={t.proof_image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ position: 'relative', width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, display: 'block', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <img
                      src={t.proof_image_url}
                      alt="Proof"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      referrerPolicy="no-referrer"
                    />
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
      <div style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', height: '1px', background: 'rgba(188,0,45,0.3)' }} />
    </div>
  );
}