import React, { useState, useEffect, useMemo } from 'react';
import { db } from "../firebase";
import { collection, onSnapshot, doc, setDoc, updateDoc } from "firebase/firestore";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PayoutLedger({ user }) {
  const [usersList, setUsersList] = useState([]);
  const [timeData, setTimeData] = useState([]);
  const [globalCompanies, setGlobalCompanies] = useState([]);
  const [globalCoAdmins, setGlobalCoAdmins] = useState([]);
  const [payoutTerms, setPayoutTerms] = useState({}); // Stores DAYS (e.g., 30, 45, 60)
  const [payoutStatus, setPayoutStatus] = useState({}); 
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  // 🚀 WE ARE NOW SELECTING THE "PAYOUT" MONTH
  const [selectedPayoutMonth, setSelectedPayoutMonth] = useState(currentMonthStr);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTime = onSnapshot(collection(db, "time_entries"), (snap) => setTimeData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRoles = onSnapshot(doc(db, "systemSettings", "roles"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGlobalCompanies(data.companyNames || []);
        setGlobalCoAdmins(data.coAdminNames || []);
      }
    });
    const unsubTerms = onSnapshot(doc(db, "systemSettings", "payoutTerms"), (snap) => {
      if (snap.exists()) setPayoutTerms(snap.data());
      else setDoc(doc(db, "systemSettings", "payoutTerms"), {}); 
    });
    const unsubStatus = onSnapshot(collection(db, "payout_ledgers"), (snap) => {
      const statuses = {};
      snap.docs.forEach(d => { statuses[d.id] = d.data(); });
      setPayoutStatus(statuses);
    });

    setLoading(false);
    return () => { unsubUsers(); unsubTime(); unsubRoles(); unsubTerms(); unsubStatus(); };
  }, []);

  const myProfile = usersList.find(u => u.email === user?.email);
  const isCoAdmin = myProfile?.role === 'co-admin' || myProfile?.role === 'admin';
  const isAdmin = myProfile?.role === 'admin';
  const myLeaderName = myProfile?.leaderName || "Unknown";

  const formatMonthName = (YYYYMM) => {
    const [y, m] = YYYYMM.split('-');
    return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
  };

  const getTargetWorkMonth = (payoutMonthStr, delayDays) => {
    const [y, m] = payoutMonthStr.split('-').map(Number);
    const anchorDate = new Date(y, m - 1, 1); 
    anchorDate.setDate(anchorDate.getDate() - delayDays);
    return `${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, '0')}`;
  };

  const processedPayouts = useMemo(() => {
    const internalGroups = {};
    const externalGroups = {};

    const myLeaderNameLower = myLeaderName.toLowerCase();
    const otherCoAdminsLower = globalCoAdmins
      .map(c => c.toLowerCase())
      .filter(c => c !== myLeaderNameLower);

    usersList.forEach(acc => {
      if (!isCoAdmin && acc.assignedLeader !== myLeaderName && acc.email !== user?.email) return;
      if (acc.role === 'admin' || acc.role === 'co-admin') return;

      const client = String(acc.clientName || "").trim().toLowerCase();
      const leader = String(acc.assignedLeader || "").trim().toLowerCase();
      const company = acc.companyName || "Unassigned Company";
      
      const delayDays = payoutTerms[company] !== undefined ? payoutTerms[company] : 30; 
      const targetWorkMonth = getTargetWorkMonth(selectedPayoutMonth, delayDays);

      const logs = timeData.filter(l => l.email === acc.email && typeof l.assigned_date === 'string' && l.assigned_date.startsWith(targetWorkMonth));
      
      let mTotal = 0;
      logs.forEach(l => {
        const h = Number(l.time_value_hours) || 0;
        if (!isNaN(h)) mTotal += h;
      });

      if (mTotal > 0) {
        const isInternal = client === "" || client === "internal" || client === "me" || globalCoAdmins.some(ca => ca.toLowerCase() === client);
        const isOwnedByOtherCoAdmin = otherCoAdminsLower.includes(client) || otherCoAdminsLower.includes(leader);
        const canMarkPaid = isAdmin || (isCoAdmin && !isOwnedByOtherCoAdmin);

        // 🚀 BULLETPROOF MATH (Exactly matched from RatersPerformance.jsx)
        const tBase = Number(acc.bonusThreshold) || 40;
        const isBonusMet = acc.hasBonus && mTotal >= tBase;
        
        // Strictly parse numbers to avoid string concatenation or falsy failures
        const lBaseInr = Number(acc.leaderBaseINR) || 0;
        const lMaxInr = Number(acc.leaderMaxINR) || 0;
        
        const cLRate = isBonusMet ? (lMaxInr > 0 ? lMaxInr : lBaseInr) : lBaseInr;
        
        const rev = mTotal * cLRate;
        const totalPay = Math.round(rev);
        
        const ledgerId = `${acc.email}_${targetWorkMonth}`;
        const isPaid = payoutStatus[ledgerId]?.status === 'paid';

        const payoutRecord = {
          email: acc.email,
          leader: acc.assignedLeader || "Unassigned",
          clientName: acc.clientName || "Agency Pool",
          hours: mTotal,
          rate: cLRate,
          totalPay: totalPay,
          isBonusMet: isBonusMet,
          ledgerId: ledgerId,
          isPaid: isPaid,
          isOwnedByOtherCoAdmin: isOwnedByOtherCoAdmin,
          canMarkPaid: canMarkPaid,
        };

        const targetDict = isInternal ? internalGroups : externalGroups;

        if (!targetDict[company]) {
          const [ty, tm] = targetWorkMonth.split('-').map(Number);
          const workMonthEnd = new Date(ty, tm, 0); 
          const expectedPayoutDate = new Date(workMonthEnd);
          expectedPayoutDate.setDate(expectedPayoutDate.getDate() + delayDays);

          const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const expectedDateOnly = new Date(expectedPayoutDate.getFullYear(), expectedPayoutDate.getMonth(), expectedPayoutDate.getDate());
          
          targetDict[company] = { 
            companyName: company, 
            workMonthFormatted: formatMonthName(targetWorkMonth),
            delayDays: delayDays,
            expectedDateFormatted: expectedPayoutDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            isPastDue: todayDateOnly > expectedDateOnly,
            accounts: [], 
            totalDue: 0, 
            totalPaid: 0,
            totalHours: 0
          };
        }
        
        targetDict[company].accounts.push(payoutRecord);
        targetDict[company].totalHours += mTotal;
        
        if (isPaid) targetDict[company].totalPaid += totalPay;
        else targetDict[company].totalDue += totalPay;
      }
    });

    const sortGroups = (dict) => {
      Object.values(dict).forEach(group => group.accounts.sort((a, b) => b.totalPay - a.totalPay));
      return Object.values(dict).sort((a, b) => String(a.companyName).localeCompare(String(b.companyName)));
    };

    return {
      internal: sortGroups(internalGroups),
      external: sortGroups(externalGroups)
    };
  }, [usersList, timeData, payoutTerms, selectedPayoutMonth, isCoAdmin, isAdmin, myLeaderName, payoutStatus, globalCoAdmins]);

  const handleUpdateDelay = async (company, delayValue) => {
    try {
      await updateDoc(doc(db, "systemSettings", "payoutTerms"), { [company]: Number(delayValue) });
    } catch (err) {
      alert("Error updating delay terms.");
    }
  };

  const handleTogglePaidStatus = async (ledgerId, currentStatus) => {
    try {
      if (currentStatus) {
        await updateDoc(doc(db, "payout_ledgers", ledgerId), { status: 'pending' });
      } else {
        await setDoc(doc(db, "payout_ledgers", ledgerId), { status: 'paid', timestamp: new Date().toISOString() }, { merge: true });
      }
    } catch (err) {
      alert("Error updating payment status. Check permissions.");
    }
  };

  const handleMarkCompanyPaid = async (group) => {
    const pendingAccounts = group.accounts.filter(a => !a.isPaid && a.canMarkPaid);
    
    if (pendingAccounts.length === 0) return alert("No accounts available for you to mark as paid in this group!");
    if (!window.confirm(`Are you sure you want to mark all ${pendingAccounts.length} of YOUR pending accounts in ${group.companyName} as PAID?`)) return;

    try {
      const promises = pendingAccounts.map(acc => 
        setDoc(doc(db, "payout_ledgers", acc.ledgerId), { status: 'paid', timestamp: new Date().toISOString() }, { merge: true })
      );
      await Promise.all(promises);
    } catch (err) {
      alert("Error processing batch payment.");
    }
  };

  if (loading) return <div style={{ padding: "100px", textAlign: "center", color: "#64748b", fontWeight: "bold" }}>Calculating Ledgers...</div>;

  const getTotals = (groups) => {
    let due = 0, paid = 0, hrs = 0;
    groups.forEach(g => { due += g.totalDue; paid += g.totalPaid; hrs += g.totalHours; });
    return { due, paid, hrs };
  };

  const internalTotals = getTotals(processedPayouts.internal);
  const externalTotals = getTotals(processedPayouts.external);
  const grandTotalDue = internalTotals.due + externalTotals.due;
  const grandTotalPaid = internalTotals.paid + externalTotals.paid;
  const grandTotalHours = internalTotals.hrs + externalTotals.hrs;

  const CompanyTableGroup = ({ group, isInternal }) => {
    const hasPayableAccounts = group.accounts.some(a => !a.isPaid && a.canMarkPaid);

    return (
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", borderTop: `6px solid ${isInternal ? "#0f172a" : "#0284c7"}`, boxShadow: "0 4px 6px rgba(0,0,0,0.05)", overflow: "hidden", marginBottom: "30px" }}>
        <div style={{ backgroundColor: "#f8fafc", padding: "20px 25px", borderBottom: "2px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ width: "45px", height: "45px", backgroundColor: isInternal ? "#e2e8f0" : "#e0f2fe", color: isInternal ? "#0f172a" : "#0284c7", borderRadius: "10px", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "22px" }}>
              {isInternal ? "🏢" : "🤝"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <h2 style={{ margin: "0", fontSize: "22px", color: "#0f172a", fontWeight: "900" }}>{group.companyName}</h2>
              <div style={{ fontSize: "14px", color: "#334155" }}>
                Paying for hours worked in: <strong style={{color: "#0f172a", fontSize: "16px"}}>{group.workMonthFormatted}</strong> 
                <span style={{ fontWeight: "bold", color: "#64748b" }}> (Net-{group.delayDays} delay)</span>
              </div>
              <div style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
                <span style={{ color: "#475569", fontWeight: "600" }}>Approx Payout Date: <strong style={{color: group.isPastDue && group.totalDue > 0 ? "#ef4444" : "#059669"}}>{group.expectedDateFormatted}</strong></span>
                {group.isPastDue && group.totalDue > 0 && (
                  <span className="pulse-alert" style={{ backgroundColor: "#ef4444", color: "white", padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "900", letterSpacing: "0.5px" }}>
                    ⚠️ PAST DUE! PAY NOW
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "25px", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "18px", fontWeight: "900", color: "#475569" }}>{group.totalHours.toFixed(1)}h</div>
              <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase" }}>Total Hrs</div>
            </div>
            <div style={{ textAlign: "center", backgroundColor: "#ecfdf5", padding: "6px 12px", borderRadius: "8px" }}>
              <div style={{ fontSize: "16px", fontWeight: "900", color: "#059669" }}>₹{group.totalPaid.toLocaleString("en-IN")}</div>
              <div style={{ fontSize: "11px", color: "#059669", fontWeight: "800", textTransform: "uppercase" }}>Paid Out</div>
            </div>
            <div style={{ textAlign: "center", backgroundColor: "#fffbeb", padding: "8px 16px", borderRadius: "8px", border: "1px solid #fde68a" }}>
              <div style={{ fontSize: "20px", fontWeight: "900", color: "#b45309" }}>₹{group.totalDue.toLocaleString("en-IN")}</div>
              <div style={{ fontSize: "11px", color: "#d97706", fontWeight: "800", textTransform: "uppercase" }}>Pending Due</div>
            </div>

            {hasPayableAccounts && (
              <button 
                onClick={() => handleMarkCompanyPaid(group)}
                style={{ padding: "12px 20px", backgroundColor: "#10b981", color: "white", border: "none", borderRadius: "8px", fontWeight: "900", cursor: "pointer", boxShadow: "0 4px 6px rgba(16, 185, 129, 0.3)", transition: "0.2s" }}
              >
                ✅ Pay My Team
              </button>
            )}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", whiteSpace: "nowrap" }}>
            <thead>
              <tr style={{ backgroundColor: "#fff" }}>
                <th style={{ padding: "15px 25px", textAlign: "left", fontSize: "11px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>Account Info</th>
                <th style={{ padding: "15px 20px", textAlign: "center", fontSize: "11px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>Hours ({group.workMonthFormatted})</th>
                <th style={{ padding: "15px 20px", textAlign: "right", fontSize: "11px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>Final Rate</th>
                <th style={{ padding: "15px 20px", textAlign: "right", fontSize: "11px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>Total Due</th>
                <th style={{ padding: "15px 25px", textAlign: "right", fontSize: "11px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>Action / Status</th>
              </tr>
            </thead>
            <tbody>
              {group.accounts.map(acc => {
                let rowBgColor = acc.isPaid ? "#f8fafc" : "#fff";
                if (!acc.isPaid && acc.isOwnedByOtherCoAdmin) rowBgColor = "#fff1f2"; 
                if (acc.isPaid && acc.isOwnedByOtherCoAdmin) rowBgColor = "#fce7f3"; 

                return (
                  <tr key={acc.ledgerId} style={{ transition: "0.2s", backgroundColor: rowBgColor, opacity: acc.isPaid ? 0.7 : 1 }}>
                    <td style={{ padding: "15px 25px", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ fontWeight: "800", color: "#1e293b", fontSize: "14px" }}>{acc.email}</div>
                      <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginTop: "4px", display: "flex", gap: "10px" }}>
                        <span>👤 L: {acc.leader}</span>
                        <span style={{color: "#cbd5e1"}}>|</span>
                        <span>📂 C: {acc.clientName}</span>
                      </div>
                    </td>
                    <td style={{ padding: "15px 20px", borderBottom: "1px solid #f1f5f9", textAlign: "center", fontWeight: "800", color: "#3b82f6", fontSize: "14px" }}>
                      {acc.hours.toFixed(1)} h
                    </td>
                    <td style={{ padding: "15px 20px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>
                      <div style={{ fontWeight: "700", color: "#475569", fontSize: "13px" }}>₹{acc.rate}</div>
                      {acc.isBonusMet && <div style={{ fontSize: "9px", color: "#fff", backgroundColor: "#a855f7", padding: "2px 6px", borderRadius: "4px", display: "inline-block", marginTop: "4px", fontWeight: "bold" }}>TARGET HIT</div>}
                    </td>
                    <td style={{ padding: "15px 20px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: "900", color: acc.isPaid ? "#94a3b8" : "#be123c", fontSize: "16px" }}>
                      ₹{acc.totalPay.toLocaleString("en-IN")}
                    </td>
                    <td style={{ padding: "15px 25px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>
                      {!acc.canMarkPaid ? (
                        <span style={{ padding: "6px 12px", borderRadius: "6px", fontWeight: "800", fontSize: "11px", backgroundColor: "#f1f5f9", color: "#94a3b8", border: "1px solid #cbd5e1" }} title="Owned by another Co-Admin">
                          🔒 RESTRICTED
                        </span>
                      ) : acc.isPaid ? (
                        <button 
                          onClick={() => handleTogglePaidStatus(acc.ledgerId, acc.isPaid)}
                          style={{ padding: "8px 14px", borderRadius: "6px", fontWeight: "800", fontSize: "11px", cursor: "pointer", transition: "0.2s", backgroundColor: "#f1f5f9", color: "#94a3b8", border: "1px solid #cbd5e1" }}
                        >
                          UNDO PAID
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleTogglePaidStatus(acc.ledgerId, acc.isPaid)}
                          style={{ padding: "8px 14px", borderRadius: "6px", fontWeight: "800", fontSize: "11px", cursor: "pointer", transition: "0.2s", backgroundColor: "#10b981", color: "white", border: "none", boxShadow: "0 2px 4px rgba(16, 185, 129, 0.3)" }}
                        >
                          MARK PAID
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: "1300px", margin: "0 auto", padding: "20px", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
        .pulse-alert { animation: pulse 1.5s infinite; }
      `}</style>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "30px", flexWrap: "wrap", gap: "20px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "900", color: "#0f172a" }}>🏦 Accounts Payable Ledger</h1>
          <p style={{ margin: "5px 0 0 0", color: "#64748b", fontSize: "14px" }}>
            Showing payouts scheduled to be distributed in <strong style={{color: "#3b82f6", fontSize: "16px"}}>{formatMonthName(selectedPayoutMonth)}</strong>
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
          {isCoAdmin && (
            <button 
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              style={{ padding: "10px 16px", backgroundColor: isSettingsOpen ? "#0f172a" : "#e2e8f0", color: isSettingsOpen ? "white" : "#334155", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", transition: "0.2s" }}
            >
              ⚙️ Payment Terms (Delays)
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#fff", padding: "6px 12px", borderRadius: "8px", border: "2px solid #cbd5e1", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#475569" }}>Payout Month:</span>
            <input 
              type="month" 
              value={selectedPayoutMonth} 
              onChange={(e) => e.target.value && setSelectedPayoutMonth(e.target.value)}
              style={{ padding: "6px", borderRadius: "4px", border: "none", outline: "none", fontWeight: "900", color: "#3b82f6", cursor: "pointer", fontSize: "15px" }}
            />
          </div>
        </div>
      </div>

      {isSettingsOpen && isCoAdmin && (
        <div style={{ backgroundColor: "#1e293b", padding: "25px", borderRadius: "12px", marginBottom: "30px", color: "white", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ margin: "0 0 15px 0", fontSize: "18px", color: "#f8fafc", display: "flex", alignItems: "center", gap: "8px" }}>
            🏢 Configure Payment Delays (in Days)
          </h3>
          <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "20px" }}>
            Set how many DAYS after a month's work is completed before the company issues payment. <br/>
            (e.g., Net-30 = 30 days, Net-60 = 60 days). Default is 30.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "15px" }}>
            {globalCompanies.map(company => (
              <div key={company} style={{ backgroundColor: "#334155", padding: "12px 15px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontWeight: "bold", width: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{company}</span>
                <input 
                  type="number"
                  value={payoutTerms[company] !== undefined ? payoutTerms[company] : 30}
                  onChange={(e) => handleUpdateDelay(company, e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #475569", backgroundColor: "#0f172a", color: "white", fontWeight: "bold", outline: "none", width: "70px", textAlign: "center" }}
                />
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>days</span>
              </div>
            ))}
            {globalCompanies.length === 0 && <span style={{ color: "#ef4444", fontSize: "13px", fontWeight: "bold" }}>No companies found. Add them in Account Management first.</span>}
          </div>
        </div>
      )}

      {/* GRAND TOTAL STATS */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "30px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, backgroundColor: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "800", textTransform: "uppercase" }}>Total Expected Payout ({formatMonthName(selectedPayoutMonth)})</div>
          <div style={{ fontSize: "28px", fontWeight: "900", color: "#0f172a", marginTop: "6px" }}>₹{(grandTotalDue + grandTotalPaid).toLocaleString("en-IN")}</div>
          <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "bold", marginTop: "4px" }}>Paying for {grandTotalHours.toFixed(1)} total past hours</div>
        </div>
        <div style={{ flex: 1, backgroundColor: "#eff6ff", padding: "20px", borderRadius: "12px", border: "1px solid #bfdbfe", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
          <div style={{ fontSize: "12px", color: "#1d4ed8", fontWeight: "800", textTransform: "uppercase" }}>Total Settled / Paid</div>
          <div style={{ fontSize: "28px", fontWeight: "900", color: "#1e3a8a", marginTop: "6px" }}>₹{grandTotalPaid.toLocaleString("en-IN")}</div>
        </div>
        <div style={{ flex: 1, backgroundColor: "#fffbeb", padding: "20px", borderRadius: "12px", border: "1px solid #fde68a", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
          <div style={{ fontSize: "12px", color: "#d97706", fontWeight: "800", textTransform: "uppercase" }}>Pending Funds to Send</div>
          <div style={{ fontSize: "28px", fontWeight: "900", color: "#b45309", marginTop: "6px" }}>₹{grandTotalDue.toLocaleString("en-IN")}</div>
        </div>
      </div>

      {processedPayouts.internal.length === 0 && processedPayouts.external.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center", backgroundColor: "#fff", borderRadius: "16px", border: "2px dashed #cbd5e1" }}>
          <span style={{ fontSize: "40px", display: "block", marginBottom: "15px" }}>📭</span>
          <h3 style={{ margin: "0 0 5px 0", color: "#334155" }}>No payouts are scheduled for {formatMonthName(selectedPayoutMonth)}.</h3>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>Try selecting a different Payout Month above.</p>
        </div>
      ) : (
        <>
          {/* INTERNAL ACCOUNTS */}
          {processedPayouts.internal.length > 0 && (
            <div style={{ marginBottom: "50px" }}>
              <h2 style={{ fontSize: "22px", color: "#0f172a", borderBottom: "2px solid #cbd5e1", paddingBottom: "10px", marginBottom: "20px" }}>
                🏢 Internal Agency Accounts
              </h2>
              {processedPayouts.internal.map(group => <CompanyTableGroup key={group.companyName} group={group} isInternal={true} />)}
            </div>
          )}

          {/* EXTERNAL ACCOUNTS */}
          {processedPayouts.external.length > 0 && (
            <div style={{ marginBottom: "50px" }}>
              <h2 style={{ fontSize: "22px", color: "#0284c7", borderBottom: "2px solid #bae6fd", paddingBottom: "10px", marginBottom: "20px" }}>
                🤝 External Client Accounts
              </h2>
              {processedPayouts.external.map(group => <CompanyTableGroup key={group.companyName} group={group} isInternal={false} />)}
            </div>
          )}
        </>
      )}

    </div>
  );
}