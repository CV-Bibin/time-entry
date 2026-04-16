import React, { useState, useEffect, useMemo } from 'react';
import { db } from "../firebase";
import { collection, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc } from "firebase/firestore";

// ==========================================
// 🚀 ARMORED UTILITY FUNCTIONS
// ==========================================
const getBaseEmail = (email) => {
  const safeEmail = String(email || ""); 
  const parts = safeEmail.split("@");
  if (parts.length !== 2) return safeEmail;
  const name = parts[0].replace(/_V\d+$/i, "");
  return `${name}@${parts[1]}`;
};

const getVersionNum = (email) => {
  const safeEmail = String(email || "");
  const parts = safeEmail.split("@");
  if (parts.length !== 2) return 1;
  const m = parts[0].match(/_V(\d+)$/i);
  return m ? parseInt(m[1]) : 1;
};

// ==========================================
// 🚀 SPREADSHEET ROW COMPONENT
// ==========================================
const AccountRow = ({ acc, updateAccountObject, isManagerAccount, allManagers, allClients, allCompanies, allCoAdminNames, conversionRate, isVersionChild }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  const isSuspended = acc.status === "suspended";
  const hasBonus = acc.hasBonus;

  const handleEditClick = () => {
    if (isSuspended) return;
    setFormData({
      clientName: acc.clientName || "",
      companyName: acc.companyName || "", // 🚀 Added Company Name
      payRateUSD: acc.payRateUSD ?? "",
      leaderBaseINR: acc.leaderBaseINR ?? "",
      leaderMaxINR: acc.leaderMaxINR ?? "",
      raterBaseINR: acc.raterBaseINR ?? "",
      raterMaxINR: acc.raterMaxINR ?? "",
      hasBonus: !!acc.hasBonus,
      bonusThreshold: acc.bonusThreshold ?? 40,
      assignedLeader: acc.assignedLeader || "",
      noRater: !!acc.noRater || acc.raterName === "Self" || (acc.raterBaseINR === 0 && acc.raterName === "")
    });
    setIsEditing(true);
  };

  const handleSaveClick = () => {
    const updates = {
      clientName: formData.clientName || "",
      companyName: formData.companyName || "", // 🚀 Save Company Name
      payRateUSD: formData.payRateUSD === "" ? "" : Number(formData.payRateUSD),
      leaderBaseINR: formData.leaderBaseINR === "" ? "" : Number(formData.leaderBaseINR),
      leaderMaxINR: formData.leaderMaxINR === "" ? "" : Number(formData.leaderMaxINR),
      raterBaseINR: formData.raterBaseINR === "" ? "" : Number(formData.raterBaseINR),
      raterMaxINR: formData.raterMaxINR === "" ? "" : Number(formData.raterMaxINR),
      hasBonus: !!formData.hasBonus,
      bonusThreshold: Number(formData.bonusThreshold) || 40,
      assignedLeader: formData.assignedLeader || "",
      noRater: !!formData.noRater,
      raterName: !!formData.noRater ? "Self" : "" // Keep clean for logic relying on 'Self'
    };

    updateAccountObject(acc.email, updates);
    setIsEditing(false);
  };

  const handleAutoConvertINR = () => {
    const usd = Number(formData.payRateUSD) || 0;
    const rate = Number(conversionRate) || 0;
    const inrValue = Math.round(usd * rate);
    setFormData({ ...formData, leaderBaseINR: inrValue });
  };

  const handleToggleNoRater = (e) => {
    const isChecked = e.target.checked;
    setFormData({
      ...formData,
      noRater: isChecked,
      raterBaseINR: isChecked ? "" : formData.raterBaseINR,
      raterMaxINR: isChecked ? "" : formData.raterMaxINR,
      raterName: isChecked ? "Self" : ""
    });
  };

  const currentLeaderObj = allManagers.find(m => m.name === formData.assignedLeader);
  const isHandlerCoAdmin = currentLeaderObj?.role === 'co-admin';
  const isOwnerCoAdmin = allCoAdminNames.includes(formData.clientName) || ["me", "internal"].includes(String(formData.clientName).toLowerCase());
  
  const showAutoFill = isHandlerCoAdmin || isOwnerCoAdmin;

  const inputStyle = { padding: "6px", borderRadius: "6px", border: "1px solid #cbd5e1", outline: "none", fontSize: "12px", width: "60px", fontWeight: "bold", backgroundColor: "#fff" };

  return (
    <tr style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: isSuspended ? "#fff1f2" : (isVersionChild ? "#fafafa" : "#fff"), transition: "0.2s" }}>
      
      <td style={{ padding: "16px 12px", paddingLeft: isVersionChild ? "45px" : "16px", borderLeft: isVersionChild ? "3px solid #cbd5e1" : (isSuspended ? "3px solid #f43f5e" : "3px solid transparent") }}>
        <div style={{ fontSize: "14px", fontWeight: "700", color: isSuspended ? "#be123c" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
          {isVersionChild && <span style={{ color: "#94a3b8" }}>↳</span>}
          {acc.email}
          {isSuspended && <span style={{ background: "#f43f5e", color: "white", fontSize: "9px", padding: "3px 6px", borderRadius: "8px", fontWeight: "bold" }}>FROZEN</span>}
        </div>
        
        {isEditing ? (
          <select value={formData.clientName} onChange={(e) => setFormData({...formData, clientName: e.target.value})} style={{...inputStyle, width: "140px", marginTop: "6px", cursor: "pointer"}}>
            <option value="">-- General Pool --</option>
            {allClients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", fontWeight: "600" }}>{acc.clientName || "General Pool"}</div>
        )}
      </td>

      <td style={{ padding: "16px 12px", fontWeight: "800", color: "#059669" }}>
        {isEditing ? (
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            $ <input type="number" step="0.1" value={formData.payRateUSD} onChange={(e) => setFormData({...formData, payRateUSD: e.target.value})} style={inputStyle} />
          </div>
        ) : (
          `$${acc.payRateUSD || "0.00"}`
        )}
      </td>

      <td style={{ padding: "16px 12px" }}>
        {isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input type="number" placeholder="Base" value={formData.leaderBaseINR} onChange={(e) => setFormData({...formData, leaderBaseINR: e.target.value})} style={{...inputStyle, border: "1px solid #bfdbfe"}} />
              {formData.hasBonus && (
                <>
                  <span style={{color: "#60a5fa"}}>➔</span>
                  <input type="number" placeholder="Max" value={formData.leaderMaxINR} onChange={(e) => setFormData({...formData, leaderMaxINR: e.target.value})} style={{...inputStyle, border: "2px solid #3b82f6", color: "#1d4ed8"}} />
                </>
              )}
            </div>
            
            {showAutoFill && (
              <button onClick={handleAutoConvertINR} style={{ background: "#e0e7ff", color: "#3730a3", border: "none", borderRadius: "6px", fontSize: "10px", fontWeight: "bold", padding: "4px 8px", cursor: "pointer", width: "max-content", transition: "0.2s" }}>
                ⚡ Auto-Fill (USD x {conversionRate})
              </button>
            )}
            
          </div>
        ) : (
          <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e3a8a" }}>
            ₹{acc.leaderBaseINR || 0}
            {hasBonus && <span style={{ color: "#3b82f6", margin: "0 6px" }}>➔ ₹{acc.leaderMaxINR || 0}</span>}
          </div>
        )}
      </td>

      <td style={{ padding: "16px 12px" }}>
        {isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "10px", fontWeight: "bold", color: "#6b21a8", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", backgroundColor: "#faf5ff", padding: "4px 8px", borderRadius: "6px", width: "max-content" }}>
              <input type="checkbox" checked={formData.noRater} onChange={handleToggleNoRater} style={{ accentColor: "#9333ea" }} />
              🚫 Leader is Rating (No Rater)
            </label>

            {!formData.noRater ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input type="number" placeholder="Base" value={formData.raterBaseINR} onChange={(e) => setFormData({...formData, raterBaseINR: e.target.value})} style={{...inputStyle, border: "1px solid #e9d5ff"}} />
                {formData.hasBonus && (
                  <>
                    <span style={{color: "#c084fc"}}>➔</span>
                    <input type="number" placeholder="Max" value={formData.raterMaxINR} onChange={(e) => setFormData({...formData, raterMaxINR: e.target.value})} style={{...inputStyle, border: "2px solid #a855f7", color: "#6b21a8"}} />
                  </>
                )}
              </div>
            ) : (
              <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "800", fontStyle: "italic", padding: "4px 0" }}>₹0 (Self-Assigned)</div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: "13px", fontWeight: "700", color: "#581c87" }}>
            {acc.noRater || acc.raterName === "Self" ? (
              <span style={{ color: "#94a3b8", fontSize: "11px", fontStyle: "italic", fontWeight: "bold" }}>No Rater</span>
            ) : (
              <>
                ₹{acc.raterBaseINR || 0}
                {hasBonus && <span style={{ color: "#a855f7", margin: "0 6px" }}>➔ ₹{acc.raterMaxINR || 0}</span>}
              </>
            )}
          </div>
        )}
      </td>

      <td style={{ padding: "16px 12px" }}>
        {isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
              <input type="checkbox" checked={formData.hasBonus} onChange={(e) => setFormData({...formData, hasBonus: e.target.checked})} />
              Enable Bonus
            </label>
            {formData.hasBonus && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <input type="number" value={formData.bonusThreshold} onChange={(e) => setFormData({...formData, bonusThreshold: e.target.value})} style={{...inputStyle, width: "40px"}} />
                <span style={{ fontSize: "10px", color: "#64748b" }}>hrs target</span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: "11px", fontWeight: "800" }}>
            {hasBonus ? <span style={{ color: "#059669", background: "#ecfdf5", padding: "4px 8px", borderRadius: "6px" }}>TARGET: {acc.bonusThreshold || 40}h</span> : <span style={{ color: "#94a3b8" }}>NO BONUS</span>}
          </div>
        )}
      </td>

 <td style={{ padding: "16px 12px" }}>
        {isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            
            {/* Show Leader Dropdown for Raters, but just show text for Managers */}
            {isManagerAccount ? (
              <div style={{ fontSize: "11px", fontWeight: "bold", color: acc.role === 'co-admin' ? "#7e22ce" : "#1d4ed8" }}>
                👤 L: {acc.leaderName || "Self"}
              </div>
            ) : (
              <select value={formData.assignedLeader} onChange={(e) => setFormData({...formData, assignedLeader: e.target.value})} style={{...inputStyle, width: "130px", cursor: "pointer"}}>
                <option value="">-- No Leader --</option>
                {allManagers.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
              </select>
            )}

            {/* 🚀 COMPANY NAME NOW VISIBLE & EDITABLE FOR EVERYONE */}
            <select value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})} style={{...inputStyle, width: "130px", cursor: "pointer"}}>
              <option value="">-- No Company --</option>
              {allCompanies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Only show Rater auto-name for actual raters */}
            {!isManagerAccount && (
              <div style={{ display: "flex", gap: "4px" }}>
                <input type="text" placeholder="Worker Name" value={formData.raterName} disabled={formData.noRater} onChange={(e) => setFormData({...formData, raterName: e.target.value})} style={{...inputStyle, width: "90px", backgroundColor: formData.noRater ? "#f1f5f9" : "#fff", color: formData.noRater ? "#94a3b8" : "#1e293b"}} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: "12px", color: "#334155", display: "flex", flexDirection: "column", gap: "4px" }}>
            {isManagerAccount ? (
              <div style={{ fontWeight: "bold", color: acc.role === 'co-admin' ? "#7e22ce" : "#1d4ed8" }}>👤 Managed by {acc.leaderName || "Self"}</div>
            ) : (
              <div><span style={{ color: "#94a3b8", fontWeight: "bold" }}>L:</span> {acc.assignedLeader || <span style={{color: "#ef4444", fontStyle: "italic"}}>Unassigned</span>}</div>
            )}
            
            {/* 🚀 COMPANY NAME NOW VISIBLE ON THE READ-ONLY VIEW TOO */}
            <div><span style={{ color: "#94a3b8", fontWeight: "bold" }}>C:</span> {acc.companyName || <span style={{color: "#ef4444", fontStyle: "italic"}}>Unassigned</span>}</div>
          </div>
        )}
      </td>

      <td style={{ padding: "16px 12px", textAlign: "right" }}>
        {isEditing ? (
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
            <button onClick={handleSaveClick} style={{ background: "#10b981", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", fontWeight: "bold", cursor: "pointer" }}>💾 Save</button>
            <button onClick={() => setIsEditing(false)} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", fontWeight: "bold", cursor: "pointer" }}>Cancel</button>
          </div>
        ) : (
          <button 
            disabled={isSuspended}
            onClick={handleEditClick} 
            style={{ background: isSuspended ? "transparent" : "#f1f5f9", color: isSuspended ? "#cbd5e1" : "#475569", border: isSuspended ? "none" : "1px solid #cbd5e1", borderRadius: "6px", padding: "6px 12px", fontWeight: "bold", cursor: isSuspended ? "not-allowed" : "pointer" }}
          >
            ✏️ Edit
          </button>
        )}
      </td>
    </tr>
  );
};

