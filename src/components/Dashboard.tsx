import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  ArrowRight, 
  Layers, 
  RefreshCw, 
  Calculator, 
  DollarSign, 
  FileText, 
  Code, 
  Lock, 
  Wrench,
  Heart,
  User,
  LogOut,
  TrendingUp,
  Sparkles,
  Shield,
  Check,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { ToolItem, CategoryType } from '../types';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

// Firebase Integrations
import { 
  auth, 
  db, 
  googleProvider, 
  facebookProvider, 
  handleFirestoreError, 
  OperationType 
} from '../firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPhoneNumber, 
  RecaptchaVerifier, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';

const CATEGORIES: { value: CategoryType; label: string; icon: any; bgActive: string; textActive: string; borderActive: string }[] = [
  { value: 'all', label: 'All Tools', icon: Layers, bgActive: 'bg-slate-900 border-slate-900 text-white', textActive: 'text-slate-900', borderActive: 'border-slate-300' },
  { value: 'converters', label: 'Unit Converters', icon: RefreshCw, bgActive: 'bg-blue-600 border-blue-600 text-white', textActive: 'text-blue-600', borderActive: 'border-blue-200' },
  { value: 'math', label: 'Math Wizards', icon: Calculator, bgActive: 'bg-emerald-600 border-emerald-600 text-white', textActive: 'text-emerald-600', borderActive: 'border-emerald-200' },
  { value: 'finance', label: 'Finance & Tax', icon: DollarSign, bgActive: 'bg-amber-600 border-amber-600 text-white', textActive: 'text-amber-600', borderActive: 'border-amber-200' },
  { value: 'content', label: 'SEO & Content', icon: FileText, bgActive: 'bg-rose-600 border-rose-600 text-white', textActive: 'text-rose-600', borderActive: 'border-rose-200' },
  { value: 'developer', label: 'Developer Kits', icon: Code, bgActive: 'bg-cyan-600 border-cyan-600 text-white', textActive: 'text-cyan-600', borderActive: 'border-cyan-200' },
  { value: 'security', label: 'Crypto & Security', icon: Lock, bgActive: 'bg-violet-600 border-violet-600 text-white', textActive: 'text-violet-600', borderActive: 'border-violet-200' },
];

const ITEMS_PER_PAGE = 24;

