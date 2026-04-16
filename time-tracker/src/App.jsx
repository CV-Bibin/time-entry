import TimeLedger from './components/TimeLedger';
import WorkProgress from './components/WorkProgress'; 
import AdminPanel from './components/AdminPanel'; 
import RatersPerformance from './components/RatersPerformance'; 
import AccountManagement from './components/AccountManagement';
import Earnings from './components/Earnings.jsx'; 
import TeamPerformanceGraphs from './components/TeamPerformanceGraphs';
import PayoutLedger from './components/PayoutLedger'; // 🚀 IMPORT NEW PAYOUT COMPONENT

import { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  updatePassword 
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from './firebase'; 

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // View State (Switches between components)
  const [currentView, setCurrentView] = useState('dashboard');
  
  // Role & Version State
  const [myRole, setMyRole] = useState('rater');
  const [myVersion, setMyVersion] = useState(1); 
  
  // Track approval status from database
  const [pwdChangeStatus, setPwdChangeStatus] = useState(null);

  // Form States
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // SELF-SERVICE PASSWORD STATE
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);

  // 1. Listen for Authentication Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch User Role & Auto-Add New Users to Database
  useEffect(() => {
    if (!user?.email) return;

    const ensureUserInDB = async () => {
      try {
        const userRef = doc(db, "users", user.email);
        const docSnap = await getDoc(userRef);
        
        if (!docSnap.exists()) {
          await setDoc(userRef, {
            email: user.email,
            role: 'rater',
            status: 'active',
            currentVersion: 1, 
            maxVersion: 1      
          });
          console.log("Added new user to database:", user.email);
        }
      } catch (err) {
        console.error("Error creating user profile:", err);
      }
    };

    ensureUserInDB();

    // Listen for role, version, and password status changes in real-time
    const unsub = onSnapshot(doc(db, "users", user.email), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMyRole(data.role || 'rater');
        setMyVersion(data.currentVersion || 1); 
        setPwdChangeStatus(data.pwdChangeStatus || null); 
      } else {
        setMyRole('rater');
        setMyVersion(1);
        setPwdChangeStatus(null);
      }
    });
    
    return () => unsub();
  }, [user?.email]);

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setErrorMsg(''); 

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      if (error.code === 'auth/invalid-credential') setErrorMsg("Incorrect email or password.");
      else if (error.code === 'auth/email-already-in-use') setErrorMsg("An account with this email already exists.");
      else setErrorMsg(error.message);
    }
  };

  const handleLogout = async () => {
    setCurrentView('dashboard'); 
    await signOut(auth);
  };

  const requestPasswordChange = async () => {
    try {
      await updateDoc(doc(db, "users", user.email), { pwdChangeStatus: 'pending' });
      alert("Request sent to Admin! Please wait for approval.");
      setIsPwdModalOpen(false);
    } catch (err) {
      setPwdError("Failed to send request.");
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess(false);

    if (newPwd.length < 6) return setPwdError('Password must be at least 6 characters.');

    try {
      await updatePassword(auth.currentUser, newPwd);
      await updateDoc(doc(db, "users", user.email), { pwdChangeStatus: null }); 
      
      setPwdSuccess(true);
      setNewPwd('');
      setTimeout(() => { setIsPwdModalOpen(false); setPwdSuccess(false); }, 2000);
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        setPwdError('Security requirement: Please log out and log back in before changing your password.');
      } else {
        setPwdError(error.message);
      }
    }
  };

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;

  // --- THE LOGIN / REGISTER SCREEN ---
  if (!user) {
    return (
      <div style={{ maxWidth: '350px', margin: '100px auto', fontFamily: 'sans-serif', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>{isLogin ? 'Log In' : 'Create Account'}</h2>
        
        {errorMsg && <div style={{ color: 'red', marginBottom: '15px', fontSize: '14px', textAlign: 'center' }}>{errorMsg}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            type="email" 
            placeholder="Email address" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input 
            type="password" 
            placeholder="Password (min 6 characters)" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button type="submit" style={{ padding: '12px', fontSize: '16px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px' }}>
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            style={{ background: 'none', border: 'none', color: '#007BFF', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isLogin ? "Need an account? Sign up" : "Already have an account? Log in"}
          </button>
        </div>
      </div>
    );
  }

  // 🚀 DEFINE WHO SEES WHAT (STRICT TIERED ACCESS)
  const isManager = myRole === 'leader' || myRole === 'co-admin' || myRole === 'admin';
  const isCoAdmin = myRole === 'co-admin' || myRole === 'admin';
  const isAdmin = myRole === 'admin';

  // 🎨 DYNAMIC BACKGROUND THEME COLORS BASED ON ROLE
  let appThemeBg = "#f8fafc"; // Default Rater Theme (Light Slate)
  if (myRole === 'leader') appThemeBg = "#f5f3ff"; // Leader Theme (Light Purple)
  if (isCoAdmin) appThemeBg = "#f0fdf4"; // Co-Admin / Admin Theme (Light Emerald)

  // --- THE MAIN DASHBOARD ---
  return (
    <div style={{ width: '100%', minHeight: '100vh', maxWidth: '100%', boxSizing: 'border-box', margin: '0', padding: '20px 40px', fontFamily: 'sans-serif', backgroundColor: appThemeBg, transition: 'background-color 0.3s ease' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: isCoAdmin ? 'flex-start' : 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '20px', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* LEFT SIDE: Title, Role Badge, and Welcome Message */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', minWidth: 'max-content' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a', whiteSpace: 'nowrap' }}>
            Dashboard
            <span style={{ fontSize: '12px', backgroundColor: '#e2e8f0', padding: '4px 10px', borderRadius: '12px', textTransform: 'uppercase', color: '#475569', letterSpacing: '0.5px' }}>
              {myRole}
            </span>
          </h2>
          <span style={{ fontSize: '15px', fontWeight: '500', color: '#64748b', whiteSpace: 'nowrap', borderLeft: '2px solid #cbd5e1', paddingLeft: '15px', marginLeft: '15px' }}>
            Welcome, <span style={{ color: '#0f172a', fontWeight: '800', textTransform: 'capitalize' }}>
              {user?.displayName || user?.email?.split('@')[0] || "User"}
            </span> 👋
          </span>
        </div>
        
        {/* RIGHT SIDE CONDITIONAL LAYOUT */}
        {isCoAdmin ? (
          // 🚀 CO-ADMIN / ADMIN LAYOUT: STACKED (Account Actions Top Right, Navigation Bottom Right)
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end', gap: '12px', marginLeft: 'auto' }}>
            
            {/* Top Row: Account Settings & Log Out */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '15px', flexWrap: 'nowrap' }}>
              <span style={{ fontSize: '14px', color: '#475569', fontWeight: '600' }}>{user.email}</span>

              
              
              <button 
                onClick={() => setIsPwdModalOpen(true)} 
                style={{ padding: '8px 12px', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '6px', background: pwdChangeStatus === 'approved' ? '#ecfdf5' : '#fff', fontSize: '12px', fontWeight: 'bold', color: pwdChangeStatus === 'approved' ? '#059669' : '#334155', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                {pwdChangeStatus === 'approved' ? '🔓 Set Password' : pwdChangeStatus === 'pending' ? '⏳ Pending...' : '🔑 Change Password'}
              </button>

              <button 
                onClick={handleLogout} 
                style={{ padding: '8px 16px', cursor: 'pointer', border: '1px solid #fecdd3', borderRadius: '6px', background: '#fff1f2', color: '#be123c', fontWeight: 'bold', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                Log Out
              </button>
            </div>

            {/* Bottom Row: Page Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setCurrentView('dashboard')} 
                style={{ padding: '8px 14px', cursor: 'pointer', border: 'none', borderRadius: '6px', background: currentView === 'dashboard' ? '#3b82f6' : '#f1f5f9', color: currentView === 'dashboard' ? 'white' : '#475569', fontWeight: 'bold', transition: '0.2s', whiteSpace: 'nowrap' }}
              >
                📅 My Calendar
              </button>

              <button 
                onClick={() => setCurrentView('earnings')} 
                style={{ padding: '8px 14px', cursor: 'pointer', border: 'none', borderRadius: '6px', background: currentView === 'earnings' ? '#8b5cf6' : '#f1f5f9', color: currentView === 'earnings' ? 'white' : '#475569', fontWeight: 'bold', transition: '0.2s', whiteSpace: 'nowrap' }}
              >
                💰 {isAdmin ? 'Payouts' : 'My Wallet'}
              </button>

              <button 
                onClick={() => setCurrentView('ratersPerformance')} 
                style={{ padding: '8px 14px', cursor: 'pointer', border: 'none', borderRadius: '6px', background: currentView === 'ratersPerformance' ? '#3b82f6' : '#f1f5f9', color: currentView === 'ratersPerformance' ? 'white' : '#475569', fontWeight: 'bold', transition: '0.2s', whiteSpace: 'nowrap' }}
              >
                👥 My Team
              </button>

              <button 
                onClick={() => setCurrentView('accountManagement')} 
                style={{ padding: '8px 14px', cursor: 'pointer', border: 'none', borderRadius: '6px', background: currentView === 'accountManagement' ? '#10b981' : '#ecfdf5', color: currentView === 'accountManagement' ? 'white' : '#047857', fontWeight: 'bold', transition: '0.2s', whiteSpace: 'nowrap' }}
              >
                💼 Agency Finances
              </button>

              <button 
                onClick={() => setCurrentView('payoutLedger')} 
                style={{ padding: '8px 14px', cursor: 'pointer', border: 'none', borderRadius: '6px', background: currentView === 'payoutLedger' ? '#d97706' : '#fef3c7', color: currentView === 'payoutLedger' ? 'white' : '#b45309', fontWeight: 'bold', transition: '0.2s', whiteSpace: 'nowrap' }}
              >
                🏦 Payout Ledger
              </button>

              {isAdmin && (
                <button 
                  onClick={() => setCurrentView('admin')} 
                  style={{ padding: '8px 14px', cursor: 'pointer', border: 'none', borderRadius: '6px', background: currentView === 'admin' ? '#0f172a' : '#f1f5f9', color: currentView === 'admin' ? 'white' : '#475569', fontWeight: 'bold', transition: '0.2s', whiteSpace: 'nowrap' }}
                >
                  🔐 Staff Access
                </button>
              )}
            </div>

          </div>
        ) : (
          // 🚀 RATER / LEADER LAYOUT: STANDARD INLINE ROW
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '20px', flexWrap: 'wrap', flex: 1 }}>
            
            {/* Nav Buttons Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setCurrentView('dashboard')} 
                style={{ padding: '8px 14px', cursor: 'pointer', border: 'none', borderRadius: '6px', background: currentView === 'dashboard' ? '#3b82f6' : '#f1f5f9', color: currentView === 'dashboard' ? 'white' : '#475569', fontWeight: 'bold', transition: '0.2s', whiteSpace: 'nowrap' }}
              >
                📅 My Calendar
              </button>

              <button 
                onClick={() => setCurrentView('earnings')} 
                style={{ padding: '8px 14px', cursor: 'pointer', border: 'none', borderRadius: '6px', background: currentView === 'earnings' ? '#8b5cf6' : '#f1f5f9', color: currentView === 'earnings' ? 'white' : '#475569', fontWeight: 'bold', transition: '0.2s', whiteSpace: 'nowrap' }}
              >
                💰 My Wallet
              </button>

              {isManager && (
                <button 
                  onClick={() => setCurrentView('ratersPerformance')} 
                  style={{ padding: '8px 14px', cursor: 'pointer', border: 'none', borderRadius: '6px', background: currentView === 'ratersPerformance' ? '#3b82f6' : '#f1f5f9', color: currentView === 'ratersPerformance' ? 'white' : '#475569', fontWeight: 'bold', transition: '0.2s', whiteSpace: 'nowrap' }}
                >
                  👥 My Team
                </button>
              )}
            </div>

            {/* Separator Line */}
            <div style={{ width: '2px', height: '30px', backgroundColor: '#cbd5e1', display: window.innerWidth > 768 ? 'block' : 'none' }}></div>

            {/* Account Actions Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'nowrap' }}>
              <span style={{ fontSize: '14px', color: '#475569', fontWeight: '600' }}>{user.email}</span>
              
              <button 
                onClick={() => setIsPwdModalOpen(true)} 
                style={{ padding: '8px 12px', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '6px', background: pwdChangeStatus === 'approved' ? '#ecfdf5' : '#fff', fontSize: '12px', fontWeight: 'bold', color: pwdChangeStatus === 'approved' ? '#059669' : '#334155', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                {pwdChangeStatus === 'approved' ? '🔓 Set Password' : pwdChangeStatus === 'pending' ? '⏳ Pending...' : '🔑 Change Password'}
              </button>

              <button 
                onClick={handleLogout} 
                style={{ padding: '8px 16px', cursor: 'pointer', border: '1px solid #fecdd3', borderRadius: '6px', background: '#fff1f2', color: '#be123c', fontWeight: 'bold', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                Log Out
              </button>
            </div>
          </div>
        )}
      </header>
      
      <main style={{ marginTop: '25px' }}>
        {currentView === 'dashboard' && <TimeLedger user={user} myVersion={myVersion} setCurrentView={setCurrentView} />}
        {currentView === 'workProgress' && <WorkProgress user={user} setCurrentView={setCurrentView} />}
        {currentView === 'earnings' && <Earnings user={user} />}
        {currentView === 'ratersPerformance' && isManager && <RatersPerformance user={user} setCurrentView={setCurrentView} />}
        {currentView === 'teamGraphs' && isManager && <TeamPerformanceGraphs user={user} setCurrentView={setCurrentView} />}
        {currentView === 'accountManagement' && isCoAdmin && <AccountManagement setCurrentView={setCurrentView} currentUser={user} myRole={myRole} />}
        {currentView === 'admin' && isAdmin && <AdminPanel setCurrentView={setCurrentView} currentUser={user} myRole={myRole} />}
        {/* 🚀 ADDED THE ROUTE FOR THE NEW COMPONENT */}
        {currentView === 'payoutLedger' && isCoAdmin && <PayoutLedger user={user} />}
      </main>

      {/* SMART PASSWORD MODAL */}
      {isPwdModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "16px", width: "400px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ width: "50px", height: "50px", backgroundColor: pwdChangeStatus === 'approved' ? "#ecfdf5" : "#f3e8ff", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", margin: "0 auto 15px", color: pwdChangeStatus === 'approved' ? "#10b981" : "#a855f7", fontSize: "24px" }}>🔑</div>
              <h2 style={{ margin: "0 0 5px 0", color: "#1e293b", fontSize: "20px" }}>Change Your Password</h2>
              <p style={{ margin: 0, color: "#64748b", fontSize: "13px", lineHeight: "1.4" }}>For security, password changes require admin approval.</p>
            </div>
            
            {pwdError && <div style={{ color: "#ef4444", fontSize: "12px", marginBottom: "15px", textAlign: "center", backgroundColor: "#fef2f2", padding: "8px", borderRadius: "6px", border: "1px solid #fecdd3" }}>{pwdError}</div>}
            {pwdSuccess && <div style={{ color: "#10b981", fontSize: "12px", marginBottom: "15px", textAlign: "center", backgroundColor: "#ecfdf5", padding: "8px", borderRadius: "6px", border: "1px solid #bbf7d0" }}>✅ Password successfully updated!</div>}

            {pwdChangeStatus === null && (
               <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                 <button onClick={() => setIsPwdModalOpen(false)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "white", fontWeight: "bold", cursor: "pointer", color: "#475569" }}>Cancel</button>
                 <button onClick={requestPasswordChange} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", backgroundColor: "#a855f7", color: "white", fontWeight: "bold", cursor: "pointer" }}>Send Request to Admin</button>
               </div>
            )}

            {pwdChangeStatus === 'pending' && (
               <div style={{ textAlign: "center", marginTop: "20px" }}>
                 <div style={{ padding: "15px", backgroundColor: "#fffbeb", color: "#d97706", borderRadius: "8px", fontWeight: "bold", marginBottom: "15px", border: "1px solid #fde68a" }}>⏳ Waiting for Admin Approval...</div>
                 <button onClick={() => setIsPwdModalOpen(false)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "white", fontWeight: "bold", cursor: "pointer", color: "#475569" }}>Close</button>
               </div>
            )}

            {pwdChangeStatus === 'approved' && (
              <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#475569", marginBottom: "5px" }}>Type New Password <span style={{color: "#ef4444"}}>*</span></label>
                  <input type="password" placeholder="Min 6 characters..." value={newPwd} onChange={(e) => setNewPwd(e.target.value)} style={{ width: "95%", padding: "10px", borderRadius: "8px", border: "1px solid #10b981", outline: "none", fontSize: "14px" }} autoFocus required />
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button type="button" onClick={() => setIsPwdModalOpen(false)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "white", color: "#475569", fontWeight: "bold", cursor: "pointer" }}>Cancel</button>
                  <button type="submit" style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", backgroundColor: "#10b981", color: "white", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 6px rgba(16, 185, 129, 0.3)" }}>Save New Password</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default App;