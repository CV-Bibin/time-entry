import React from "react";

// --- SHARED UI UTILITIES ---
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
  return val.toLocaleString("en-IN", { maximumFractionDigits: decimals });
};

// 🚀 EXPLICIT COLUMN WIDTHS FOR FIXED TABLE LAYOUT
const colWidths = {
  accountName: "240px",
  ldr: "60px",
  w: "55px",
  total: "65px",
  usdHr: "50px",
  lPayRate: "65px",
  rev: "85px",
  rPayRate: "60px",
  cost: "85px",
  alerts: "120px",
};

export default function PerformanceTable({
  isCoAdminView,
  showLeaderCol,
  clientGroups,
  monthWeeks,
  numWeeks,
  totalColumns,
  grandWkTotal,
  grandHrs,
  grandLeaderPay,
  grandRaterPay,
  setCalendarUser,
}) {
  // 🚀 PRESERVED INTERNAL STYLES & LAYOUT FROM PASTED CODE
  const s = {
    // Thinner padding, stricter header text size
    th: {
      padding: "10px 4px",
      backgroundColor: "#f8fafc",
      color: "#475569",
      fontWeight: "800",
      fontSize: "11px",
      textAlign: "center",
      borderBottom: "2px solid #cbd5e1",
      borderRight: "1px solid #e2e8f0",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    },
    td: {
      padding: "8px 4px",
      borderBottom: "1px solid #e2e8f0",
      borderRight: "1px solid #e2e8f0",
      fontSize: "13px",
      color: "#1e293b",
      textAlign: "center",
      verticalAlign: "middle",
      whiteSpace: "nowrap",
    },

    // Limits the email column to 220px and adds '...' if too long so it doesn't stretch the screen
    tdAccount: {
      padding: "10px 8px 10px 16px",
      borderBottom: "1px solid #e2e8f0",
      borderRight: "1px solid #e2e8f0",
      textAlign: "left",
      verticalAlign: "middle",
      maxWidth: "220px",
    },

    // Allows alert badges to stack vertically instead of stretching horizontally
    tdAlert: {
      padding: "6px",
      borderBottom: "1px solid #e2e8f0",
      textAlign: "left",
      verticalAlign: "middle",
      maxWidth: "120px",
      whiteSpace: "normal",
    },

    alertBadge: {
      padding: "3px 6px",
      borderRadius: "4px",
      fontSize: "10px",
      fontWeight: "700",
      display: "inline-block",
      marginBottom: "4px",
      marginRight: "4px",
    },

    // 🚀 NEW BOX BORDER & SHADOW STYLE
    categoryBox: {
      backgroundColor: "#fff",
      borderRadius: "12px",
      border: "3px solid #cbd5e1", // Thicker box border
      boxShadow: "0 8px 20px rgba(100,116,139,0.1)", // Elegant shadow for grouping
      marginBottom: "20px",
      overflow: "hidden", // Prevents corner bleed
    },
  };

  const safeClientGroups = clientGroups || {};

  if (Object.keys(safeClientGroups).length === 0) {
    return (
      <div style={{ padding: "80px", textAlign: "center", color: "#64748b" }}>
        <span
          style={{ fontSize: "30px", display: "block", marginBottom: "10px" }}
        >
          📭
        </span>
        <span style={{ fontWeight: "bold", fontSize: "16px" }}>
          No accounts found for this filter.
        </span>
      </div>
    );
  }

  // RE-STRUCTURE DATA: Category -> Handler -> Accounts
  const structuredData = {};
  Object.keys(safeClientGroups).forEach((key) => {
    const parts = key.split("||");
    const category = `${parts[0]}||${parts[1]}`;
    const handler = parts[2] || "Unknown";

    if (!structuredData[category]) structuredData[category] = {};
    if (!structuredData[category][handler])
      structuredData[category][handler] = [];

    structuredData[category][handler].push(...safeClientGroups[key]);
  });

  const numWCols = numWeeks || 0;
  const actualColumns =
    6 + (showLeaderCol ? 1 : 0) + (isCoAdminView ? 1 : 0) + numWCols;

  // COMMON SHARED HEADERS & COLGROUP
  const renderColGroup = () => (
    <colgroup>
      <col style={{ width: colWidths.accountName }} />
      {showLeaderCol && <col style={{ width: colWidths.ldr }} />}
      {new Array(numWCols).fill(0).map((_, i) => (
        <col key={i} style={{ width: colWidths.w }} />
      ))}
      <col style={{ width: colWidths.total }} />
      {isCoAdminView && <col style={{ width: colWidths.usdHr }} />}
      <col style={{ width: colWidths.lPayRate }} />
      <col style={{ width: colWidths.rev }} />
      <col style={{ width: colWidths.rPayRate }} />
      <col style={{ width: colWidths.cost }} />
      <col style={{ width: colWidths.alerts }} />
    </colgroup>
  );

  const renderHeaders = () => (
    <thead>
      <tr>
        <th style={{ ...s.th, textAlign: "left", paddingLeft: "16px" }}>
          Account Name
        </th>
        {showLeaderCol && <th style={s.th}>LDR</th>}
        {(monthWeeks || []).map((w, i) => (
          <th key={i} style={s.th}>
            <div style={{ fontSize: "11px", color: "#1e293b" }}>{w.label}</div>
            <div
              style={{
                fontSize: "9px",
                color: "#94a3b8",
                marginTop: "2px",
                fontWeight: "600",
              }}
            >
              {w.dateRange}
            </div>
          </th>
        ))}
        <th style={{ ...s.th, backgroundColor: "#fffbeb", color: "#b45309" }}>
          Total
        </th>
        {isCoAdminView && <th style={{ ...s.th, color: "#059669" }}>$/hr</th>}
        <th style={s.th}>L. Pay</th>
        <th style={{ ...s.th, backgroundColor: "#eff6ff", color: "#1d4ed8" }}>
          Rev
        </th>
        <th style={s.th}>R. Pay</th>
        <th style={{ ...s.th, backgroundColor: "#fdf2f8", color: "#be123c" }}>
          Cost
        </th>
        <th
          style={{
            ...s.th,
            textAlign: "left",
            paddingLeft: "12px",
            borderRight: "none",
          }}
        >
          Alerts
        </th>
      </tr>
    </thead>
  );

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      {/* 🚀 MAIN HEADER TABLE (Fixed Layout) */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          whiteSpace: "nowrap",
          tableLayout: "fixed",
        }}
      >
        {renderColGroup()}
        {renderHeaders()}
      </table>
      {/* 🚀 BODY CONTAINER (No table wrapper here, multiple tables instead) */}
      <div style={{ width: "100%" }}>
        {Object.keys(structuredData)
          .sort()
          .map((categoryKey) => {
            const parts = categoryKey.split("||");
            const sortNum = parts[0];
            const cleanCategoryName = parts[1];
            const isPartnerGroup = sortNum === "3";

            return (
              <React.Fragment key={categoryKey}>
                {/* 🚀 CATEGORY CONTAINER (FULL BOX BORDER) */}
                <div style={s.categoryBox}>
                  {/* CATEGORY HEADER SUB-TABLE (Rendered once per category block) */}
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      whiteSpace: "nowrap",
                      tableLayout: "fixed",
                    }}
                  >
                    {renderColGroup()}
                    <tbody>
                      {isCoAdminView && (
                        <tr style={{ borderTop: "1px solid #cbd5e1" }}>
                          <td
                            colSpan={actualColumns}
                            style={{
                              backgroundColor: isPartnerGroup
                                ? "#fff1f2"
                                : "#f1f5f9",
                              padding: "10px 16px",
                              fontWeight: "800",
                              color: isPartnerGroup ? "#be123c" : "#334155",
                              fontSize: "13px",
                              letterSpacing: "0.5px",
                              borderBottom: "1px solid #cbd5e1",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span>
                                📁 {sortNum === "0" ? "" : `${sortNum} -`}{" "}
                                {cleanCategoryName}
                              </span>
                              {isPartnerGroup && (
                                <span
                                  style={{
                                    fontSize: "10px",
                                    backgroundColor: "#ffe4e6",
                                    color: "#be123c",
                                    padding: "2px 8px",
                                    borderRadius: "4px",
                                    border: "1px solid #fda4af",
                                  }}
                                >
                                  0% PROFIT MARGIN
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* ACCOUNTS UNDER THIS CATEGORY (Rendered directly in the main body loop) */}
                      {Object.keys(structuredData[categoryKey])
                        .sort()
                        .map((handler) => {
                          const handlerAccounts =
                            structuredData[categoryKey][handler];
                          let cHrs = 0,
                            cLPay = 0,
                            cRPay = 0;
                          const cWk = new Array(numWCols).fill(0);

                          return (
                            <React.Fragment key={handler}>
                              {/* HANDLER SUB-HEADER */}
                              {isCoAdminView && (
                                <tr>
                                  <td
                                    colSpan={actualColumns}
                                    style={{
                                      padding: "8px 16px",
                                      backgroundColor: "#ffffff",
                                      fontSize: "11px",
                                      fontWeight: "800",
                                      color: "#64748b",
                                      borderBottom: "1px dashed #e2e8f0",
                                    }}
                                  >
                                    👤 MANAGED BY: {handler.toUpperCase()}
                                  </td>
                                </tr>
                              )}

                              {/* ACCOUNT ROWS */}
                              {handlerAccounts.map((acc) => {
                                cHrs += acc.mTotal || 0;
                                cLPay += acc.rev || 0;
                                cRPay += acc.cost || 0;
                                (acc.wHrs || []).forEach(
                                  (h, i) => (cWk[i] += h),
                                );

                                const safeKey =
                                  acc.id ||
                                  acc.email ||
                                  Math.random().toString();

                                // 🚀 SYNC RATER LOGIC: Hide Rater entirely if it's a manager account
                                const isManager =
                                  acc.role === "leader" ||
                                  acc.role === "co-admin";
                                const actualRaterName = isManager
                                  ? null
                                  : acc.isNoRater
                                    ? "No Rater"
                                    : acc.raterName || "Unassigned";

                                return (
                                  <tr
                                    key={safeKey}
                                    onClick={() =>
                                      setCalendarUser && setCalendarUser(acc)
                                    }
                                    style={{
                                      backgroundColor: acc.isSuspended
                                        ? "#fff1f2"
                                        : "#fff",
                                      cursor: "pointer",
                                      transition: "0.1s",
                                    }}
                                    onMouseOver={(e) =>
                                      !acc.isSuspended &&
                                      (e.currentTarget.style.backgroundColor =
                                        "#f8fafc")
                                    }
                                    onMouseOut={(e) =>
                                      !acc.isSuspended &&
                                      (e.currentTarget.style.backgroundColor =
                                        "#fff")
                                    }
                                    title={acc.email}
                                  >
                                    <td style={s.tdAccount}>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          color: acc.isSuspended
                                            ? "#94a3b8"
                                            : "#0f172a",
                                          fontWeight: "700",
                                          fontSize: "13px",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: "13px",
                                            opacity: "0.6",
                                          }}
                                        >
                                          📅
                                        </span>
                                        <span
                                          style={{
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {acc.email}
                                        </span>{" "}
                                        {acc.isSuspended && "🔒"}
                                      </div>

                                      <div
                                        style={{
                                          fontSize: "10px",
                                          color: "#64748b",
                                          marginTop: "4px",
                                          fontWeight: "600",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        <span style={{ color: "#94a3b8" }}>
                                          Client:
                                        </span>{" "}
                                        <span
                                          style={{
                                            color: "#2563eb",
                                            fontWeight: "800",
                                          }}
                                        >
                                          {acc.clientName || "General"}
                                        </span>
                                      </div>
                                    </td>

                                    {showLeaderCol && (
                                      <td
                                        style={{
                                          ...s.td,
                                          color: "#64748b",
                                          fontWeight: "600",
                                          fontSize: "11px",
                                        }}
                                      >
                                        {handler}
                                      </td>
                                    )}

                                    {(acc.wHrs || []).map((h, i) => (
                                      <td
                                        key={i}
                                        style={{
                                          ...s.td,
                                          color:
                                            h === 0 ? "#cbd5e1" : "#475569",
                                          fontWeight: h > 0 ? "600" : "400",
                                        }}
                                      >
                                        {formatTime(h)}
                                      </td>
                                    ))}
                                    <td
                                      style={{
                                        ...s.td,
                                        backgroundColor: "#fffbeb",
                                        fontWeight: "800",
                                        color:
                                          acc.mTotal === 0
                                            ? "#94a3b8"
                                            : "#d97706",
                                      }}
                                    >
                                      {acc.mTotal > 0
                                        ? Number(acc.mTotal).toFixed(2)
                                        : "-"}
                                    </td>

                                    {isCoAdminView && (
                                      <td
                                        style={{
                                          ...s.td,
                                          color: "#059669",
                                          fontWeight: "800",
                                        }}
                                      >
                                        ${acc.payRateUSD || 0}
                                      </td>
                                    )}

                                    <td
                                      style={{
                                        ...s.td,
                                        backgroundColor: acc.isBonusMet
                                          ? "#ecfdf5"
                                          : "transparent",
                                      }}
                                    >
                                      {acc.isBonusMet ? (
                                        <div
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            gap: "2px",
                                          }}
                                        >
                                          <span
                                            style={{
                                              color: "#059669",
                                              fontWeight: "900",
                                              fontSize: "13px",
                                            }}
                                          >
                                            ₹{acc.cLRate}
                                          </span>
                                          <span
                                            style={{
                                              fontSize: "8px",
                                              backgroundColor: "#10b981",
                                              color: "#fff",
                                              padding: "1px 4px",
                                              borderRadius: "3px",
                                              fontWeight: "bold",
                                            }}
                                          >
                                            🎯 BONUS
                                          </span>
                                        </div>
                                      ) : (
                                        <span
                                          style={{
                                            color: "#64748b",
                                            fontWeight: "600",
                                          }}
                                        >
                                          ₹{acc.cLRate}
                                        </span>
                                      )}
                                    </td>
                                    <td
                                      style={{
                                        ...s.td,
                                        backgroundColor: "#eff6ff",
                                        color: "#1d4ed8",
                                        fontWeight: "800",
                                      }}
                                    >
                                      ₹{formatMoney(acc.rev, 0)}
                                    </td>

                                    <td
                                      style={{
                                        ...s.td,
                                        backgroundColor:
                                          acc.isBonusMet && !acc.isNoRater
                                            ? "#ecfdf5"
                                            : "transparent",
                                      }}
                                    >
                                      {acc.isNoRater ? (
                                        <span
                                          style={{
                                            color: "#94a3b8",
                                            fontSize: "10px",
                                            fontStyle: "italic",
                                            fontWeight: "bold",
                                          }}
                                        >
                                          No Rater
                                        </span>
                                      ) : acc.isBonusMet ? (
                                        <div
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            gap: "2px",
                                          }}
                                        >
                                          <span
                                            style={{
                                              color: "#059669",
                                              fontWeight: "800",
                                              fontSize: "13px",
                                            }}
                                          >
                                            ₹{acc.cRRate}
                                          </span>
                                          <span
                                            style={{
                                              fontSize: "8px",
                                              backgroundColor: "#10b981",
                                              color: "#fff",
                                              padding: "1px 4px",
                                              borderRadius: "3px",
                                              fontWeight: "bold",
                                            }}
                                          >
                                            🎯 BONUS
                                          </span>
                                        </div>
                                      ) : (
                                        <span
                                          style={{
                                            color: "#64748b",
                                            fontWeight: "600",
                                          }}
                                        >
                                          ₹{acc.cRRate}
                                        </span>
                                      )}
                                    </td>
                                    <td
                                      style={{
                                        ...s.td,
                                        backgroundColor:
                                          acc.isBonusMet && !acc.isNoRater
                                            ? "#fdf2f8"
                                            : "#fff",
                                        color: acc.isNoRater
                                          ? "#94a3b8"
                                          : "#be123c",
                                        fontWeight: "800",
                                      }}
                                    >
                                      {acc.isNoRater
                                        ? "₹0"
                                        : `₹${formatMoney(acc.cost, 2)}`}
                                    </td>

                                    <td style={s.tdAlert}>
                                      {acc.isSuspended && (
                                        <span
                                          style={{
                                            ...s.alertBadge,
                                            backgroundColor: "#f1f5f9",
                                            color: "#64748b",
                                            border: "1px solid #cbd5e1",
                                          }}
                                        >
                                          ❄️ Frozen
                                        </span>
                                      )}
                                      {(acc.alerts || []).length > 0
                                        ? acc.alerts.map((a, i) => (
                                            <span
                                              key={i}
                                              style={{
                                                ...s.alertBadge,
                                                backgroundColor:
                                                  a.type === "danger"
                                                    ? "#fef2f2"
                                                    : "#fff7ed",
                                                color:
                                                  a.type === "danger"
                                                    ? "#e11d48"
                                                    : "#ea580c",
                                                border: `1px solid ${a.type === "danger" ? "#fecdd3" : "#fed7aa"}`,
                                              }}
                                            >
                                              {a.msg}
                                            </span>
                                          ))
                                        : !acc.isSuspended && (
                                            <span
                                              style={{
                                                fontSize: "10px",
                                                color: "#10b981",
                                                fontWeight: "700",
                                              }}
                                            >
                                              ✔️ OK
                                            </span>
                                          )}
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* SUBTOTALS (STAY INSIDE CELL BORDERS) */}
                              <tr
                                style={{
                                  backgroundColor: isPartnerGroup
                                    ? "#fff1f2"
                                    : "#eef2ff",
                                  borderTop: "2px solid #a5b4fc",
                                  borderBottom: "2px solid #a5b4fc",
                                }}
                              >
                                <td
                                  colSpan={showLeaderCol ? 2 : 1}
                                  style={{
                                    ...s.td,
                                    textAlign: "right",
                                    paddingRight: "16px",
                                    fontWeight: "900",
                                    color: isPartnerGroup
                                      ? "#be123c"
                                      : "#312e81",
                                    backgroundColor: "transparent",
                                  }}
                                >
                                  Subtotal:
                                </td>
                                {cWk.map((h, i) => (
                                  <td
                                    key={i}
                                    style={{
                                      ...s.td,
                                      fontWeight: "800",
                                      color: "#4338ca",
                                      backgroundColor: "transparent",
                                    }}
                                  >
                                    {formatTime(h)}
                                  </td>
                                ))}

                                <td
                                  style={{
                                    ...s.td,
                                    fontWeight: "900",
                                    color: "#9a3412",
                                    backgroundColor: "transparent",
                                  }}
                                >
                                  {cHrs > 0 ? Number(cHrs).toFixed(2) : "-"}
                                </td>

                                {isCoAdminView && (
                                  <td
                                    style={{
                                      ...s.td,
                                      backgroundColor: "transparent",
                                    }}
                                  ></td>
                                )}

                                <td
                                  style={{
                                    ...s.td,
                                    backgroundColor: "transparent",
                                  }}
                                ></td>
                                <td
                                  style={{
                                    ...s.td,
                                    fontWeight: "900",
                                    color: "#1e3a8a",
                                    backgroundColor: "transparent",
                                  }}
                                >
                                  ₹{formatMoney(cLPay, 0)}
                                </td>

                                <td
                                  style={{
                                    ...s.td,
                                    backgroundColor: "transparent",
                                  }}
                                ></td>
                                <td
                                  style={{
                                    ...s.td,
                                    fontWeight: "900",
                                    color: "#9f1239",
                                    backgroundColor: "transparent",
                                  }}
                                >
                                  ₹{formatMoney(cRPay, 2)}
                                </td>

                                <td
                                  style={{
                                    ...s.td,
                                    borderRight: "none",
                                    backgroundColor: "transparent",
                                  }}
                                ></td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                    </tbody>
                  </table>
                </div>{" "}
                {/* Close CATEGORY CONTAINER Div */}
              </React.Fragment>
            );
          })}
      </div>{" "}
      {/* Close BODY CONTAINER Div */}
      {/* 🚀 GRAND TOTALS TABLE (Fixed Layout) */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          backgroundColor: "#0f172a",
        }}
      >
        {renderColGroup()}
        <tfoot style={{ color: "#ffffff" }}>
          <tr style={{ borderTop: "1px solid #cbd5e1" }}>
            <td
              colSpan={showLeaderCol ? 2 : 1}
              style={{
                padding: "16px",
                textAlign: "right",
                fontWeight: "900",
                color: "#fff",
                fontSize: "13px",
                border: "none",
              }}
            >
              FILTERED TOTALS:
            </td>
            {(grandWkTotal || []).map((h, i) => (
              <td
                key={i}
                style={{
                  padding: "16px 6px",
                  textAlign: "center",
                  color: "#94a3b8",
                  fontWeight: "700",
                  border: "none",
                }}
              >
                {formatTime(h)}
              </td>
            ))}
            <td
              style={{
                padding: "16px 6px",
                textAlign: "center",
                color: "#fbbf24",
                fontWeight: "900",
                fontSize: "14px",
                border: "none",
              }}
            >
              {grandHrs > 0 ? Number(grandHrs).toFixed(2) : "-"}
            </td>

            {isCoAdminView && <td style={{ border: "none" }}></td>}

            <td style={{ border: "none" }}></td>
            <td
              style={{
                padding: "16px 6px",
                textAlign: "center",
                color: "#60a5fa",
                fontWeight: "900",
                fontSize: "15px",
                border: "none",
              }}
            >
              ₹{formatMoney(grandLeaderPay, 0)}
            </td>
            <td style={{ border: "none" }}></td>
            <td
              style={{
                padding: "16px 6px",
                textAlign: "center",
                color: "#f87171",
                fontWeight: "900",
                fontSize: "15px",
                border: "none",
              }}
            >
              ₹{formatMoney(grandRaterPay, 2)}
            </td>
            <td style={{ border: "none" }}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