// ==========================================
// 🚀 SAFE TABLE RENDERER (NOW ACCEPTS SORT)
// ==========================================
const AccountTable = ({ filteredAccounts, updateAccountObject, allManagers, allClients, allCompanies, allCoAdminNames, conversionRate, tableSortBy }) => {
  const grouped = {};
  filteredAccounts.forEach(acc => {
    const base = getBaseEmail(acc.email);
    if(!grouped[base]) grouped[base] = [];
    grouped[base].push(acc);
  });

  const sortedGroups = Object.values(grouped).map(group => {
    return group.sort((a, b) => getVersionNum(a.email) - getVersionNum(b.email));
  }).sort((g1, g2) => {
    const a = g1[0] || {};
    const b = g2[0] || {};
    
    if (tableSortBy === 'clientName') {
      return String(a.clientName || "").localeCompare(String(b.clientName || "")) || String(a.email || "").localeCompare(String(b.email || ""));
    }
    if (tableSortBy === 'rev') {
      return (Number(b.payRateUSD) || 0) - (Number(a.payRateUSD) || 0) || String(a.email || "").localeCompare(String(b.email || ""));
    }
    if (tableSortBy === 'leaderPay') {
      return (Number(b.leaderBaseINR) || 0) - (Number(a.leaderBaseINR) || 0) || String(a.email || "").localeCompare(String(b.email || ""));
    }
    if (tableSortBy === 'raterPay') {
       return (Number(b.raterBaseINR) || 0) - (Number(a.raterBaseINR) || 0) || String(a.email || "").localeCompare(String(b.email || ""));
    }
    return String(a.email || "").localeCompare(String(b.email || ""));
  });

  return (
    <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", backgroundColor: "#fff", minWidth: "1000px" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
            <th style={{ padding: "16px 12px", color: "#475569", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>Account & Client</th>
            <th style={{ padding: "16px 12px", color: "#475569", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>Rev / hr</th>
            <th style={{ padding: "16px 12px", color: "#475569", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>Leader Pay</th>
            <th style={{ padding: "16px 12px", color: "#475569", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>Rater Pay</th>
            <th style={{ padding: "16px 12px", color: "#475569", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>Settings</th>
            <th style={{ padding: "16px 12px", color: "#475569", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>Assignments</th>
            <th style={{ padding: "16px 12px", color: "#475569", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedGroups.map((group) => (
            <React.Fragment key={(group[0]?.email || Math.random()) + "_group"}>
              {group.map((acc, index) => (
                <AccountRow 
                  key={acc.email || Math.random()} 
                  acc={acc} 
                  updateAccountObject={updateAccountObject} 
                  isManagerAccount={acc.role === 'leader' || acc.role === 'co-admin'} 
                  allManagers={allManagers} 
                  allClients={allClients}
                  allCompanies={allCompanies} 
                  allCoAdminNames={allCoAdminNames}
                  conversionRate={conversionRate}
                  isVersionChild={index > 0} 
                />
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ==========================================
// 🚀 MAIN COMPONENT
// ==========================================
export default function AccountManagement({ setCurrentView }) {
  const [usersList, setUsersList] = useState([]);
  // 🚀 NEW: Added companyNames to globalNames defaults
  const [globalNames, setGlobalNames] = useState({ leaderNames: [], coAdminNames: [], clientNames: [], companyNames: [] });
  const [loading, setLoading] = useState(true);
  
  const [conversionRate, setConversionRate] = useState(86);
  const [tableSortBy, setTableSortBy] = useState('email');
  
  const [isSettingsLocked, setIsSettingsLocked] = useState(true);
  const [newLeader, setNewLeader] = useState("");
  const [newCoAdmin, setNewCoAdmin] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newCompany, setNewCompany] = useState(""); // 🚀 NEW State
  const [versionModal, setVersionModal] = useState({ isOpen: false, acc: null, email: "", password: "" });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "systemSettings", "roles"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGlobalNames({ ...data, companyNames: data.companyNames || [] }); // Protect against undefined
      }
    });
    return () => unsub();
  }, []);

  const updateAccountObject = async (email, updatesObj) => {
    if (!email) return;
    try {
      await updateDoc(doc(db, "users", email), updatesObj);
    } catch (err) {
      alert("Error saving updates to database. Check permissions.");
    }
  };

  const handleAddName = async (type, nameInput, setInput) => {
    if (!nameInput.trim()) return;
    try {
      await updateDoc(doc(db, "systemSettings", "roles"), { [type]: arrayUnion(nameInput.trim()) });
      setInput(""); 
    } catch (err) { alert("Failed to add name to system."); }
  };

  const checkIsNameInUse = (name, type) => {
    if (type === 'clientNames') return usersList.some(u => u.clientName === name);
    if (type === 'companyNames') return usersList.some(u => u.companyName === name); // 🚀 NEW Check
    return usersList.some(u => u.leaderName === name || u.assignedLeader === name);
  };

  const handleRemoveName = async (type, nameToRemove) => {
    if (checkIsNameInUse(nameToRemove, type)) return alert(`⛔ ACTION BLOCKED: Cannot delete "${nameToRemove}". It is currently assigned to an account.`);
    if(!window.confirm(`Are you sure you want to completely remove ${nameToRemove}?`)) return;
    try { await updateDoc(doc(db, "systemSettings", "roles"), { [type]: arrayRemove(nameToRemove) }); } 
    catch (err) { alert("Failed to remove name."); }
  };

  const handleEditGlobalName = async (type, oldName) => {
    const newName = window.prompt(`Rename "${oldName}" to:`, oldName);
    if (!newName || newName.trim() === "" || newName.trim() === oldName) return;

    const cleanNewName = newName.trim();

    try {
      const settingsRef = doc(db, "systemSettings", "roles");
      await updateDoc(settingsRef, { [type]: arrayRemove(oldName) });
      await updateDoc(settingsRef, { [type]: arrayUnion(cleanNewName) });

      const updatePromises = usersList.map(async (u) => {
        const updates = {};
        if (type === 'clientNames' && u.clientName === oldName) updates.clientName = cleanNewName;
        if (type === 'companyNames' && u.companyName === oldName) updates.companyName = cleanNewName; // 🚀 Merge support
        if (type === 'leaderNames' || type === 'coAdminNames') {
          if (u.leaderName === oldName) updates.leaderName = cleanNewName;
          if (u.assignedLeader === oldName) updates.assignedLeader = cleanNewName;
        }
        if (Object.keys(updates).length > 0) return updateDoc(doc(db, "users", u.email), updates);
      });

      await Promise.all(updatePromises);
      alert(`Successfully merged/renamed "${oldName}" to "${cleanNewName}" everywhere!`);
    } catch (err) {
      alert("Failed to rename globally. Check permissions.");
    }
  };

  const { allManagers, allClients, allCompanies, allCoAdminNames, allLeaderNames, assignableAccounts, unassignedAccounts } = useMemo(() => {
    const validUsers = usersList.filter(u => u && typeof u.email === 'string');
    const clients = Array.isArray(globalNames.clientNames) ? [...globalNames.clientNames].sort() : [];
    const companies = Array.isArray(globalNames.companyNames) ? [...globalNames.companyNames].sort() : []; // 🚀
    const coAdmins = Array.isArray(globalNames.coAdminNames) ? [...globalNames.coAdminNames].sort() : [];
    const leaders = Array.isArray(globalNames.leaderNames) ? [...globalNames.leaderNames].sort() : [];
    
    const managerMap = {};
    leaders.forEach(name => { managerMap[name] = { name, role: 'leader' }; });
    coAdmins.forEach(name => { managerMap[name] = { name, role: 'co-admin' }; });

    validUsers.forEach(u => {
      if ((u.role === 'leader' || u.role === 'co-admin') && String(u.leaderName || "").trim()) {
        if (!managerMap[u.leaderName]) managerMap[u.leaderName] = { name: u.leaderName, role: u.role };
      }
    });

    const managers = Object.values(managerMap).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    const leaderCounters = {};
    const assignable = validUsers.filter(u => u.role !== 'admin').sort((a, b) => String(a.email || "").localeCompare(String(b.email || ""))).map(acc => {
      const groupKey = acc.assignedLeader || 'Unassigned';
      if (!leaderCounters[groupKey]) leaderCounters[groupKey] = 0;
      leaderCounters[groupKey]++;
      return { ...acc, leaderIndex: leaderCounters[groupKey] };
    });

    const unassigned = assignable.filter(a => {
      if (a.role !== 'rater') return false;
      return !String(a.assignedLeader || "").trim() || !managers.some(m => m.name === a.assignedLeader);
    });

    return { allManagers: managers, allClients: clients, allCompanies: companies, allCoAdminNames: coAdmins, allLeaderNames: leaders, assignableAccounts: assignable, unassignedAccounts: unassigned };
  }, [usersList, globalNames]);

  const confirmCreateNewVersion = async () => {
    if (!versionModal.email || !versionModal.password) return alert("Email and Password are required.");
    try {
      await setDoc(doc(db, "users", versionModal.email.toLowerCase()), {
        email: versionModal.email.toLowerCase(),
        password: versionModal.password,
        clientName: versionModal.acc.clientName || "",
        companyName: versionModal.acc.companyName || "", // 🚀 Inherit company
        role: "rater",
        status: "active",
        payRateUSD: versionModal.acc.payRateUSD || 0,
        createdAt: new Date().toISOString()
      });
      setVersionModal({ isOpen: false, acc: null, email: "", password: "" });
    } catch (err) {
      alert("Failed to create new account version.");
    }
  };

  const handleDeleteUser = async (email) => {
    const confirmEmail = window.prompt(`⚠️ DANGER ZONE ⚠️\n\nYou are about to permanently delete the account:\n${email}\n\nTo confirm, type the exact email address below:`);
    if (confirmEmail === null) return; 
    
    if (confirmEmail.trim().toLowerCase() === email.toLowerCase()) {
      try { await deleteDoc(doc(db, "users", email)); } 
      catch (err) { alert("Failed to delete account. Check permissions."); }
    } else {
      alert("Email did not match. Deletion cancelled.");
    }
  };

  const handleOpenVersionModal = (acc) => {
    const baseEmail = getBaseEmail(acc.email);
    const group = usersList.filter(u => getBaseEmail(u.email) === baseEmail);
    const maxV = Math.max(...group.map(u => getVersionNum(u.email)));
    const nextV = maxV + 1;

    const parts = acc.email.split("@");
    const baseName = parts[0].replace(/_V\d+$/i, "");
    const domain = parts.length > 1 ? `@${parts[1]}` : "";
    const newEmail = `${baseName}_V${nextV}${domain}`;

    setVersionModal({ isOpen: true, acc: acc, email: newEmail, password: "" });
  };

  if (loading) return <div style={{ padding: "100px", textAlign: "center", fontWeight: "bold", color: "#64748b", fontSize: "18px" }}>Fetching Agency Hierarchy...</div>;

  return (
    <div style={{ backgroundColor: "#f1f5f9", minHeight: "100vh", padding: "40px 20px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", backgroundColor: "#1e293b", padding: "20px", borderRadius: "12px", color: "white" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "800" }}>🔐 Admin Command Center</h1>
            <p style={{ margin: "5px 0 0 0", color: "#94a3b8", fontSize: "14px" }}>Manage System Roles and Access</p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setCurrentView("dashboard")} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "white", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "bold" }}>⬅ Back to Dashboard</button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px", paddingBottom: "20px", borderBottom: "2px solid #e2e8f0", flexWrap: "wrap", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <h2 style={{ margin: 0, color: "#1e293b", fontSize: "20px", fontWeight: "900" }}>⚙️ Global Configurations Database</h2>
            <button onClick={() => setIsSettingsLocked(!isSettingsLocked)} style={{ padding: "6px 12px", backgroundColor: isSettingsLocked ? "#f1f5f9" : "#ef4444", color: isSettingsLocked ? "#475569" : "#fff", border: isSettingsLocked ? "1px solid #cbd5e1" : "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
              {isSettingsLocked ? "🔓 Unlock Actions" : "🔒 Lock Settings"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#fff", padding: "8px 15px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
              <span style={{ fontSize: "13px", fontWeight: "bold", color: "#475569" }}>Sort Tables:</span>
              <select value={tableSortBy} onChange={(e) => setTableSortBy(e.target.value)} style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #cbd5e1", outline: "none", fontWeight: "bold", color: "#1e293b", cursor: "pointer", backgroundColor: "#f8fafc" }}>
                <option value="email">Account Email (A-Z)</option>
                <option value="clientName">Client Name</option>
                <option value="rev">Rev / hr (Highest)</option>
                <option value="leaderPay">Leader Pay (Highest)</option>
                <option value="raterPay">Rater Pay (Highest)</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#fffbeb", padding: "8px 15px", borderRadius: "8px", border: "1px solid #fde68a" }}>
              <span style={{ fontSize: "13px", fontWeight: "bold", color: "#d97706" }}>$ to ₹ Rate:</span>
              <input type="number" value={conversionRate} onChange={(e) => setConversionRate(e.target.value)} style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #fcd34d", outline: "none", width: "60px", fontWeight: "bold", color: "#b45309" }} />
            </div>
          </div>
        </div>

        {/* ⚙️ GLOBAL NAMES CONFIGURATOR */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "15px", marginBottom: "50px", opacity: isSettingsLocked ? 0.7 : 1, pointerEvents: isSettingsLocked ? "none" : "auto" }}>
          
          <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
            <h3 style={{ margin: "0 0 15px 0", color: "#312e81", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "20px" }}>👑</span> Leaders</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "15px", minHeight: "40px" }}>
              {allLeaderNames.map(name => {
                const inUse = checkIsNameInUse(name, 'leaderNames');
                return (
                  <span key={name} style={{ background: inUse ? "#f1f5f9" : "#e0e7ff", color: inUse ? "#64748b" : "#3730a3", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px", border: inUse ? "1px solid #cbd5e1" : "none" }}>
                    {name}
                    <div style={{ display: "flex", gap: "2px", marginLeft: "4px" }}>
                      <button onClick={() => handleEditGlobalName('leaderNames', name)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "12px", padding: 0 }} title="Rename globally">✏️</button>
                      <button onClick={() => handleRemoveName('leaderNames', name)} style={{ background: "transparent", border: "none", color: inUse ? "#94a3b8" : "#4f46e5", cursor: inUse ? "not-allowed" : "pointer", fontSize: "14px", padding: 0 }} title={inUse ? "Protected" : "Remove name"}>{inUse ? "🔒" : "×"}</button>
                    </div>
                  </span>
                );
              })}
              {allLeaderNames.length === 0 && <span style={{ color: "#94a3b8", fontSize: "13px", fontStyle: "italic" }}>No Leaders added.</span>}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input type="text" value={newLeader} onChange={(e)=>setNewLeader(e.target.value)} placeholder="Add Leader..." onKeyDown={(e)=>e.key === 'Enter' && handleAddName('leaderNames', newLeader, setNewLeader)} style={{ flex: 1, padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px", outline: "none" }} />
              <button onClick={() => handleAddName('leaderNames', newLeader, setNewLeader)} style={{ padding: "8px 15px", background: "#4f46e5", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Add</button>
            </div>
          </div>

          <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
            <h3 style={{ margin: "0 0 15px 0", color: "#581c87", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "20px" }}>🛡️</span> Co-Admins</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "15px", minHeight: "40px" }}>
              {allCoAdminNames.map(name => {
                const inUse = checkIsNameInUse(name, 'coAdminNames');
                return (
                  <span key={name} style={{ background: inUse ? "#f8fafc" : "#f3e8ff", color: inUse ? "#64748b" : "#6b21a8", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px", border: inUse ? "1px solid #cbd5e1" : "none" }}>
                    {name}
                    <div style={{ display: "flex", gap: "2px", marginLeft: "4px" }}>
                      <button onClick={() => handleEditGlobalName('coAdminNames', name)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "12px", padding: 0 }} title="Rename globally">✏️</button>
                      <button onClick={() => handleRemoveName('coAdminNames', name)} style={{ background: "transparent", border: "none", color: inUse ? "#94a3b8" : "#7e22ce", cursor: inUse ? "not-allowed" : "pointer", fontSize: "14px", padding: 0 }} title={inUse ? "Protected" : "Remove name"}>{inUse ? "🔒" : "×"}</button>
                    </div>
                  </span>
                );
              })}
              {allCoAdminNames.length === 0 && <span style={{ color: "#94a3b8", fontSize: "13px", fontStyle: "italic" }}>No Co-Admins added.</span>}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input type="text" value={newCoAdmin} onChange={(e)=>setNewCoAdmin(e.target.value)} placeholder="Add Co-Admin..." onKeyDown={(e)=>e.key === 'Enter' && handleAddName('coAdminNames', newCoAdmin, setNewCoAdmin)} style={{ flex: 1, padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px", outline: "none" }} />
              <button onClick={() => handleAddName('coAdminNames', newCoAdmin, setNewCoAdmin)} style={{ padding: "8px 15px", background: "#7e22ce", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Add</button>
            </div>
          </div>

          <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
            <h3 style={{ margin: "0 0 15px 0", color: "#047857", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "20px" }}>🏢</span> Clients</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "15px", minHeight: "40px" }}>
              {allClients.map(name => {
                const inUse = checkIsNameInUse(name, 'clientNames');
                return (
                  <span key={name} style={{ background: inUse ? "#f8fafc" : "#ecfdf5", color: inUse ? "#64748b" : "#047857", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px", border: inUse ? "1px solid #cbd5e1" : "none" }}>
                    {name}
                    <div style={{ display: "flex", gap: "2px", marginLeft: "4px" }}>
                      <button onClick={() => handleEditGlobalName('clientNames', name)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "12px", padding: 0 }} title="Rename globally">✏️</button>
                      <button onClick={() => handleRemoveName('clientNames', name)} style={{ background: "transparent", border: "none", color: inUse ? "#94a3b8" : "#059669", cursor: inUse ? "not-allowed" : "pointer", fontSize: "14px", padding: 0 }} title={inUse ? "Protected" : "Remove name"}>{inUse ? "🔒" : "×"}</button>
                    </div>
                  </span>
                );
              })}
              {allClients.length === 0 && <span style={{ color: "#94a3b8", fontSize: "13px", fontStyle: "italic" }}>No Clients added.</span>}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input type="text" value={newClient} onChange={(e)=>setNewClient(e.target.value)} placeholder="Add Client..." onKeyDown={(e)=>e.key === 'Enter' && handleAddName('clientNames', newClient, setNewClient)} style={{ flex: 1, padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px", outline: "none" }} />
              <button onClick={() => handleAddName('clientNames', newClient, setNewClient)} style={{ padding: "8px 15px", background: "#059669", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Add</button>
            </div>
          </div>

          {/* 🚀 NEW CARD: COMPANIES */}
          <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
            <h3 style={{ margin: "0 0 15px 0", color: "#b45309", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "20px" }}>🌐</span> Companies</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "15px", minHeight: "40px" }}>
              {allCompanies.map(name => {
                const inUse = checkIsNameInUse(name, 'companyNames');
                return (
                  <span key={name} style={{ background: inUse ? "#f8fafc" : "#fffbeb", color: inUse ? "#64748b" : "#b45309", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px", border: inUse ? "1px solid #cbd5e1" : "none" }}>
                    {name}
                    <div style={{ display: "flex", gap: "2px", marginLeft: "4px" }}>
                      <button onClick={() => handleEditGlobalName('companyNames', name)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "12px", padding: 0 }} title="Rename globally">✏️</button>
                      <button onClick={() => handleRemoveName('companyNames', name)} style={{ background: "transparent", border: "none", color: inUse ? "#94a3b8" : "#d97706", cursor: inUse ? "not-allowed" : "pointer", fontSize: "14px", padding: 0 }} title={inUse ? "Protected" : "Remove name"}>{inUse ? "🔒" : "×"}</button>
                    </div>
                  </span>
                );
              })}
              {allCompanies.length === 0 && <span style={{ color: "#94a3b8", fontSize: "13px", fontStyle: "italic" }}>No Companies added.</span>}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input type="text" value={newCompany} onChange={(e)=>setNewCompany(e.target.value)} placeholder="E.g. Telus..." onKeyDown={(e)=>e.key === 'Enter' && handleAddName('companyNames', newCompany, setNewCompany)} style={{ flex: 1, padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px", outline: "none" }} />
              <button onClick={() => handleAddName('companyNames', newCompany, setNewCompany)} style={{ padding: "8px 15px", background: "#d97706", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Add</button>
            </div>
          </div>

        </div>

        <div style={{ marginBottom: "50px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "15px" }}>
            <h2 style={{ margin: 0, fontSize: "20px", color: "#334155", fontWeight: "800" }}>Unassigned Raters</h2>
            <span style={{ backgroundColor: "#e2e8f0", color: "#475569", padding: "4px 10px", borderRadius: "20px", fontSize: "13px", fontWeight: "800" }}>{unassignedAccounts.length}</span>
          </div>
          {unassignedAccounts.length > 0 ? (
            <AccountTable filteredAccounts={unassignedAccounts} updateAccountObject={updateAccountObject} allManagers={allManagers} allClients={allClients} allCompanies={allCompanies} allCoAdminNames={allCoAdminNames} conversionRate={conversionRate} tableSortBy={tableSortBy} />
          ) : (
            <div style={{ padding: "40px", textAlign: "center", background: "#fff", borderRadius: "16px", border: "2px dashed #cbd5e1", color: "#94a3b8" }}>
              <span style={{ fontSize: "30px", display: "block", marginBottom: "10px" }}>🎉</span>
              <span style={{ fontWeight: "600" }}>All accounts are currently assigned to a leader!</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
          {allManagers.map(manager => {
            const groupAccounts = assignableAccounts.filter(a => (a.role === 'leader' || a.role === 'co-admin' ? a.leaderName === manager.name : a.assignedLeader === manager.name));
            const isCoAdmin = manager.role === 'co-admin';
            const accentColor = isCoAdmin ? "#a855f7" : "#3b82f6";
            const lightColor = isCoAdmin ? "#faf5ff" : "#eff6ff";

            return (
              <div key={manager.name} style={{ background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", borderTop: `6px solid ${accentColor}`, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <div style={{ padding: "20px 25px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                    <div style={{ width: "45px", height: "45px", borderRadius: "12px", backgroundColor: lightColor, color: accentColor, display: "flex", justifyContent: "center", alignItems: "center", fontSize: "20px" }}>
                      {isCoAdmin ? "🛡️" : "👑"}
                    </div>
                    <div>
                      <h2 style={{ margin: "0 0 4px 0", color: "#0f172a", fontSize: "22px", fontWeight: "900" }}>{manager.name}</h2>
                      <span style={{ fontSize: "11px", color: accentColor, fontWeight: "800", textTransform: "uppercase" }}>{manager.role} Group</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "24px", fontWeight: "900", color: "#1e293b", lineHeight: "1" }}>{groupAccounts.length}</div>
                    <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", marginTop: "4px" }}>Accounts</div>
                  </div>
                </div>
                
                <div style={{ padding: "20px" }}>
                  {groupAccounts.length > 0 ? (
                    <AccountTable filteredAccounts={groupAccounts} updateAccountObject={updateAccountObject} allManagers={allManagers} allClients={allClients} allCompanies={allCompanies} allCoAdminNames={allCoAdminNames} conversionRate={conversionRate} tableSortBy={tableSortBy} />
                  ) : (
                    <div style={{ padding: "40px", textAlign: "center", background: "#f8fafc", borderRadius: "12px", color: "#94a3b8", border: "1px dashed #cbd5e1" }}>
                      <span style={{ fontWeight: "600" }}>No accounts assigned to this manager yet.</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {versionModal.isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "16px", width: "400px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ width: "50px", height: "50px", backgroundColor: "#eff6ff", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", margin: "0 auto 15px", color: "#3b82f6", fontSize: "24px" }}>➕</div>
              <h2 style={{ margin: "0 0 5px 0", color: "#1e293b", fontSize: "20px" }}>Create New Version</h2>
              <p style={{ margin: 0, color: "#64748b", fontSize: "13px", lineHeight: "1.4" }}>This will spin up a fresh, active copy of the frozen account while preserving the old data.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "25px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#475569", marginBottom: "5px" }}>New Account Email (Auto-Generated)</label>
                <input type="text" value={versionModal.email} onChange={(e) => setVersionModal({ ...versionModal, email: e.target.value })} style={{ width: "95%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "14px", fontWeight: "bold", color: "#1e293b", backgroundColor: "#f8fafc" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#475569", marginBottom: "5px" }}>System Password <span style={{color: "#ef4444"}}>*</span></label>
                <input type="password" placeholder="Enter login password..." value={versionModal.password} onChange={(e) => setVersionModal({ ...versionModal, password: e.target.value })} style={{ width: "95%", padding: "10px", borderRadius: "8px", border: "1px solid #3b82f6", outline: "none", fontSize: "14px" }} autoFocus />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setVersionModal({ isOpen: false, acc: null, email: "", password: "" })} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "white", color: "#475569", fontWeight: "bold", cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmCreateNewVersion} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 6px rgba(59, 130, 246, 0.3)" }}>Create Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}