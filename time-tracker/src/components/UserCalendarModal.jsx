import React, { useState, useMemo } from 'react';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatTime = (decimalHours) => {
  const val = Number(decimalHours);
  if (isNaN(val) || val <= 0) return "-";
  const h = Math.floor(val);
  const m = Math.round((val - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const formatMoney = (num) => {
  const val = Number(num);
  return isNaN(val) ? "0" : val.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

export default function UserCalendarModal({ selectedAccount, initialMonth, timeData, onClose }) {
  const [currentMonthStr, setCurrentMonthStr] = useState(initialMonth);

  // Handle Month Navigation inside Modal
  const changeMonth = (offset) => {
    const [y, m] = currentMonthStr.split('-').map(Number);
    let newMonth = m - 1 + offset;
    let newYear = y;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    setCurrentMonthStr(`${newYear}-${String(newMonth + 1).padStart(2, '0')}`);
  };

  // Filter logs & Calculate Stats
  const { logs, mTotal, daysActive, rev, cost, isBonusMet, displayMonthName } = useMemo(() => {
    const [yStr, mStr] = currentMonthStr.split('-');
    const mIndex = parseInt(mStr, 10) - 1;
    const dispName = `${MONTHS[mIndex]} ${yStr}`;

    const filteredLogs = timeData.filter(l => l.email === selectedAccount.email && typeof l.assigned_date === 'string' && l.assigned_date.startsWith(currentMonthStr));
    
    let totalHrs = 0;
    const uniqueDays = new Set();

    filteredLogs.forEach(l => {
      const h = Number(l.time_value_hours) || 0;
      if (h > 0) {
        totalHrs += h;
        uniqueDays.add(l.assigned_date);
      }
    });

    const target = Number(selectedAccount.bonusThreshold) || 40;
    const bonusMet = selectedAccount.hasBonus && totalHrs >= target;
    const cLRate = bonusMet ? (Number(selectedAccount.leaderMaxINR) || Number(selectedAccount.leaderBaseINR) || 0) : (Number(selectedAccount.leaderBaseINR) || 0);
    const cRRate = bonusMet ? (Number(selectedAccount.raterMaxINR) || Number(selectedAccount.raterBaseINR) || 0) : (Number(selectedAccount.raterBaseINR) || 0);

    return {
      logs: filteredLogs,
      mTotal: totalHrs,
      daysActive: uniqueDays.size,
      rev: totalHrs * cLRate,
      cost: totalHrs * cRRate,
      isBonusMet: bonusMet,
      displayMonthName: dispName
    };
  }, [currentMonthStr, timeData, selectedAccount]);

  // Calendar Grid Logic
  const [yStr, mStr] = currentMonthStr.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayIndex = new Date(year, month - 1, 1).getDay();
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const blanks = Array.from({ length: firstDayIndex }, () => null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const gridItems = [...blanks, ...days];

  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "850px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)" }}>
        
        {/* MODAL HEADER */}
        <div style={{ padding: "20px 30px", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: "0 0 4px 0", color: "#0f172a", fontSize: "24px" }}>Performance Report</h2>
            <div style={{ color: "#64748b", fontWeight: "600", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{color: "#3b82f6"}}>📧</span> {selectedAccount.email} 
              {selectedAccount.status === 'suspended' && <span style={{backgroundColor: "#fef2f2", color: "#e11d48", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", border: "1px solid #fecdd3"}}>Account Frozen</span>}
            </div>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            {/* MONTH NAVIGATOR */}
            <div style={{ display: "flex", alignItems: "center", backgroundColor: "#f1f5f9", borderRadius: "8px", padding: "4px" }}>
              <button onClick={() => changeMonth(-1)} style={{ border: "none", background: "none", cursor: "pointer", padding: "6px 12px", borderRadius: "6px", fontWeight: "bold", color: "#475569" }}>◀</button>
              <span style={{ fontWeight: "800", color: "#0f172a", minWidth: "90px", textAlign: "center" }}>{displayMonthName}</span>
              <button onClick={() => changeMonth(1)} style={{ border: "none", background: "none", cursor: "pointer", padding: "6px 12px", borderRadius: "6px", fontWeight: "bold", color: "#475569" }}>▶</button>
            </div>
            <button onClick={onClose} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", fontSize: "14px", color: "#64748b", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", transition: "0.2s" }}>✕</button>
          </div>
        </div>

        {/* QUICK STATS DASHBOARD */}
        <div style={{ padding: "25px 30px", backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "15px" }}>
          <div style={{ backgroundColor: "#fff", padding: "15px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "700", textTransform: "uppercase" }}>Total Logged</div>
            <div style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a", marginTop: "4px" }}>{formatTime(mTotal)}</div>
          </div>
          <div style={{ backgroundColor: "#fff", padding: "15px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "700", textTransform: "uppercase" }}>Days Active</div>
            <div style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a", marginTop: "4px" }}>{daysActive} <span style={{fontSize:"13px", color:"#94a3b8", fontWeight:"600"}}>days</span></div>
          </div>
          <div style={{ backgroundColor: "#eff6ff", padding: "15px", borderRadius: "12px", border: "1px solid #bfdbfe", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: "12px", color: "#1d4ed8", fontWeight: "700", textTransform: "uppercase" }}>Generated Rev</div>
            <div style={{ fontSize: "22px", fontWeight: "900", color: "#1e3a8a", marginTop: "4px" }}>₹{formatMoney(rev)}</div>
          </div>
          <div style={{ backgroundColor: isBonusMet ? "#ecfdf5" : "#fdf2f8", padding: "15px", borderRadius: "12px", border: `1px solid ${isBonusMet ? '#a7f3d0' : '#fbcfe8'}`, boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: "12px", color: isBonusMet ? "#047857" : "#be123c", fontWeight: "700", textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
              Est. Payout {isBonusMet && <span title="Bonus Active">🎯</span>}
            </div>
            <div style={{ fontSize: "22px", fontWeight: "900", color: isBonusMet ? "#064e3b" : "#9f1239", marginTop: "4px" }}>₹{formatMoney(cost)}</div>
          </div>
        </div>

        {/* CALENDAR GRID */}
        <div style={{ padding: "30px" }}>
          
          {/* TARGET PROGRESS BARS */}
          <div style={{ display: "flex", gap: "20px", marginBottom: "25px", flexWrap: "wrap" }}>
            
            {/* 5-Hour Monthly Target */}
            <div style={{ flex: "1 1 250px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "700", color: "#64748b", marginBottom: "8px" }}>
                <span>Monthly Target Progress</span>
                <span style={{ color: mTotal >= 5 ? "#10b981" : "#ea580c" }}>{mTotal.toFixed(1)} / 5 hrs</span>
              </div>
              <div style={{ width: "100%", height: "8px", backgroundColor: "#f1f5f9", borderRadius: "10px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                <div style={{ width: `${Math.min((mTotal / 5) * 100, 100)}%`, height: "100%", backgroundColor: mTotal >= 5 ? "#10b981" : "#f59e0b", borderRadius: "10px", transition: "width 0.5s ease" }} />
              </div>
            </div>

            {/* 20-Hour Quarter Target */}
            <div style={{ flex: "1 1 250px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "700", color: "#64748b", marginBottom: "8px" }}>
                <span>Quarter Target Progress</span>
                <span style={{ color: mTotal >= 20 ? "#10b981" : "#ea580c" }}>{mTotal.toFixed(1)} / 20 hrs</span>
              </div>
              <div style={{ width: "100%", height: "8px", backgroundColor: "#f1f5f9", borderRadius: "10px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                <div style={{ width: `${Math.min((mTotal / 20) * 100, 100)}%`, height: "100%", backgroundColor: mTotal >= 20 ? "#10b981" : "#f59e0b", borderRadius: "10px", transition: "width 0.5s ease" }} />
              </div>
            </div>

          </div>

          {/* Grid Headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "10px", marginBottom: "10px" }}>
            {dayNames.map(d => (
              <div key={d} style={{ textAlign: "center", fontWeight: "800", color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>{d}</div>
            ))}
          </div>

          {/* Grid Body */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "10px" }}>
            {gridItems.map((dayNum, idx) => {
              if (dayNum === null) return <div key={`blank-${idx}`} style={{ backgroundColor: "transparent" }}></div>;
              
              const dateStr = `${currentMonthStr}-${String(dayNum).padStart(2, '0')}`;
              const dayLogs = logs.filter(l => l.assigned_date === dateStr);
              const dayTotal = dayLogs.reduce((sum, l) => sum + (Number(l.time_value_hours) || 0), 0);
              
              const isToday = dateStr === todayStr;
              const hasHours = dayTotal > 0;

              return (
                <div key={dayNum} style={{ 
                  backgroundColor: hasHours ? "#ecfdf5" : "#f8fafc", 
                  border: `1px solid ${hasHours ? '#a7f3d0' : (isToday ? '#93c5fd' : '#e2e8f0')}`, 
                  borderRadius: "12px", 
                  minHeight: "90px", 
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: isToday ? "0 0 0 2px #eff6ff" : "none",
                  transition: "0.2s"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "15px", fontWeight: "800", color: isToday ? "#2563eb" : (hasHours ? "#065f46" : "#94a3b8") }}>
                      {dayNum}
                    </span>
                    {isToday && <span style={{ fontSize: "10px", fontWeight: "800", color: "#3b82f6", backgroundColor: "#eff6ff", padding: "2px 6px", borderRadius: "10px" }}>TODAY</span>}
                  </div>
                  
                  {/* ONLY SHOW TOTAL HOURS IN A DAY */}
                  {hasHours && (
                    <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ textAlign: "center", backgroundColor: "#10b981", color: "#fff", padding: "6px 0", borderRadius: "6px", fontWeight: "800", fontSize: "15px", boxShadow: "0 2px 4px rgba(16,185,129,0.2)" }}>
                        {formatTime(dayTotal)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}