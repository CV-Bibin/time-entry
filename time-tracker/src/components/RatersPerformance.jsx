import React, { useState, useEffect } from 'react';
import { db } from "../firebase";
import { collection, onSnapshot, doc } from "firebase/firestore";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 🎨 EXPANDED HIGH-CONTRAST Color Palette
const CHART_COLORS = [
  "#dc2626", "#2563eb", "#16a34a", "#d97706", "#9333ea", "#0891b2", "#db2777", "#65a30d",
  "#4f46e5", "#be123c", "#ca8a04", "#0d9488", "#854d0e", "#1e40af", "#3f6212", "#c026d3",
  "#0284c7", "#ea580c", "#4d7c0f", "#4338ca", "#9f1239", "#b45309", "#0f766e", "#6b21a8",
  "#e11d48", "#2dd4bf", "#f59e0b", "#84cc16", "#3b82f6", "#10b981", "#f43f5e", "#6366f1",
  "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4", "#ec4899", "#22c55e", "#fbbf24", "#60a5fa"
];

// 🚀 SMART MATCHING ENGINE: Catches partial names (e.g. "Vivek" matches "Vivek M")
const fuzzyMatch = (val, list) => {
  if (!val) return false;
  const lowerVal = val.trim().toLowerCase();
  const validList = list.filter(i => i.trim().length > 0);
  return validList.some(item => lowerVal === item || lowerVal.includes(item) || item.includes(lowerVal));
};

