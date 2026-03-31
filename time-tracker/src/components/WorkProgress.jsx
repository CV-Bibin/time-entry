import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, onSnapshot } from "firebase/firestore";

export default function WorkProgress({ user, setCurrentView }) {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const currentMonthString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthString);

  useEffect(() => {
    const q = query(collection(db, "time_entries"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((d) => d.data());
      setAllData(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading)
    return (
      <div
        style={{
          textAlign: "center",
          padding: "100px",
          fontFamily: "sans-serif",
        }}
      >
        <h3>Loading Data Intelligence...</h3>
      </div>
    );

  // ==========================================
  // 🧠 DATA PROCESSING
  // ==========================================
  const [yearStr, monthStr] = selectedMonth.split("-");
  const selectedYear = parseInt(yearStr, 10);
  const selectedMonthIndex = parseInt(monthStr, 10) - 1;
  const daysInMonth = new Date(
    selectedYear,
    selectedMonthIndex + 1,
    0,
  ).getDate();
  const displayMonthName = new Date(
    selectedYear,
    selectedMonthIndex,
    1,
  ).toLocaleString("default", { month: "long", year: "numeric" });

  // 1. QUARTER CALCULATION (Trend Line)
  const quarterIdx = Math.floor(selectedMonthIndex / 3);
  const quarterMonths = [
    quarterIdx * 3,
    quarterIdx * 3 + 1,
    quarterIdx * 3 + 2,
  ];

  const quarterStats = quarterMonths.map((mIdx) => {
    const mPrefix = `${selectedYear}-${String(mIdx + 1).padStart(2, "0")}`;
    const entries = allData.filter((e) =>
      e?.assigned_date?.startsWith(mPrefix),
    );
    const usersInMonth = new Set(entries.map((e) => e.email));
    const totalHrs = entries.reduce((s, e) => s + (e.time_value_hours || 0), 0);
    const avg = usersInMonth.size > 0 ? totalHrs / usersInMonth.size : 0;
    const mine = entries
      .filter((e) => e.email === user.email)
      .reduce((s, e) => s + (e.time_value_hours || 0), 0);
    return {
      name: new Date(selectedYear, mIdx, 1).toLocaleString("default", {
        month: "short",
      }),
      myTotal: mine,
      teamAvg: avg,
    };
  });

  // 2. MONTHLY TEAM TOTALS (For KPI Card)
  const raterTotals = new Map();
  const personalMonthEntries = [];

  allData.forEach((entry) => {
    if (entry?.assigned_date?.startsWith(selectedMonth)) {
      const email = entry?.email || "Unknown";
      raterTotals.set(
        email,
        (raterTotals.get(email) || 0) + (entry?.time_value_hours || 0),
      );
      if (email === user.email) personalMonthEntries.push(entry);
    }
  });

  const myHours = raterTotals.get(user.email) || 0;
  const teamSize = raterTotals.size;
  const totalTeamHours = Array.from(raterTotals.values()).reduce(
    (a, b) => a + b,
    0,
  );
  const teamAvgHours = teamSize > 0 ? totalTeamHours / teamSize : 0;

 // 🐾 POWER NICKNAME GENERATOR (100% Collision-Free)
  const animalNames = [
    "Thunder Lion", "Golden Tiger", "Swift Falcon", "Shadow Panther", 
    "Iron Rhino", "Arctic Wolf", "Storm Eagle", "Emerald Dragon", 
    "Royal Cheetah", "Blaze Phoenix", "Silver Shark", "Mighty Bison",
    "Neon Cobra", "Alpha Bear", "Frost Fox", "Solar Hawk",
    "Crystal Owl", "Crimson Viper", "Ghost Leopard", "Jade Mantis",
    "Lunar Stag", "Mystic Raven", "Obsidian Bull", "Phantom Lynx",
    "Ruby Condor", "Sapphire Ray", "Topaz Grizzly", "Valiant Stallion",
    "Zen Koi", "Astral Jaguar", "Cobalt Crane", "Dawn Gorilla",
    "Eclipse Moth", "Flare Salamander", "Glacier Penguin", "Horizon Orca",
    "Inferno Hound", "Jungle Python", "Karma Chameleon", "Lightning Gecko",
    "Midnight Badger", "Nova Otter", "Onyx Beetle", "Cosmic Turtle", "Titan Gorilla"
  ];

  const assignedNames = new Map();
  const usedNames = new Set();

  // Sort emails alphabetically so the assignment is always consistent on every refresh!
  const uniqueEmails = Array.from(raterTotals.keys()).sort();

 uniqueEmails.forEach(email => {
    let charSum = email.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
    let index = charSum % animalNames.length;
    let suffix = "";
    let attempt = 0;

    // IF TAKEN: Keep looking, and add Roman Numerals if the whole list is full!
    while (usedNames.has(animalNames[index] + suffix)) {
      index = (index + 1) % animalNames.length;
      attempt++;

      // If we've checked all 45 names, bump up to the next generation (II, III, IV)
      if (attempt % animalNames.length === 0) {
        const tier = Math.floor(attempt / animalNames.length);
        const romanNumerals = ["", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
        suffix = ` ${romanNumerals[tier] || tier + 1}`; // Falls back to standard numbers if it goes past X
      }
    }

    const finalName = animalNames[index] + suffix;
    assignedNames.set(email, finalName);
    usedNames.add(finalName);
  });

  // Helper function to pull the safely assigned name
  const getPowerName = (email) => assignedNames.get(email) || "Mystery Animal";

  const sortedRaters = Array.from(raterTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([email, hours], index) => ({
      rank: index + 1,
      isMe: email === user.email,
      displayName:
        email === user.email
          ? `${getPowerName(email)} (You)`
          : getPowerName(email),
      hours: hours,
    }));

  const myRank = sortedRaters.find((r) => r.isMe)?.rank || "-";

  // 3. DAILY CHART DATA
  const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `${selectedMonth}-${String(dayNum).padStart(2, "0")}`;
    const hours = personalMonthEntries
      .filter((e) => e.assigned_date === dateStr)
      .reduce((s, e) => s + e.time_value_hours, 0);
    return { day: dayNum, hours };
  });

  const maxDaily = Math.max(...dailyData.map((d) => d.hours), 5);
  const maxQ = Math.max(
    ...quarterStats.map((q) => Math.max(q.myTotal, q.teamAvg)),
    10,
  );

  return (
    <div
      style={{
        maxWidth: "1250px",
        margin: "0 auto",
        padding: "20px",
        fontFamily: "'Inter', sans-serif",
        color: "#1e293b",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "26px",
              fontWeight: "800",
              color: "#0f172a",
            }}
          >
            Performance Analytics
          </h1>
          <div style={{ color: "#64748b", fontSize: "14px" }}>
            Insights for {displayMonthName}
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontWeight: "bold",
              outline: "none",
            }}
          />
          <button
            onClick={() => setCurrentView("dashboard")}
            style={{
              padding: "10px 24px",
              backgroundColor: "#334155",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "700",
            }}
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* KPI ROW - NOW WITH TEAM AVERAGE */}
      <div
        style={{
          display: "flex",
          gap: "15px",
          marginBottom: "30px",
          flexWrap: "wrap",
        }}
      >
        {[
          {
            label: "LOGGED THIS MONTH",
            val: `${myHours.toFixed(2)}h`,
            color: "#3b82f6",
          },
          {
            label: "TEAM AVERAGE",
            val: `${teamAvgHours.toFixed(2)}h`,
            color: "#10b981",
          },
          { label: "YOUR RANK", val: `#${myRank}`, color: "#f59e0b" },
          {
            label: "ACTIVE DAYS",
            val: dailyData.filter((d) => d.hours > 0).length,
            color: "#8b5cf6",
          },
        ].map((kpi, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: "180px",
              backgroundColor: "#fff",
              padding: "20px",
              borderRadius: "12px",
              border: "1px solid #eee",
              borderLeft: `6px solid ${kpi.color}`,
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: "700",
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {kpi.label}
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: "900",
                marginTop: "8px",
                color: "#1e293b",
              }}
            >
              {kpi.val}
            </div>
          </div>
        ))}
      </div>

      {/* FULL WIDTH HEATMAP WITH DATA LABELS */}
      <div
        style={{
          backgroundColor: "#fff",
          padding: "25px",
          borderRadius: "12px",
          border: "1px solid #eee",
          marginBottom: "30px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
        }}
      >
        <h3
          style={{
            margin: "0 0 25px 0",
            fontSize: "14px",
            fontWeight: "700",
            color: "#64748b",
          }}
        >
          DAILY ACTIVITY HEATMAP (HOURS PER DAY)
        </h3>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            height: "200px",
            borderBottom: "2px solid #f1f5f9",
            gap: "4px",
            paddingBottom: "10px",
            overflowX: "auto",
          }}
        >
          {dailyData.map((d) => (
            <div
              key={d.day}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minWidth: "22px",
              }}
            >
              {/* DATA VALUE ABOVE BAR */}
              <div
                style={{
                  fontSize: "9px",
                  fontWeight: "800",
                  color: "#3b82f6",
                  marginBottom: "4px",
                  visibility: d.hours > 0 ? "visible" : "hidden",
                }}
              >
                {d.hours.toFixed(1)}
              </div>
              <div
                style={{
                  width: "100%",
                  backgroundColor: d.hours > 0 ? "#3b82f6" : "#f1f5f9",
                  height: `${(d.hours / maxDaily) * 160}px`,
                  borderRadius: "3px 3px 0 0",
                }}
              ></div>
              <span
                style={{
                  fontSize: "10px",
                  marginTop: "8px",
                  color: "#94a3b8",
                  fontWeight: "bold",
                }}
              >
                {d.day}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: "25px",
          flexWrap: "wrap",
        }}
      >
        {/* QUARTERLY PERFORMANCE WITH DATA LABELS */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: "25px",
            borderRadius: "12px",
            border: "1px solid #eee",
          }}
        >
          <h3
            style={{
              margin: "0 0 25px 0",
              fontSize: "14px",
              fontWeight: "700",
              color: "#64748b",
            }}
          >
            QUARTERLY TREND (YOU VS. TEAM AVG)
          </h3>

          <div
            style={{ position: "relative", height: "220px", padding: "0 30px" }}
          >
            <svg
              viewBox="0 0 300 100"
              style={{ width: "100%", height: "100%", overflow: "visible" }}
            >
              {(() => {
                const getX = (i) => i * 150;
                const getY = (val) => 100 - (val / maxQ) * 100;

                const myPath = `M ${getX(0)} ${getY(quarterStats[0].myTotal)} L ${getX(1)} ${getY(quarterStats[1].myTotal)} L ${getX(2)} ${getY(quarterStats[2].myTotal)}`;
                const teamPath = `M ${getX(0)} ${getY(quarterStats[0].teamAvg)} L ${getX(1)} ${getY(quarterStats[1].teamAvg)} L ${getX(2)} ${getY(quarterStats[2].teamAvg)}`;

                return (
                  <>
                    <path
                      d={teamPath}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                    />
                    <path
                      d={myPath}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />

                    {quarterStats.map((q, i) => (
                      <g key={i}>
                        {/* TEAM AVG LABELS */}
                        {/* TEAM AVG LABELS (Smart Spacing to prevent overlap) */}
                        <text
                          x={getX(i)}
                          // If values are almost identical, push this label BELOW the line instead of above it
                          y={
                            Math.abs(q.teamAvg - q.myTotal) < maxQ * 0.1
                              ? getY(q.teamAvg) + 14
                              : getY(q.teamAvg) - 8
                          }
                          textAnchor="middle"
                          fontSize="6"
                          fill="#94a3b8"
                          fontWeight="bold"
                        >
                          {q.teamAvg.toFixed(1)}h
                        </text>{" "}
                        <circle
                          cx={getX(i)}
                          cy={getY(q.teamAvg)}
                          r="3"
                          fill="#cbd5e1"
                        />
                        {/* YOUR TOTAL LABELS */}
                        <text
                          x={getX(i)}
                          y={getY(q.myTotal) - 10}
                          textAnchor="middle"
                          fontSize="7"
                          fill="#3b82f6"
                          fontWeight="900"
                        >
                          {q.myTotal.toFixed(1)}h
                        </text>
                        <circle
                          cx={getX(i)}
                          cy={getY(q.myTotal)}
                          r="5"
                          fill="#3b82f6"
                          stroke="white"
                          strokeWidth="2"
                        />
                        <text
                          x={getX(i)}
                          y="120"
                          textAnchor="middle"
                          fontSize="8"
                          fontWeight="800"
                          fill="#475569"
                        >
                          {q.name.toUpperCase()}
                        </text>
                      </g>
                    ))}
                  </>
                );
              })()}
            </svg>

            <div
              style={{
                display: "flex",
                gap: "20px",
                marginTop: "45px",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  fontWeight: "700",
                }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    backgroundColor: "#3b82f6",
                    borderRadius: "3px",
                  }}
                ></div>{" "}
                YOU
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  fontWeight: "700",
                }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "3px",
                    backgroundColor: "#cbd5e1",
                    borderRadius: "1px",
                  }}
                ></div>{" "}
                TEAM AVG
              </div>
            </div>
          </div>
        </div>

        {/* LEADERBOARD */}
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #eee",
            overflow: "hidden",
            boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
          }}
        >
          <div
            style={{
              padding: "18px 20px",
              backgroundColor: "#f8fafc",
              borderBottom: "1px solid #eee",
              fontWeight: "800",
              fontSize: "13px",
              color: "#475569",
            }}
          >
            🥇 TOP PERFORMERS
          </div>
          <div style={{ maxHeight: "330px", overflowY: "auto" }}>
            {sortedRaters.map((r) => (
              <div
                key={r.rank}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "15px 20px",
                  borderBottom: "1px solid #f8fafc",
                  backgroundColor: r.isMe ? "#eff6ff" : "transparent",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#1e293b",
                  }}
                >
                  {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}{" "}
                  {r.displayName}
                </span>
                <span
                  style={{
                    fontWeight: "800",
                    fontSize: "13px",
                    color: r.isMe ? "#3b82f6" : "#1e293b",
                  }}
                >
                  {r.hours.toFixed(2)}h
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