export default function Dashboard() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [appending, setAppending] = useState(false);

  // Authentication & Bookmark states
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userFavorites, setUserFavorites] = useState<string[]>([]);
  const [userRecents, setUserRecents] = useState<string[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [onlyFavoritesMode, setOnlyFavoritesMode] = useState(false);

  // Advanced Firebase Authentication Methods states (Google, Phone OTP, Facebook)
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [phoneAuthStep, setPhoneAuthStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  // Sync with Firebase Authentication state & Firestore preferences document
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const identifier = firebaseUser.email || firebaseUser.phoneNumber || 'Authenticated User';
        setUserEmail(identifier);
        
        // Fetch or initialize user document in Firestore to persist bookmarks & recents
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserFavorites(data.favorites || []);
            setUserRecents(data.recents || []);
          } else {
            // Document does not exist; create user profile in Firestore
            const initialProfile = {
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              favorites: [],
              recents: [],
              createdAt: serverTimestamp()
            };
            await setDoc(userDocRef, initialProfile);
            setUserFavorites([]);
            setUserRecents([]);
          }
        } catch (err) {
          console.error('Failed to sync user Firestore preferences:', err);
        }
      } else {
        setUserEmail(null);
        setUserFavorites([]);
        setUserRecents([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Dynamically set page title and metadata based on category or search
  useDocumentMeta({
    title: selectedCategory !== 'all' 
      ? `Free ${CATEGORIES.find(c => c.value === selectedCategory)?.label} | Toolsmart Free Tools`
      : search 
        ? `Search results for "${search}"` 
        : "Toolsmart - 110,000+ Online Unit Converters, Math Solvers & Calculators",
    description: selectedCategory !== 'all'
      ? `Browse our comprehensive collection of ${CATEGORIES.find(c => c.value === selectedCategory)?.label}. Fast, accurate, and 100% free to use online.`
      : search
        ? `Looking for tools matching "${search}"? Discover the best calculations, tools, and converters here.`
        : "A massive, search-engine-optimized, high-speed programmatic directory of utility calculators, converters, development tools, math wizards, and content utilities.",
    category: selectedCategory !== 'all' ? selectedCategory : undefined
  });

  // Load tools from API with search, category, and page filters
  useEffect(() => {
    if (page === 1) {
      setLoading(true);
    } else {
      setAppending(true);
    }

    const controller = new AbortController();
    fetch(`/api/tools?search=${encodeURIComponent(search)}&category=${selectedCategory}&page=${page}&limit=${ITEMS_PER_PAGE}`, {
      signal: controller.signal
    })
      .then(res => res.json())
      .then(data => {
        let loadedTools = data.tools || [];
        
        // Handle client-side "Only Favorited" filter if active
        if (onlyFavoritesMode) {
          loadedTools = loadedTools.filter((t: ToolItem) => userFavorites.includes(t.slug));
        }

        if (page === 1) {
          setTools(loadedTools);
        } else {
          setTools(prev => [...prev, ...loadedTools]);
        }
        setTotal(onlyFavoritesMode ? userFavorites.length : (data.total || 0));
        setLoading(false);
        setAppending(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch tools:', err);
          setLoading(false);
          setAppending(false);
        }
      });

    return () => controller.abort();
  }, [search, selectedCategory, page, onlyFavoritesMode, userFavorites]);

  // Reset page when filters change
  const handleCategoryChange = (cat: CategoryType) => {
    setSelectedCategory(cat);
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  // Auth form submissions for Email and Password (Firebase)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    try {
      if (authMode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, authEmail, authPassword);
        setAuthSuccess(`Successfully logged in as ${userCredential.user.email}!`);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        setAuthSuccess(`Account registered and logged in as ${userCredential.user.email}!`);
      }

      setTimeout(() => {
        setShowAuthModal(false);
        setAuthEmail('');
        setAuthPassword('');
        setAuthSuccess('');
      }, 1000);
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please check credentials and try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Phone OTP Sign-in handler
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);
    try {
      // Initialize Invisible RecaptchaVerifier
      if (!(window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            console.log('Invisible reCAPTCHA verified');
          },
          'expired-callback': () => {
            setAuthError('reCAPTCHA expired. Please try again.');
          }
        });
      }
      
      const appVerifier = (window as any).recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(result);
      setPhoneAuthStep('otp');
      setAuthSuccess('Verification code sent successfully!');
    } catch (err: any) {
      setAuthError(err.message || 'Failed to send verification SMS. Verify format is international, e.g., +11234567890');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);
    try {
      if (!confirmationResult) {
        throw new Error('No active verification session. Request code first.');
      }
      const result = await confirmationResult.confirm(verificationCode);
      setAuthSuccess(`Signed in as ${result.user.phoneNumber}!`);
      setTimeout(() => {
        setShowAuthModal(false);
        setPhoneAuthStep('phone');
        setPhoneNumber('');
        setVerificationCode('');
        setAuthSuccess('');
      }, 1000);
    } catch (err: any) {
      setAuthError(err.message || 'Invalid SMS verification code. Please check and try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Google & Facebook Popup Auths
  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setAuthSuccess(`Successfully logged in as ${result.user.displayName || result.user.email || 'Google User'}!`);
      setTimeout(() => {
        setShowAuthModal(false);
        setAuthSuccess('');
      }, 1000);
    } catch (err: any) {
      setAuthError(err.message || 'Google authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, facebookProvider);
      setAuthSuccess(`Successfully logged in as ${result.user.displayName || result.user.email || 'Facebook User'}!`);
      setTimeout(() => {
        setShowAuthModal(false);
        setAuthSuccess('');
      }, 1000);
    } catch (err: any) {
      setAuthError(err.message || 'Facebook authentication failed. Make sure Facebook Sign-In is enabled in your Firebase Console.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Toggle Bookmark / Favorite directly in Firestore!
  const handleToggleFavorite = async (e: React.MouseEvent, slug: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!auth.currentUser) {
      setAuthMode('login');
      setAuthError('Please sign in or create an account to bookmark your favorite utility tools.');
      setShowAuthModal(true);
      return;
    }

    const currentFavorites = [...userFavorites];
    const idx = currentFavorites.indexOf(slug);
    if (idx >= 0) {
      currentFavorites.splice(idx, 1);
    } else {
      currentFavorites.push(slug);
    }

    // Optimistically update local state for fast UI rendering
    setUserFavorites(currentFavorites);

    try {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userDocRef, {
        favorites: currentFavorites
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUserEmail(null);
      setUserFavorites([]);
      setUserRecents([]);
      setOnlyFavoritesMode(false);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'converters': return RefreshCw;
      case 'math': return Calculator;
      case 'finance': return DollarSign;
      case 'content': return FileText;
      case 'developer': return Code;
      case 'security': return Lock;
      default: return Wrench;
    }
  };

  const getCategoryTheme = (category: string) => {
    switch (category) {
      case 'converters': return {
        tag: 'bg-blue-50 text-blue-700 border-blue-100',
        hoverBorder: 'group-hover:border-blue-500/80',
        text: 'text-blue-600 group-hover:text-blue-800'
      };
      case 'math': return {
        tag: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        hoverBorder: 'group-hover:border-emerald-500/80',
        text: 'text-emerald-600 group-hover:text-emerald-800'
      };
      case 'finance': return {
        tag: 'bg-amber-50 text-amber-700 border-amber-100',
        hoverBorder: 'group-hover:border-amber-500/80',
        text: 'text-amber-600 group-hover:text-amber-800'
      };
      case 'content': return {
        tag: 'bg-rose-50 text-rose-700 border-rose-100',
        hoverBorder: 'group-hover:border-rose-500/80',
        text: 'text-rose-600 group-hover:text-rose-800'
      };
      case 'developer': return {
        tag: 'bg-cyan-50 text-cyan-700 border-cyan-100',
        hoverBorder: 'group-hover:border-cyan-500/80',
        text: 'text-cyan-600 group-hover:text-cyan-800'
      };
      case 'security': return {
        tag: 'bg-violet-50 text-violet-700 border-violet-100',
        hoverBorder: 'group-hover:border-violet-500/80',
        text: 'text-violet-600 group-hover:text-violet-800'
      };
      default: return {
        tag: 'bg-slate-50 text-slate-700 border-slate-100',
        hoverBorder: 'group-hover:border-slate-400',
        text: 'text-slate-600 group-hover:text-slate-800'
      };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans" id="dashboard-wrapper">
      
      {/* Sleek Professional Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200/80 shadow-xs" id="nav-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            
            {/* Professional Logo */}
            <a href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-all">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-600 rounded-lg blur-xs opacity-40" />
                <div className="relative bg-gradient-to-br from-indigo-500 to-indigo-700 text-white w-9 h-9 flex items-center justify-center rounded-lg font-black text-lg shadow-sm border border-indigo-400">
                  T
                </div>
              </div>
              <span className="font-black text-xl tracking-tight text-slate-900">
                Tool<span className="text-indigo-600 font-extrabold">smart</span>
              </span>
            </a>

            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-500">
              <button 
                onClick={() => { setOnlyFavoritesMode(false); handleCategoryChange('all'); }} 
                className={`hover:text-slate-900 transition-colors cursor-pointer ${!onlyFavoritesMode ? 'text-indigo-600 font-semibold' : ''}`}
              >
                All Tools Directory
              </button>
              <button 
                onClick={() => {
                  if (!userEmail) {
                    setAuthMode('login');
                    setAuthError('Please sign in or create an account to view your bookmarked tools.');
                    setShowAuthModal(true);
                  } else {
                    setOnlyFavoritesMode(!onlyFavoritesMode);
                  }
                }}
                className={`flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer ${onlyFavoritesMode ? 'text-indigo-600 font-semibold' : ''}`}
              >
                <Heart className={`w-4 h-4 ${onlyFavoritesMode ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                <span>My Bookmarks {userEmail ? `(${userFavorites.length})` : ''}</span>
              </button>
            </nav>
          </div>

          {/* Clean Dynamic User Identity Block */}
          <div className="flex items-center gap-4">
            {userEmail ? (
              <div className="flex items-center gap-3 bg-slate-100 pl-3.5 pr-2 py-1.5 rounded-full border border-slate-200">
                <div className="w-5.5 h-5.5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0 max-w-[140px]">
                  <span className="text-[11px] font-bold text-slate-800 truncate leading-tight">{userEmail}</span>
                  <span className="text-[9px] font-extrabold text-indigo-600 tracking-wider uppercase leading-none mt-0.5">Premium</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-full hover:bg-slate-200 transition-colors cursor-pointer ml-1"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setAuthMode('login'); setAuthError(''); setShowAuthModal(true); }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-950 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => { setAuthMode('register'); setAuthError(''); setShowAuthModal(true); }}
                  className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-100 rounded-xl transition-all cursor-pointer border border-indigo-500"
                >
                  Join Free
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Pristine Modern Search & Hero Section */}
      <section className="relative overflow-hidden bg-white border-b border-slate-200 py-16 sm:py-24 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]" id="hero-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            
            <motion.div 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-xs font-bold mb-6"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
              <span>Over 110,000+ lightning-fast calculators & conversion utilities</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 mb-6 leading-tight"
            >
              The Smartest Collection of <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-800">Free Online Tools</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.16 }}
              className="text-base sm:text-lg text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              Discover our dynamic index of mathematical tables, cybersecurity utilities, financial meters, caption boundaries, and conversion standards. Perfect for developers, students, and professionals.
            </motion.p>

            {/* Premium Dynamic Search Interface */}
            <motion.div 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.24 }}
              className="max-w-2xl mx-auto relative"
            >
              <div className="relative group">
                <div className="absolute -inset-1.5 bg-indigo-100 rounded-2xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 w-5.5 h-5.5 group-focus-within:text-indigo-600 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search 110,000+ free tools (e.g. 'table of 7', '15 percent off')..."
                    value={search}
                    onChange={handleSearchChange}
                    className="w-full pl-13 pr-32 py-4 sm:py-4.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-xs transition-all text-base text-slate-900"
                    id="search-input"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {search && (
                      <button 
                        onClick={() => setSearch('')} 
                        className="text-xs text-slate-400 hover:text-slate-600 bg-slate-200/50 hover:bg-slate-200/80 px-2.5 py-1 rounded-md transition-colors font-medium"
                      >
                        Clear
                      </button>
                    )}
                    <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-150 px-3 py-1.5 rounded-lg font-bold">
                      {total.toLocaleString()} Match
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Main Catalog Body Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Categories Navigation Filter Row */}
        <div className="flex items-center overflow-x-auto pb-4.5 mb-10 -mx-4 px-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent gap-2" id="categories-bar">
          {CATEGORIES.map((cat) => {
            const IconComponent = cat.icon;
            const isSelected = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => handleCategoryChange(cat.value)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-full border text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isSelected 
                    ? cat.bgActive + ' shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
                id={`cat-btn-${cat.value}`}
              >
                <IconComponent className={`w-4 h-4`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Directory Stats Line & Reset Filters Option */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8" id="stats-bar">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              {onlyFavoritesMode ? "Your Bookmarked Catalog" : `${CATEGORIES.find(c => c.value === selectedCategory)?.label}`}
            </h3>
            <p className="text-sm font-medium text-slate-500 mt-1">
              {loading ? (
                <span>Loading directory index...</span>
              ) : (
                <span>
                  Showing <span className="font-bold text-slate-800">{tools.length}</span> of{' '}
                  <span className="font-bold text-slate-800">{total.toLocaleString()}</span> dynamic tools ready on-demand
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {userEmail && (
              <button
                onClick={() => setOnlyFavoritesMode(!onlyFavoritesMode)}
                className={`text-xs px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                  onlyFavoritesMode 
                    ? 'bg-rose-50 border-rose-200 text-rose-700' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${onlyFavoritesMode ? 'fill-rose-600 text-rose-600' : 'text-slate-400'}`} />
                <span>Saved Bookmarks Only</span>
              </button>
            )}
            
            {(selectedCategory !== 'all' || search) && (
              <button 
                onClick={() => { setSelectedCategory('all'); setSearch(''); setOnlyFavoritesMode(false); }} 
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Pristine Bento Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28" id="grid-loader">
            <div className="animate-spin rounded-full h-9 w-9 border-t-2 border-b-2 border-indigo-600 mb-4" />
            <p className="text-sm text-slate-500 font-semibold">Scanning local system catalog...</p>
          </div>
        ) : tools.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="tools-grid-box">
            
            {tools.map((tool) => {
              const CategoryIcon = getCategoryIcon(tool.category);
              const isFavorited = userFavorites.includes(tool.slug);
              const theme = getCategoryTheme(tool.category);

              return (
                <div
                  key={tool.slug}
                  className={`group bg-white border border-slate-200 hover:shadow-md ${theme.hoverBorder} rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between relative`}
                  id={`tool-card-${tool.slug}`}
                >
                  <div>
                    {/* Badge & Bookmark icon */}
                    <div className="flex justify-between items-center mb-4.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${theme.tag}`}>
                        <CategoryIcon className="w-3.5 h-3.5" />
                        {tool.category}
                      </span>

                      <button
                        onClick={(e) => handleToggleFavorite(e, tool.slug)}
                        className="p-1.5 rounded-full text-slate-300 hover:text-rose-500 hover:bg-slate-50 transition-colors cursor-pointer"
                        title={isFavorited ? "Remove from bookmarks" : "Save to bookmarks"}
                      >
                        <Heart className={`w-4 h-4 transition-transform group-hover:scale-105 ${isFavorited ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                      </button>
                    </div>

                    <a href={`/tools/${tool.slug}.html`} className="block">
                      <h3 className="text-base font-extrabold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                        {tool.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-3 mb-6 leading-relaxed">
                        {tool.description}
                      </p>
                    </a>
                  </div>

                  <a
                    href={`/tools/${tool.slug}.html`}
                    className={`flex items-center justify-between text-xs font-bold ${theme.text} transition-colors mt-auto pt-3.5 border-t border-slate-100`}
                  >
                    <span>Launch Utility</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl" id="no-results-box">
            <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-1">No tools match your query</h3>
            <p className="text-sm text-slate-500">Try clearing your filters or searching for another keyphrase (e.g. "multiplication").</p>
          </div>
        )}

        {/* Load More Pagination */}
        {!loading && tools.length < total && (
          <div className="text-center mt-12" id="load-more-container">
            <button
              onClick={loadMore}
              disabled={appending}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              id="load-more-btn"
            >
              {appending ? 'Loading next page...' : 'Load More Tools'}
            </button>
          </div>
        )}
      </div>

      {/* Professional Features / Trust Section */}
      <section className="bg-white border-t border-slate-200 py-16" id="features-highlights">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50">
              <div className="text-indigo-600 mb-4 p-2.5 bg-indigo-50 inline-block rounded-xl">
                <Shield className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Secure & Sandboxed</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                All calculations and formatting functions compute instantly inside your secure, isolated browser session. Your raw input data is private and never recorded.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50">
              <div className="text-emerald-600 mb-4 p-2.5 bg-emerald-50 inline-block rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Lightning Fast Performance</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Built with modern web standards and highly optimized javascript runtimes to deliver immediate results on any desktop, tablet, or mobile viewport.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50">
              <div className="text-amber-600 mb-4 p-2.5 bg-amber-50 inline-block rounded-xl">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Comprehensive Toolkit</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Unlock frictionless access across over 110,000 mathematical times tables, cybersecurity key generators, content limits, and unit configurations.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Authentication Modal Dialog */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" id="auth-modal">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowAuthModal(false)} />
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 w-full max-w-md relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-900 mb-1">
              {authMethod === 'phone' 
                ? 'Verify with Phone OTP' 
                : authMode === 'login' 
                  ? 'Welcome Back to Toolsmart' 
                  : 'Create Your Free Account'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              {authMethod === 'phone'
                ? 'Sign in instantly using a verification code sent via SMS.'
                : authMode === 'login' 
                  ? 'Sign in to access your saved tools, check recents, and export data.' 
                  : 'Join over 150,000+ developers and SEO strategists using Toolsmart daily.'}
            </p>

            {/* Method Selectors (Email vs Phone) */}
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl mb-5">
              <button
                type="button"
                onClick={() => { setAuthMethod('email'); setAuthError(''); setAuthSuccess(''); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  authMethod === 'email' ? 'bg-white text-indigo-750 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Email & Password
              </button>
              <button
                type="button"
                onClick={() => { setAuthMethod('phone'); setAuthError(''); setAuthSuccess(''); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  authMethod === 'phone' ? 'bg-white text-indigo-750 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Phone Number (SMS)
              </button>
            </div>

            {authError && (
              <div className="bg-rose-50 border border-rose-150 text-rose-700 p-3 rounded-lg text-xs font-semibold mb-4 flex items-center gap-2">
                <span className="p-1 bg-rose-200 text-rose-800 rounded-full text-[10px] leading-none">!</span>
                <span className="break-words">{authError}</span>
              </div>
            )}

            {authSuccess && (
              <div className="bg-emerald-50 border border-emerald-150 text-emerald-700 p-3 rounded-lg text-xs font-semibold mb-4 flex items-center gap-2">
                <span className="p-1 bg-emerald-200 text-emerald-800 rounded-full text-[10px] leading-none">✓</span>
                <span className="break-words">{authSuccess}</span>
              </div>
            )}

            {/* Email Form */}
            {authMethod === 'email' && (
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="name@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Password</label>
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 font-bold text-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {authLoading ? 'Authenticating...' : authMode === 'login' ? 'Sign In Now' : 'Register Free Account'}
                </button>

                <div className="pt-2 text-center">
                  {authMode === 'login' ? (
                    <p className="text-xs text-slate-500">
                      New to Toolsmart?{' '}
                      <button type="button" onClick={() => { setAuthMode('register'); setAuthError(''); }} className="text-indigo-600 font-bold hover:underline cursor-pointer">
                        Create free account
                      </button>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Already have an account?{' '}
                      <button type="button" onClick={() => { setAuthMode('login'); setAuthError(''); }} className="text-indigo-600 font-bold hover:underline cursor-pointer">
                        Sign in here
                      </button>
                    </p>
                  )}
                </div>
              </form>
            )}

            {/* Phone Form */}
            {authMethod === 'phone' && (
              <div className="space-y-4">
                {phoneAuthStep === 'phone' ? (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Mobile Phone Number</label>
                      <input 
                        type="tel" 
                        placeholder="+1 123 456 7890"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm"
                        required
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Include international prefixes (e.g., +1 for USA, +91 for India, +44 for UK).</p>
                    </div>

                    {/* Invisible ReCAPTCHA Container */}
                    <div id="recaptcha-container"></div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-2.5 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 font-bold text-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      {authLoading ? 'Sending SMS...' : 'Send Verification SMS Code'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">6-Digit Verification Code</label>
                      <input 
                        type="text" 
                        placeholder="123456"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="w-full px-3 py-2 tracking-widest text-center border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 font-mono text-lg font-bold"
                        required
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setPhoneAuthStep('phone'); setVerificationCode(''); setAuthError(''); }}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm transition-all cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="flex-[2] py-2.5 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 font-bold text-sm transition-all cursor-pointer disabled:opacity-50"
                      >
                        {authLoading ? 'Verifying OTP...' : 'Verify OTP & Login'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Social Authentication Providers Row */}
            <div className="relative my-5 text-center">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-150"></span>
              </div>
              <span className="relative bg-white px-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">Or continue with</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.03-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={handleFacebookSignIn}
                disabled={authLoading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <span>Facebook</span>
              </button>
            </div>
            
            <p className="text-[10px] text-center text-slate-400 mt-5 leading-relaxed">
              Google, Facebook, and Phone authentication require corresponding activations in your Firebase Console.
            </p>
          </div>
        </div>
      )}

      {/* Clean Footer */}
      <footer className="bg-white border-t border-slate-200 py-12" id="dashboard-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-400 text-xs">
          <p className="font-bold text-slate-700 mb-2">Toolsmart Instant Web Utilities Portal</p>
          <p>Powered by an automated pipeline rendering lightning-fast, secure tools on-demand.</p>
          <p className="mt-4">&copy; 2026 Toolsmart. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
