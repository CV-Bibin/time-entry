import React from 'react';

export default function CalendarBoard({
  user,
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

  // ==========================================
  // 🗓️ MONTH NAVIGATION LOGIC
  // ==========================================
  const handlePrevMonth = () => {
    const [y, m] = selectedDate.split("-");
    const prevDate = new Date(y, m - 1 - 1, 1); // Subtract 1 month, default to 1st day
    const newDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01`;
    setSelectedDate(newDateStr);
    setEditingId(null);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedDate.split("-");
    const nextDate = new Date(y, m - 1 + 1, 1); // Add 1 month, default to 1st day
    const newDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-01`;
    setSelectedDate(newDateStr);
    setEditingId(null);
  };

  // Prevent navigating into the future
  const isViewingCurrentMonth = targetMonthPrefix >= todayString.substring(0, 7);

  // ==========================================
  // 💰 PAY RATE CALCULATION
  // ==========================================
  const HOURLY_RATE = 160; 
  const estimatedEarnings = monthlyTotal * HOURLY_RATE;

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
          <p><strong>Total Hours:</strong> ${monthlyTotal.toFixed(3)}</p>
          <p><strong>Estimated Pay:</strong> ${formatCurrency(estimatedEarnings)} (at ₹${HOURLY_RATE}/hr)</p>
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
    const isLocked = dateStr < minDateString;

    return (
      <div 
        key={dayNum} 
        onClick={() => { setSelectedDate(dateStr); setEditingId(null); }}
        style={{ 
          border: '1px solid #eee', borderRadius: '6px', padding: '8px 4px', textAlign: 'center', cursor: 'pointer',
          backgroundColor: isSelected ? '#007BFF' : (isToday ? '#e8f5e9' : '#fff'),
          color: isSelected ? '#fff' : '#333',
          boxShadow: isSelected ? '0 4px 10px rgba(0,123,255,0.4)' : 'none',
          opacity: isLocked ? 0.5 : 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          minHeight: '65px', transition: 'all 0.2s ease-in-out'
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{dayNum}</div>
        <div style={{ fontSize: '11px', marginTop: '4px', fontWeight: dayTotal > 0 ? 'bold' : 'normal', color: isSelected ? '#e0f7fa' : (dayTotal > 0 ? '#28a745' : '#ccc') }}>
          {dayTotal > 0 ? `${dayTotal.toFixed(1)}h` : '-'}
        </div>
      </div>
    );
  });

  const cleanHmsString = formatDecimalToHMS(monthlyTotal).replace(/[()]/g, '');

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
        
        {/* BIG TEXT: Real-time format (19h 16m 44s) */}
        <div style={{ fontSize: "36px", fontWeight: "900", color: "#007BFF", margin: "8px 0", letterSpacing: "-0.5px" }}>
          {cleanHmsString}
        </div>
        
        {/* SMALL TEXT: Decimal format in brackets (19.279 hrs) */}
        <div style={{ fontSize: "15px", color: "#666", fontWeight: "bold", marginBottom: "12px" }}>
          ({monthlyTotal.toFixed(3)} hrs)
        </div>

        {/* 💰 EARNINGS BADGE */}
        <div style={{ display: "inline-block", backgroundColor: "#e8f5e9", color: "#155724", padding: "6px 16px", borderRadius: "20px", fontSize: "15px", fontWeight: "bold", border: "1px solid #c3e6cb", boxShadow: "0 2px 4px rgba(40,167,69,0.1)" }}>
          Estimated Pay: {formatCurrency(estimatedEarnings)}
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
        <button 
          onClick={() => setCurrentView('progress')}
          style={{ flex: 1, padding: "10px", backgroundColor: "#17a2b8", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
        >
          📈 View Work Progress
        </button>
      </div>

      {/* 3. CALENDAR GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: '#888', paddingBottom: '4px' }}>{d}</div>
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