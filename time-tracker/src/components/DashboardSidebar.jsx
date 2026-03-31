import React from 'react';

export default function DashboardSidebar({ user, isMonthLocked, totalToday, allEntries, selectedDate }) {
  
  // ==========================================
  // QUARTERLY COMPLIANCE MATH
  // ==========================================
  const dateObj = new Date(selectedDate);
  const selectedYear = dateObj.getFullYear();
  const currentMonthIndex = dateObj.getMonth(); // 0 = Jan, 11 = Dec
  
  const quarterIndex = Math.floor(currentMonthIndex / 3);
  const quarterStartMonth = quarterIndex * 3;
  const quarterMonths = [quarterStartMonth, quarterStartMonth + 1, quarterStartMonth + 2];
  
  // RULES
  const QUARTER_GOAL = 20; 
  const MIN_MONTH_GOAL = 5;

  // Helper to fetch total hours for a specific month
  const getMonthTotal = (mIndex) => {
    const monthString = String(mIndex + 1).padStart(2, '0');
    return allEntries
      .filter(e => e.assigned_date.startsWith(`${selectedYear}-${monthString}`))
      .reduce((sum, e) => sum + e.time_value_hours, 0);
  };

  const m1Total = getMonthTotal(quarterMonths[0]);
  const m2Total = getMonthTotal(quarterMonths[1]);
  const m3Total = getMonthTotal(quarterMonths[2]);
  
  const quarterTotal = m1Total + m2Total + m3Total;
  const quarterProgressPercent = Math.min(100, (quarterTotal / QUARTER_GOAL) * 100);
  const quarterRemaining = Math.max(0, QUARTER_GOAL - quarterTotal).toFixed(2);

  // --- SMART TARGET LOGIC ---
  const m3Target = Math.max(MIN_MONTH_GOAL, QUARTER_GOAL - (m1Total + m2Total));

  const monthsData = [
    { name: new Date(selectedYear, quarterMonths[0], 1).toLocaleString('default', { month: 'short' }), total: m1Total, target: MIN_MONTH_GOAL, isCurrent: currentMonthIndex === quarterMonths[0] },
    { name: new Date(selectedYear, quarterMonths[1], 1).toLocaleString('default', { month: 'short' }), total: m2Total, target: MIN_MONTH_GOAL, isCurrent: currentMonthIndex === quarterMonths[1] },
    { name: new Date(selectedYear, quarterMonths[2], 1).toLocaleString('default', { month: 'short' }), total: m3Total, target: m3Target, isCurrent: currentMonthIndex === quarterMonths[2] }
  ];

  // --- DYNAMIC ACCOUNT STATUS ---
  let accountStatusTitle = "Account in Good Standing";
  let accountStatusColor = "#28a745"; // Green
  let warningMessage = null;
  let isAtRisk = false;

  const currentMonthInQuarter = currentMonthIndex % 3; 
  const currentMonthTarget = monthsData[currentMonthInQuarter].target;

  if (currentMonthInQuarter === 2 && quarterTotal < QUARTER_GOAL) {
    isAtRisk = true;
    accountStatusTitle = "⚠️ ACCOUNT AT RISK";
    accountStatusColor = "#dc3545"; // Red
    warningMessage = (
      <>
        CRITICAL: You must log 
        <span style={{ backgroundColor: "#721c24", color: "white", padding: "2px 6px", borderRadius: "4px", fontSize: "14px", margin: "0 4px", display: "inline-block", boxShadow: "0 2px 4px rgba(114, 28, 36, 0.4)" }}>
          {quarterRemaining}
        </span> 
        more hours by the end of {monthsData[2].name} to secure your account.
      </>
    );
  } else if (monthsData[currentMonthInQuarter].total < currentMonthTarget) {
    accountStatusTitle = "Target Pending";
    accountStatusColor = "#ffc107"; // Yellow
    warningMessage = (
      <>
        Reminder: You need to hit your target of 
        <span style={{ backgroundColor: "#856404", color: "white", padding: "2px 6px", borderRadius: "4px", fontSize: "13px", margin: "0 4px", display: "inline-block" }}>
          {currentMonthTarget} hrs
        </span> 
        for {monthsData[currentMonthInQuarter].name}.
      </>
    );
  }

  // ==========================================
  // WEEKLY BREAKDOWN MATH (CURRENT MONTH)
  // ==========================================
  const currentMonthString = String(currentMonthIndex + 1).padStart(2, '0');
  const currentMonthPrefix = `${selectedYear}-${currentMonthString}`;
  const daysInViewedMonth = new Date(selectedYear, currentMonthIndex + 1, 0).getDate();
  const viewedMonthName = new Date(selectedYear, currentMonthIndex, 1).toLocaleString('default', { month: 'long' });

  // Array to hold hours for Week 1, 2, 3, 4, 5
  const weeklyTotals = [0, 0, 0, 0, 0];
  
  allEntries
    .filter(e => e.assigned_date.startsWith(currentMonthPrefix))
    .forEach(entry => {
      const day = parseInt(entry.assigned_date.split('-')[2], 10);
      // Group days into 7-day buckets
      const weekIdx = Math.min(4, Math.floor((day - 1) / 7));
      weeklyTotals[weekIdx] += entry.time_value_hours;
    });

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "25px", paddingBottom: "20px" }}>
      
      {/* INJECTED ANIMATION CSS */}
      <style>
        {`
          @keyframes pulse-danger {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); }
            50% { transform: scale(1.02); box-shadow: 0 0 15px 5px rgba(220, 53, 69, 0.4); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
          }
          @keyframes flash-text {
            0% { color: #dc3545; }
            50% { color: #8b0000; }
            100% { color: #dc3545; }
          }
          .animate-risk-card { animation: pulse-danger 1.5s infinite; border: 2px solid #dc3545 !important; }
          .animate-risk-text { animation: flash-text 1.5s infinite; font-weight: 900 !important; }
        `}
      </style>

      {/* =========================================
          1. NOTIFICATIONS SECTION
      ========================================= */}
      <div style={{ padding: "20px", backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #f0f0f0", paddingBottom: "10px", marginBottom: "15px" }}>
          <h4 style={{ margin: 0, color: "#333", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>🔔 Notifications</h4>
          {warningMessage && <span style={{ backgroundColor: accountStatusColor, color: "white", fontSize: "11px", padding: "2px 8px", borderRadius: "12px", fontWeight: "bold" }}>Alert</span>}
        </div>

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
          {warningMessage && (
            <li className={isAtRisk ? "animate-risk-card" : ""} style={{ padding: "12px", backgroundColor: isAtRisk ? '#f8d7da' : '#fff3cd', borderLeft: `4px solid ${accountStatusColor}`, borderRadius: "4px" }}>
              <div className={isAtRisk ? "animate-risk-text" : ""} style={{ fontSize: "13px", fontWeight: "bold", color: isAtRisk ? '#721c24' : '#856404', marginBottom: "6px" }}>
                {isAtRisk ? "Action Required" : "Compliance Status"}
              </div>
              <div style={{ fontSize: "13px", color: isAtRisk ? '#721c24' : '#666', lineHeight: "1.5", fontWeight: isAtRisk ? 'bold' : 'normal' }}>
                {warningMessage}
              </div>
            </li>
          )}
          <li style={{ padding: "12px", backgroundColor: "#f8f9fa", borderLeft: "4px solid #007BFF", borderRadius: "4px" }}>
            <div style={{ fontSize: "13px", fontWeight: "bold", color: "#333", marginBottom: "4px" }}>Quarterly Rules</div>
            <div style={{ fontSize: "12px", color: "#666", lineHeight: "1.4" }}>Secure your account by logging 20 hrs per quarter and at least 5 hrs every month.</div>
          </li>
        </ul>
      </div>

      {/* =========================================
          2. SYSTEMATIC COMPLIANCE LEDGER
      ========================================= */}
      <div style={{ padding: "20px", backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
        
        <div style={{ borderBottom: "2px solid #f0f0f0", paddingBottom: "10px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className={isAtRisk ? "animate-risk-text" : ""} style={{ fontSize: "12px", fontWeight: "bold", color: accountStatusColor, backgroundColor: isAtRisk ? "#f8d7da" : "#f8f9fa", padding: "4px 8px", borderRadius: "4px", textAlign: "right" }}>
            {accountStatusTitle}
          </span>
        </div>

        {/* QUARTERLY MASTER PROGRESS BAR */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px", fontWeight: "bold" }}>
            <span style={{color: "#555"}}>Q{quarterIndex + 1} Master Goal ({monthsData[0].name}-{monthsData[2].name})</span>
            <span style={{ color: quarterTotal >= QUARTER_GOAL ? "#28a745" : "#007BFF" }}>{quarterTotal.toFixed(1)} / {QUARTER_GOAL} hrs</span>
          </div>
          <div style={{ width: "100%", height: "10px", backgroundColor: "#e9ecef", borderRadius: "5px", overflow: "hidden", border: "1px solid #ddd" }}>
            <div style={{ height: "100%", width: `${quarterProgressPercent}%`, backgroundColor: quarterTotal >= QUARTER_GOAL ? "#28a745" : "#007BFF", transition: "width 0.5s ease" }}></div>
          </div>
        </div>

        {/* VISUAL MONTHLY TABLE */}
        <div style={{ backgroundColor: "#f8f9fa", border: "1px solid #eee", borderRadius: "6px", overflow: "hidden" }}>
          <div style={{ display: "flex", backgroundColor: "#e9ecef", padding: "8px 12px", fontSize: "11px", fontWeight: "bold", color: "#555", textTransform: "uppercase" }}>
            <div style={{ flex: 1.2 }}>Month</div>
            <div style={{ flex: 2 }}>Progress</div>
            <div style={{ flex: 1, textAlign: "right" }}>Logged</div>
            <div style={{ flex: 0.5, textAlign: "center" }}>Sts</div>
          </div>

          {monthsData.map((m, i) => {
            const isComplete = m.total >= m.target;
            const monthProgressPercent = Math.min(100, (m.total / m.target) * 100);
            
            return (
              <div key={i} style={{ display: "flex", padding: "12px", borderTop: "1px solid #eee", backgroundColor: m.isCurrent ? "#fff" : "transparent", alignItems: "center" }}>
                <div style={{ flex: 1.2, fontSize: "13px", fontWeight: m.isCurrent ? "bold" : "normal", color: m.isCurrent ? "#007BFF" : "#333", display: "flex", alignItems: "center", gap: "6px" }}>
                  {m.name} {m.isCurrent && <span style={{ width: "6px", height: "6px", backgroundColor: "#007BFF", borderRadius: "50%" }}></span>}
                </div>
                
                <div style={{ flex: 2, paddingRight: "10px", display: "flex", alignItems: "center" }}>
                  <div style={{ width: "100%", height: "6px", backgroundColor: "#e9ecef", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${monthProgressPercent}%`, backgroundColor: isComplete ? "#28a745" : (m.isCurrent ? "#ffc107" : "#dc3545"), transition: "width 0.5s ease" }}></div>
                  </div>
                </div>

                <div style={{ flex: 1, textAlign: "right", fontSize: "12px", fontWeight: "bold", color: isComplete ? "#28a745" : (m.isCurrent ? "#ffc107" : "#dc3545") }}>
                  {m.total.toFixed(1)}h
                </div>

                <div style={{ flex: 0.5, textAlign: "center", fontSize: "12px" }}>
                  {isComplete ? "✅" : (m.isCurrent ? "⏳" : "⚠️")}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================
          3. WEEKLY BREAKDOWN (NEW SECTION)
      ========================================= */}
      <div style={{ padding: "20px", backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
        <div style={{ borderBottom: "2px solid #f0f0f0", paddingBottom: "10px", marginBottom: "15px" }}>
          <h4 style={{ margin: 0, color: "#333", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>📅 {viewedMonthName} - Weekly Log</h4>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {weeklyTotals.map((total, i) => {
            // Do not show Week 5 if it's February on a non-leap year (<= 28 days)
            if (i === 4 && daysInViewedMonth <= 28) return null;

            let dateRange = "";
            if (i === 0) dateRange = "1st - 7th";
            if (i === 1) dateRange = "8th - 14th";
            if (i === 2) dateRange = "15th - 21st";
            if (i === 3) dateRange = "22nd - 28th";
            if (i === 4) dateRange = `29th - ${daysInViewedMonth}th`;

            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", backgroundColor: total > 0 ? "#e8f5e9" : "#f8f9fa", borderRadius: "4px", border: `1px solid ${total > 0 ? '#c3e6cb' : '#eee'}`, fontSize: "13px", alignItems: "center" }}>
                <span style={{ fontWeight: "bold", color: "#444" }}>
                  Week {i + 1} <span style={{ fontSize: "11px", fontWeight: "normal", color: "#888", marginLeft: "4px" }}>({dateRange})</span>
                </span>
                <span style={{ fontWeight: "bold", color: total > 0 ? "#28a745" : "#999" }}>
                  {total.toFixed(2)} hrs
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}