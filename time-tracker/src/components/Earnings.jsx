import React, { useState, useEffect } from 'react';
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

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

const formatMoney = (num, decimals = 0) => {
  const val = Number(num);
  if (isNaN(val)) return "0";
  return val.toLocaleString('en-IN', { maximumFractionDigits: decimals });
};

const getActualLeader = (acc) => {
  if (acc.role === 'leader' || acc.role === 'co-admin') {
    return (acc.leaderName || "").trim();
  }
  return (acc.assignedLeader || "").trim();
};

export default function Earnings({ user }) {
  const [usersList, setUsersList] = useState([]);
  const [timeData, setTimeData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [conversionRate, setConversionRate] = useState(86);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTime = onSnapshot(collection(db, "time_entries"), (snap) => setTimeData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    setLoading(false);
    return () => { unsubUsers(); unsubTime(); };
  }, []);

  if (loading) return <div style={{ padding: "100px", textAlign: "center", color: "#64748b", fontWeight: "600" }}>Fetching Earnings...</div>;
  if (!user || !user.email) return <div style={{ padding: "100px", textAlign: "center", color: "#64748b" }}>Authenticating...</div>;

  const myProfile = usersList.find(u => u.email === user.email);
  if (!myProfile) return <div style={{ padding: "100px", textAlign: "center", color: "#64748b" }}>Loading Profile...</div>;

  const isMainAdmin = myProfile.role === 'admin';
  const isCoAdmin = myProfile.role === 'co-admin';
  const isLeader = myProfile.role === 'leader';
  const myLeaderName = myProfile.leaderName || "Unknown";

  let displayMonthName = selectedMonth;
  const [yStr, mStr] = selectedMonth.split('-');
  const mIndex = parseInt(mStr, 10) - 1;
  if (!isNaN(mIndex)) displayMonthName = `${MONTHS[mIndex]} ${yStr}`;

  const otherCoAdmins = usersList
    .filter(u => (u.role === 'co-admin' || u.role === 'admin') && u.leaderName !== myProfile.leaderName)
    .map(u => (u.leaderName || "").trim().toLowerCase())
    .filter(n => n !== "");

  const calculateAccount = (acc) => {
    const monthLogs = timeData.filter(l => l.email === acc.email && typeof l.assigned_date === 'string' && l.assigned_date.startsWith(selectedMonth));
    let mTotal = 0;
    monthLogs.forEach(l => mTotal += (Number(l.time_value_hours) || 0));

    const tBase = Number(acc.bonusThreshold) || 40;
    const isBonusMet = acc.hasBonus && mTotal >= tBase;
    
    const isNoRater = !!acc.noRater || String(acc.raterName || "").trim().toLowerCase() === "self";
    const cLRate = isBonusMet ? (Number(acc.leaderMaxINR) || Number(acc.leaderBaseINR) || 0) : (Number(acc.leaderBaseINR) || 0);
    const cRRate = isNoRater ? 0 : (isBonusMet ? (Number(acc.raterMaxINR) || Number(acc.raterBaseINR) || 0) : (Number(acc.raterBaseINR) || 0));

    const usdRate = Number(acc.payRateUSD) || 0;
    const totalAgencyRevenue = mTotal * usdRate * conversionRate;
    const leaderPayout = mTotal * cLRate;       
    const workerPayout = mTotal * cRRate;  
    
    const margin = usdRate > 0 ? (totalAgencyRevenue - leaderPayout) : 0;

    const cName = (acc.clientName || "").trim().toLowerCase();
    const lNameLower = myLeaderName.toLowerCase();
    
    const isMyAccount = cName === lNameLower || cName === 'me';
    const isOtherCoAdminAccount = otherCoAdmins.includes(cName);
    const isSharedExternalAccount = !isMyAccount && !isOtherCoAdminAccount;
    
    const isRatedByMe = acc.email === user.email;

    let safeHandler = getActualLeader(acc);
    if (isRatedByMe) {
      safeHandler = myLeaderName;
    } else if (safeHandler === "") {
      if (isMyAccount) safeHandler = myLeaderName;
      else if (isOtherCoAdminAccount) safeHandler = acc.clientName || "Unknown";
      else safeHandler = "Direct / Unassigned";
    }

    let myProfit = 0;
    if (isMainAdmin || isCoAdmin) {
      if (isMyAccount) {
        myProfit += margin; 
      } else if (isSharedExternalAccount) {
        myProfit += (margin / 2); 
      }
      
      if (safeHandler.toLowerCase() === lNameLower) {
        myProfit += leaderPayout;
      }
    }

    return {
      ...acc, mTotal, totalAgencyRevenue, leaderPayout, workerPayout, margin, myProfit, isMyAccount, isSharedExternalAccount, isOtherCoAdminAccount, isRatedByMe, cLRate, cRRate, isBonusMet, isNoRater, safeHandler, usdRate
    };
  };

  // ============================================================================
  // 👔 VIEW 1: CO-ADMIN / ADMIN VIEW 
  // ============================================================================
  if (isMainAdmin || isCoAdmin) {
    let rawAccounts = [];
    if (isMainAdmin) {
      rawAccounts = usersList;
    } else if (isCoAdmin) {
      rawAccounts = usersList.filter(u => {
        const actualLeader = getActualLeader(u);
        if (u.email === user.email || actualLeader.toLowerCase() === myLeaderName.toLowerCase()) return true;
        if (u.role === 'admin' || u.role === 'co-admin') return false;

        const cName = (u.clientName || "").trim().toLowerCase();
        let lName = actualLeader.toLowerCase();
        
        if (lName === "" && otherCoAdmins.includes(cName)) lName = cName;
        if (otherCoAdmins.includes(cName) && cName === lName) return false;
        
        return true; 
      });
    }

    let allAccounts = rawAccounts.map(calculateAccount).filter(a => a.mTotal > 0);
    
    if (searchTerm) {
      allAccounts = allAccounts.filter(acc => 
        acc.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (acc.clientName && acc.clientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (acc.safeHandler && acc.safeHandler.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // 🚀 NEW SEPARATED METRICS
    let grandHours = 0, grandProfit = 0, grandExpense = 0;
    
    let myOwnHours = 0, myOwnRev = 0, myOwnExpense = 0, myOwnProfit = 0;
    let extHours = 0, extRev = 0, extExpense = 0, extProfit = 0;

    const myOwnAccounts = [];
    const externalAccounts = [];
    const partnerAccounts = [];

    allAccounts.forEach(acc => {
      grandHours += acc.mTotal;
      grandProfit += acc.myProfit;
      
      const isSelfWorked = acc.safeHandler.toLowerCase() === myLeaderName.toLowerCase();
      const expense = isSelfWorked ? 0 : acc.leaderPayout;
      grandExpense += expense;

      // Fallback revenue logic: If USD rate is missing, fallback to the leader payout as the base revenue
      const actualRevenue = acc.totalAgencyRevenue > 0 ? acc.totalAgencyRevenue : acc.leaderPayout;

      if (acc.isMyAccount) {
        myOwnAccounts.push(acc);
        myOwnHours += acc.mTotal;
        myOwnRev += actualRevenue;
        myOwnExpense += expense;
        myOwnProfit += acc.myProfit;
      } else {
        if (acc.isSharedExternalAccount) externalAccounts.push(acc);
        else if (acc.isOtherCoAdminAccount) partnerAccounts.push(acc);

        extHours += acc.mTotal;
        extRev += actualRevenue;
        extExpense += expense;
        extProfit += acc.myProfit;
      }
    });

    const AdminTable = ({ title, accounts, isExternalGroup }) => {
      if (accounts.length === 0) return null;
      
      const tHours = accounts.reduce((sum, a) => sum + a.mTotal, 0);
      const tOwed = accounts.reduce((sum, a) => sum + (a.safeHandler.toLowerCase() === myLeaderName.toLowerCase() ? 0 : a.leaderPayout), 0);
      const tProfit = accounts.reduce((sum, a) => sum + a.myProfit, 0);

      return (
        <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #cbd5e1", overflow: "hidden", marginBottom: "30px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div style={{ backgroundColor: isExternalGroup ? "#fff7ed" : "#f1f5f9", padding: "16px 20px", fontWeight: "900", color: isExternalGroup ? "#c2410c" : "#0f172a", borderBottom: "2px solid #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "16px" }}>
            <span>{title}</span>
            {isExternalGroup && <span style={{ fontSize: "11px", color: "#9a3412", backgroundColor: "#ffedd5", border: "1px solid #fdba74", padding: "4px 10px", borderRadius: "12px", fontWeight: "800" }}>50% MARGIN SPLIT</span>}
          </div>
          
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "800" }}>
                  <th style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0" }}>Account Name</th>
                  <th style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0" }}>Client Tag</th>
                  <th style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0" }}>Managed By</th>
                  <th style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0", textAlign: "center" }}>Hours</th>
                  <th style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0", textAlign: "center", color: "#059669" }}>Client Rate ($/hr)</th>
                  <th style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0", textAlign: "center" }}>Leader Rate (₹)</th>
                  <th style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0", textAlign: "right", color: "#1d4ed8" }}>Payout to Leader</th>
                  <th style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0", textAlign: "right", color: "#047857" }}>My Profit</th>
                </tr>
              </thead>
              <tbody>
                {accounts.sort((a,b) => b.mTotal - a.mTotal).map(acc => {
                  const isWorkedByMe = acc.safeHandler.toLowerCase() === myLeaderName.toLowerCase();
                  return (
                    <tr key={acc.email} style={{ borderBottom: "1px solid #f1f5f9", transition: "0.2s" }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"} onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
                      <td style={{ padding: "14px 20px", fontWeight: "700", color: "#0f172a" }}>
                        {acc.email}
                        {acc.isRatedByMe && <span style={{ marginLeft: "8px", fontSize: "9px", backgroundColor: "#e2e8f0", padding: "2px 6px", borderRadius: "4px", color: "#475569" }}>WORKED BY ME</span>}
                      </td>
                      <td style={{ padding: "14px 20px", color: "#2563eb", fontSize: "12px", fontWeight: "700" }}>{acc.clientName || "General"}</td>
                      <td style={{ padding: "14px 20px", color: "#475569", fontWeight: "600", fontSize: "13px", textTransform: "capitalize" }}>{acc.safeHandler}</td>
                      <td style={{ padding: "14px 20px", textAlign: "center", color: "#334155", fontWeight: "800" }}>{formatTime(acc.mTotal)}</td>
                      <td style={{ padding: "14px 20px", textAlign: "center", color: "#059669", fontSize: "13px", fontWeight: "800" }}>{acc.usdRate > 0 ? `$${acc.usdRate}` : '-'}</td>
                      <td style={{ padding: "14px 20px", textAlign: "center", color: "#64748b", fontSize: "13px", fontWeight: "600" }}>₹{acc.cLRate} {acc.isBonusMet && <span style={{fontSize: "10px", color:"#10b981", fontWeight:"bold"}}>(BONUS)</span>}</td>
                      <td style={{ padding: "14px 20px", textAlign: "right", fontWeight: "800", color: "#1e3a8a", backgroundColor: "#eff6ff" }}>
                        {isWorkedByMe ? <span style={{color: "#94a3b8", fontSize: "12px", fontWeight: "600"}}>N/A (Self)</span> : `₹${formatMoney(acc.leaderPayout)}`}
                      </td>
                      <td style={{ padding: "14px 20px", textAlign: "right", fontWeight: "800", color: "#064e3b", backgroundColor: "#ecfdf5" }}>₹{formatMoney(acc.myProfit)}</td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: isExternalGroup ? "#ffedd5" : "#e2e8f0" }}>
                  <td colSpan="3" style={{ padding: "14px 20px", textAlign: "right", fontWeight: "900", color: isExternalGroup ? "#9a3412" : "#334155" }}>Group Subtotals:</td>
                  <td style={{ padding: "14px 20px", textAlign: "center", fontWeight: "900", color: "#0f172a" }}>{formatTime(tHours)}</td>
                  <td colSpan="2"></td>
                  <td style={{ padding: "14px 20px", textAlign: "right", fontWeight: "900", color: "#1d4ed8" }}>₹{formatMoney(tOwed)}</td>
                  <td style={{ padding: "14px 20px", textAlign: "right", fontWeight: "900", color: "#047857" }}>₹{formatMoney(tProfit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    return (
      <div style={{ padding: "30px", backgroundColor: "#f8fafc", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
        <Header 
          title="Financial Overview" 
          selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} 
          displayMonthName={displayMonthName} 
          searchTerm={searchTerm} setSearchTerm={setSearchTerm} 
          conversionRate={conversionRate} setConversionRate={setConversionRate}
        />

        {/* 🚀 GRAND TOTALS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginBottom: "20px" }}>
          <StatCard title="Grand Total Billed Hours" value={formatTime(grandHours)} color="slate" />
          <StatCard title="Total Owed (Expense)" value={`₹${formatMoney(grandExpense)}`} color="red" />
          <StatCard title="Grand Net Profit" value={`₹${formatMoney(grandProfit)}`} color="green" />
        </div>

        {/* 🚀 SPLIT SUMMARIES: OWN vs EXTERNAL */}
        <div style={{ display: "flex", gap: "20px", marginBottom: "40px", flexWrap: "wrap" }}>
          
          {/* MY ACCOUNTS SUMMARY */}
          <div style={{ flex: "1 1 45%", backgroundColor: "#fff", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <h3 style={{ margin: "0 0 20px 0", color: "#0f172a", fontSize: "16px", fontWeight: "900" }}>📁 MY ACCOUNTS SUMMARY</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "800", textTransform: "uppercase" }}>Hours</div>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#1e293b" }}>{formatTime(myOwnHours)}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "800", textTransform: "uppercase" }}>Total Revenue</div>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#2563eb" }}>₹{formatMoney(myOwnRev)}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "800", textTransform: "uppercase" }}>Expense (Payouts)</div>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#e11d48" }}>₹{formatMoney(myOwnExpense)}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "800", textTransform: "uppercase" }}>Net Profit</div>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#059669" }}>₹{formatMoney(myOwnProfit)}</div>
              </div>
            </div>
          </div>

          {/* EXTERNAL ACCOUNTS SUMMARY */}
          <div style={{ flex: "1 1 45%", backgroundColor: "#fff7ed", border: "1px solid #fdba74", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <h3 style={{ margin: "0 0 20px 0", color: "#9a3412", fontSize: "16px", fontWeight: "900" }}>🌍 EXTERNAL ACCOUNTS SUMMARY</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#9a3412", fontWeight: "800", textTransform: "uppercase" }}>Hours</div>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#7c2d12" }}>{formatTime(extHours)}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#9a3412", fontWeight: "800", textTransform: "uppercase" }}>Total Revenue</div>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#2563eb" }}>₹{formatMoney(extRev)}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#9a3412", fontWeight: "800", textTransform: "uppercase" }}>Expense (Payouts)</div>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#e11d48" }}>₹{formatMoney(extExpense)}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#9a3412", fontWeight: "800", textTransform: "uppercase" }}>My Profit (50%)</div>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#059669" }}>₹{formatMoney(extProfit)}</div>
              </div>
            </div>
          </div>

        </div>

        <AdminTable title={`📁 MY OWN ACCOUNTS (${myLeaderName.toUpperCase()})`} accounts={myOwnAccounts} isExternalGroup={false} />
        {isMainAdmin && <AdminTable title={`🤝 PARTNER ACCOUNTS (OTHER CO-ADMINS)`} accounts={partnerAccounts} isExternalGroup={false} />}
        <AdminTable title="🌍 EXTERNAL ACCOUNTS (CLIENTS / POOL)" accounts={externalAccounts} isExternalGroup={true} />
        
      </div>
    );
  }

  // ============================================================================
  // 👑 VIEW 2: LEADER VIEW
  // ============================================================================
  if (isLeader) {
    let teamAccounts = usersList
      .filter(u => (u.role === 'rater' && u.assignedLeader === myLeaderName) || u.email === user.email)
      .map(calculateAccount)
      .filter(a => a.mTotal > 0);

    if (searchTerm) teamAccounts = teamAccounts.filter(acc => acc.email.toLowerCase().includes(searchTerm.toLowerCase()));

    let totalTeamHours = 0, totalReceivables = 0, totalPayables = 0;
    const receivablesByCoAdmin = {};
    const payablesToRaters = [];

    teamAccounts.forEach(acc => {
      totalTeamHours += acc.mTotal;
      totalReceivables += acc.leaderPayout;
      
      if (acc.email !== user.email) {
        totalPayables += acc.workerPayout;
        payablesToRaters.push(acc);
      }

      const coAdminName = acc.clientName || "General Pool (Agency)";
      if (!receivablesByCoAdmin[coAdminName]) receivablesByCoAdmin[coAdminName] = 0;
      receivablesByCoAdmin[coAdminName] += acc.leaderPayout;
    });

    const myNetEarning = totalReceivables - totalPayables;

    return (
      <div style={{ padding: "30px", backgroundColor: "#f8fafc", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
        <Header title="Team & Personal Earnings" selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} displayMonthName={displayMonthName} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "40px" }}>
          <StatCard title="Total Team Hours" value={formatTime(totalTeamHours)} color="slate" />
          <StatCard title="My Net Earnings (Profit)" value={`₹${formatMoney(myNetEarning)}`} color="green" />
          <StatCard title="Total Owed to Team" value={`₹${formatMoney(totalPayables)}`} color="red" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "30px" }}>
          <div>
            <h2 style={{ fontSize: "18px", color: "#064e3b", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" }}>📥 Inbound Payouts <span style={{fontSize:"12px", color:"#10b981"}}>(From Co-Admins)</span></h2>
            <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #a7f3d0", overflow: "hidden", boxShadow: "0 2px 4px rgba(16,185,129,0.05)" }}>
              {Object.keys(receivablesByCoAdmin).map((coAdmin, idx) => (
                <div key={coAdmin} style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", borderBottom: idx === Object.keys(receivablesByCoAdmin).length - 1 ? "none" : "1px solid #f1f5f9" }}>
                  <span style={{ fontWeight: "700", color: "#334155" }}>{coAdmin}</span>
                  <span style={{ fontWeight: "900", color: "#059669", fontSize: "16px" }}>₹{formatMoney(receivablesByCoAdmin[coAdmin])}</span>
                </div>
              ))}
              <div style={{ backgroundColor: "#ecfdf5", padding: "16px 20px", display: "flex", justifyContent: "space-between", borderTop: "2px solid #a7f3d0" }}>
                <span style={{ fontWeight: "800", color: "#065f46" }}>Total Expected:</span>
                <span style={{ fontWeight: "900", color: "#047857", fontSize: "18px" }}>₹{formatMoney(totalReceivables)}</span>
              </div>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: "18px", color: "#9f1239", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" }}>📤 Outbound Payroll <span style={{fontSize:"12px", color:"#f43f5e"}}>(To Team)</span></h2>
            <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #fecdd3", overflow: "hidden", boxShadow: "0 2px 4px rgba(225,29,72,0.05)" }}>
              {payablesToRaters.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8" }}>No team members logged hours.</div>
              ) : (
                payablesToRaters.sort((a,b) => b.workerPayout - a.workerPayout).map((rater, idx) => (
                  <div key={rater.email} style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: idx === payablesToRaters.length - 1 ? "none" : "1px solid #f1f5f9" }}>
                    <div>
                      <div style={{ fontWeight: "700", color: "#334155" }}>{rater.email}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{formatTime(rater.mTotal)} @ ₹{rater.cRRate}/hr</div>
                    </div>
                    <span style={{ fontWeight: "900", color: "#e11d48", fontSize: "16px" }}>₹{formatMoney(rater.workerPayout)}</span>
                  </div>
                ))
              )}
              <div style={{ backgroundColor: "#fff1f2", padding: "16px 20px", display: "flex", justifyContent: "space-between", borderTop: "2px solid #fecdd3" }}>
                <span style={{ fontWeight: "800", color: "#9f1239" }}>Total to Pay:</span>
                <span style={{ fontWeight: "900", color: "#be123c", fontSize: "18px" }}>₹{formatMoney(totalPayables)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 👤 VIEW 3: RATER VIEW (Untouched)
  // ============================================================================
  const myData = calculateAccount(myProfile);
  const myLeader = myProfile.assignedLeader || "Agency Admin";

  return (
    <div style={{ padding: "30px", backgroundColor: "#f8fafc", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <Header title="My Earnings" selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} displayMonthName={displayMonthName} />

      <div style={{ maxWidth: "500px", margin: "0 auto", backgroundColor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <div style={{ backgroundColor: "#1e293b", padding: "40px 30px", color: "#fff", textAlign: "center" }}>
          <div style={{ fontSize: "14px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Total Earnings</div>
          <div style={{ fontSize: "56px", fontWeight: "900", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
            ₹{formatMoney(myData.workerPayout)}
          </div>
        </div>

        <div style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "15px" }}>
            <span style={{ color: "#64748b", fontWeight: "600" }}>Total Hours Logged</span>
            <span style={{ color: "#0f172a", fontWeight: "800" }}>{formatTime(myData.mTotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "15px" }}>
            <span style={{ color: "#64748b", fontWeight: "600" }}>Hourly Rate</span>
            <span style={{ color: "#0f172a", fontWeight: "800" }}>₹{myData.cRRate}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f0fdf4", padding: "15px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
            <span style={{ color: "#065f46", fontWeight: "700" }}>Owed by Leader:</span>
            <span style={{ color: "#047857", fontWeight: "900", fontSize: "16px" }}>{myLeader}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const Header = ({ title, selectedMonth, setSelectedMonth, displayMonthName, searchTerm, setSearchTerm, conversionRate, setConversionRate }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "30px", flexWrap: "wrap", gap: "15px" }}>
    <div>
      <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "900", color: "#0f172a" }}>{title}</h1>
      <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "14px" }}>Viewing data for {displayMonthName}</p>
    </div>
    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
      {setConversionRate && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#fffbeb", padding: "4px 14px", borderRadius: "8px", border: "1px solid #fde68a" }}>
          <span style={{ fontSize: "12px", fontWeight: "bold", color: "#d97706" }}>$ to ₹ Rate:</span>
          <input 
            type="number" value={conversionRate} onChange={(e) => setConversionRate(e.target.value)}
            style={{ width: "50px", border: "none", background: "transparent", outline: "none", fontWeight: "900", color: "#b45309", fontSize: "14px" }}
          />
        </div>
      )}
      
      {setSearchTerm && (
        <input 
          type="text" placeholder="🔍 Search accounts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", width: "200px" }}
        />
      )}
      <input 
        type="month" value={selectedMonth} onChange={(e) => { if (e.target.value) setSelectedMonth(e.target.value); }}
        style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontWeight: "700", outline: "none", cursor: "pointer", backgroundColor: "#fff" }}
      />
    </div>
  </div>
);

const StatCard = ({ title, value, color }) => {
  const colors = {
    slate: { bg: "#f8fafc", border: "#e2e8f0", title: "#64748b", val: "#0f172a" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", title: "#1d4ed8", val: "#1e3a8a" },
    green: { bg: "#ecfdf5", border: "#a7f3d0", title: "#047857", val: "#064e3b" },
    red: { bg: "#fff1f2", border: "#fecdd3", title: "#be123c", val: "#9f1239" },
  };
  const theme = colors[color];
  return (
    <div style={{ backgroundColor: theme.bg, padding: "20px", borderRadius: "12px", border: `1px solid ${theme.border}`, boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
      <div style={{ fontSize: "12px", color: theme.title, fontWeight: "800", textTransform: "uppercase" }}>{title}</div>
      <div style={{ fontSize: "28px", fontWeight: "900", color: theme.val, marginTop: "6px" }}>{value}</div>
    </div>
  );
};