import TimeLedger from './components/TimeLedger';
import WorkProgress from './components/WorkProgress'; // <-- NEW IMPORT
import { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { auth } from './firebase';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // NEW: View State (Switches between 'dashboard' and 'progress')
  const [currentView, setCurrentView] = useState('dashboard');
  
  // Form States
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevents the page from reloading
    setErrorMsg(''); // Clear old errors

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
    await signOut(auth);
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

  // --- THE MAIN DASHBOARD ---
  return (
    <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', margin: '0', padding: '20px 40px', fontFamily: 'sans-serif' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '15px' }}>
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '14px', color: '#555' }}>{user.email}</span>
          <button onClick={handleLogout} style={{ padding: '6px 12px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px', background: '#fff' }}>Log Out</button>
        </div>
      </header>
      
      <main style={{ marginTop: '25px' }}>
        {/* Toggle between the two screens based on the currentView state */}
        {currentView === 'dashboard' ? (
          <TimeLedger user={user} setCurrentView={setCurrentView} />
        ) : (
          <WorkProgress user={user} setCurrentView={setCurrentView} />
        )}
      </main>
      
    </div>
  );
}

export default App;