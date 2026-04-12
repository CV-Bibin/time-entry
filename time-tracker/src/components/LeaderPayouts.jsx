import React from 'react';

const formatMoney = (num, decimals = 0) => {
  const val = Number(num);
  if (isNaN(val)) return "0";
  return val.toLocaleString('en-IN', { maximumFractionDigits: decimals });
};

export default function LeaderPayouts({ leaderPayouts, isMainAdmin, isCoAdmin }) {
  // Hide if not admin, or if there is no data
  if (!(isMainAdmin || isCoAdmin) || !leaderPayouts || Object.keys(leaderPayouts).length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "30px" }}>
      
      {/* Loop through each OWNER (Co-Admin) */}
      {Object.keys(leaderPayouts).sort().map(owner => (
        <div key={owner} style={{ padding: "30px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          
          {/* Dynamic Owner Header */}
          <div style={{ backgroundColor: "#fbcfe8", color: "#000", padding: "8px 24px", fontSize: "20px", display: "inline-block", marginBottom: "30px", border: "1px solid #f472b6", fontWeight: "bold" }}>
            PAYOUTS FUNDED BY: {owner}
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
            
            {/* Loop through each LEADER owed money by this Owner */}
            {Object.keys(leaderPayouts[owner]).sort().map((leader, index) => {
              const data = leaderPayouts[owner][leader];
              
              const isEven = index % 2 === 0;
              const topBg = isEven ? "#8ba8a9" : "#a2c2e8"; 
              const botBg = isEven ? "#c3d3d6" : "#d1e2f3";

              return (
                <div key={leader} style={{ display: "flex", alignItems: "center", gap: "25px" }}>
                  
                  {/* Leader Box */}
                  <div style={{ width: "200px", border: "1px solid #000", display: "flex", flexDirection: "column" }}>
                    <div style={{ backgroundColor: topBg, padding: "10px", textAlign: "center", fontSize: "16px", fontWeight: "bold", color: "#000", borderBottom: "1px solid #000" }}>
                      {leader}
                    </div>
                    <div style={{ backgroundColor: botBg, padding: "18px", textAlign: "center", fontSize: "22px", fontWeight: "bold", color: "#000" }}>
                      ₹{formatMoney(data.total)}
                    </div>
                  </div>

                  {/* Account List */}
                  <div style={{ color: "#65a30d", fontStyle: "italic", fontSize: "15px", flex: 1, fontWeight: "600" }}>
                    {Array.from(data.accounts).join(', ')}
                  </div>
                  
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}