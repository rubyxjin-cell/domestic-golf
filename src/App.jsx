import { useState, useRef, useEffect } from "react";

const loadH2C = () => new Promise((res, rej) => {
  if (window.html2canvas) { res(window.html2canvas); return; }
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
  s.onload = () => {
    const check = () => {
      if (window.html2canvas) res(window.html2canvas);
      else setTimeout(check, 100);
    };
    check();
  };
  s.onerror = () => rej(new Error("html2canvas 로드 실패"));
  document.head.appendChild(s);
});

const PW = "0090";
const RL = { IC: "인터컨티넨탈 호텔", HIR: "홀리데이인 호텔", HIS33: "홀리데이인 스위트 콘도 33평형" };
const rmLabel = k => RL[k] || k;
const DN = ["일", "월", "화", "수", "목", "금", "토"];
const fmt = n => (n || 0).toLocaleString();
const dow = ds => ds ? new Date(ds + "T00:00:00").getDay() : -1;
const dayType = ds => { const d = dow(ds); return d >= 1 && d <= 4 ? "weekday" : d === 5 ? "friday" : d === 6 ? "saturday" : "sunday"; };
const dayLabel = dt => ({ weekday: "평일", friday: "금요일", saturday: "토요일", sunday: "일요일" }[dt]);
const roomSat = ds => dow(ds) === 6;
const nextDay = ds => {
  if (!ds) return "";
  const d = new Date(ds + "T00:00:00"); d.setDate(d.getDate() + 1);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
};
const fmtD = ds => {
  if (!ds) return "";
  const d = new Date(ds + "T00:00:00");
  return (d.getMonth() + 1) + "/" + d.getDate() + "(" + DN[d.getDay()] + ")";
};

const G = { primary: "#1a5c3a", accent: "#27ae60", light: "#eef7f1", gold: "#b8860b", goldBg: "#fdf6e3", goldBr: "#e8d5a3" };

const DEF = {
  alpensia: {
    name: "알펜시아 골프패키지", sub: "26년 오픈 기념 특가 · 1박2일",
    seasons: { s1: "오픈~4/09", s2: "4/10~4/30" }, seasonCut: "2026-04-10",
    courseNames: { pub: "700GC (대중제)", prv: "알펜시아CC (회원제)" },
    courses: {
      pub: {
        s1: { weekday: [50000, 60000], friday: [70000, 80000], saturday: [110000, 130000], sunday: [110000, 100000] },
        s2: { weekday: [60000, 70000], friday: [80000, 90000], saturday: [130000, 150000], sunday: [130000, 120000] },
      },
      prv: {
        s1: { weekday: [70000, 80000], friday: [80000, 90000], saturday: [130000, 140000], sunday: [130000, 120000] },
        s2: { weekday: [80000, 90000], friday: [100000, 110000], saturday: [150000, 160000], sunday: [150000, 130000] },
      },
    },
    rooms: {
      IC: { s1: [100000, 140000], s2: [110000, 150000], occ: 2 },
      HIR: { s1: [80000, 100000], s2: [80000, 100000], occ: 2 },
      HIS33: { s1: [80000, 140000], s2: [100000, 160000], occ: 4 },
    },
    breakfast: 20000, surcharge: 20000,
    courseIntro: {
      pub: "700골프클럽(대중제)은 강원도 평창 해발 700m 고원에 위치한 18홀 대중 골프장입니다. 시원한 산바람과 쾌적한 환경에서 라운딩을 즐길 수 있습니다.",
      prv: "알펜시아CC(회원제)는 2018 평창올림픽 인근 프리미엄 회원제 골프장으로, 수준 높은 코스 관리와 아름다운 경관이 특징입니다.",
    },
    roomIntro: {
      IC: "인터컨티넨탈 알펜시아 평창 리조트 — 5성급 호텔, 고급스러운 객실과 다양한 부대시설.",
      HIR: "홀리데이인 알펜시아 평창 리조트 — 편안한 숙박과 합리적인 가격의 호텔.",
      HIS33: "홀리데이인 스위트 콘도 33평형 — 넓은 거실과 주방, 4인 가족/동반 라운딩에 최적.",
    },
    notes: [
      "조식 = 클럽하우스 해장국+커피 20,000원/1인 (2일차 1부 시 포함)",
      "2부+2부 패키지 시 2일차 추가금 +2만원, 조식 미포함",
      "4/10일 부터 1부 08:00 이전 추가금 +2만 적용",
      "[대중제] 문의 6주전 / 확정 4주전 월요일 오픈",
      "[회원제] 문의 6주전 / 확정 4주전 수요일 오픈",
      "[회원제] 주말·연휴·극성수기 버스진입 불가",
      "객실요금 URL입력시 반드시 재확인",
    ],
  },
};

const COMBOS = [
  { key: "prv2", d1: "prv", d2: "prv" },
  { key: "pub2", d1: "pub", d2: "pub" },
  { key: "prv_pub", d1: "prv", d2: "pub" },
  { key: "pub_prv", d1: "pub", d2: "prv" },
];

