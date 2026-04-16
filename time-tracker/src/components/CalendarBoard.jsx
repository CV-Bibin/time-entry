import React, { useState, useEffect } from 'react';
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

export default function CalendarBoard({
  user,
  myRole, 
  payData = {}, 
  selectedDate, setSelectedDate, setEditingId,
  monthlyEntries, monthlyTotal, targetMonthPrefix,
  todayString, minDateString, 
  isMonthLocked, handleMarkAsCompleted, formatDecimalToHMS,
  isViewedMonthOver, setCurrentView
}) {

  const [year, month] = targetMonthPrefix.split("-");
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); 
  const monthName = new Date(selectedDate).toLocaleString('default', { month: 'long', year: 'numeric' });

  // 🚀 NEW: LIVE DATABASE FETCH
  const [liveUserData, setLiveUserData] = useState(null);

  useEffect(() => {
    if (!user?.email) return;
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const allUsers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const me = allUsers.find(u => u.email === user.email);
      if (me) setLiveUserData(me);
    });
    return () => unsub();
  }, [user?.email]);

  // ==========================================
  // 🗓️ MONTH NAVIGATION LOGIC
  // ==========================================
  const handlePrevMonth = () => {
    const [y, m] = selectedDate.split("-");
    const prevDate = new Date(y, m - 1 - 1, 1);
    const newDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01`;
    setSelectedDate(newDateStr);
    setEditingId(null);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedDate.split("-");
    const nextDate = new Date(y, m - 1 + 1, 1);
    const newDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-01`;
    setSelectedDate(newDateStr);
    setEditingId(null);
  };

  const isViewingCurrentMonth = targetMonthPrefix >= todayString.substring(0, 7);

  // ==========================================
  // 💰 SMART PAY RATE CALCULATION
  // ==========================================
  
  // MERGE: Overrides any broken/stale props with the live, accurate database values
  const d = { ...user, ...payData, ...(liveUserData || {}) };

  let baseRate = Number(d.raterBaseINR) || 0;
  let bonusRate = Number(d.raterMaxINR) || baseRate;
  const currencySymbol = '₹';

  // FAILSAFE: If no rater or rater rate is 0, fetch the Leader's pay
  const isNoRater = !!d.noRater || String(d.raterName || "").trim().toLowerCase() === "self" || String(d.raterName || "").trim() === "";
  if (isNoRater || baseRate <= 0) {
    baseRate = Number(d.leaderBaseINR) || 0;
    bonusRate = Number(d.leaderMaxINR) || baseRate;
  }

  // MANAGERS ALWAYS SEE LEADER PAY (L. PAY)
  if (myRole === 'leader' || myRole === 'co-admin' || myRole === 'admin') {
    baseRate = Number(d.leaderBaseINR) || 0;
    bonusRate = Number(d.leaderMaxINR) || baseRate;
  }

  const safeMonthlyTotal = Number(monthlyTotal) || 0;
  const threshold = Number(d.bonusThreshold) || 40;
  
  // 🚀 STRICT BONUS CHECKER: ONLY triggers if the checkbox is actually checked in DB!
  const hasBonusFlag = d.hasBonus === true || String(d.hasBonus).toLowerCase() === "true";
  const isBonusUnlocked = hasBonusFlag && safeMonthlyTotal >= threshold;
  
  const currentRate = isBonusUnlocked ? bonusRate : baseRate;
  const estimatedEarnings = safeMonthlyTotal * currentRate;
  const hoursNeededForBonus = Math.max(0, threshold - safeMonthlyTotal);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // ==========================================
  // 📥 EXCEL EXPORT
  // ==========================================
  const handleExportToExcel = () => {
    if (monthlyEntries.length === 0) {
      alert("There is no data to export for this month.");
      return;
    }

    let tableHtml = `
      <html xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
          <meta charset="utf-8">
          <style>
            table { border-collapse: collapse; font-family: sans-serif; }
            th { background-color: #007BFF; color: #ffffff; font-weight: bold; border: 1px solid #dddddd; padding: 12px; text-align: center; }
            td { border: 1px solid #dddddd; padding: 10px; text-align: center; vertical-align: middle; }
            h2 { color: #333; margin-bottom: 5px; }
            .med-col { width: 130px; }
            .wide-col { width: 220px; } 
            .total-text { font-weight: bold; color: #007BFF; }
          </style>
        </head>
        <body>
          <h2>Timesheet Report - ${monthName}</h2>
          <p><strong>User:</strong> ${user?.email || 'N/A'}</p>
          <p><strong>Total Hours:</strong> ${safeMonthlyTotal.toFixed(3)}</p>
          <p><strong>Estimated Pay:</strong> ${safeMonthlyTotal.toFixed(2)} hrs × ${currencySymbol}${currentRate} = ${formatCurrency(estimatedEarnings)}</p>
          <table>
            <thead>
              <tr>
                <th class="med-col">Date</th>
                <th class="wide-col">Time Entry Logged</th>
                <th class="med-col">Raw Time Input</th>
                <th class="med-col">Total Decimal Hours</th>
              </tr>
            </thead>
            <tbody>
    `;

    monthlyEntries.forEach(entry => {
      const loggedAt = new Date(entry.timestamp_entered).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      tableHtml += `
        <tr>
          <td>${entry.assigned_date}</td>
          <td>${loggedAt}</td>
          <td>${entry.raw_input}</td>
          <td class="total-text">${entry.time_value_hours}</td>
        </tr>
      `;
    });

    tableHtml += `
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${user?.email || 'User'}_${monthName.replace(" ", "_")}_Timesheet.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- CALENDAR GRID LOGIC ---
  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => <div key={`blank-${i}`} style={{ padding: '8px' }}></div>);
  
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `${year}-${month}-${String(dayNum).padStart(2, '0')}`;
    const dayTotal = monthlyEntries.filter(e => e.assigned_date === dateStr).reduce((s, e) => s + e.time_value_hours, 0);
    
    const isSelected = dateStr === selectedDate;
    const isToday = dateStr === todayString;
    const isFuture = dateStr > todayString;
    const isLocked = dateStr < minDateString;
    const isDisabled = isLocked || isFuture;
    
    const hasHours = dayTotal > 0;

    return (
      <div 
        key={dayNum} 
        onClick={isDisabled ? undefined : () => { setSelectedDate(dateStr); setEditingId(null); }}
        style={{ 
          backgroundColor: isSelected ? '#eff6ff' : (isDisabled ? '#f8fafc' : '#ffffff'),
          border: isSelected ? '2px solid #3b82f6' : (isToday ? '1px solid #93c5fd' : '1px solid #e2e8f0'),
          borderRadius: '10px',
          padding: '8px',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.6 : 1,
          boxShadow: isSelected ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '85px',
          transition: 'all 0.2s ease',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ fontWeight: '800', fontSize: '14px', color: isSelected ? '#1e40af' : (isToday ? '#2563eb' : (isDisabled ? '#94a3b8' : '#334155')) }}>
            {dayNum}
          </span>
          {isToday && (
            <span style={{ fontSize: '9px', fontWeight: '800', color: '#fff', backgroundColor: '#3b82f6', padding: '2px 5px', borderRadius: '4px', letterSpacing: '0.5px' }}>
              TODAY
            </span>
          )}
        </div>

        <div style={{ alignSelf: 'center', marginTop: 'auto', width: '100%' }}>
          {hasHours ? (
            <div style={{ 
              backgroundColor: isSelected ? '#3b82f6' : '#10b981', 
              color: '#fff', 
              fontSize: '13px', 
              fontWeight: '800', 
              padding: '4px 0', 
              borderRadius: '6px', 
              textAlign: 'center',
              boxShadow: isSelected ? 'none' : '0 2px 4px rgba(16,185,129,0.2)'
            }}>
              {dayTotal.toFixed(1)}h
            </div>
          ) : (
            <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#cbd5e1' }}>
              -
            </div>
          )}
        </div>
      </div>
    );
  });

  const cleanHmsString = formatDecimalToHMS(safeMonthlyTotal).replace(/[()]/g, '');

  return (
    <div style={{ flex: 1, minWidth: 0, padding: "20px", backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
      
      {/* 1. MONTHLY TOTAL HEADER WITH NAVIGATION ARROWS */}
      <div style={{ textAlign: "center", paddingBottom: "15px" }}>
        
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "15px", marginBottom: "5px" }}>
          <button 
            onClick={handlePrevMonth} 
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#007BFF", padding: "5px", display: "flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px", borderRadius: "50%", transition: "background 0.2s" }}
            onMouseOver={(e) => e.target.style.background = "#e3f2fd"}
            onMouseOut={(e) => e.target.style.background = "none"}
          >
            ◀
          </button>
          
          <h4 style={{ margin: 0, color: "#666", textTransform: "uppercase", letterSpacing: "1px", fontSize: "13px", minWidth: "150px" }}>
            {monthName} Overview
          </h4>
          
          <button 
            onClick={handleNextMonth} 
            disabled={isViewingCurrentMonth}
            style={{ background: "none", border: "none", cursor: isViewingCurrentMonth ? "not-allowed" : "pointer", fontSize: "16px", color: isViewingCurrentMonth ? "#ccc" : "#007BFF", padding: "5px", display: "flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px", borderRadius: "50%", transition: "background 0.2s" }}
            onMouseOver={(e) => !isViewingCurrentMonth && (e.target.style.background = "#e3f2fd")}
            onMouseOut={(e) => e.target.style.background = "none"}
          >
            ▶
          </button>
        </div>
        
        {/* BIG TEXT: Real-time format */}
        <div style={{ fontSize: "36px", fontWeight: "900", color: "#007BFF", margin: "8px 0", letterSpacing: "-0.5px" }}>
          {cleanHmsString}
        </div>
        
        {/* SMALL TEXT: Decimal format */}
        <div style={{ fontSize: "15px", color: "#666", fontWeight: "bold", marginBottom: "12px" }}>
          ({safeMonthlyTotal.toFixed(3)} hrs)
        </div>

        {/* 🚀 BONUS PROGRESS TRACKER */}
        {hasBonusFlag && threshold > 0 && (
          <div style={{ marginBottom: "12px", fontSize: "13px" }}>
            {isBonusUnlocked ? (
              <span style={{ color: "#d97706", fontWeight: "bold", backgroundColor: "#fffbeb", padding: "4px 10px", borderRadius: "12px" }}>
                🎉 Target Hit! Earning {currencySymbol}{bonusRate}/hr
              </span>
            ) : (
              <span style={{ color: "#64748b" }}>
                Work <b>{hoursNeededForBonus.toFixed(1)} more hours</b> to unlock {currencySymbol}{bonusRate}/hr
              </span>
            )}
          </div>
        )}

        {/* 💰 EXPLICIT EARNINGS BADGE */}
        <div style={{ display: "inline-block", backgroundColor: "#e8f5e9", color: "#155724", padding: "6px 16px", borderRadius: "20px", fontSize: "15px", fontWeight: "bold", border: "1px solid #c3e6cb", boxShadow: "0 2px 4px rgba(40,167,69,0.1)" }}>
          Estimated Pay: {safeMonthlyTotal.toFixed(2)} hrs × {currencySymbol}{currentRate} = {formatCurrency(estimatedEarnings)}
        </div>
      </div>

      {/* 2. ACTION BUTTONS ROW */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "15px", paddingBottom: "15px", borderBottom: "2px solid #f0f0f0", flexWrap: "wrap", marginTop: "10px" }}>
        <button 
          onClick={handleExportToExcel}
          disabled={monthlyEntries.length === 0}
          style={{ flex: 1, padding: "10px", backgroundColor: monthlyEntries.length > 0 ? "#28a745" : "#ccc", color: "white", border: "none", borderRadius: "6px", cursor: monthlyEntries.length > 0 ? "pointer" : "not-allowed", fontSize: "13px", fontWeight: "bold", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
        >
          📊 View in Excel
        </button>

      {myRole !== 'rater' && (
          <button 
            onClick={() => setCurrentView('teamGraphs')}
            style={{ flex: 1, padding: "10px", backgroundColor: "#3b82f6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
          >
            📊 Team Performance
          </button>
        )}

        <button 
          onClick={() => setCurrentView('workProgress')}
          style={{ flex: 1, padding: "10px", backgroundColor: "#17a2b8", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
        >
          📈 View Work Progress
        </button>
      </div>

     {/* 3. CALENDAR GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: '4px' }}>
            {d}
          </div>
        ))}
        {blanks}
        {days}
      </div>

      {/* 4. CONDITIONAL LOCK BUTTON / WAITING STATE */}
      {!isMonthLocked && isViewedMonthOver && (
        <button onClick={handleMarkAsCompleted} style={{ width: '100%', marginTop: '20px', padding: '12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: "bold", fontSize: "14px" }}>
          ✅ Lock & Finalize {monthName}
        </button>
      )}
      {!isMonthLocked && !isViewedMonthOver && (
        <div style={{ width: '100%', marginTop: '20px', padding: '12px', backgroundColor: '#f8f9fa', color: '#6c757d', border: '1px dashed #ccc', borderRadius: '6px', textAlign: 'center', fontSize: "14px" }}>
          ⏳ <b>{monthName}</b> can be locked on the 1st of next month.
        </div>
      )}
    </div>
  );
}