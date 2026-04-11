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

export default function Earnings({ user }) {
  const [usersList, setUsersList] = useState([]);
  const [timeData, setTimeData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [searchTerm, setSearchTerm] = useState("");

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
  const myLeaderName = myProfile.leaderName;

  let displayMonthName = selectedMonth;
  const [yStr, mStr] = selectedMonth.split('-');
  const mIndex = parseInt(mStr, 10) - 1;
  if (!isNaN(mIndex)) displayMonthName = `${MONTHS[mIndex]} ${yStr}`;

  const calculateAccount = (acc) => {
    const monthLogs = timeData.filter(l => l.email === acc.email && typeof l.assigned_date === 'string' && l.assigned_date.startsWith(selectedMonth));
    let mTotal = 0;
    monthLogs.forEach(l => mTotal += (Number(l.time_value_hours) || 0));

    const tBase = Number(acc.bonusThreshold) || 40;
    const isBonusMet = acc.hasBonus && mTotal >= tBase;
    
    const fallbackRate = Number(acc.payRateUSD) || 0;
    const hasLeaderRate = Number(acc.leaderBaseINR) > 0 || Number(acc.leaderMaxINR) > 0;
    const hasRaterRate = Number(acc.raterBaseINR) > 0 || Number(acc.raterMaxINR) > 0;

    const cLRate = hasLeaderRate ? (isBonusMet ? (Number(acc.leaderMaxINR) || Number(acc.leaderBaseINR) || 0) : (Number(acc.leaderBaseINR) || 0)) : fallbackRate;
    const cRRate = hasRaterRate ? (isBonusMet ? (Number(acc.raterMaxINR) || Number(acc.raterBaseINR) || 0) : (Number(acc.raterBaseINR) || 0)) : fallbackRate;
    
    const revenue = mTotal * cLRate;       
    const workerPayout = mTotal * cRRate;  
    const margin = revenue - workerPayout; 

    const cName = (acc.clientName || "").trim().toLowerCase();
    const isInternal = cName === 'me' || cName === 'internal' || cName === 'general pool' || cName === '';
    const isExternal = !isInternal;
    const isRatedByMe = acc.email === user.email;

    let myProfit = 0;
    if (isMainAdmin || isCoAdmin) {
      if (isRatedByMe) {
        myProfit = isInternal ? revenue : workerPayout + (margin / 2);
      } else {
        myProfit = isInternal ? margin : (margin / 2);
      }
    }

    return {
      ...acc, mTotal, revenue, workerPayout, margin, myProfit, isInternal, isExternal, isRatedByMe, cLRate, cRRate, isBonusMet
    };
  };

  // ============================================================================
  // 👔 VIEW 1: CO-ADMIN / ADMIN VIEW
  // ============================================================================
  if (isMainAdmin || isCoAdmin) {
    // 🚀 STRICT PRIVACY FILTERING ENGINE
    let rawAccounts = [];
    if (isMainAdmin) {
      rawAccounts = usersList;
    } else if (isCoAdmin) {
      rawAccounts = usersList.filter(u => {
        if (u.email === user.email || u.assignedLeader === myLeaderName) return true;
        if (u.role === 'admin' || u.role === 'co-admin') return false;
        
        const cName = (u.clientName || "").trim().toLowerCase();
        const lName = (u.assignedLeader || "").trim().toLowerCase();
        const isPersonal = cName === "me" || cName === "internal" || cName === lName;

        if (isPersonal) {
          const leaderProfile = usersList.find(x => x.leaderName && x.leaderName.toLowerCase() === lName);
          if (leaderProfile && leaderProfile.role === 'co-admin') {
            return false; // Hide from view
          }
        }
        return true;
      });
    }

    let allAccounts = rawAccounts.map(calculateAccount).filter(a => a.mTotal > 0);
    
    if (searchTerm) {
      allAccounts = allAccounts.filter(acc => 
        acc.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (acc.clientName && acc.clientName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    let totalAgencyHours = 0, totalAgencyRevenue = 0, totalOutboundPayroll = 0, totalMyNetProfit = 0;
    const leaderPayroll = {};

    allAccounts.forEach(acc => {
      totalAgencyHours += acc.mTotal;
      totalAgencyRevenue += acc.revenue;
      totalMyNetProfit += acc.myProfit;

      if (!acc.isRatedByMe) {
        totalOutboundPayroll += acc.workerPayout;
        const leader = acc.assignedLeader || "Unassigned / Direct";
        if (!leaderPayroll[leader]) leaderPayroll[leader] = { total: 0, hours: 0, accounts: [] };
        leaderPayroll[leader].total += acc.workerPayout;
        leaderPayroll[leader].hours += acc.mTotal;
        leaderPayroll[leader].accounts.push(acc);
      }
    });

    const internalAccounts = allAccounts.filter(a => a.isInternal);
    const externalAccounts = allAccounts.filter(a => a.isExternal);

    const AdminTable = ({ title, accounts, isExternal }) => {
      if (accounts.length === 0) return null;
      
      const tHours = accounts.reduce((sum, a) => sum + a.mTotal, 0);
      const tRev = accounts.reduce((sum, a) => sum + a.revenue, 0);
      const tPayout = accounts.reduce((sum, a) => sum + a.workerPayout, 0);
      const tProfit = accounts.reduce((sum, a) => sum + a.myProfit, 0);

      return (
        <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: "25px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div style={{ backgroundColor: "#f8fafc", padding: "12px 20px", fontWeight: "800", color: "#1e293b", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "15px" }}>{title}</span>
            {isExternal && <span style={{ fontSize: "11px", color: "#c2410c", backgroundColor: "#ffedd5", padding: "4px 10px", borderRadius: "12px", fontWeight: "700" }}>External Margin (50% Shared with Vivek)</span>}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", whiteSpace: "nowrap" }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9", fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>
                <th style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0" }}>Account</th>
                <th style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0" }}>Client Tag</th>
                <th style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0" }}>Leader</th>
                <th style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0", textAlign: "center" }}>Hours</th>
                <th style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>Leader Payout Value</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.email} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 20px", fontWeight: "600", color: "#0f172a" }}>{acc.email}</td>
                  <td style={{ padding: "12px 20px", color: "#64748b", fontSize: "12px" }}>{acc.clientName || "-"}</td>
                  <td style={{ padding: "12px 20px", color: "#475569", fontWeight: "600" }}>{acc.assignedLeader || "-"}</td>
                  <td style={{ padding: "12px 20px", textAlign: "center", color: "#334155", fontWeight: "600" }}>{formatTime(acc.mTotal)}</td>
                  <td style={{ padding: "12px 20px", textAlign: "right", fontWeight: "800", color: "#1d4ed8" }}>₹{formatMoney(acc.leaderPayment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    };

    const renderAccountGroup = (title, accounts, isExternal) => {
      if (accounts.length === 0) return null;
      
      const myAccs = accounts.filter(a => a.isRatedByMe);
      const teamAccs = accounts.filter(a => !a.isRatedByMe);
      const leaderGroups = {};
      teamAccs.forEach(a => {
        const l = a.assignedLeader || "Unassigned";
        if (!leaderGroups[l]) leaderGroups[l] = [];
        leaderGroups[l].push(a);
      });

      return (
        <div style={{ marginBottom: "50px" }}>
          <h2 style={{ fontSize: "22px", color: "#0f172a", borderBottom: "3px solid #cbd5e1", paddingBottom: "10px", marginBottom: "25px", fontWeight: "900" }}>{title}</h2>
          <AdminTable title="👨‍💻 Rated by Me" accounts={myAccs} isExternal={isExternal} />
          {Object.keys(leaderGroups).sort().map(l => (
            <AdminTable key={l} title={`👑 Rated by Team: ${l}`} accounts={leaderGroups[l]} isExternal={isExternal} />
          ))}
        </div>
      );
    };

    return (
      <div style={{ padding: "30px", backgroundColor: "#f1f5f9", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
        <Header title="Agency Financial Overview" selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} displayMonthName={displayMonthName} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "40px" }}>
          <StatCard title="Total Agency Hours" value={formatTime(totalAgencyHours)} color="slate" />
          <StatCard title="Total Agency Revenue" value={`₹${formatMoney(totalAgencyRevenue)}`} color="blue" />
          <StatCard title="Total Outbound Payroll" value={`₹${formatMoney(totalOutboundPayroll)}`} color="red" />
          <StatCard title="My Total Net Profit" value={`₹${formatMoney(totalMyNetProfit)}`} color="green" />
        </div>

        {Object.keys(leaderPayroll).length > 0 && (
          <div style={{ marginBottom: "50px", padding: "25px", backgroundColor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontSize: "20px", color: "#0f172a", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}><span style={{fontSize:"24px"}}>💸</span> Outbound Leader Payroll</h2>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              {Object.keys(leaderPayroll).sort().map(leader => (
                <div key={leader} style={{ flex: "1 1 250px", backgroundColor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "12px", padding: "20px" }}>
                  <div style={{ fontSize: "16px", fontWeight: "800", color: "#9f1239", marginBottom: "10px" }}>{leader}</div>
                  <div style={{ fontSize: "28px", fontWeight: "900", color: "#be123c", marginBottom: "10px" }}>₹{formatMoney(leaderPayroll[leader].total)}</div>
                  <div style={{ fontSize: "13px", color: "#e11d48", fontWeight: "600" }}>For {formatTime(leaderPayroll[leader].hours)} across {leaderPayroll[leader].accounts.length} accounts.</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {renderAccountGroup("🏢 INTERNAL ACCOUNTS (AGENCY)", internalAccounts, false)}
        {renderAccountGroup("🌍 EXTERNAL ACCOUNTS (CLIENTS)", externalAccounts, true)}
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
      totalReceivables += acc.revenue;
      
      if (acc.email !== user.email) {
        totalPayables += acc.workerPayout;
        payablesToRaters.push(acc);
      }

      const coAdminName = acc.clientName || "General Pool (Agency)";
      if (!receivablesByCoAdmin[coAdminName]) receivablesByCoAdmin[coAdminName] = 0;
      receivablesByCoAdmin[coAdminName] += acc.revenue;
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
  // 👤 VIEW 3: RATER VIEW
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

const Header = ({ title, selectedMonth, setSelectedMonth, displayMonthName, searchTerm, setSearchTerm }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "30px", flexWrap: "wrap", gap: "15px" }}>
    <div>
      <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "900", color: "#0f172a" }}>{title}</h1>
      <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "14px" }}>Viewing data for {displayMonthName}</p>
    </div>
    <div style={{ display: "flex", gap: "10px" }}>
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