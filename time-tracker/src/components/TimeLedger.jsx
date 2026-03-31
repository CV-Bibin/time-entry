import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc, query, where, onSnapshot } from "firebase/firestore";

import CustomAlert from "./CustomAlert";
import CalendarBoard from "./CalendarBoard";
import DashboardSidebar from "./DashboardSidebar";

// --- DATE HELPERS ---
const getLocalDateString = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const formatReadableDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-");
  const date = new Date(y, m - 1, d);
  const getOrdinal = (n) => { if (n > 3 && n < 21) return 'th'; return ['th','st','nd','rd'][n % 10] || 'th'; };
  return `${date.getDate()}${getOrdinal(date.getDate())} ${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
};
const formatDecimalToHMS = (dec) => {
  if (dec <= 0) return "(0h 0m 0s)";
  const sTot = Math.round(dec * 3600);
  return `(${Math.floor(sTot / 3600)}h ${Math.floor((sTot % 3600) / 60)}m ${sTot % 60}s)`;
};

export default function TimeLedger({ user, setCurrentView }) {
  const today = new Date();
  const todayString = getLocalDateString(today);
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(today.getDate() - 30);
  const minDateString = getLocalDateString(thirtyDaysAgo);

  const [selectedDate, setSelectedDate] = useState(todayString);
  const [inputHours, setInputHours] = useState("");
  const [inputMinutes, setInputMinutes] = useState("");
  const [inputSeconds, setInputSeconds] = useState("");
  
  const [allEntries, setAllEntries] = useState([]);
  const [monthlyEntries, setMonthlyEntries] = useState([]);
  
  const [editingId, setEditingId] = useState(null);
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, type: 'info', title: '', message: '' });

  const [isPrevMonthLocked, setIsPrevMonthLocked] = useState(true);

  const currentMonthId = `${selectedDate.split("-")[1]}-${selectedDate.split("-")[0]}`;
  const targetMonthPrefix = `${selectedDate.split("-")[0]}-${selectedDate.split("-")[1]}`;
  const todayYYYY_MM = todayString.substring(0, 7);
  
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthId = `${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${prevMonthDate.getFullYear()}`;
  const prevMonthName = prevMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const prevMonthYYYY_MM = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // ==========================================
  // 🛡️ NEW ACCOUNT BYPASS LOGIC
  // ==========================================
  // Safely grab the exact moment the user's account was created in Firebase
  const creationDate = user?.metadata?.creationTime ? new Date(user.metadata.creationTime) : new Date();
  const creationYYYY_MM = `${creationDate.getFullYear()}-${String(creationDate.getMonth() + 1).padStart(2, '0')}`;
  
  // If the previous month is chronologically BEFORE their creation month, they are excused!
  const requiresPrevMonthLock = prevMonthYYYY_MM >= creationYYYY_MM;

  const isViewedMonthOver = targetMonthPrefix < todayYYYY_MM;
  const isViewingCurrentMonth = targetMonthPrefix === todayYYYY_MM;
  
  // FIX: Added requiresPrevMonthLock so brand new users don't get blocked
  const isEntryBlocked = isViewingCurrentMonth && !isPrevMonthLocked && requiresPrevMonthLock;
  const isFormDisabled = isMonthLocked || isEntryBlocked; 

  const showAlert = (type, title, message, onConfirm = null, confirmText = 'Confirm') => setAlertConfig({ isOpen: true, type, title, message, onConfirm, confirmText });
  const closeAlert = () => setAlertConfig(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "monthly_locks", `${user.uid}_${currentMonthId}`), (snap) => setIsMonthLocked(snap.exists() && snap.data().completed));
  }, [user, currentMonthId]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "monthly_locks", `${user.uid}_${prevMonthId}`), (snap) => {
      setIsPrevMonthLocked(snap.exists() && snap.data().completed);
    });
  }, [user, prevMonthId]);

  useEffect(() => {
    if (!user) return;
    setAllEntries([]);
    setMonthlyEntries([]); 
    const q = query(collection(db, "time_entries"), where("uid", "==", user.uid));
    return onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllEntries(fetched);
      setMonthlyEntries(fetched.filter(e => e.assigned_date.startsWith(targetMonthPrefix)).sort((a, b) => b.timestamp_entered - a.timestamp_entered));
    });
  }, [user, targetMonthPrefix]);

  const calcHrs = (parseFloat(inputHours) || 0) + (parseFloat(inputMinutes) || 0) / 60 + (parseFloat(inputSeconds) || 0) / 3600;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isFormDisabled || (calcHrs <= 0 && !editingId)) return;
    if (selectedDate < minDateString) return showAlert('error', 'Date Locked', 'Older than 30 days.');

    const hoursToSave = Number(calcHrs.toFixed(3));
    const raw = `${inputHours || 0}h ${inputMinutes || 0}m ${inputSeconds || 0}s`;
    
    setInputHours(''); setInputMinutes(''); setInputSeconds('');
    const currentId = editingId; setEditingId(null);

    try {
      if (currentId) await updateDoc(doc(db, "time_entries", currentId), { time_value_hours: hoursToSave, raw_input: raw, last_edited: Date.now() });
      else await addDoc(collection(db, 'time_entries'), { uid: user.uid, email: user.email, assigned_date: selectedDate, time_value_hours: hoursToSave, timestamp_entered: Date.now(), raw_input: raw, groupId: "Unassigned" });
    } catch (err) { showAlert('error', 'Error', 'Failed to save.'); }
  };

  const handleMarkAsCompleted = () => {
    const monthName = new Date(selectedDate).toLocaleString('default', { month: 'long', year: 'numeric' });
    showAlert('confirm', `Finalize ${monthName}?`, `No further edits allowed.`, async () => {
      try { await setDoc(doc(db, "monthly_locks", `${user.uid}_${currentMonthId}`), { uid: user.uid, month_year: currentMonthId, completed: true, completed_at: Date.now() }); } 
      catch (err) { showAlert('error', 'Error', 'Could not lock.'); }
    }, 'Yes, Lock Month');
  };

  const handleDelete = (id) => showAlert('danger-confirm', 'Delete Entry?', 'Permanently delete this?', async () => await deleteDoc(doc(db, "time_entries", id)), 'Delete');

  const dailyEntries = monthlyEntries.filter(e => e.assigned_date === selectedDate);
  const totalToday = dailyEntries.reduce((s, e) => s + e.time_value_hours, 0);
  const monthlyTotal = monthlyEntries.reduce((s, e) => s + e.time_value_hours, 0);

  const dayInfo = (() => {
    const diff = Math.round((new Date(selectedDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
    if (diff === 0) return { t: "Entering Today's hrs", c: "#28A745" };
    if (diff === -1) return { t: "Entering Yesterday's hrs", c: "#FD7E14" };
    if (diff === -2) return { t: "Entering Day Before Yesterday's hrs", c: "#E83E8C" };
    return { t: `Entering hrs for ${formatReadableDate(selectedDate)}`, c: "#DC3545" };
  })();

  return (
    <div style={{ width: "100%", boxSizing: "border-box", padding: "0", fontFamily: "sans-serif" }}>
      
      <CustomAlert config={alertConfig} closeAlert={closeAlert} />

      {isMonthLocked && <div style={{ backgroundColor: '#d1ecf1', color: '#0c5460', padding: '15px', borderRadius: '8px', margin: '0 auto 20px auto', textAlign: 'center', fontWeight: 'bold' }}>🔒 Month marked as COMPLETED. Records are locked.</div>}

      {isEntryBlocked && !isMonthLocked && (
        <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '15px', borderRadius: '8px', margin: '0 auto 20px auto', textAlign: 'center', fontWeight: 'bold', border: '1px solid #ffeeba' }}>
          ⚠️ Action Required: You must finalize <u>{prevMonthName}</u> first.<br/>
          <span style={{fontSize: '13px', fontWeight: 'normal'}}>Please select a date from {prevMonthName} in the calendar to lock it.</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "row", flexWrap: "nowrap", gap: "25px", alignItems: "flex-start" }}>
        
        {/* =======================================
            COLUMN 1: INPUT & RECEIPT
        ======================================= */}
        <div style={{ flex: 2, minWidth: 0 }}>
          <div style={{ padding: "30px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: isFormDisabled ? "#f8f9fa" : "#fff", opacity: isFormDisabled ? 0.8 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" }}>
              <h3 style={{ margin: 0, color: isFormDisabled ? "#666" : dayInfo.c, fontWeight: "900", fontSize: '22px' }}>{dayInfo.t}</h3>
              <input type="date" value={selectedDate} max={todayString} min={minDateString} onChange={(e) => { setSelectedDate(e.target.value || todayString); setEditingId(null); }} style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc", cursor: "pointer", fontSize: "16px", maxWidth: "160px" }} />
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                {[ {l:'Hours', v:inputHours, s:setInputHours}, {l:'Minutes', v:inputMinutes, s:setInputMinutes}, {l:'Seconds', v:inputSeconds, s:setInputSeconds} ].map((f) => (
                  <div key={f.l} style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: "14px", color: "#666", marginBottom: "6px", fontWeight: "bold" }}>{f.l}</label>
                    <input disabled={isFormDisabled} type="number" min="0" step="any" value={f.v} onChange={(e) => f.s(e.target.value)} style={{ width: "100%", padding: "15px", boxSizing: "border-box", borderRadius: "6px", border: "1px solid #ccc", fontSize: "18px" }} />
                  </div>
                ))}
              </div>
              <button type="submit" disabled={isFormDisabled || calcHrs <= 0} style={{ width: "100%", padding: "15px", backgroundColor: isFormDisabled ? "#ccc" : (editingId ? "#FFC107" : (calcHrs > 0 ? "#007BFF" : "#ccc")), color: editingId ? "#000" : "white", border: "none", borderRadius: "6px", fontSize: "18px", cursor: isFormDisabled ? "not-allowed" : "pointer", fontWeight: "bold" }}>
                {isMonthLocked ? "Locked" : (isEntryBlocked ? "Previous Month Pending" : (editingId ? "Update Entry" : `Submit ${calcHrs.toFixed(3)} hrs ${formatDecimalToHMS(calcHrs)}`))}
              </button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setInputHours(''); setInputMinutes(''); setInputSeconds(''); }} style={{ width: '100%', marginTop: '12px', background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', textDecoration: 'underline', fontSize: "16px" }}>Cancel Edit</button>}
            </form>
          </div>

          <div style={{ marginTop: "25px", padding: "30px", backgroundColor: "#f9f9f9", borderRadius: "8px", border: "1px solid #eee" }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #ddd", paddingBottom: "15px", marginBottom: "20px" }}>
              <h4 style={{ margin: 0, fontSize: "20px", color: "#333" }}>Receipt for {selectedDate}</h4>
              <h4 style={{ margin: 0, color: "#007BFF", fontSize: "20px" }}>Total: {totalToday.toFixed(3)} hrs</h4>
            </div>

            {dailyEntries.length === 0 ? <p style={{ textAlign: "center", color: "#888", fontStyle: "italic", fontSize: "16px" }}>No time logged for this date yet.</p> : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {dailyEntries.map((e) => (
                  <li key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderBottom: "1px solid #eee" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#555", fontSize: "14px", marginBottom: "4px" }}>
                        {new Date(e.timestamp_entered).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {e.last_edited && <span style={{ fontStyle: "italic", color: "#999", marginLeft: "5px" }}>(edited)</span>}
                      </div>
                      <span style={{ fontWeight: "bold", fontSize: "18px" }}>+ {e.time_value_hours} hrs</span>
                      <span style={{ fontSize: "14px", color: "#999", marginLeft: "8px" }}>({e.raw_input})</span>
                    </div>
                    {!isMonthLocked && (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => { setEditingId(e.id); const p = e.raw_input.match(/\d+(\.\d+)?/g); if (p) { setInputHours(p[0]); setInputMinutes(p[1]); setInputSeconds(p[2]); } window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ background: '#e3f2fd', color: '#1976d2', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: "bold" }}>Edit</button>
                        <button onClick={() => handleDelete(e.id)} style={{ background: '#ffebee', color: '#d32f2f', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: "bold" }}>Delete</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* =======================================
            COLUMN 2: CALENDAR OVERVIEW
        ======================================= */}
        <div style={{ flex: 3, minWidth: 0 }}>
          <CalendarBoard 
            user={user} 
            selectedDate={selectedDate} setSelectedDate={setSelectedDate} setEditingId={setEditingId}
            monthlyEntries={monthlyEntries} monthlyTotal={monthlyTotal} targetMonthPrefix={targetMonthPrefix}
            todayString={todayString} minDateString={minDateString} 
            isMonthLocked={isMonthLocked} handleMarkAsCompleted={handleMarkAsCompleted} formatDecimalToHMS={formatDecimalToHMS}
            isViewedMonthOver={isViewedMonthOver} 
            setCurrentView={setCurrentView}
          />
        </div>

        {/* =======================================
            COLUMN 3: NOTIFICATIONS & STATUS
        ======================================= */}
        <DashboardSidebar 
          user={user} 
          isMonthLocked={isMonthLocked} 
          totalToday={totalToday} 
          allEntries={allEntries}
          selectedDate={selectedDate}
        />
        
      </div>
    </div>
  );
}