export default function TeamPerformanceGraphs({ user, setCurrentView }) {
  const [usersList, setUsersList] = useState([]);
  const [timeData, setTimeData] = useState([]);
  const [globalNames, setGlobalNames] = useState({ coAdminNames: [] });
  const [loading, setLoading] = useState(true);
  
  // TIMEFRAME STATE LOGIC
  const [historyMode, setHistoryMode] = useState('halfYearly'); 
  const [historyOffset, setHistoryOffset] = useState(0); 
  
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  let displayMonthName = selectedMonth;
  const [yStr, mStr] = selectedMonth.split('-');
  const mIndex = parseInt(mStr, 10) - 1;
  if (!isNaN(mIndex)) displayMonthName = `${MONTHS[mIndex]} ${yStr}`;

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTime = onSnapshot(collection(db, "time_entries"), (snap) => setTimeData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSettings = onSnapshot(doc(db, "systemSettings", "roles"), (snap) => {
      if (snap.exists()) setGlobalNames(snap.data());
    });
    
    setLoading(false);
    return () => { unsubUsers(); unsubTime(); unsubSettings(); };
  }, []);

  if (loading) return <div style={{ padding: "100px", textAlign: "center", color: "#64748b", fontWeight: "bold" }}>Loading Dashboard...</div>;

  const myProfile = usersList.find(u => u.email === user?.email);
  if (!myProfile) return <div style={{ padding: "100px", textAlign: "center" }}>Loading Profile...</div>;

  const isMainAdmin = myProfile.role === 'admin';
  const isCoAdmin = myProfile.role === 'co-admin';
  const isLeader = myProfile.role === 'leader';
  const myLeaderName = myProfile.leaderName || "Unknown";

  const getActualLeader = (acc) => {
    if (acc.role === 'leader' || acc.role === 'co-admin') return (acc.leaderName || "").trim();
    return (acc.assignedLeader || "").trim();
  };

  const otherCoAdmins = (globalNames.coAdminNames || [])
    .filter(n => n.toLowerCase() !== myLeaderName.toLowerCase())
    .map(n => n.toLowerCase());

  // ==========================================
  // 🚀 1. EXACT MASTER LEDGER FILTER (For Graph 1 & 2)
  // ==========================================
  let teamAccounts = [];
  if (isMainAdmin) {
    teamAccounts = usersList;
  } else if (isCoAdmin) {
    teamAccounts = usersList.filter(u => {
      const actualLeader = getActualLeader(u);
      
      // 1. Always show my own accounts
      if (u.email === user.email || actualLeader.toLowerCase() === myLeaderName.toLowerCase()) return true;
      
      // 2. Hide base admin/manager logins (unless caught by rule 1)
      if (u.role === 'admin' || u.role === 'co-admin') return false;

      const cName = (u.clientName || "").trim().toLowerCase();
      let leaderLower = actualLeader.toLowerCase();
      
      const isOwnedByOther = fuzzyMatch(cName, otherCoAdmins);
      const isWorkedByOther = leaderLower ? fuzzyMatch(leaderLower, otherCoAdmins) : isOwnedByOther;
      
      // 3. 🚀 PRIVACY BLOCK: Hide accounts owned AND worked by another Co-Admin
      if (isOwnedByOther && isWorkedByOther) return false;
      
      // 4. SHOW EVERYTHING ELSE (including raters under other co-admins, and external accounts)
      return true; 
    });
  } else if (isLeader) {
    teamAccounts = usersList.filter(u => {
      const actualLeader = getActualLeader(u);
      return (u.role === 'rater' && actualLeader.toLowerCase() === myLeaderName.toLowerCase()) || u.email === user.email;
    });
  }

  // ==========================================
  // GRAPH 1 DATA: Selected Month Totals (Bar Chart)
  // ==========================================
  const chartData = teamAccounts.map(acc => {
    const monthLogs = timeData.filter(l => l.email === acc.email && typeof l.assigned_date === 'string' && l.assigned_date.startsWith(selectedMonth));
    const totalHours = monthLogs.reduce((sum, l) => sum + (Number(l.time_value_hours) || 0), 0);
    return { email: acc.email.split('@')[0], hours: totalHours, isMe: acc.email === user.email };
  }).filter(data => data.hours > 0).sort((a, b) => b.hours - a.hours);

  const maxTotalHours = chartData.length > 0 ? Math.max(...chartData.map(d => d.hours)) : 1;
  const totalTeamHours = chartData.reduce((sum, d) => sum + d.hours, 0);

  // ==========================================
  // GRAPH 2 DATA: Daily Progress (Line Graph)
  // ==========================================
  const [selY, selM] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(selY, selM, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const dailyTrends = teamAccounts.map((acc, index) => {
    const shortName = acc.email.split('@')[0];
    let userHasAnyHours = false;

    const history = daysArray.map(day => {
      const dateStr = `${selY}-${String(selM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const logs = timeData.filter(l => l.email === acc.email && l.assigned_date === dateStr);
      const totalDaily = logs.reduce((sum, l) => sum + (Number(l.time_value_hours) || 0), 0);
      if (totalDaily > 0) userHasAnyHours = true;
      return { day: day, dateStr: dateStr, hours: totalDaily };
    });

    return { name: shortName, color: CHART_COLORS[index % CHART_COLORS.length], history, hasData: userHasAnyHours };
  }).filter(ut => ut.hasData);

  let maxDailyHours = 8; 
  dailyTrends.forEach(ut => {
    const localMax = Math.max(...ut.history.map(h => h.hours));
    if (localMax > maxDailyHours) maxDailyHours = localMax;
  });

  // ==========================================
  // 🚀 GRAPH 3 DATA: Historical STACKED BAR Chart
  // ==========================================
  
  // 🚀 CUSTOM FILTER FOR GRAPH 3 ONLY: No other Co-Admins AT ALL
  let historicalTeamAccounts = [];
  if (isMainAdmin) {
    historicalTeamAccounts = usersList;
  } else if (isCoAdmin) {
    historicalTeamAccounts = teamAccounts.filter(u => {
      const cName = (u.clientName || "").trim().toLowerCase();
      // If the client tag matches ANY other Co-Admin, strip it out completely for this historical graph
      if (fuzzyMatch(cName, otherCoAdmins)) return false; 
      return true;
    });
  } else if (isLeader) {
    historicalTeamAccounts = teamAccounts;
  }

  let monthCount = 12;
  let startMonthIndex = 0;

  if (historyMode === 'quarterly') {
    monthCount = 3;
    startMonthIndex = Math.floor((selM - 1) / 3) * 3; 
    startMonthIndex -= (historyOffset * 3); 
  } else if (historyMode === 'halfYearly') {
    monthCount = 6;
    startMonthIndex = Math.floor((selM - 1) / 6) * 6; 
    startMonthIndex -= (historyOffset * 6); 
  } else {
    monthCount = 12;
    startMonthIndex = 0; 
    startMonthIndex -= (historyOffset * 12); 
  }

  const historicalMonths = [];
  for (let i = 0; i < monthCount; i++) {
    const d = new Date(selY, startMonthIndex + i, 1);
    historicalMonths.push({
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      shortLabel: `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
      prefix: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    });
  }

  const historicalUserTrends = historicalTeamAccounts.map((acc, index) => {
    return { email: acc.email, name: acc.email.split('@')[0], color: CHART_COLORS[index % CHART_COLORS.length] };
  });

  let maxHistoricalTotalHours = 40; 
  
  const stackedMonthData = historicalMonths.map(m => {
    let totalForMonth = 0;
    const segments = historicalUserTrends.map(ut => {
      const logs = timeData.filter(l => l.email === ut.email && l.assigned_date?.startsWith(m.prefix));
      const hrs = logs.reduce((sum, l) => sum + (Number(l.time_value_hours) || 0), 0);
      totalForMonth += hrs;
      return { name: ut.name, color: ut.color, hours: hrs };
    }).filter(seg => seg.hours > 0); 
    
    if (totalForMonth > maxHistoricalTotalHours) maxHistoricalTotalHours = totalForMonth;

    return { ...m, total: totalForMonth, segments };
  });

  const activeRatersInHistory = historicalUserTrends.filter(ut => {
    return stackedMonthData.some(m => m.segments.some(seg => seg.name === ut.name));
  });

  return (
    <div style={{ padding: "30px", backgroundColor: "#f8fafc", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "30px", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <button onClick={() => setCurrentView('dashboard')} style={{ marginBottom: "10px", padding: "6px 12px", backgroundColor: "#e2e8f0", color: "#475569", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
            ⬅ Back to Dashboard
          </button>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "900", color: "#0f172a" }}>Team Performance Graph</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "14px" }}>Visual breakdown for {displayMonthName}</p>
        </div>
        <input 
          type="month" value={selectedMonth} onChange={(e) => { 
            if (e.target.value) {
              setSelectedMonth(e.target.value);
              setHistoryOffset(0); 
            } 
          }}
          style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontWeight: "700", outline: "none", cursor: "pointer", backgroundColor: "#fff" }}
        />
      </div>

      {/* QUICK STATS */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "30px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, backgroundColor: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "800", textTransform: "uppercase" }}>Active Team Members</div>
          <div style={{ fontSize: "28px", fontWeight: "900", color: "#0f172a", marginTop: "6px" }}>{chartData.length}</div>
        </div>
        <div style={{ flex: 1, backgroundColor: "#eff6ff", padding: "20px", borderRadius: "12px", border: "1px solid #bfdbfe", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
          <div style={{ fontSize: "12px", color: "#1d4ed8", fontWeight: "800", textTransform: "uppercase" }}>Total Team Hours</div>
          <div style={{ fontSize: "28px", fontWeight: "900", color: "#1e3a8a", marginTop: "6px" }}>{totalTeamHours.toFixed(1)}h</div>
        </div>
        <div style={{ flex: 1, backgroundColor: "#ecfdf5", padding: "20px", borderRadius: "12px", border: "1px solid #a7f3d0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
          <div style={{ fontSize: "12px", color: "#047857", fontWeight: "800", textTransform: "uppercase" }}>Top Performer</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "#064e3b", marginTop: "10px" }}>
            {chartData.length > 0 ? chartData[0].email : "-"}
          </div>
        </div>
      </div>

      {/* 1. THE BAR CHART */}
      <div style={{ backgroundColor: "#fff", padding: "40px", borderRadius: "16px", border: "1px solid #cbd5e1", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)", marginBottom: "30px" }}>
        <h3 style={{ margin: "0 0 40px 0", color: "#334155", fontSize: "18px", fontWeight: "800", textAlign: "center" }}>Total Hours Logged by User ({displayMonthName})</h3>
        
        {chartData.length === 0 ? (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px" }}>No data logged for this month.</div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "20px", height: "350px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px", overflowX: "auto" }}>
            {chartData.map((data, index) => {
              const heightPercent = (data.hours / maxTotalHours) * 100;
              return (
                <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "60px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "800", color: data.isMe ? "#2563eb" : "#64748b", marginBottom: "8px" }}>
                    {data.hours.toFixed(1)}h
                  </span>
                  
                  <div style={{ 
                    height: `${heightPercent}%`, minHeight: "20px", width: "40px", 
                    backgroundColor: data.isMe ? "#3b82f6" : "#cbd5e1", borderRadius: "6px 6px 0 0", transition: "all 0.3s ease"
                  }}></div>
                  
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#475569", marginTop: "15px", textAlign: "center", wordWrap: "break-word", width: "100%" }}>
                    {data.email}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. THE DAILY LINE GRAPH */}
      <div style={{ backgroundColor: "#fff", padding: "40px", borderRadius: "16px", border: "1px solid #cbd5e1", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)", marginBottom: "30px" }}>
        <h3 style={{ margin: "0 0 10px 0", color: "#334155", fontSize: "18px", fontWeight: "800", textAlign: "center" }}>Daily Individual Trends ({displayMonthName})</h3>
        <p style={{ textAlign: "center", color: "#64748b", fontSize: "13px", marginBottom: "40px", fontWeight: "600" }}>Hover over dots to see exact hours logged per day</p>

        {dailyTrends.length === 0 ? (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px" }}>No daily logs found for this month.</div>
        ) : (
          <>
            <div style={{ width: "100%", overflowX: "auto", display: "flex", justifyContent: "center", paddingBottom: "20px" }}>
              <svg viewBox="0 0 1000 300" style={{ width: "100%", minWidth: "700px", maxWidth: "1000px", overflow: "visible" }}>
                
                {daysArray.map((day, i) => {
                  const x = 40 + (i * (920 / (daysInMonth - 1)));
                  return <line key={`vgrid-${day}`} x1={x} y1="50" x2={x} y2="250" stroke="#f1f5f9" strokeWidth="1.5" />;
                })}

                <line x1="40" y1="50" x2="960" y2="50" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="6" />
                <line x1="40" y1="150" x2="960" y2="150" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="6" />
                <line x1="40" y1="250" x2="960" y2="250" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />

                <text x="30" y="55" textAnchor="end" fill="#94a3b8" fontSize="12" fontWeight="bold">{Math.ceil(maxDailyHours)}h</text>
                <text x="30" y="155" textAnchor="end" fill="#94a3b8" fontSize="12" fontWeight="bold">{Math.ceil(maxDailyHours/2)}h</text>
                <text x="30" y="255" textAnchor="end" fill="#94a3b8" fontSize="12" fontWeight="bold">0h</text>

                {daysArray.map((day, i) => {
                  if (day === 1 || day % 5 === 0 || day === daysInMonth) {
                    const x = 40 + (i * (920 / (daysInMonth - 1)));
                    return (
                      <text key={`label-${day}`} x={x} y="275" textAnchor="middle" fill="#475569" fontSize="12" fontWeight="800">
                        {day} {MONTHS[selM - 1]}
                      </text>
                    );
                  }
                  return null;
                })}

                {dailyTrends.map((userTrend) => {
                  const points = userTrend.history.map((dataPoint, i) => {
                    const x = 40 + (i * (920 / (daysInMonth - 1))); 
                    const y = 250 - ((dataPoint.hours / maxDailyHours) * 200); 
                    return { x, y, hours: dataPoint.hours, day: dataPoint.day };
                  });

                  const pathString = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(" ");

                  return (
                    <g key={`trend-${userTrend.name}`}>
                      <path d={pathString} fill="none" stroke={userTrend.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }} />
                      {points.map((p, i) => {
                        if (p.hours > 0) {
                          return (
                            <g key={`point-${userTrend.name}-${i}`} style={{ cursor: "pointer" }}>
                              <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke={userTrend.color} strokeWidth="2" style={{ transition: "all 0.2s" }} 
                                onMouseOver={(e) => { e.target.setAttribute("r", "7"); e.target.setAttribute("fill", userTrend.color); }}
                                onMouseOut={(e) => { e.target.setAttribute("r", "4"); e.target.setAttribute("fill", "#fff"); }}
                              />
                              <title>{userTrend.name}: {p.hours.toFixed(2)} hrs on {p.day} {MONTHS[selM - 1]}</title>
                            </g>
                          );
                        }
                        return null;
                      })}
                    </g>
                  );
                })}
              </svg>
            </div>
            
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "15px", marginTop: "10px", borderTop: "1px solid #f1f5f9", paddingTop: "20px" }}>
              {dailyTrends.map((ut) => (
                <div key={`legend-${ut.name}`} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", color: "#475569" }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: ut.color, border: "2px solid #fff", boxShadow: "0 0 0 1px #cbd5e1" }}></span>
                  {ut.name}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 🚀 3. THE HISTORICAL STACKED BAR CHART */}
      <div style={{ backgroundColor: "#fff", padding: "40px", borderRadius: "16px", border: "1px solid #cbd5e1", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "15px" }}>
          <h3 style={{ margin: 0, color: "#334155", fontSize: "18px", fontWeight: "800" }}>Historical Performance Tracker</h3>
          
          <div style={{ display: "flex", gap: "15px", alignItems: "center", flexWrap: "wrap" }}>
            <select 
              value={historyMode} 
              onChange={(e) => { 
                setHistoryMode(e.target.value); 
                setHistoryOffset(0); 
              }}
              style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontWeight: "bold", color: "#0f172a", outline: "none", cursor: "pointer", backgroundColor: "#f8fafc" }}
            >
              <option value="quarterly">Quarterly View</option>
              <option value="halfYearly">6-Month View</option>
              <option value="yearly">Yearly View</option>
            </select>

            <div style={{ display: "flex", gap: "8px" }}>
              <button 
                onClick={() => setHistoryOffset(prev => prev + 1)}
                style={{ padding: "6px 12px", backgroundColor: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
              >
                ◀ Older
              </button>
              <button 
                onClick={() => setHistoryOffset(prev => Math.max(0, prev - 1))}
                disabled={historyOffset === 0}
                style={{ padding: "6px 12px", backgroundColor: historyOffset === 0 ? "#f8fafc" : "#f1f5f9", color: historyOffset === 0 ? "#cbd5e1" : "#334155", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: historyOffset === 0 ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "12px" }}
              >
                Newer ▶
              </button>
            </div>
          </div>
        </div>
        
        <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "40px", fontWeight: "600" }}>
          Total team hours per month, segmented by individual contribution. Hover over sections for exact hours.
        </p>

        {activeRatersInHistory.length === 0 ? (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px" }}>No historical data found for this timeframe.</div>
        ) : (
          <>
            <div style={{ width: "100%", overflowX: "auto", display: "flex", justifyContent: "center", paddingBottom: "20px" }}>
              <svg viewBox="0 0 1000 300" style={{ width: "100%", minWidth: "700px", maxWidth: "1000px", overflow: "visible" }}>
                
                {historicalMonths.map((_, i) => {
                  const x = 40 + (i * (920 / (monthCount - 1)));
                  return <line key={`h-vgrid-${i}`} x1={x} y1="50" x2={x} y2="250" stroke="#f1f5f9" strokeWidth="1.5" />;
                })}

                <line x1="40" y1="50" x2="960" y2="50" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="6" />
                <line x1="40" y1="150" x2="960" y2="150" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="6" />
                <line x1="40" y1="250" x2="960" y2="250" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />

                <text x="30" y="55" textAnchor="end" fill="#94a3b8" fontSize="12" fontWeight="bold">{Math.ceil(maxHistoricalTotalHours)}h</text>
                <text x="30" y="155" textAnchor="end" fill="#94a3b8" fontSize="12" fontWeight="bold">{Math.ceil(maxHistoricalTotalHours/2)}h</text>
                <text x="30" y="255" textAnchor="end" fill="#94a3b8" fontSize="12" fontWeight="bold">0h</text>

                {stackedMonthData.map((monthData, i) => {
                  const x = 40 + (i * (920 / (monthCount - 1)));
                  return (
                    <text key={`stack-label-${i}`} x={x} y="275" textAnchor="middle" fill="#475569" fontSize="13" fontWeight="800">
                      {monthData.shortLabel}
                    </text>
                  );
                })}

                {stackedMonthData.map((monthData, i) => {
                  const x = 40 + (i * (920 / (monthCount - 1)));
                  let currentY = 250; 

                  return (
                    <g key={`stack-${i}`}>
                      {monthData.total > 0 && (
                        <>
                          {monthData.segments.map((seg, j) => {
                            const barHeight = (seg.hours / maxHistoricalTotalHours) * 200;
                            currentY -= barHeight; 
                            
                            return (
                              <g key={`seg-${i}-${j}`} style={{ cursor: "pointer" }}>
                                <rect 
                                  x={x - 20} y={currentY} width="40" height={barHeight} 
                                  fill={seg.color} stroke="#fff" strokeWidth="1" 
                                  style={{ transition: "all 0.2s" }}
                                  onMouseOver={(e) => { e.target.setAttribute("opacity", "0.8"); }}
                                  onMouseOut={(e) => { e.target.setAttribute("opacity", "1"); }}
                                />
                                <title>{seg.name}: {seg.hours.toFixed(1)} hrs in {monthData.fullMonth}</title>
                              </g>
                            );
                          })}
                          
                          <text x={x} y={currentY - 10} textAnchor="middle" fill="#334155" fontSize="13" fontWeight="900">
                            {monthData.total.toFixed(1)}h
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
            
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "15px", marginTop: "10px", borderTop: "1px solid #f1f5f9", paddingTop: "20px" }}>
              {activeRatersInHistory.map((ut) => (
                <div key={`hist-legend-${ut.name}`} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", color: "#475569" }}>
                  <span style={{ width: "14px", height: "14px", borderRadius: "4px", backgroundColor: ut.color, border: "2px solid #fff", boxShadow: "0 0 0 1px #cbd5e1" }}></span>
                  {ut.name}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  );
}