export default function DomesticGolf() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState(false);
  const [tab, setTab] = useState("calc");
  const [products, setProducts] = useState(DEF);
  const [loaded, setLoaded] = useState(false);
  const [month, setMonth] = useState(0);
  const [day, setDay] = useState(0);
  const [combo, setCombo] = useState("prv2");
  const [d2Tee, setD2Tee] = useState(0);
  const [teams, setTeams] = useState(1);
  const [rmType, setRmType] = useState("HIS33");
  const [customSell, setCustomSell] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [qClient, setQClient] = useState("");
  const [qPhone, setQPhone] = useState("");
  const [qMemo, setQMemo] = useState("");
  const [qTee1, setQTee1] = useState("");
  const [qTee2, setQTee2] = useState("");
  const [qAccount, setQAccount] = useState("");
  const previewRef = useRef(null);
  const isMob = typeof window !== "undefined" && window.innerWidth < 768;

  const pk = "alpensia";
  const prod = products[pk];
  const date = (month && day) ? "2026-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0") : "";
  const d2 = date ? nextDay(date) : "";
  const ppl = teams * 4;
  const bfOn = d2Tee === 0;
  const curC = COMBOS.find(c => c.key === combo) || COMBOS[0];
  const rmD = prod?.rooms[rmType];
  const rmOcc = rmD?.occ || 4;
  const rmCnt = teams * (rmOcc === 4 ? 1 : 2);
  const rmOL = rmOcc === 4 ? "4인1실" : "2인1실";
  const season = ds => (!ds || ds < (prod?.seasonCut || "")) ? "s1" : "s2";
  const dv = date && d2 && d2 <= "2026-04-30";

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dm-golf-v3");
      if (raw) {
        const p = JSON.parse(raw);
        if (p.products) { const fp = Object.values(p.products)[0]; if (fp?.courses?.pub) setProducts(p.products); }
      }
    } catch (e) { }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      try { localStorage.setItem("dm-golf-v3", JSON.stringify({ products })); } catch (e) { }
    }, 500);
    return () => clearTimeout(t);
  }, [products, loaded]);

  const calc = (() => {
    if (!date || !prod || !dv || !rmD) return null;
    const dt1 = dayType(date), dt2t = dayType(d2);
    const ss1 = season(date), ss2 = season(d2);
    const c1 = prod.courses[curC.d1], c2 = prod.courses[curC.d2];
    if (!c1 || !c2) return null;
    const gf1 = c1[ss1]?.[dt1]?.[1] || 0;
    const gf2 = c2[ss2]?.[dt2t]?.[d2Tee] || 0;
    const surD2 = d2Tee === 1 ? (prod.surcharge || 0) : 0;
    const cn1 = prod.courseNames[curC.d1], cn2 = prod.courseNames[curC.d2];
    const rmIdx = roomSat(date) ? 1 : 0;
    const rmRate = rmD[ss1]?.[rmIdx] || 0;
    const rmPP = Math.ceil(rmRate * rmCnt / ppl);
    const bfPP = bfOn ? (prod.breakfast || 0) : 0;
    const costPP = gf1 + gf2 + surD2 + rmPP + bfPP;
    const offPP = costPP + 25000;
    const sellPP = offPP - 20000;
    return { cn1, cn2, gf1, gf2, surD2, rmPP, bfPP, costPP, offPP, sellPP };
  })();
  const finalSell = customSell ? parseInt(customSell, 10) : (calc?.sellPP || 0);

  const doDownload = async () => {
    if (!previewRef.current) return;
    setDownloading(true);
    try {
      const h = await loadH2C();
      const el = previewRef.current;
      const cv = await h(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#fff",
        logging: false,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });
      const link = document.createElement("a");
      link.download = "견적_" + (qClient || "고객") + "_" + (date || "날짜") + ".jpg";
      link.href = cv.toDataURL("image/jpeg", 0.92);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("JPG 저장 오류: " + e.message + "\n\n대안: 스크린샷으로 저장해주세요.");
    }
    setDownloading(false);
  };

  const upProd = (f, v) => setProducts(p => ({ ...p, [pk]: { ...p[pk], [f]: v } }));
  const upCourse = (cK, sn, dT, idx, v) => {
    setProducts(prev => {
      const p = { ...prev[pk] }; const cs = { ...p.courses }; const c = { ...cs[cK] }; const s = { ...c[sn] };
      const a = [...(s[dT] || [0, 0])]; a[idx] = parseInt(v) || 0;
      s[dT] = a; c[sn] = s; cs[cK] = c; p.courses = cs; return { ...prev, [pk]: p };
    });
  };
  const upRoom = (rN, sn, idx, v) => {
    setProducts(prev => {
      const p = { ...prev[pk] }; const rs = { ...p.rooms }; const r = { ...rs[rN] };
      const a = [...(r[sn] || [0, 0])]; a[idx] = parseInt(v) || 0;
      r[sn] = a; rs[rN] = r; p.rooms = rs; return { ...prev, [pk]: p };
    });
  };

  const inp = { padding: "10px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", width: "100%", boxSizing: "border-box", fontFamily: "inherit" };
  const lbl = { fontSize: "13px", fontWeight: "700", color: "#555", marginBottom: "6px", display: "block" };
  const sc = { background: "#fff", borderRadius: "16px", padding: isMob ? "16px" : "22px", marginBottom: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
  const qTd = { padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: "13px", color: "#444" };
  const qTdR = { ...qTd, textAlign: "right", fontWeight: "700" };

  // ===== LOGIN =====
  if (!authed) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,#1a5c3a 0%,#0d3320 100%)", fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: "20px", padding: "44px 36px", width: "340px", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", textAlign: "center" }}>
        <div style={{ fontSize: "52px", marginBottom: "8px" }}>⛳</div>
        <div style={{ fontSize: "24px", fontWeight: "900", color: G.primary, marginBottom: "4px" }}>국내골프 견적시스템</div>
        <div style={{ fontSize: "12px", color: "#aaa", marginBottom: "28px", letterSpacing: "2px" }}>CHOICE GOLF</div>
        <input type="password" placeholder="비밀번호" value={pw} onChange={e => { setPw(e.target.value); setPwErr(false); }} onKeyDown={e => { if (e.key === "Enter") { if (pw === PW) { setAuthed(true); setPwErr(false); } else { setPwErr(true); } } }}
          style={{ ...inp, textAlign: "center", marginBottom: "14px", border: pwErr ? "2px solid #e74c3c" : "1px solid #ddd", fontSize: "16px" }} />
        {pwErr && <div style={{ color: "#e74c3c", fontSize: "13px", marginBottom: "10px" }}>비밀번호가 틀립니다</div>}
        <button onClick={() => { if (pw === PW) { setAuthed(true); setPwErr(false); } else { setPwErr(true); } }} style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "none", background: G.primary, color: "#fff", fontWeight: "800", fontSize: "16px", cursor: "pointer" }}>로그인</button>
      </div>
    </div>
  );

  const cLabel = t => t === "pub" ? "대중제" : "회원제";
  const cColor = t => t === "pub" ? "#27ae60" : "#2980b9";
  const cBg = t => t === "pub" ? "#eafaf1" : "#ebf5fb";

  // ===== 알펜시아 (견적 + 견적서 한 페이지) =====
  const renderCalc = () => {
    if (!prod) return null;

    const incl = ["골프 그린피 36홀 (18홀 x 2라운드)", "숙박 1박 — " + rmLabel(rmType) + " (" + rmCnt + "실 · " + rmOL + ")"];
    if (bfOn) incl.push("조식 — 클럽하우스 해장국+커피");
    const excl = ["저녁식사 (자유식)", "개인 경비 (캐디피, 카트비 등)"];
    if (!bfOn) excl.push("조식 (2부+2부 미포함)");

    return (
      <div>
        <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
          <div style={{ fontSize: "20px", fontWeight: "900", color: G.primary }}>{prod.name}</div>
          <div style={{ fontSize: "12px", color: "#999", marginTop: "2px" }}>{prod.sub}</div>
        </div>

        {/* 날짜 */}
        <div style={sc}>
          <div style={{ fontSize: "13px", fontWeight: "800", color: G.primary, marginBottom: "10px" }}>📅 출발일 선택</div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#888" }}>2026년</span>
            <select value={month} onChange={e => { setMonth(parseInt(e.target.value)); setDay(0); }} style={{ ...inp, width: "auto", padding: "10px 16px", fontWeight: "700", fontSize: "15px" }}>
              <option value={0}>월</option>
              {[1, 2, 3, 4].map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
            <select value={day} onChange={e => setDay(parseInt(e.target.value))} style={{ ...inp, width: "auto", padding: "10px 16px", fontWeight: "700", fontSize: "15px" }}>
              <option value={0}>일</option>
              {month > 0 && Array.from({ length: new Date(2026, month, 0).getDate() }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>{d}일 ({DN[new Date(2026, month - 1, d).getDay()]})</option>
              ))}
            </select>
          </div>
          {date && (
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <div style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "#ebf5fb", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#7f8c8d", fontWeight: "700" }}>1일차 · 오후 2부</div>
                <div style={{ fontSize: "16px", fontWeight: "900", color: "#2c3e50", marginTop: "2px" }}>{fmtD(date)}</div>
              </div>
              <div style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "#eafaf1", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#7f8c8d", fontWeight: "700" }}>2일차 · {d2Tee === 0 ? "오전 1부" : "오후 2부"}</div>
                <div style={{ fontSize: "16px", fontWeight: "900", color: "#2c3e50", marginTop: "2px" }}>{fmtD(d2)}</div>
              </div>
            </div>
          )}
          {date && !dv && <div style={{ marginTop: "10px", padding: "10px", background: "#fdecea", borderRadius: "8px", fontSize: "13px", color: "#c0392b", fontWeight: "700" }}>⚠️ 요금표는 4/30까지 적용됩니다.</div>}
        </div>

        {/* 라운딩 조합 */}
        <div style={sc}>
          <div style={{ fontSize: "13px", fontWeight: "800", color: G.primary, marginBottom: "10px" }}>⛳ 라운딩 조합</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {COMBOS.map(rc => {
              const on = combo === rc.key;
              return (
                <button key={rc.key} onClick={() => setCombo(rc.key)} style={{ padding: 0, borderRadius: "10px", cursor: "pointer", overflow: "hidden", display: "flex", border: on ? "2.5px solid " + G.primary : "2px solid #e8e8e8", background: "#fff" }}>
                  <div style={{ flex: 1, padding: "12px 6px", background: on ? cBg(rc.d1) : "#fafafa", textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: "#aaa", fontWeight: "700" }}>1일차</div>
                    <div style={{ fontSize: "16px", fontWeight: "800", color: on ? cColor(rc.d1) : "#bbb", marginTop: "1px" }}>{cLabel(rc.d1)}</div>
                  </div>
                  <div style={{ width: "1px", background: on ? G.primary : "#eee" }} />
                  <div style={{ flex: 1, padding: "12px 6px", background: on ? cBg(rc.d2) : "#fafafa", textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: "#aaa", fontWeight: "700" }}>2일차</div>
                    <div style={{ fontSize: "16px", fontWeight: "800", color: on ? cColor(rc.d2) : "#bbb", marginTop: "1px" }}>{cLabel(rc.d2)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 팀수 + 숙소 */}
        <div style={sc}>
          <div style={{ display: "flex", gap: "20px", flexWrap: isMob ? "wrap" : "nowrap" }}>
            <div style={{ flex: isMob ? "1 1 100%" : "0 0 auto" }}>
              <div style={{ fontSize: "13px", fontWeight: "800", color: G.primary, marginBottom: "10px" }}>🏌️ 팀수</div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button onClick={() => teams > 1 && setTeams(teams - 1)} style={{ width: "38px", height: "38px", borderRadius: "8px", border: "1px solid #ddd", background: "#fafafa", cursor: "pointer", fontSize: "18px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontSize: "22px", fontWeight: "900", minWidth: "50px", textAlign: "center" }}>{teams}<span style={{ fontSize: "13px", fontWeight: "500", color: "#999" }}>팀</span></span>
                <button onClick={() => setTeams(teams + 1)} style={{ width: "38px", height: "38px", borderRadius: "8px", border: "1px solid #ddd", background: "#fafafa", cursor: "pointer", fontSize: "18px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                <span style={{ fontSize: "13px", color: "#999", fontWeight: "600" }}>= {ppl}명</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "13px", fontWeight: "800", color: G.primary, marginBottom: "10px" }}>🏨 숙소</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {Object.keys(prod.rooms).map(r => {
                  const on = rmType === r; const occ = prod.rooms[r]?.occ || 4;
                  return (
                    <button key={r} onClick={() => setRmType(r)} style={{ padding: "10px 14px", borderRadius: "10px", cursor: "pointer", textAlign: "left", border: on ? "2px solid " + G.primary : "2px solid #e8e8e8", background: on ? G.light : "#fafafa", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: on ? G.primary : "#777" }}>{rmLabel(r)}</span>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: on ? G.accent : "#aaa" }}>{occ === 4 ? "4인1실" : "2인1실"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ══ 결과 (공식판매가 + AGT 입금가) ══ */}
        {calc && (
          <div style={{ borderRadius: "16px", overflow: "hidden", marginBottom: "12px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
            <div style={{ padding: "24px", background: "linear-gradient(135deg, #fdf6e3 0%, #fffef7 100%)", borderBottom: "1px solid #e8d5a3" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: G.gold, fontWeight: "700", marginBottom: "6px" }}>공식판매가 (1인)</div>
                  <div style={{ fontSize: "36px", fontWeight: "900", color: "#5a4510", letterSpacing: "-1px", lineHeight: 1 }}>₩{fmt(calc.offPP)}</div>
                </div>
                <div style={{ padding: "8px 18px", background: "rgba(184,134,11,0.12)", borderRadius: "24px", border: "1px solid #e8d5a3" }}>
                  <span style={{ fontSize: "14px", fontWeight: "800", color: G.gold }}>커미션 2만원/인</span>
                </div>
              </div>
            </div>
            <div style={{ padding: "18px 24px", background: G.primary }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", fontWeight: "600", marginBottom: "2px" }}>AGT 입금가 (1인)</div>
                  <div style={{ fontSize: "28px", fontWeight: "900", color: "#fff" }}>₩{fmt(finalSell)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)" }}>총액 ({ppl}명)</div>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: "#fff" }}>₩{fmt(finalSell * ppl)}</div>
                </div>
              </div>
            </div>
            <div style={{ padding: "16px 24px", background: "#f9fbfa" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#aaa", marginBottom: "8px" }}>포함사항</div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ padding: "6px 14px", borderRadius: "20px", background: "#fff", border: "1px solid #ddd", fontSize: "12px", fontWeight: "700", color: "#444" }}>⛳ 골프 그린피 36홀</span>
                {bfOn && <span style={{ padding: "6px 14px", borderRadius: "20px", background: "#fff", border: "1px solid #ddd", fontSize: "12px", fontWeight: "700", color: "#444" }}>🥐 클럽조식</span>}
                <span style={{ padding: "6px 14px", borderRadius: "20px", background: "#fff", border: "1px solid #ddd", fontSize: "12px", fontWeight: "700", color: "#444" }}>🏨 {rmLabel(rmType)}</span>
              </div>
              {!bfOn && <div style={{ marginTop: "8px", padding: "6px 12px", borderRadius: "8px", background: "#fff3e0", fontSize: "12px", fontWeight: "700", color: "#e65100" }}>🥐 조식 미포함 (2부+2부)</div>}
              {calc.surD2 > 0 && <div style={{ marginTop: "6px", padding: "6px 12px", borderRadius: "8px", background: "#fff3e0", fontSize: "12px", fontWeight: "700", color: "#e65100" }}>⚠️ 2일차 추가금 +{fmt(calc.surD2)}원</div>}
            </div>
          </div>
        )}

        {/* 세부 옵션 */}
        {calc && (
          <div style={sc}>
            <button onClick={() => setShowDetail(!showDetail)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: "#f0f0f0", cursor: "pointer", fontSize: "13px", fontWeight: "700", color: "#777" }}>
              {showDetail ? "▲ 세부 옵션 닫기" : "▼ 세부 옵션 (2일차 티타임 · 상세내역)"}
            </button>
            {showDetail && (
              <div style={{ marginTop: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: G.primary, marginBottom: "8px" }}>2일차 티타임</div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                  {[{ v: 0, lb: "1부 (오전) — 기본" }, { v: 1, lb: "2부 (오후) — +2만원" }].map(o => (
                    <button key={o.v} onClick={() => setD2Tee(o.v)} style={{ flex: 1, padding: "12px", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "12px", border: d2Tee === o.v ? "2px solid " + G.primary : "2px solid #e8e8e8", background: d2Tee === o.v ? G.light : "#fafafa", color: d2Tee === o.v ? G.primary : "#999" }}>{o.lb}</button>
                  ))}
                </div>
                <div style={{ fontSize: "12px", fontWeight: "700", color: G.primary, marginBottom: "6px" }}>원가 상세 (1인)</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <tbody>
                    <tr><td style={qTd}>⛳ 1일차 {calc.cn1} 2부</td><td style={qTdR}>₩{fmt(calc.gf1)}</td></tr>
                    <tr><td style={qTd}>⛳ 2일차 {calc.cn2} {d2Tee === 0 ? "1부" : "2부"}</td><td style={qTdR}>₩{fmt(calc.gf2)}</td></tr>
                    {calc.surD2 > 0 && <tr><td style={{ ...qTd, color: "#e65100" }}>⚠️ 2일차 추가금</td><td style={{ ...qTdR, color: "#e65100" }}>₩{fmt(calc.surD2)}</td></tr>}
                    <tr><td style={qTd}>🏨 {rmLabel(rmType)} ({rmCnt}실·{rmOL})</td><td style={qTdR}>₩{fmt(calc.rmPP)}</td></tr>
                    {calc.bfPP > 0 && <tr><td style={qTd}>🥐 조식</td><td style={qTdR}>₩{fmt(calc.bfPP)}</td></tr>}
                    <tr style={{ background: "#f8f8f8" }}><td style={{ ...qTd, fontWeight: "700" }}>원가 합계</td><td style={qTdR}>₩{fmt(calc.costPP)}</td></tr>
                    <tr style={{ background: G.goldBg }}><td style={{ ...qTd, fontWeight: "700", color: "#5a4510" }}>공식판매가 (+2.5만)</td><td style={{ ...qTdR, color: "#5a4510" }}>₩{fmt(calc.offPP)}</td></tr>
                    <tr style={{ background: G.light }}><td style={{ ...qTd, fontWeight: "800", color: G.primary }}>AGT 입금가 (−2만)</td><td style={{ ...qTdR, color: G.primary }}>₩{fmt(calc.sellPP)}</td></tr>
                  </tbody>
                </table>
                <div style={{ marginTop: "12px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#999", display: "block", marginBottom: "4px" }}>✏️ 입금가 직접 입력</label>
                  <input type="number" style={{ ...inp, fontSize: "13px" }} value={customSell} onChange={e => setCustomSell(e.target.value)} placeholder={"자동: " + fmt(calc.sellPP) + "원"} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════ 견적서 ══════════ */}
        {calc && (
          <div style={{ marginTop: "20px", borderTop: "3px solid " + G.primary, paddingTop: "20px" }}>
            <div style={{ fontSize: "16px", fontWeight: "900", color: G.primary, marginBottom: "14px", textAlign: "center" }}>📋 고객 견적서</div>

            {/* 입력 필드 */}
            <div style={sc}>
              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: "10px" }}>
                <div><label style={lbl}>고객명</label><input style={inp} value={qClient} onChange={e => setQClient(e.target.value)} placeholder="고객명" /></div>
                <div><label style={lbl}>연락처</label><input style={inp} value={qPhone} onChange={e => setQPhone(e.target.value)} placeholder="010-0000-0000" /></div>
                <div><label style={lbl}>1일차 티오프</label><input style={inp} value={qTee1} onChange={e => setQTee1(e.target.value)} placeholder="예: 14:00" /></div>
                <div><label style={lbl}>2일차 티오프</label><input style={inp} value={qTee2} onChange={e => setQTee2(e.target.value)} placeholder="예: 07:00" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                <div><label style={lbl}>입금계좌</label><input style={inp} value={qAccount} onChange={e => setQAccount(e.target.value)} placeholder="예: 국민은행 000-000-00-000 초이스골프" /></div>
                <div><label style={lbl}>메모</label><input style={inp} value={qMemo} onChange={e => setQMemo(e.target.value)} placeholder="선택" /></div>
              </div>
            </div>

            {/* ── 견적서 본문 (JPG) ── */}
            <div ref={previewRef} style={{ background: "#fff", padding: "24px", fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>

              {/* 타이틀 */}
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <div style={{ fontSize: "9px", letterSpacing: "3px", color: "#bbb", marginBottom: "2px" }}>CHOICE GOLF</div>
                <div style={{ fontSize: "20px", fontWeight: "900", color: "#222" }}>{prod.name}</div>
                <div style={{ fontSize: "11px", color: "#999", marginTop: "2px" }}>{prod.sub}</div>
              </div>

              {/* 고객정보 — 한줄 */}
              <div style={{ display: "flex", borderTop: "2px solid #222", borderBottom: "1px solid #ddd", fontSize: "14px" }}>
                <div style={{ flex: 1, padding: "10px 12px", borderRight: "1px solid #eee" }}><span style={{ color: "#999", fontSize: "11px" }}>고객</span><br /><b>{qClient || "—"}</b></div>
                <div style={{ flex: 1, padding: "10px 12px", borderRight: "1px solid #eee" }}><span style={{ color: "#999", fontSize: "11px" }}>연락처</span><br /><b>{qPhone || "—"}</b></div>
                <div style={{ flex: 1, padding: "10px 12px" }}><span style={{ color: "#999", fontSize: "11px" }}>일정</span><br /><b>{fmtD(date)} ~ {fmtD(d2)}</b></div>
              </div>

              {/* ── 1일차 ── */}
              <div style={{ background: "#1a5c3a", padding: "8px 12px", marginTop: "12px", fontSize: "15px", fontWeight: "800", color: "#fff", borderRadius: "4px" }}>1일차 · {fmtD(date)}</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px 12px", fontSize: "14px", color: "#333" }}>
                      <b>{calc.cn1}</b> · 18홀 라운딩 (2부)
                      {qTee1 && <span style={{ color: G.accent, fontSize: "13px", marginLeft: "8px" }}>T/O {qTee1}</span>}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: "700", fontSize: "13px", whiteSpace: "nowrap", color: "#333" }}>₩{fmt(calc.gf1)}</td>
                  </tr>
                  {prod.courseIntro?.[curC.d1] && (
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <td colSpan={2} style={{ padding: "6px 10px 8px" }}>
                        <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.5", paddingLeft: "8px", borderLeft: "2px solid #ddd" }}>{prod.courseIntro[curC.d1]}</div>
                      </td>
                    </tr>
                  )}
                  <tr style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px 12px", fontSize: "14px", color: "#333" }}><b>{rmLabel(rmType)}</b> ({rmCnt}실 · {rmOL})</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: "700", fontSize: "13px", whiteSpace: "nowrap", color: "#333" }}>₩{fmt(calc.rmPP)}</td>
                  </tr>
                  {prod.roomIntro?.[rmType] && (
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <td colSpan={2} style={{ padding: "6px 10px 8px" }}>
                        <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.5", paddingLeft: "8px", borderLeft: "2px solid #ddd" }}>{prod.roomIntro[rmType]}</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* ── 2일차 ── */}
              <div style={{ background: "#2c7a50", padding: "8px 12px", marginTop: "12px", fontSize: "15px", fontWeight: "800", color: "#fff", borderRadius: "4px" }}>2일차 · {fmtD(d2)}</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px 12px", fontSize: "14px", color: "#333" }}>
                      <b>{calc.cn2}</b> · 18홀 라운딩 ({d2Tee === 0 ? "1부" : "2부"})
                      {qTee2 && <span style={{ color: G.accent, fontSize: "13px", marginLeft: "8px" }}>T/O {qTee2}</span>}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: "700", fontSize: "13px", whiteSpace: "nowrap", color: "#333" }}>₩{fmt(calc.gf2)}</td>
                  </tr>
                  {curC.d1 !== curC.d2 && prod.courseIntro?.[curC.d2] && (
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <td colSpan={2} style={{ padding: "6px 10px 8px" }}>
                        <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.5", paddingLeft: "8px", borderLeft: "2px solid #ddd" }}>{prod.courseIntro[curC.d2]}</div>
                      </td>
                    </tr>
                  )}
                  {calc.surD2 > 0 && (
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "10px 12px", fontSize: "14px", color: "#c0392b" }}>2부+2부 추가금</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: "700", fontSize: "13px", color: "#c0392b", whiteSpace: "nowrap" }}>₩{fmt(calc.surD2)}</td>
                    </tr>
                  )}
                  {calc.bfPP > 0 && (
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "10px 12px", fontSize: "14px", color: "#333" }}>조식 (해장국+커피)</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: "700", fontSize: "13px", whiteSpace: "nowrap", color: "#333" }}>₩{fmt(calc.bfPP)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* ── 합계 ── */}
              <div style={{ marginTop: "12px", padding: "16px 18px", background: "#f5f5f0", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "2px solid #ddd" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "#888" }}>1인 요금</div>
                  <div style={{ fontSize: "30px", fontWeight: "900", color: "#d32f2f", letterSpacing: "-1px" }}>₩{fmt(calc.offPP)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "12px", color: "#888" }}>총액 ({ppl}명)</div>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: "#333" }}>₩{fmt(calc.offPP * ppl)}</div>
                </div>
              </div>
              {qAccount && (
                <div style={{ textAlign: "center", padding: "8px", fontSize: "13px", color: "#555", background: "#f9f9f9", borderRadius: "0 0 6px 6px", marginTop: "-2px", border: "1px solid #eee", borderTop: "none" }}>
                  입금계좌: <b>{qAccount}</b>
                </div>
              )}

              {/* 포함/불포함 — 한줄씩 */}
              <div style={{ marginTop: "12px", display: "flex", gap: "8px", fontSize: "13px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "700", color: "#333", marginBottom: "4px" }}>포함</div>
                  {incl.map((it, i) => <div key={i} style={{ color: "#555", lineHeight: "1.6" }}>· {it}</div>)}
                </div>
                <div style={{ width: "1px", background: "#eee" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "700", color: "#333", marginBottom: "4px" }}>불포함</div>
                  {excl.map((it, i) => <div key={i} style={{ color: "#555", lineHeight: "1.6" }}>· {it}</div>)}
                </div>
              </div>

              {/* 메모 */}
              {qMemo && <div style={{ marginTop: "10px", fontSize: "13px", color: "#555", padding: "8px 12px", background: "#fffde7", borderRadius: "4px" }}>💬 {qMemo}</div>}

              {/* 안내사항 */}
              {prod.notes?.length > 0 && (
                <div style={{ marginTop: "10px", fontSize: "11px", color: "#aaa", lineHeight: "1.6" }}>
                  {prod.notes.map((n, i) => <span key={i}>{i > 0 ? " · " : ""}{n}</span>)}
                </div>
              )}

              {/* 푸터 */}
              <div style={{ textAlign: "center", fontSize: "10px", color: "#ccc", marginTop: "12px", paddingTop: "8px", borderTop: "1px solid #f0f0f0" }}>
                ㈜초이스골프 | 1533-3160 | choicegolf.co.kr
              </div>
            </div>

            {/* JPG 저장 */}
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <button onClick={doDownload} disabled={downloading} style={{ padding: "14px 40px", borderRadius: "8px", border: "none", cursor: downloading ? "wait" : "pointer", background: downloading ? "#999" : "#d32f2f", color: "#fff", fontWeight: "800", fontSize: "15px" }}>{downloading ? "저장 중..." : "📸 JPG 저장"}</button>
            </div>
          </div>
        )}

        {/* 안내사항 (결과 없을 때만) */}
        {!calc && prod.notes?.length > 0 && (
          <div style={{ ...sc, background: "#fafafa" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#aaa", marginBottom: "6px" }}>안내사항</div>
            {prod.notes.map((n, i) => <div key={i} style={{ fontSize: "12px", color: "#666", padding: "3px 0", lineHeight: "1.6" }}>• {n}</div>)}
          </div>
        )}
      </div>
    );
  };

  // ===== ADMIN =====
  const renderAdmin = () => {
    const p = prod; if (!p) return null;
    return (
      <div>
        <div style={sc}>
          <div style={{ fontSize: "16px", fontWeight: "800", color: G.primary, marginBottom: "16px" }}>⚙️ 상품 기본정보</div>
          <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr", gap: "12px" }}>
            <div><label style={lbl}>상품명</label><input style={inp} value={p.name} onChange={e => upProd("name", e.target.value)} /></div>
            <div><label style={lbl}>설명</label><input style={inp} value={p.sub} onChange={e => upProd("sub", e.target.value)} /></div>
            <div><label style={lbl}>시즌1</label><input style={inp} value={p.seasons.s1} onChange={e => upProd("seasons", { ...p.seasons, s1: e.target.value })} /></div>
            <div><label style={lbl}>시즌2</label><input style={inp} value={p.seasons.s2} onChange={e => upProd("seasons", { ...p.seasons, s2: e.target.value })} /></div>
            <div><label style={lbl}>시즌 구분일</label><input type="date" style={inp} value={p.seasonCut} onChange={e => upProd("seasonCut", e.target.value)} /></div>
            <div><label style={lbl}>조식 (1인)</label><input type="number" style={inp} value={p.breakfast} onChange={e => upProd("breakfast", parseInt(e.target.value) || 0)} /></div>
            <div><label style={lbl}>2부+2부 추가금</label><input type="number" style={inp} value={p.surcharge} onChange={e => upProd("surcharge", parseInt(e.target.value) || 0)} /></div>
          </div>
        </div>

        {Object.entries(p.courses).map(([cK, cD]) => (
          <div key={cK} style={sc}>
            <div style={{ fontSize: "15px", fontWeight: "800", color: G.primary, marginBottom: "12px" }}>⛳ {p.courseNames[cK]}</div>
            {["s1", "s2"].map(sn => (
              <div key={sn} style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#555", marginBottom: "8px", background: "#f5f5f5", padding: "8px 12px", borderRadius: "8px" }}>{sn === "s1" ? "시즌1" : "시즌2"} ({p.seasons[sn]})</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead><tr style={{ background: "#f9f9f9" }}><th style={{ padding: "8px", textAlign: "left" }}>요일</th><th style={{ padding: "8px", textAlign: "right" }}>1부</th><th style={{ padding: "8px", textAlign: "right" }}>2부</th></tr></thead>
                  <tbody>{["weekday", "friday", "saturday", "sunday"].map(dt => (
                    <tr key={dt}>
                      <td style={{ padding: "6px 8px", fontWeight: "600" }}>{dayLabel(dt)}</td>
                      <td style={{ padding: "4px 8px" }}><input type="number" style={{ ...inp, textAlign: "right", padding: "6px 8px" }} value={cD[sn]?.[dt]?.[0] || 0} onChange={e => upCourse(cK, sn, dt, 0, e.target.value)} /></td>
                      <td style={{ padding: "4px 8px" }}><input type="number" style={{ ...inp, textAlign: "right", padding: "6px 8px" }} value={cD[sn]?.[dt]?.[1] || 0} onChange={e => upCourse(cK, sn, dt, 1, e.target.value)} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ))}
          </div>
        ))}

        <div style={sc}>
          <div style={{ fontSize: "15px", fontWeight: "800", color: G.primary, marginBottom: "12px" }}>🏨 객실 요금</div>
          {Object.entries(p.rooms).map(([rN, rD]) => (
            <div key={rN} style={{ marginBottom: "16px", padding: "14px", background: "#fafafa", borderRadius: "10px" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "8px" }}>{rmLabel(rN)} ({rN})</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead><tr style={{ background: "#f0f0f0" }}><th style={{ padding: "6px 8px", textAlign: "left" }}>시즌</th><th style={{ padding: "6px 8px", textAlign: "right" }}>주중</th><th style={{ padding: "6px 8px", textAlign: "right" }}>토요일</th></tr></thead>
                <tbody>{["s1", "s2"].map(sn => (
                  <tr key={sn}>
                    <td style={{ padding: "4px 8px", fontWeight: "600" }}>{sn === "s1" ? "시즌1" : "시즌2"}</td>
                    <td style={{ padding: "4px 8px" }}><input type="number" style={{ ...inp, textAlign: "right", padding: "6px 8px" }} value={rD[sn]?.[0] || 0} onChange={e => upRoom(rN, sn, 0, e.target.value)} /></td>
                    <td style={{ padding: "4px 8px" }}><input type="number" style={{ ...inp, textAlign: "right", padding: "6px 8px" }} value={rD[sn]?.[1] || 0} onChange={e => upRoom(rN, sn, 1, e.target.value)} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ))}
        </div>

        <div style={sc}>
          <div style={{ fontSize: "15px", fontWeight: "800", color: G.primary, marginBottom: "12px" }}>📝 골프장·숙소 소개글</div>
          {Object.keys(p.courseNames || {}).map(ck => (
            <div key={ck} style={{ marginBottom: "8px" }}>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "3px" }}>⛳ {p.courseNames[ck]}</label>
              <textarea style={{ ...inp, minHeight: "60px", resize: "vertical" }} value={p.courseIntro?.[ck] || ""} onChange={e => { const ci = { ...(p.courseIntro || {}) }; ci[ck] = e.target.value; upProd("courseIntro", ci); }} />
            </div>
          ))}
          {Object.keys(p.rooms || {}).map(rk => (
            <div key={rk} style={{ marginBottom: "8px" }}>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "#888", display: "block", marginBottom: "3px" }}>🏨 {rmLabel(rk)}</label>
              <textarea style={{ ...inp, minHeight: "60px", resize: "vertical" }} value={p.roomIntro?.[rk] || ""} onChange={e => { const ri = { ...(p.roomIntro || {}) }; ri[rk] = e.target.value; upProd("roomIntro", ri); }} />
            </div>
          ))}
        </div>

        <div style={sc}>
          <div style={{ fontSize: "15px", fontWeight: "800", color: G.primary, marginBottom: "12px" }}>📝 안내사항</div>
          {(p.notes || []).map((n, i) => (
            <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
              <input style={{ ...inp, flex: 1, fontSize: "13px" }} value={n} onChange={e => { const a = [...p.notes]; a[i] = e.target.value; upProd("notes", a); }} />
              <button onClick={() => upProd("notes", p.notes.filter((_, j) => j !== i))} style={{ background: "#e74c3c", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 12px", cursor: "pointer" }}>✕</button>
            </div>
          ))}
          <button onClick={() => upProd("notes", [...(p.notes || []), ""])} style={{ width: "100%", padding: "10px", border: "2px dashed #ccc", borderRadius: "8px", background: "transparent", color: G.primary, fontWeight: "700", fontSize: "13px", cursor: "pointer", marginTop: "6px" }}>+ 추가</button>
        </div>

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button onClick={() => { if (confirm("초기값으로 되돌리시겠습니까?")) setProducts(DEF); }} style={{ padding: "12px 24px", borderRadius: "8px", border: "2px solid #e74c3c", background: "#fff", color: "#e74c3c", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>🔄 초기값 복원</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f2f4f3", fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background: G.primary, padding: isMob ? "8px 10px" : "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", gap: "4px" }}>
          {[["calc", "알펜시아"], ["admin", "요금관리"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: isMob ? "8px 14px" : "8px 18px", borderRadius: "8px", border: "none", cursor: "pointer", background: tab === k ? "#fff" : "rgba(255,255,255,0.12)", color: tab === k ? G.primary : "rgba(255,255,255,0.85)", fontWeight: "800", fontSize: "13px", whiteSpace: "nowrap" }}>{l}</button>
          ))}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontWeight: "600", letterSpacing: "1px" }}>CHOICE GOLF</div>
      </div>
      <div style={{ padding: isMob ? "12px 10px" : "20px", maxWidth: "800px", margin: "0 auto" }}>
        {tab === "calc" && renderCalc()}
        {tab === "admin" && renderAdmin()}
      </div>
    </div>
  );
}
