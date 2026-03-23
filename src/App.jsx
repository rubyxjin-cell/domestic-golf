import { useState, useRef, useEffect } from "react";

// Supabase 클라이언트
const SUPABASE_URL = "https://qmzrpyyadoajwziqachm.supabase.co";
const SUPABASE_KEY = "sb_publishable_RFXuOTusimP_z4m8OQMe4g_A0-Dl-qg";
const sbFetch = async (method, path, body) => {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=representation" : (method === "PATCH" ? "return=representation" : ""),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

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

const G = {
  primary:  "#1a4731",   // 딥 포레스트 그린
  accent:   "#2e7d52",   // 미디엄 그린
  bright:   "#34a863",   // 밝은 그린 (강조)
  light:    "#e8f5ee",   // 연한 그린 배경
  lighter:  "#f4fbf6",   // 매우 연한 그린
  gold:     "#9a6f1a",
  goldBg:   "#fdf6e3",
  goldBr:   "#e8d5a3",
  text:     "#1a2e22",   // 진한 텍스트
  textMid:  "#4a6358",   // 중간 텍스트
  textSub:  "#8aaa97",   // 서브 텍스트
  border:   "#d4e8dc",   // 테두리
  surface:  "#f7fcf9",   // 카드 배경
};


// 연휴, 연휴전일, 공휴일 그린피 특별요금 날짜
const HOLIDAY_DATES    = ["2026-05-01","2026-05-02","2026-05-03","2026-05-23","2026-05-24"];
const HOLIDAY_EVE      = ["2026-04-30","2026-05-22"];
// 날짜 더하기 (timezone 문제 없는 로컬 계산)
const addDays = (ds, n) => {
  const d = new Date(ds + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
};

const isHoliday    = ds => HOLIDAY_DATES.includes(ds);
const isHolidayEve = ds => HOLIDAY_EVE.includes(ds);

// 상품 목록 (골프장 추가 시 여기에만 추가하면 됨)
const PRODUCT_LIST = [
  { id: "alpensia", name: "알펜시아 골프패키지" },
];

const AGTS = [
  { id: "elite",    name: "엘리트골프",       pw: "4432" },
  { id: "sangsang", name: "상상로드투어",      pw: "5979" },
  { id: "golf4ppl", name: "골프와사람들",      pw: "8499" },
  { id: "si",       name: "시골프투어",        pw: "2000" },
];

const DEF = {
  alpensia: {
    name: "알펜시아 골프패키지", sub: "",
    seasons: { s1: "오픈~4/09", s2: "4/10~4/30", s3: "5/01~5/31" }, seasonCut: "2026-04-10", seasonCut2: "2026-05-01",
    courseNames: { pub: "700GC (대중제)", prv: "알펜시아CC (회원제)" },
    courses: {
      pub: {
        s1: { weekday: [50000, 60000], friday: [70000, 80000], saturday: [110000, 130000], sunday: [110000, 100000] },
        s2: { weekday: [60000, 70000], friday: [80000, 90000], saturday: [130000, 150000], sunday: [130000, 120000] },
        s3: { weekday: [80000, 80000], friday: [100000, 130000], saturday: [150000, 170000], sunday: [150000, 130000] },
      },
      prv: {
        s1: { weekday: [70000, 80000], friday: [80000, 90000], saturday: [130000, 140000], sunday: [130000, 120000] },
        s2: { weekday: [80000, 90000], friday: [100000, 110000], saturday: [150000, 160000], sunday: [150000, 130000] },
        s3: { weekday: [90000, 90000], friday: [110000, 140000], saturday: [160000, 180000], sunday: [160000, 140000] },
      },
    },
    rooms: {
      IC:    { s1: [100000, 140000, 140000], s2: [110000, 150000, 150000], s3: [120000, 160000, 190000], holiday: [220000, 230000, 240000], occ: 2 },
      HIR:   { s1: [80000,  100000, 100000], s2: [80000,  100000, 100000], s3: [100000, 120000, 150000], holiday: [200000, 210000, 220000], occ: 2 },
      HIS33: { s1: [80000,  140000, 140000], s2: [100000, 160000, 160000], s3: [140000, 190000, 240000], holiday: [240000, 270000, 300000], occ: 4 },
    },
    breakfast: { s1: 20000, s2: 20000, s3: 15000 }, surcharge: 20000,
    courseIntro: {
      pub: "평창 알펜시아 700 G.C는 세계 명문 골프코스의 홀을 체험할 수 있게 만든 신개념의 레플리카 골프 코스(Replica Golf Course)로 구성되어 있습니다.|18홀 72par 6,659yard",
      prv: "전 세계에 200개 이상의 골프코스를 설계 및 개조를 한 세계적인 골프코스 설계자인 Robert Trent Jones, Jr. 가 대관령의 자연과 코스 주변의 아름다움을 그의 코스 디자인 도면에 조화롭게 그려낸 알펜시아 ALPENSIA Country Club은 또 하나의 세계적인 명품 골프코스로 평가되고 있습니다.|27홀 108par 9,905yard",
    },
coursePhoto: { pub: [], prv: [] },    roomIntro: {
      IC: "아름다운 조망이 돋보이는 5성급 인터컨티넨탈 알펜시아 리조트는, 대관령의 전경이 파노라마처럼 펼쳐지는 환상적인 객실 전망과 고급스럽고 품격 있는 분위기를 느낄 수 있는 238실 규모의 객실로 이루어져 있습니다.",
      HIR: "2010년 12월 오픈한 5성급 홀리데이 인 리조트 평창 호텔은 비즈니스에 특화된 객실을 갖추고 있으며, 컨벤션 센터와 연계되어 있어 가족과 함께 자연 속에서 휴식 및 비즈니스를 동시에 즐길 수 있는 호텔입니다.",
      HIS33: "평창 알펜시아 리조트 빌리지 안에 위치한 콘도미니엄 홀리데이 인 &amp; 스위트는 전원풍의 사계절 휴양지로, 캐나다 휘슬러 리조트와 미국 베일 리조트를 벤치마킹해 리조트 안에서 모든 것을 해결할 수 있는 원스톱 리조트 시설을 갖추고 있습니다.",
    },
roomPhoto: { IC: [], HIR: [], HIS33: [] },    notes: [
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

// 패키지별 라운드 구성 정의
// rounds: 각 라운드 [ {tee: 0=1부/1=2부, dayOffset: 날짜기준} ]
// 박수 선택 → 자동으로 rounds 배열 길이만큼 계산
const PACKAGES = {
  "1박2일": { nights: 1, rounds: 2 },
  "2박3일": { nights: 2, rounds: 3 },
  "3박4일": { nights: 3, rounds: 4 },
};

// 라운드별 기본 티타임 (2부=1, 1부=0)
const DEFAULT_TEE = [1, 0, 0, 0]; // 1일차 2부, 이후 모두 1부

const COMBOS = [
  { key: "prv2", d1: "prv", d2: "prv" },
  { key: "pub2", d1: "pub", d2: "pub" },
  { key: "prv_pub", d1: "prv", d2: "pub" },
  { key: "pub_prv", d1: "pub", d2: "prv" },
];

// 패키지 라운드별 코스 조합 생성
const buildRounds = (pkgKey, courseKeys) => {
  const pkg = PACKAGES[pkgKey];
  if (!pkg) return [];
  return Array.from({ length: pkg.rounds }, (_, i) => ({
    dayOffset: i,
    tee: DEFAULT_TEE[i] ?? 0,
    course: courseKeys[i] ?? courseKeys[courseKeys.length - 1],
  }));
};

// 패키지별 기본 코스 배열 (1박2일: 2개, 2박3일: 3개, 3박4일: 4개)
const defaultCourses = (pkgKey, baseCombo) => {
  const pkg = PACKAGES[pkgKey];
  if (!pkg) return [];
  const c = COMBOS.find(c => c.key === baseCombo) || COMBOS[0];
  const pool = [c.d1, c.d2, c.d2, c.d2];
  return pool.slice(0, pkg.rounds);
};

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
  const [pkgKey, setPkgKey] = useState("1박2일");
  const [roundCourses, setRoundCourses] = useState(["prv","prv"]); // 라운드별 코스
  const [roundTees, setRoundTees] = useState([1,0]); // 라운드별 티타임
  // AGT 예약관리
  const [agtTab, setAgtTab] = useState("login"); // login | list | form | invoice
  const [agtAuthed, setAgtAuthed] = useState(null); // authed AGT object
  const [agtPw, setAgtPw] = useState("");
  const [agtPwErr, setAgtPwErr] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [agtResLoaded, setAgtResLoaded] = useState(false);
  const [agtResLoading, setAgtResLoading] = useState(false);
  const [selRes, setSelRes] = useState(null); // 선택된 예약 (인보이스용)
  const [showTeeSur, setShowTeeSur] = useState(true); // 인보이스 시간추가금 표시 여부
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletePw, setDeletePw] = useState("");
  const [deletePwErr, setDeletePwErr] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editPw, setEditPw] = useState("");
  const [editPwErr, setEditPwErr] = useState(false);
  const [showEditPw, setShowEditPw] = useState(false);
  const [resForm, setResForm] = useState({ depDate: "", repName: "", phone: "", productId: "alpensia", nights: "1박2일", combo: "prv2", teams: 1, gfPpl: 0, bfPpl: 0, rmType: "HIS33", tee1: "", tee2: "", tee3: "", tee4: "", teeSur1: 0, teeSur2: 0, teeSur3: 0, teeSur4: 0, memo: "" });
  const [teams, setTeams] = useState(1);
  const [rmType, setRmType] = useState("HIS33");
  const [customSell, setCustomSell] = useState("");
  const [qCustomPrice, setQCustomPrice] = useState(""); // 고객 요금 직접입력
  const [qDeposit, setQDeposit] = useState("100,000");   // 예약금
  const [qManager, setQManager] = useState("초이스골프 최진우");   // 담당자
  const [qManagerPhone, setQManagerPhone] = useState("010-5897-1053"); // 담당자 연락처
  const [downloading, setDownloading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [qClient, setQClient] = useState("");
  const [qPhone, setQPhone] = useState("");
  const [qMemo, setQMemo] = useState("");
  const [qTees, setQTees] = useState(["","","",""]); // 라운드별 티오프시간
  const qTee1 = qTees[0]; const qTee2 = qTees[1]; // 하위호환
  const [qAccount, setQAccount] = useState("신한은행 140-015-261327 ㈜초이스골프");
  const [qNotice1On, setQNotice1On] = useState(false); // 티오프 홀딩 문구
  const [qNotice2On, setQNotice2On] = useState(false); // 가견적 문구
  const [qNotice1, setQNotice1] = useState("해당 티오프는 견적서 발송일 기준 가능한 티오프이며, 1일 이내 홀딩 가능합니다.");
  const [qNotice2, setQNotice2] = useState("본 견적은 가견적으로, 확정 예약은 출발일 기준 6주 전부터 가능합니다. 예약이 불가한 경우 입금액 전액 환불해 드립니다.");
  const previewRef = useRef(null);
  const agtInvoiceRef = useRef(null);
  const isMob = typeof window !== "undefined" && window.innerWidth < 768;

  const pk = "alpensia";
  const prod = products[pk];
  const date = (month && day) ? "2026-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0") : "";
  const d2 = date ? nextDay(date) : "";
  const ppl = teams * 4;
  const bfOn = true;
  const curC = COMBOS.find(c => c.key === combo) || COMBOS[0];
  const rmD = prod?.rooms[rmType];
  const rmOcc = rmD?.occ || 4;
  const rmCnt = teams * (rmOcc === 4 ? 1 : 2);
  const pkgNights = PACKAGES[pkgKey]?.nights || 1;
  const pkgRounds = PACKAGES[pkgKey]?.rounds || 2;
  const rmOL = rmOcc === 4 ? "4인1실" : "2인1실";
  // 패키지 변경 시 라운드 배열 재초기화
  const handlePkgChange = (newPkg) => {
    const pkg = PACKAGES[newPkg];
    if (!pkg) return;
    setPkgKey(newPkg);
    const c = COMBOS.find(c => c.key === combo) || COMBOS[0];
    const pool = [c.d1, c.d2, c.d2, c.d2];
    setRoundCourses(pool.slice(0, pkg.rounds));
    setRoundTees(DEFAULT_TEE.slice(0, pkg.rounds));
  };
  // combo 변경 시 코스 배열 재초기화
  const handleComboChange = (newCombo) => {
    setCombo(newCombo);
    const pkg = PACKAGES[pkgKey];
    const c = COMBOS.find(c => c.key === newCombo) || COMBOS[0];
    const pool = [c.d1, c.d2, c.d2, c.d2];
    setRoundCourses(pool.slice(0, pkg?.rounds || 2));
    setRoundTees(DEFAULT_TEE.slice(0, pkg?.rounds || 2));
  };

  const season = ds => (!ds || ds < (prod?.seasonCut || "")) ? "s1" : ds < (prod?.seasonCut2 || "2026-05-01") ? "s2" : "s3";
  const dv = date && d2 && d2 <= "2026-05-31";

  // 객실 요금 조회 (연휴/연휴전일 처리 포함)
  const getRmRate = (rmD2, ds) => {
    if (!rmD2) return 0;
    const d = dow(ds);
    const rmIdx = d === 6 ? 2 : d === 5 ? 1 : 0; // 토=2, 금=1, 주중=0
    if (isHoliday(ds) || isHolidayEve(ds)) {
      // 연휴/연휴전일: holiday 요금 사용, 연휴전일은 금요일 요금(index 1)
      const hIdx = isHolidayEve(ds) ? 1 : rmIdx;
      return (rmD2.holiday?.[hIdx]) || (rmD2[season(ds)]?.[rmIdx]) || 0;
    }
    return rmD2[season(ds)]?.[rmIdx] || 0;
  };

  // 티오프 시간 기준 추가금: 1부 7:30 이후 / 2부 13:00 이전 → +2만원
  const teeToMin = t => { if (!t) return null; const [h,m] = t.split(":").map(Number); return h*60+(m||0); };
  const getTeeSur = (tee, isD1) => {
    const m = teeToMin(tee);
    if (m === null) return 0;
    if (isD1) return m > 7*60+30 ? 20000 : 0;   // 1일차(2부): 7:30 이후
    return m < 13*60 ? 20000 : 0;                 // 2일차(1부): 13:00 이전
  };
  const getGfDayType = (ds) => dayType(ds);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dm-golf-v3");
      if (raw) {
        const p = JSON.parse(raw);
        if (p.products) {
          const fp = Object.values(p.products)[0];
          if (fp?.courses?.pub) {
            const fixed = Object.fromEntries(Object.entries(p.products).map(([k, v]) => [k, {
              ...v,
              breakfast: (typeof v.breakfast === "object" && v.breakfast !== null) ? v.breakfast : DEF[k]?.breakfast ?? v.breakfast,
              sub: (DEF[k]?.sub !== undefined) ? DEF[k].sub : (v.sub || ""),
              courseIntro: DEF[k]?.courseIntro ?? v.courseIntro,
              roomIntro: DEF[k]?.roomIntro ?? v.roomIntro,
              // 사진은 항상 DEF(코드에 박힌 값) 우선
              // 사진: DEF에 값 있으면 DEF 우선, 없으면 localStorage 유지
              coursePhoto: Object.fromEntries(Object.entries(DEF[k]?.coursePhoto || {}).map(([ck, arr]) => [ck, arr.some(x=>x) ? arr : (v.coursePhoto?.[ck] || arr)])),
              roomPhoto: Object.fromEntries(Object.entries(DEF[k]?.roomPhoto || {}).map(([rk, arr]) => [rk, arr.some(x=>x) ? arr : (v.roomPhoto?.[rk] || arr)])),
            }]));
            setProducts(fixed);
          }
        }
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

  // AGT 예약 Supabase 로드
  useEffect(() => {
    if (!agtAuthed) return;
    setAgtResLoading(true);
    sbFetch("GET", "reservations?agt_id=eq." + agtAuthed.id + "&order=dep_date.asc")
      .then(data => {
        setReservations((data || []).map(r => ({
          id: r.id,
          agtId: r.agt_id,
          depDate: r.dep_date,
          repName: r.rep_name,
          phone: r.phone,
          productId: r.product_id,
          nights: r.nights,
          combo: r.combo,
          teams: r.teams,
          rmType: r.rm_type,
          tee1: r.tee1,
          tee2: r.tee2,
          teeSur1: r.tee_sur1 || 0,
          teeSur2: r.tee_sur2 || 0,
          gfPpl: Number(r.gf_ppl) || 0,
          bfPpl: Number(r.bf_ppl) || 0,
          memo: r.memo,
          createdAt: r.created_at,
        })));
      })
      .catch(() => setReservations([]))
      .finally(() => { setAgtResLoaded(true); setAgtResLoading(false); });
  }, [agtAuthed]);

  const calcForRes = (r) => {
    const resProd = products[r.productId || "alpensia"];
    if (!r || !resProd) return null;
    const prod = resProd;
    const date = r.depDate;
    if (!date) return null;
    const pkg = PACKAGES[r.nights] || PACKAGES["1박2일"];
    const numRounds = pkg.rounds;  // 1박2일=2, 2박3일=3, 3박4일=4
    const numNights = pkg.nights;
    const ppl2 = r.teams * 4;
    const gfPpl2 = (r.gfPpl && r.gfPpl > 0) ? r.gfPpl : ppl2;
    const bfPpl2 = (r.bfPpl && r.bfPpl > 0) ? r.bfPpl : gfPpl2;
    const rmD2 = prod.rooms[r.rmType];
    if (!rmD2) return null;
    const rmOcc2 = rmD2.occ || 4;
    const rmCnt2 = r.teams * (rmOcc2 === 4 ? 1 : 2);

    // 라운드별 그린피 계산
    const teeNums = [r.teeSur1||0, r.teeSur2||0, r.teeSur3||0, r.teeSur4||0];
    // 코스: 1일차=curC2.d1(2부), 이후=curC2.d2(1부) - COMBO_LABEL 기반
    const curC2 = COMBOS.find(c => c.key === r.combo) || COMBOS[0];
    const gfList = Array.from({ length: numRounds }, (_, i) => {
      const ds = addDays(date, i);
      const ss = season(ds);
      const dt = dayType(ds);
      const courseKey = i === 0 ? curC2.d1 : curC2.d2;
      const course = prod.courses[courseKey];
      const teeIdx = i === 0 ? 1 : 0; // 1일차 2부, 이후 1부
      const basGf = (course?.[ss]?.[dt]?.[teeIdx] || 0) + 2500;
      const sur = teeNums[i] || 0;
      return { gf: basGf + (showTeeSur ? sur : 0), sur, cn: prod.courseNames[courseKey], ds, teeIdx };
    });

    // 객실: 박수만큼
    let rmPP2 = 0;
    for (let i = 0; i < numNights; i++) {
      const ds = addDays(date, i);
      const rate = getRmRate(rmD2, ds);
      rmPP2 += Math.ceil(rate * rmCnt2 / ppl2);
    }

    const ss1 = season(date);
    const bfPP2 = (prod.breakfast?.[ss1] ?? prod.breakfast) || 0;
    const gfTotal = gfList.reduce((s, g) => s + g.gf, 0);
    const costPP2 = gfTotal + rmPP2 + bfPP2;

    const totalAgt = (gfTotal * gfPpl2) + (bfPP2 * bfPpl2) + (rmPP2 * ppl2);

    // 하위호환용
    const gf1 = gfList[0]?.gf || 0;
    const gf2 = gfList[1]?.gf || 0;
    const cn1 = gfList[0]?.cn || "";
    const cn2 = gfList[1]?.cn || "";

    return { gf1, gf2, gfList, rmPP: rmPP2, bfPP: bfPP2, costPP: costPP2, sellPP: costPP2,
             totalAgt, ppl: ppl2, gfPpl: gfPpl2, bfPpl: bfPpl2, rmCnt: rmCnt2,
             cn1, cn2, teeSur1: r.teeSur1||0, teeSur2: r.teeSur2||0, numRounds, numNights };
  };

  const COMBO_LABEL = { prv2: "회원제+회원제", pub2: "대중제+대중제", prv_pub: "회원제+대중제", pub_prv: "대중제+회원제", prv_pub_prv: "회원제+대중제+회원제", pub_prv_pub: "대중제+회원제+대중제", prv3: "회원제x3", pub3: "대중제x3", prv2_pub: "회원제x2+대중제", pub2_prv: "대중제x2+회원제", prv_pub2: "회원제+대중제x2", pub_prv2: "대중제+회원제x2", prv4: "회원제x4", pub4: "대중제x4", prv3_pub: "회원제x3+대중제", pub3_prv: "대중제x3+회원제" };

  const doAgtDownload = async () => {
    if (!agtInvoiceRef.current) return;
    try {
      const h = await loadH2C();
      const cv = await h(agtInvoiceRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = "인보이스_" + (selRes?.repName || "고객") + "_" + (selRes?.depDate || "") + ".jpg";
      link.href = cv.toDataURL("image/jpeg", 0.95);
      link.click();
    } catch(e) { alert("저장 오류: " + e.message); }
  };

  const renderAgt = () => {
    const fmt2 = n => n?.toLocaleString() || "0";
    if (agtTab === "login" || !agtAuthed) return (
      <div style={sc}>
        <div style={{ fontSize: "18px", fontWeight: "800", color: G.primary, marginBottom: "6px" }}>🏢 AGT 예약관리</div>
        <div style={{ fontSize: "13px", color: "#888", marginBottom: "20px" }}>담당자에게 받은 비밀번호를 입력하세요</div>
        <input
          style={{ ...inp, fontSize: "22px", letterSpacing: "8px", textAlign: "center", marginBottom: "10px" }}
          type="password" maxLength={8} value={agtPw}
          onChange={e => { setAgtPw(e.target.value); setAgtPwErr(false); }}
          onKeyDown={e => { if (e.key === "Enter") {
            const found = AGTS.find(a => a.pw === agtPw);
            if (found) { setAgtAuthed(found); setAgtPw(""); setAgtPwErr(false); setAgtTab("list"); }
            else setAgtPwErr(true);
          }}}
          placeholder="••••"
        />
        {agtPwErr && <div style={{ color: "#e74c3c", fontSize: "13px", marginBottom: "8px" }}>비밀번호가 틀렸습니다.</div>}
        <button onClick={() => {
          const found = AGTS.find(a => a.pw === agtPw);
          if (found) { setAgtAuthed(found); setAgtPw(""); setAgtPwErr(false); setAgtTab("list"); }
          else setAgtPwErr(true);
        }} style={{ width: "100%", padding: "14px", background: G.primary, color: "#fff", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: "800", cursor: "pointer" }}>
          로그인
        </button>
      </div>
    );

    if (agtTab === "invoice" && selRes) {
      const r = selRes;
      const inv = calcForRes(r);
      const d2date = r.depDate ? nextDay(r.depDate) : "";
      return (
        <div style={sc}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <button onClick={() => { setAgtTab("list"); setSelRes(null); setShowDeleteConfirm(false); setDeletePw(""); setDeletePwErr(false); }} style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: "13px" }}>← 목록</button>
            <div style={{ fontSize: "16px", fontWeight: "800", color: G.primary }}>📄 인보이스</div>
            <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: G.textMid, cursor: "pointer", marginLeft: "8px" }}>
              <input type="checkbox" checked={showTeeSur} onChange={e => setShowTeeSur(e.target.checked)} style={{ accentColor: G.primary }} />
              시간추가금
            </label>
            <button onClick={doAgtDownload} style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: "8px", border: "none", background: "#d32f2f", color: "#fff", fontWeight: "800", fontSize: "13px", cursor: "pointer" }}>📸 JPG 저장</button>
            <button onClick={() => { setShowEditPw(true); setEditPw(""); setEditPwErr(false); setEditMode(false); }}
              style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid " + G.primary, background: "#fff", color: G.primary, fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>✏️ 수정</button>
            <button onClick={() => { setShowDeleteConfirm(true); setDeletePw(""); setDeletePwErr(false); }}
              style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #e74c3c", background: "#fff", color: "#e74c3c", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>🗑 삭제</button>
          </div>

          {/* 수정 비밀번호 확인 */}
          {showEditPw && !editMode && (
            <div style={{ marginBottom: "16px", padding: "16px", background: "#f0f7f3", borderRadius: "10px", border: "1px solid " + G.border }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: G.primary, marginBottom: "10px" }}>✏️ 수정하려면 비밀번호를 입력하세요</div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="password" maxLength={8} value={editPw}
                  onChange={e => { setEditPw(e.target.value); setEditPwErr(false); }}
                  onKeyDown={e => { if (e.key === "Enter") { if (editPw === agtAuthed?.pw) { setEditMode(true); setShowEditPw(false); setResForm({...selRes, depDate: selRes.depDate, productId: selRes.productId||"alpensia"}); setAgtTab("edit"); } else setEditPwErr(true); }}}
                  placeholder="비밀번호 입력"
                  style={{ ...inp, width: "160px", letterSpacing: "4px", fontSize: "16px", textAlign: "center" }} />
                <button onClick={() => { if (editPw === agtAuthed?.pw) { setEditMode(true); setShowEditPw(false); setResForm({...selRes, productId: selRes.productId||"alpensia"}); setAgtTab("edit"); } else setEditPwErr(true); }}
                  style={{ padding: "10px 16px", background: G.primary, color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>확인</button>
                <button onClick={() => { setShowEditPw(false); setEditPw(""); setEditPwErr(false); }}
                  style={{ padding: "10px 14px", background: "#fff", color: "#888", border: "1px solid #ddd", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>취소</button>
              </div>
              {editPwErr && <div style={{ marginTop: "6px", fontSize: "12px", color: "#e74c3c", fontWeight: "700" }}>비밀번호가 틀렸습니다.</div>}
            </div>
          )}

          {/* 삭제 비밀번호 확인 */}
          {showDeleteConfirm && (
            <div style={{ marginBottom: "16px", padding: "16px", background: "#fff5f5", borderRadius: "10px", border: "1px solid #fcc" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#c0392b", marginBottom: "10px" }}>🗑 예약을 삭제하려면 비밀번호를 입력하세요</div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="password" maxLength={8}
                  value={deletePw}
                  onChange={e => { setDeletePw(e.target.value); setDeletePwErr(false); }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      if (deletePw === agtAuthed?.pw) {
                        sbFetch("DELETE", "reservations?id=eq." + selRes.id)
                          .then(() => { setReservations(p => p.filter(r => r.id !== selRes.id)); setAgtTab("list"); setSelRes(null); setShowDeleteConfirm(false); setDeletePw(""); })
                          .catch(e => alert("삭제 오류: " + e.message));
                      } else { setDeletePwErr(true); }
                    }
                  }}
                  placeholder="비밀번호 입력"
                  style={{ ...inp, width: "160px", letterSpacing: "4px", fontSize: "16px", textAlign: "center" }}
                />
                <button onClick={() => {
                  if (deletePw === agtAuthed?.pw) {
                    sbFetch("DELETE", "reservations?id=eq." + selRes.id)
                      .then(() => { setReservations(p => p.filter(r => r.id !== selRes.id)); setAgtTab("list"); setSelRes(null); setShowDeleteConfirm(false); setDeletePw(""); })
                      .catch(e => alert("삭제 오류: " + e.message));
                  } else { setDeletePwErr(true); }
                }} style={{ padding: "10px 16px", background: "#e74c3c", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>삭제 확인</button>
                <button onClick={() => { setShowDeleteConfirm(false); setDeletePw(""); setDeletePwErr(false); }}
                  style={{ padding: "10px 14px", background: "#fff", color: "#888", border: "1px solid #ddd", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>취소</button>
              </div>
              {deletePwErr && <div style={{ marginTop: "6px", fontSize: "12px", color: "#e74c3c", fontWeight: "700" }}>비밀번호가 틀렸습니다.</div>}
            </div>
          )}
          <div ref={agtInvoiceRef} style={{ border: "2px solid " + G.primary, borderRadius: "12px", overflow: "hidden" }}>
            {/* 헤더 */}
            <div style={{ background: G.primary, padding: "14px 18px", color: "#fff" }}>
              <div style={{ fontSize: "15px", fontWeight: "800" }}>초이스골프 · AGT 청구서</div>
              <div style={{ fontSize: "12px", opacity: 0.8, marginTop: "3px" }}>{agtAuthed.name}</div>
            </div>
            {/* 예약정보 */}
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #eee" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px" }}>
                {[
                  ["출발일", r.depDate ? fmtD(r.depDate) : "-"],
                  ["귀국일", d2date ? fmtD(d2date) : "-"],
                  ["골프장", PRODUCT_LIST.find(p => p.id === (r.productId || "alpensia"))?.name || "-"],
                  ["대표자", r.repName || "-"],
                  ["연락처", r.phone || "-"],
                  ["상품", COMBO_LABEL[r.combo] || r.combo],
                  ["박수", r.nights],
                  ["팀수", r.teams + "팀 (" + (inv?.ppl || 0) + "인)"],
                  ["객실", rmLabel(r.rmType) + " " + (inv?.rmCnt || 0) + "실"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: "6px" }}>
                    <span style={{ color: "#888", fontWeight: "600", minWidth: "48px" }}>{k}</span>
                    <span style={{ fontWeight: "700" }}>{v}</span>
                  </div>
                ))}
              </div>
              {r.memo && <div style={{ marginTop: "8px", padding: "8px 10px", background: "#f8f8f8", borderRadius: "6px", fontSize: "12px", color: "#555" }}>📝 {r.memo}</div>}
            </div>
            {/* 금액 상세 */}
            {inv && (
              <div style={{ padding: "14px 18px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: G.primary, marginBottom: "10px" }}>금액 상세 (1인 기준)</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <tbody>
                    {/* 라운드별 그린피 */}
                    {(inv.gfList || [
                      { cn: inv.cn1, teeIdx: 1, gf: inv.gf1, sur: inv.teeSur1||0, ds: r.depDate },
                      { cn: inv.cn2, teeIdx: 0, gf: inv.gf2, sur: inv.teeSur2||0, ds: addDays(r.depDate,1) },
                    ]).map((g, i) => {
                      const tees = [r.tee1, r.tee2, r.tee3, r.tee4]; const teeStr = tees[i] || "";
                      const label = "⛳ " + (i+1) + "일차 " + g.cn + " " + (g.teeIdx===1?"2부":"1부") + (teeStr ? " T/O " + teeStr : "");
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "6px 4px", color: "#555", fontSize: "13px" }}>{label}</td>
                          <td style={{ padding: "6px 4px", textAlign: "right" }}>₩{fmt2(g.gf)}</td>
                        </tr>
                      );
                    })}
                    {[
                      ["🏨 객실 ÷ " + inv.ppl + "인", inv.rmPP],
                      ["🥐 조식 × " + inv.bfPpl + "인", inv.bfPP],
                    ].map(([label, amt]) => (
                      <tr key={label} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "6px 4px", color: "#555", fontSize: "13px" }}>{label}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>₩{fmt2(amt)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderBottom: "1px solid #ddd" }}>
                      <td style={{ padding: "6px 4px", fontWeight: "700" }}>1인 소계</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: "700" }}>₩{fmt2(inv.sellPP)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: "12px", padding: "14px 16px", background: G.light, borderRadius: "10px", border: "2px solid " + G.primary }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "12px", color: G.primary, fontWeight: "700" }}>총 청구금액</div>
                      <div style={{ fontSize: "11px", color: "#888" }}>
                        {inv.gfPpl === inv.ppl && inv.bfPpl === inv.ppl
                          ? "1인 ₩" + fmt2(inv.sellPP) + " × " + inv.ppl + "인"
                          : "그린피 ₩" + fmt2((inv.gfList||[]).reduce((s,g)=>s+g.gf,0)||(inv.gf1+inv.gf2)) + "×" + inv.gfPpl + "인 + 조식 ₩" + fmt2(inv.bfPP) + "×" + inv.bfPpl + "인 + 객실 ₩" + fmt2(inv.rmPP) + "×" + inv.ppl + "인"
                        }
                      </div>
                    </div>
                    <div style={{ fontSize: "24px", fontWeight: "900", color: G.primary }}>₩{fmt2(inv.totalAgt)}</div>
                  </div>
                </div>
                <div style={{ marginTop: "10px", padding: "12px 16px", background: "#fff8e1", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#999", marginBottom: "3px" }}>💳 입금계좌</div>
                  <div style={{ fontSize: "16px", fontWeight: "900", color: "#5a4200", letterSpacing: "0.5px" }}>신한은행 140-015-261327</div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#7a5c00", marginTop: "2px" }}>주식회사 초이스골프</div>
                </div>
              </div>
            )}
          </div>

          {/* 취소 및 환불규정 */}
          <div style={{ ...sc, marginTop: "8px", border: "1px solid #e0e0e0" }}>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#333", marginBottom: "10px" }}>📋 취소 및 환불규정 <span style={{ fontSize: "11px", fontWeight: "600", color: "#888" }}>(3팀부터 단체규정)</span></div>
            <div style={{ fontSize: "11px", color: "#555", marginBottom: "8px", lineHeight: "1.8" }}>
              <div>· 우전시 골프장 프론트에 취소처리 하셔야 위약금 없이 취소 가능합니다.</div>
              <div>· 객실은 골프텔이 아닌 관계로 우전시 자동취소가 불가능합니다.</div>
              <div>· 단체팀(3팀이상) 취소는 21일전 패널티 발생하오니, 바로 문의 부탁드립니다.</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "8px" }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={{ padding: "6px 8px", textAlign: "center", border: "1px solid #ddd", fontWeight: "700" }}>구분</th>
                  <th style={{ padding: "6px 8px", textAlign: "center", border: "1px solid #ddd", fontWeight: "700" }}>주 중</th>
                  <th style={{ padding: "6px 8px", textAlign: "center", border: "1px solid #ddd", fontWeight: "700" }}>주 말/성수기</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["미내장 (당일취소)", "그린피 100% 적용", "그린피 100% 적용"],
                  ["1~4일전 (16시이전)", "그린피 50% 적용", "그린피 50% 적용"],
                  ["5~13일전 (16시이전)", "150,000원 (18홀기준)", "200,000원 (18홀기준)"],
                  ["14일전 (16시이전)", "16시 이전 취소시 위약없음", "16시 이전 취소시 위약없음"],
                ].map(([g, w, wk]) => (
                  <tr key={g}>
                    <td style={{ padding: "5px 8px", border: "1px solid #ddd", fontWeight: "600", background: "#fafafa" }}>{g}</td>
                    <td style={{ padding: "5px 8px", border: "1px solid #ddd", textAlign: "center" }}>{w}</td>
                    <td style={{ padding: "5px 8px", border: "1px solid #ddd", textAlign: "center" }}>{wk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: "8px 10px", background: "#fff9c4", borderRadius: "6px", fontSize: "11px", fontWeight: "700", color: "#7a5c00", lineHeight: "1.8" }}>
              <div>🏨 호텔 취소: 일주일전까지 무료취소가능 / 일주일안에 취소 시 100% 패널티</div>
              <div>⏰ 취소는 주말/공휴일 제외 영업일 16:00까지 취소 해주셔야 합니다.</div>
            </div>
          </div>
        </div>
      );
    }

    // 예약 수정 폼
    if (agtTab === "edit") return (
      <div style={sc}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <button onClick={() => { setAgtTab("invoice"); setEditMode(false); }} style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: "13px" }}>← 취소</button>
          <div style={{ fontSize: "16px", fontWeight: "800", color: G.primary }}>✏️ 예약 수정</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr", gap: "12px" }}>
          {[
            { label: "출발일", node: <input type="date" style={inp} value={resForm.depDate} onChange={e => setResForm(p => ({...p, depDate: e.target.value}))} /> },
            { label: "상품 (골프장)", node: <select style={inp} value={resForm.productId} onChange={e => setResForm(p => ({...p, productId: e.target.value}))}>{PRODUCT_LIST.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select> },
            { label: "대표자명", node: <input style={inp} value={resForm.repName} onChange={e => setResForm(p => ({...p, repName: e.target.value}))} /> },
            { label: "연락처", node: <input style={inp} value={resForm.phone} onChange={e => setResForm(p => ({...p, phone: e.target.value}))} /> },
            { label: "박수", node: <select style={inp} value={resForm.nights} onChange={e => setResForm(p => ({...p, nights: e.target.value}))}>{["1박2일","2박3일","3박4일"].map(v => <option key={v}>{v}</option>)}</select> },
            { label: "상품 구성", node: <select style={inp} value={resForm.combo} onChange={e => setResForm(p => ({...p, combo: e.target.value}))}>{Object.entries(COMBO_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select> },
            { label: "팀 수", node: <select style={inp} value={resForm.teams} onChange={e => setResForm(p => ({...p, teams: parseInt(e.target.value)}))}>{[1,2,3,4,5].map(v => <option key={v} value={v}>{v}팀 ({v*4}인)</option>)}</select> },
            { label: "객실", node: <select style={inp} value={resForm.rmType} onChange={e => setResForm(p => ({...p, rmType: e.target.value}))}>{[["HIS33","홀리데이인 콘도 33평"],["HIR","홀리데이인 호텔"],["IC","인터컨티넨탈"]].map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select> },
            ...(["tee1","tee2","tee3","tee4"].slice(0, PACKAGES[resForm.nights]?.rounds||2).map((tk, i) => ({
              label: (i+1)+"일차 티오프",
              node: <input style={inp} type="text" value={resForm[tk]||""} onChange={e => setResForm(p => ({...p, [tk]: e.target.value}))} placeholder={i===0?"예: 14:00":"예: 07:00"} />
            }))),
            { label: "그린피 인원 (비워두면 팀수x4)", node: <input style={inp} type="number" value={resForm.gfPpl||""} onChange={e => setResForm(p => ({...p, gfPpl: Number(e.target.value)||0}))} placeholder={String(resForm.teams*4)+"명 (자동)"} /> },
            { label: "조식 인원 (비워두면 그린피 동일)", node: <input style={inp} type="number" value={resForm.bfPpl||""} onChange={e => setResForm(p => ({...p, bfPpl: Number(e.target.value)||0}))} placeholder="비워두면 자동" /> },
            { label: "1일차 추가금", node: <input style={inp} type="number" value={resForm.teeSur1||""} onChange={e => setResForm(p => ({...p, teeSur1: parseInt(e.target.value)||0}))} placeholder="0" /> },
            { label: "2일차 추가금", node: <input style={inp} type="number" value={resForm.teeSur2||""} onChange={e => setResForm(p => ({...p, teeSur2: parseInt(e.target.value)||0}))} placeholder="0" /> },
            { label: "메모", node: <input style={inp} value={resForm.memo||""} onChange={e => setResForm(p => ({...p, memo: e.target.value}))} placeholder="특이사항" /> },
          ].map(({ label, node }) => (
            <div key={label}><label style={{ fontSize: "12px", fontWeight: "700", color: "#555", display: "block", marginBottom: "4px" }}>{label}</label>{node}</div>
          ))}
        </div>
        <button onClick={() => {
          if (!resForm.depDate || !resForm.repName) return alert("출발일과 대표자명은 필수입니다.");
          sbFetch("PATCH", "reservations?id=eq." + selRes.id, {
            dep_date: resForm.depDate, rep_name: resForm.repName, phone: resForm.phone,
            product_id: resForm.productId||"alpensia", nights: resForm.nights, combo: resForm.combo,
            teams: resForm.teams, rm_type: resForm.rmType, tee1: resForm.tee1||"" , tee2: resForm.tee2||"",
            tee_sur1: resForm.teeSur1||0, tee_sur2: resForm.teeSur2||0,
            gf_ppl: Number(resForm.gfPpl)||0, bf_ppl: Number(resForm.bfPpl)||0, memo: resForm.memo||""
          }).then(() => {
            const updated = { ...selRes, ...resForm, depDate: resForm.depDate, repName: resForm.repName,
              phone: resForm.phone, productId: resForm.productId||"alpensia", nights: resForm.nights,
              combo: resForm.combo, teams: resForm.teams, rmType: resForm.rmType,
              tee1: resForm.tee1||"", tee2: resForm.tee2||"",
              teeSur1: resForm.teeSur1||0, teeSur2: resForm.teeSur2||0,
              gfPpl: Number(resForm.gfPpl)||0, bfPpl: Number(resForm.bfPpl)||0, memo: resForm.memo||"" };
            setReservations(p => p.map(r => r.id === selRes.id ? updated : r));
            setSelRes(updated);
            setAgtTab("invoice"); setEditMode(false);
          }).catch(e => alert("수정 오류: " + e.message));
        }} style={{ width: "100%", marginTop: "16px", padding: "14px", background: G.primary, color: "#fff", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: "800", cursor: "pointer" }}>
          수정 저장
        </button>
      </div>
    );

    // 예약 입력 폼
    if (agtTab === "form") return (
      <div style={sc}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <button onClick={() => setAgtTab("list")} style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: "13px" }}>← 목록</button>
          <div style={{ fontSize: "16px", fontWeight: "800", color: G.primary }}>📝 예약 등록</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr", gap: "12px" }}>
          {[
            { label: "출발일", node: <input type="date" style={inp} value={resForm.depDate} onChange={e => setResForm(p => ({...p, depDate: e.target.value}))} /> },
            { label: "상품 (골프장)", node: <select style={inp} value={resForm.productId} onChange={e => setResForm(p => ({...p, productId: e.target.value}))}>{PRODUCT_LIST.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select> },
            { label: "대표자명", node: <input style={inp} placeholder="홍길동님" value={resForm.repName} onChange={e => setResForm(p => ({...p, repName: e.target.value}))} /> },
            { label: "연락처", node: <input style={inp} placeholder="010-0000-0000" value={resForm.phone} onChange={e => setResForm(p => ({...p, phone: e.target.value}))} /> },
            { label: "박수", node: <select style={inp} value={resForm.nights} onChange={e => setResForm(p => ({...p, nights: e.target.value}))}>{["1박2일","2박3일","3박4일"].map(v => <option key={v}>{v}</option>)}</select> },
            { label: "상품 구성", node: <select style={inp} value={resForm.combo} onChange={e => setResForm(p => ({...p, combo: e.target.value}))}>{Object.entries(COMBO_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select> },
            { label: "팀 수", node: <select style={inp} value={resForm.teams} onChange={e => setResForm(p => ({...p, teams: parseInt(e.target.value)}))}>{[1,2,3,4,5].map(v => <option key={v} value={v}>{v}팀 ({v*4}인)</option>)}</select> },
            { label: "객실", node: <select style={inp} value={resForm.rmType} onChange={e => setResForm(p => ({...p, rmType: e.target.value}))}>{[["HIS33","홀리데이인 콘도 33평"],["HIR","홀리데이인 호텔"],["IC","인터컨티넨탈"]].map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select> },
            ...(["tee1","tee2","tee3","tee4"].slice(0, PACKAGES[resForm.nights]?.rounds||2).map((tk, i) => ({
              label: (i+1)+"일차 티오프",
              node: <input style={inp} type="text" value={resForm[tk]||""} onChange={e => setResForm(p => ({...p, [tk]: e.target.value}))} placeholder={i===0?"예: 14:00":"예: 07:00"} />
            }))),
            { label: "그린피 인원 (비워두면 팀수x4)", node: <input style={inp} type="number" value={resForm.gfPpl||""} onChange={e => setResForm(p => ({...p, gfPpl: Number(e.target.value)||0}))} placeholder={String(resForm.teams*4) + "명 (자동)"} /> },
            { label: "조식 인원 (비워두면 그린피 동일)", node: <input style={inp} type="number" value={resForm.bfPpl||""} onChange={e => setResForm(p => ({...p, bfPpl: Number(e.target.value)||0}))} placeholder="비워두면 자동" /> },
            { label: "1일차 추가금", node: <input style={inp} type="number" value={resForm.teeSur1||""} onChange={e => setResForm(p => ({...p, teeSur1: parseInt(e.target.value)||0}))} placeholder="0 (없으면 비워두기)" /> },
            { label: "2일차 추가금", node: <input style={inp} type="number" value={resForm.teeSur2||""} onChange={e => setResForm(p => ({...p, teeSur2: parseInt(e.target.value)||0}))} placeholder="0 (없으면 비워두기)" /> },
            { label: "메모", node: <input style={inp} placeholder="특이사항" value={resForm.memo} onChange={e => setResForm(p => ({...p, memo: e.target.value}))} /> },
          ].map(({ label, node }) => (
            <div key={label}>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "#555", display: "block", marginBottom: "4px" }}>{label}</label>
              {node}
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            if (!resForm.depDate || !resForm.repName) return alert("출발일과 대표자명은 필수입니다.");
            sbFetch("POST", "reservations", {
              agt_id: agtAuthed.id,
              dep_date: resForm.depDate,
              rep_name: resForm.repName,
              phone: resForm.phone,
              product_id: resForm.productId || "alpensia",
              nights: resForm.nights,
              combo: resForm.combo,
              teams: resForm.teams,
              rm_type: resForm.rmType,
              tee1: resForm.tee1 || "",
              tee2: resForm.tee2 || "",
              tee_sur1: resForm.teeSur1 || 0,
              tee_sur2: resForm.teeSur2 || 0,
              gf_ppl: Number(resForm.gfPpl) || 0,
              bf_ppl: Number(resForm.bfPpl) || 0,
              memo: resForm.memo || "",
            }).then(data => {
              const r = data[0];
              setReservations(p => [...p, {
                id: r.id, agtId: r.agt_id, depDate: r.dep_date, repName: r.rep_name,
                phone: r.phone, productId: r.product_id, nights: r.nights,
                combo: r.combo, teams: r.teams, rmType: r.rm_type,
                tee1: r.tee1, tee2: r.tee2, memo: r.memo, createdAt: r.created_at,
              }]);
              setResForm({ depDate: "", repName: "", phone: "", productId: "alpensia", nights: "1박2일", combo: "prv2", teams: 1, rmType: "HIS33", tee1: "", tee2: "", tee3: "", tee4: "", teeSur1: 0, teeSur2: 0, teeSur3: 0, teeSur4: 0, memo: "" });
              setAgtTab("list");
            }).catch(e => alert("저장 오류: " + e.message));
          }}
          style={{ width: "100%", marginTop: "16px", padding: "14px", background: G.primary, color: "#fff", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: "800", cursor: "pointer" }}
        >
          예약 등록
        </button>
      </div>
    );

    // 예약 목록
    return (
      <div>
        <div style={{ ...sc, marginBottom: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: "800", color: G.primary }}>{agtAuthed.name}</div>
              <div style={{ fontSize: "12px", color: "#888", marginTop: "2px" }}>예약 {reservations.length}건</div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setAgtTab("form")} style={{ padding: "8px 16px", background: G.primary, color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>+ 예약 등록</button>
              <button onClick={() => { setAgtAuthed(null); setAgtTab("login"); setReservations([]); setAgtResLoaded(false); }} style={{ padding: "8px 12px", background: "#f0f0f0", color: "#666", border: "none", borderRadius: "8px", fontSize: "12px", cursor: "pointer" }}>로그아웃</button>
            </div>
          </div>
        </div>
        {reservations.length === 0 ? (
          agtResLoading ? <div style={{ ...sc, textAlign: "center", color: "#bbb", padding: "40px" }}>불러오는 중...</div> : <div style={{ ...sc, textAlign: "center", color: "#bbb", padding: "40px" }}>등록된 예약이 없습니다</div>
        ) : (
          <div style={sc}>
            {/* 헤더 */}
            {/* 헤더 */}
            <div style={{ display: "grid", gridTemplateColumns: "80px 48px 90px 100px 70px 80px 1fr 44px", gap: "6px", padding: "8px 12px", background: G.lighter, borderRadius: "8px", fontSize: "11px", fontWeight: "700", color: G.textSub, marginBottom: "4px", border: "1px solid " + G.border }}>
              <span>출발일</span><span>박수</span><span>대표자</span><span>연락처</span><span>티오프</span><span>골프장</span><span>구성</span><span style={{textAlign:"right"}}>팀수</span>
            </div>
            {[...reservations].sort((a, b) => (a.depDate || "") > (b.depDate || "") ? 1 : -1).map((r) => {
              const inv = calcForRes(r);
              const productName = PRODUCT_LIST.find(p => p.id === (r.productId||"alpensia"))?.name || "-";
              return (
                <div key={r.id} onClick={() => { setSelRes(r); setAgtTab("invoice"); setEditMode(false); setShowEditPw(false); setEditPw(""); setShowDeleteConfirm(false); }}
                  style={{ display: "grid", gridTemplateColumns: "80px 48px 90px 100px 70px 80px 1fr 44px", gap: "6px", padding: "12px", borderRadius: "8px", cursor: "pointer", borderBottom: "1px solid " + G.border, fontSize: "13px", alignItems: "center", transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background=G.lighter}
                  onMouseLeave={e => e.currentTarget.style.background=""}
                >
                  <span style={{ fontWeight: "800", color: G.primary, whiteSpace: "nowrap" }}>{r.depDate ? fmtD(r.depDate) : "-"}</span>
                  <span style={{ color: G.textMid, fontSize: "12px", whiteSpace: "nowrap" }}>{r.nights}</span>
                  <span style={{ fontWeight: "700", color: G.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.repName}</span>
                  <span style={{ color: G.textMid, fontSize: "12px", whiteSpace: "nowrap" }}>{r.phone}</span>
                  <span style={{ fontSize: "11px", color: "#e67e22", fontWeight: "700", whiteSpace: "nowrap" }}>{r.tee1 || "-"}</span>
                  <span style={{ fontSize: "11px", color: G.accent, fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{productName}</span>
                  <span style={{ fontSize: "12px", color: G.text, whiteSpace: "nowrap" }}>{COMBO_LABEL[r.combo]}</span>
                  <span style={{ textAlign: "right", fontWeight: "800", color: G.primary, whiteSpace: "nowrap" }}>{r.teams}팀</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const calc = (() => {
    if (!date || !prod || !dv || !rmD) return null;
    const pkg = PACKAGES[pkgKey];
    if (!pkg) return null;
    // 라운드별 계산
    const rounds = Array.from({ length: pkg.rounds }, (_, i) => {
      const ds = addDays(date, i);
      const teeIdx = roundTees[i] ?? DEFAULT_TEE[i] ?? 0;
      const courseKey = roundCourses[i] ?? "prv";
      const course = prod.courses[courseKey];
      const ss = season(ds);
      const dt = getGfDayType(ds);
      const isD1 = i === 0;
      const teeSur = getTeeSur(qTees[i] || "", isD1);
      const rawGf = (course?.[ss]?.[dt]?.[teeIdx] || 0) + teeSur; // 순수 알펜시아 그린피
      const gf = rawGf + 2500; // AGT 청구 그린피 (초이스 수수료 포함)
      return { ds, teeIdx, courseKey, cn: prod.courseNames[courseKey], gf, rawGf, teeSur, ss };
    });
    // 객실: 박수만큼, 각 날짜별 요금
    let rmPP = 0;
    for (let i = 0; i < pkg.nights; i++) {
      const ds = addDays(date, i);
      const rate = getRmRate(rmD, ds);
      rmPP += Math.ceil(rate * rmCnt / ppl);
    }
    const ss1 = season(date);
    const bfPP = (prod.breakfast?.[ss1] ?? prod.breakfast) || 0;
    const rawGfTotal = rounds.reduce((s, r) => s + r.rawGf, 0); // 순수 원가 그린피 합계
    const gfTotal = rounds.reduce((s, r) => s + r.gf, 0);       // 수수료 포함 그린피 합계
    const rawCostPP = rawGfTotal + rmPP + bfPP;  // 순수 알펜시아 원가
    const costPP = gfTotal + rmPP + bfPP;        // AGT 입금가 (초이스 수수료 포함)
    // 공식판매가 = 원가 + 골프 10,000원/라운드 + 객실 5,000원/박
    const offPP = rawCostPP + (10000 * pkg.rounds) + (5000 * pkg.nights);
    // AGT 입금가 = 원가 + 골프 2,500원/라운드 (초이스 수수료만, 객실은 AGT 마진)
    const sellPP = rawCostPP + (2500 * pkg.rounds);
    // AGT 마진 = 골프 7,500원/라운드 + 객실 5,000원/박
    const agtMgn = (7500 * pkg.rounds) + (5000 * pkg.nights);
    // 초이스 마진 = 2,500원 × 라운드
    const choiceMgn = 2500 * pkg.rounds;
    return { rounds, rawGfTotal, gfTotal, rmPP, bfPP, rawCostPP, costPP, offPP, sellPP, agtMgn, choiceMgn };
  })();
  const finalSell = customSell ? parseInt(customSell, 10) : (calc?.sellPP || 0);

  const doDownload = async () => {
    if (!previewRef.current) return;
    setDownloading(true);
    try {
      const h = await loadH2C();
      const el = previewRef.current;
      const cv = await h(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#fff",
        logging: false,
        windowWidth: 780,
        width: el.offsetWidth,
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

  const inp = { padding: "10px 14px", borderRadius: "8px", border: "1px solid " + G.border, fontSize: "14px", width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none", color: G.text };
  const lbl = { fontSize: "12px", fontWeight: "700", color: G.textMid, marginBottom: "5px", display: "block", letterSpacing: "0.3px" };
  const sc = { background: "#fff", borderRadius: "14px", padding: isMob ? "16px" : "22px", marginBottom: "12px", boxShadow: "0 2px 12px rgba(26,71,49,0.07)", border: "1px solid " + G.border };
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

  // incl/excl — renderCalc, renderQuote 공용
  const incl = prod ? ["골프 그린피 " + (pkgRounds * 18) + "홀 (18홀 x " + pkgRounds + "라운드)", "숙박 " + pkgNights + "박 — " + rmLabel(rmType) + " (" + rmCnt + "실 · " + rmOL + ")"] : [];
  if (prod && bfOn) incl.push("클럽조식 (해장국+커피)");
  // 선택된 코스 종류 파악
  const hasPrv = roundCourses.includes("prv");
  const hasPub = roundCourses.includes("pub");
  const excl = prod ? [] : [];
  if (prod) {
    if (hasPrv && hasPub) {
      excl.push("캐디피 ₩150,000 (회원제 · 대중제 동일)");
      excl.push("카트비 ₩120,000 (회원제) / ₩100,000 (대중제)");
    } else if (hasPrv) {
      excl.push("캐디피 ₩150,000");
      excl.push("카트비 ₩120,000");
    } else if (hasPub) {
      excl.push("캐디피 ₩150,000");
      excl.push("카트비 ₩100,000");
    }
  }

  // ===== 알펜시아 (견적 + 견적서 한 페이지) =====
  const renderCalc = () => {
    if (!prod) return null;

    return (
      <div>
        <div style={{ textAlign: "center", padding: "20px 0 10px" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: G.textSub, letterSpacing: "3px", marginBottom: "6px" }}>CHOICE GOLF · ALPENSIA</div>
          <div style={{ fontSize: "22px", fontWeight: "900", color: G.text, letterSpacing: "-0.5px" }}>{prod.name}</div>
          {prod.sub && <div style={{ fontSize: "12px", color: G.textSub, marginTop: "4px" }}>{prod.sub}</div>}
        </div>

        {/* 날짜 */}
        <div style={sc}>
          <div style={{ fontSize: "13px", fontWeight: "800", color: G.text, marginBottom: "12px", letterSpacing: "-0.2px" }}>📅 출발일 선택</div>

          {/* 패키지 선택 */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {Object.keys(PACKAGES).map(pk => (
              <button key={pk} onClick={() => handlePkgChange(pk)} style={{ flex: 1, padding: "12px 6px", borderRadius: "10px", border: pkgKey === pk ? "2px solid " + G.accent : "1.5px solid " + G.border, background: pkgKey === pk ? G.primary : "#fff", fontWeight: "800", fontSize: "14px", color: pkgKey === pk ? "#fff" : G.textMid, cursor: "pointer", transition: "all 0.15s", boxShadow: pkgKey === pk ? "0 4px 12px rgba(26,71,49,0.25)" : "none" }}>{pk}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#888" }}>2026년</span>
            <select value={month} onChange={e => { setMonth(parseInt(e.target.value)); setDay(0); }} style={{ ...inp, width: "auto", padding: "10px 16px", fontWeight: "700", fontSize: "15px" }}>
              <option value={0}>월</option>
              {[1, 2, 3, 4, 5].filter(m => {
                const today = new Date(); today.setHours(0,0,0,0);
                const lastDayOfMonth = new Date(2026, m, 0);
                return lastDayOfMonth >= today;
              }).map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
            <select value={day} onChange={e => setDay(parseInt(e.target.value))} style={{ ...inp, width: "auto", padding: "10px 16px", fontWeight: "700", fontSize: "15px" }}>
              <option value={0}>일</option>
              {month > 0 && Array.from({ length: new Date(2026, month, 0).getDate() }, (_, i) => i + 1).filter(d => {
                const today = new Date(); today.setHours(0,0,0,0);
                return new Date(2026, month - 1, d) >= today;
              }).map(d => (
                <option key={d} value={d}>{d}일 ({DN[new Date(2026, month - 1, d).getDay()]})</option>
              ))}
            </select>
          </div>

          {/* 날짜별 라운드 표시 */}
          {date && (
            <div style={{ display: "flex", gap: "6px", marginTop: "12px", flexWrap: "wrap" }}>
              {Array.from({ length: pkgRounds }, (_, i) => {
                const ds = addDays(date, i);
                const teeLabel = (roundTees[i] ?? DEFAULT_TEE[i] ?? 0) === 1 ? "오후 2부" : "오전 1부";
                const colors = [G.light, "#e8f5ee", "#e0f0ea", "#d8ebe3"];
                return (
                  <div key={i} style={{ flex: 1, minWidth: "70px", padding: "8px 6px", borderRadius: "8px", background: colors[i % 4], textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "#7f8c8d", fontWeight: "700" }}>{i+1}일차 · {teeLabel}</div>
                    <div style={{ fontSize: "14px", fontWeight: "900", color: "#2c3e50", marginTop: "2px" }}>{fmtD(ds)}</div>
                  </div>
                );
              })}
            </div>
          )}
          {date && !dv && <div style={{ marginTop: "10px", padding: "10px", background: "#fdecea", borderRadius: "8px", fontSize: "13px", color: "#c0392b", fontWeight: "700" }}>⚠️ 요금표는 5/31까지 적용됩니다.</div>}
        </div>

        {/* 라운드별 코스 + 티타임 선택 */}
        <div style={sc}>
          <div style={{ fontSize: "13px", fontWeight: "800", color: G.text, marginBottom: "12px", letterSpacing: "-0.2px" }}>⛳ 라운드별 구성</div>
          {Array.from({ length: pkgRounds }, (_, i) => {
            const ds = date ? addDays(date, i) : "";
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", padding: "10px 12px", background: G.surface, borderRadius: "10px", border: "1px solid " + G.border }}>
                <div style={{ fontWeight: "800", fontSize: "13px", color: G.primary, minWidth: "44px" }}>{i+1}일차</div>
                {ds && <div style={{ fontSize: "11px", color: "#888", minWidth: "60px" }}>{fmtD(ds)}</div>}
                {/* 코스 선택 */}
                <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                  {["prv","pub"].map(ck => (
                    <button key={ck} onClick={() => { const a = [...roundCourses]; a[i] = ck; setRoundCourses(a); }}
                      style={{ flex: 1, padding: "6px 4px", borderRadius: "6px", border: roundCourses[i] === ck ? "2px solid " + G.primary : "1px solid #ddd", background: roundCourses[i] === ck ? G.primary : "#fff", fontWeight: "700", fontSize: "12px", color: roundCourses[i] === ck ? "#fff" : G.textSub, cursor: "pointer" }}>
                      {ck === "prv" ? "회원제" : "대중제"}
                    </button>
                  ))}
                </div>
                {/* 티타임 선택 */}
                <div style={{ display: "flex", gap: "4px" }}>
                  {[[0,"1부"],[1,"2부"]].map(([tv, tl]) => (
                    <button key={tv} onClick={() => { const a = [...roundTees]; a[i] = tv; setRoundTees(a); }}
                      style={{ padding: "6px 10px", borderRadius: "6px", border: (roundTees[i] ?? DEFAULT_TEE[i]) === tv ? "2px solid #e67e22" : "1px solid #ddd", background: (roundTees[i] ?? DEFAULT_TEE[i]) === tv ? "#fef3e2" : "#fff", fontWeight: "700", fontSize: "12px", color: (roundTees[i] ?? DEFAULT_TEE[i]) === tv ? "#e67e22" : "#aaa", cursor: "pointer" }}>
                      {tl}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* 팀수 + 숙소 */}
        <div style={sc}>
          <div style={{ display: "flex", gap: "20px", flexWrap: isMob ? "wrap" : "nowrap" }}>
            <div style={{ flex: isMob ? "1 1 100%" : "0 0 auto" }}>
              <div style={{ fontSize: "13px", fontWeight: "800", color: G.text, marginBottom: "12px" }}>🏌️ 팀수</div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button onClick={() => teams > 1 && setTeams(teams - 1)} style={{ width: "38px", height: "38px", borderRadius: "8px", border: "1px solid #ddd", background: "#fafafa", cursor: "pointer", fontSize: "18px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontSize: "22px", fontWeight: "900", minWidth: "50px", textAlign: "center" }}>{teams}<span style={{ fontSize: "13px", fontWeight: "500", color: "#999" }}>팀</span></span>
                <button onClick={() => setTeams(teams + 1)} style={{ width: "38px", height: "38px", borderRadius: "8px", border: "1px solid #ddd", background: "#fafafa", cursor: "pointer", fontSize: "18px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                <span style={{ fontSize: "13px", color: "#999", fontWeight: "600" }}>= {ppl}명</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "13px", fontWeight: "800", color: G.text, marginBottom: "12px" }}>🏨 숙소</div>
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
                  <span style={{ fontSize: "14px", fontWeight: "800", color: G.gold }}>커미션 {fmt((7500*pkgRounds)+(5000*pkgNights))}원/인</span>
                </div>
              </div>
            </div>
            <div style={{ padding: "18px 24px", background: G.primary }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", fontWeight: "600", marginBottom: "2px" }}>AGT 입금가 (1인)</div>
                  <div style={{ fontSize: "28px", fontWeight: "900", color: "#fff" }}>₩{fmt(calc.sellPP)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)" }}>총액 ({ppl}명)</div>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: "#fff" }}>₩{fmt(calc.sellPP * ppl)}</div>
                </div>
              </div>
            </div>
            <div style={{ padding: "16px 24px", background: "#f9fbfa" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#aaa", marginBottom: "8px" }}>포함사항</div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ padding: "6px 14px", borderRadius: "20px", background: "#fff", border: "1px solid #ddd", fontSize: "12px", fontWeight: "700", color: "#444" }}>⛳ 골프 그린피 {pkgRounds * 18}홀</span>
                {bfOn && <span style={{ padding: "6px 14px", borderRadius: "20px", background: "#fff", border: "1px solid #ddd", fontSize: "12px", fontWeight: "700", color: "#444" }}>🥐 클럽조식(해장국+커피)</span>}
                <span style={{ padding: "6px 14px", borderRadius: "20px", background: "#fff", border: "1px solid #ddd", fontSize: "12px", fontWeight: "700", color: "#444" }}>🏨 {rmLabel(rmType)}</span>
              </div>
  
              {calc.surD2 > 0 && <div style={{ marginTop: "6px", padding: "6px 12px", borderRadius: "8px", background: "#fff3e0", fontSize: "12px", fontWeight: "700", color: "#e65100" }}>⚠️ 2일차 추가금 +{fmt(calc.surD2)}원</div>}
            </div>
          </div>
        )}

        {/* 세부 옵션 */}
        {calc && (
          <div style={sc}>
            <button onClick={() => setShowDetail(!showDetail)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: "#f0f0f0", cursor: "pointer", fontSize: "13px", fontWeight: "700", color: "#777" }}>
              {showDetail ? "▲ 세부 요금표 닫기" : "▼ 세부 요금표"}
            </button>
            {showDetail && (
              <div style={{ marginTop: "14px" }}>

                <div style={{ fontSize: "12px", fontWeight: "700", color: G.primary, marginBottom: "6px" }}>원가 상세 (1인)</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <tbody>
                    {calc.rounds.map((r, i) => (
                      <tr key={i}><td style={qTd}>⛳ {i+1}일차 {r.cn} {r.teeIdx===1?"2부":"1부"}</td><td style={qTdR}>₩{fmt(r.gf)}</td></tr>
                    ))}
                    <tr><td style={qTd}>🏨 {rmLabel(rmType)} {pkgNights}박 ({rmCnt}실·{rmOL})</td><td style={qTdR}>₩{fmt(calc.rmPP)}</td></tr>
                    {calc.bfPP > 0 && <tr><td style={qTd}>🥐 조식</td><td style={qTdR}>₩{fmt(calc.bfPP)}</td></tr>}
                    <tr style={{ background: G.light }}><td style={{ ...qTd, fontWeight: "800", color: G.primary }}>AGT 입금가</td><td style={{ ...qTdR, color: G.primary, fontSize: "15px" }}>₩{fmt(calc.sellPP)}</td></tr>
                  </tbody>
                </table>

              </div>
            )}
          </div>
        )}

        {/* 견적서 탭으로 이동 안내 */}
        {calc && (
          <div style={{ marginTop: "16px", padding: "12px 16px", background: G.light, borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: G.primary }}>📋 고객 견적서를 작성하시겠습니까?</div>
            <button onClick={() => setTab("quote")} style={{ padding: "10px 20px", background: G.primary, color: "#fff", border: "none", borderRadius: "8px", fontWeight: "800", fontSize: "13px", cursor: "pointer", boxShadow: "0 4px 12px rgba(26,71,49,0.3)" }}>견적서 작성 →</button>
          </div>
        )}



        {/* 안내사항 (결과 없을 때만) */}
        {!calc && prod.notes?.length > 0 && (
          <div style={{ ...sc, background: G.lighter, border: "1px solid " + G.border }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: G.textSub, marginBottom: "8px", letterSpacing: "1px" }}>안내사항</div>
            {prod.notes.map((n, i) => <div key={i} style={{ fontSize: "12px", color: G.textMid, padding: "3px 0", lineHeight: "1.6" }}>• {n}</div>)}
          </div>
        )}
      </div>
    );
  };

  // ===== 고객 견적서 탭 =====
  const renderQuote = () => {
    if (!calc) return (
      <div style={{ ...sc, textAlign: "center", padding: "40px", color: "#bbb" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
        <div style={{ fontSize: "15px", fontWeight: "700", marginBottom: "8px" }}>견적서를 작성하려면</div>
        <div style={{ fontSize: "13px", color: "#aaa", marginBottom: "16px" }}>알펜시아 요금 탭에서 출발일과 상품을 먼저 선택해주세요</div>
        <button onClick={() => setTab("calc")} style={{ padding: "10px 24px", background: G.primary, color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}>← 요금 선택하러 가기</button>
      </div>
    );

    const displayPrice = qCustomPrice ? parseInt(qCustomPrice.replace(/,/g,"")) : calc.offPP;
    const depositAmt = qDeposit ? parseInt(qDeposit.replace(/,/g,"")) : 0;
    const lastDay = calc.rounds.length > 0 ? calc.rounds[calc.rounds.length-1].ds : d2;

    return (
      <div>
        {/* ── 입력 폼 ── */}
        <div style={sc}>
          <div style={{ fontSize: "13px", fontWeight: "800", color: G.text, marginBottom: "14px" }}>✏️ 견적서 정보 입력</div>

          {/* 3컬럼 균등: 수신인 | 발신인 | 금액 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
            {/* 수신인 */}
            <div style={{ background: G.lighter, borderRadius: "10px", padding: "12px 14px", border: "1px solid " + G.border }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: G.accent, letterSpacing: "1px", marginBottom: "8px" }}>📨 수신인 (고객)</div>
              <div style={{ marginBottom: "6px" }}>
                <label style={{ ...lbl, fontSize: "11px" }}>이름</label>
                <input style={inp} value={qClient} onChange={e => setQClient(e.target.value)} placeholder="홍길동님" />
              </div>
              <div>
                <label style={{ ...lbl, fontSize: "11px" }}>연락처</label>
                <input style={inp} value={qPhone} onChange={e => setQPhone(e.target.value)} placeholder="010-0000-0000" />
              </div>
            </div>
            {/* 발신인 */}
            <div style={{ background: G.lighter, borderRadius: "10px", padding: "12px 14px", border: "1px solid " + G.border }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: G.accent, letterSpacing: "1px", marginBottom: "8px" }}>📤 발신인 (담당자)</div>
              <div style={{ marginBottom: "6px" }}>
                <label style={{ ...lbl, fontSize: "11px" }}>이름</label>
                <input style={inp} value={qManager} onChange={e => setQManager(e.target.value)} placeholder="최진우" />
              </div>
              <div>
                <label style={{ ...lbl, fontSize: "11px" }}>연락처</label>
                <input style={inp} value={qManagerPhone} onChange={e => setQManagerPhone(e.target.value)} placeholder="010-5897-1053" />
              </div>
            </div>
            {/* 금액/예약금 */}
            <div style={{ background: "#fef6f6", borderRadius: "10px", padding: "12px 14px", border: "1px solid #f5d0d0" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#c0392b", letterSpacing: "1px", marginBottom: "8px" }}>💰 금액</div>
              <div style={{ marginBottom: "6px" }}>
                <label style={{ ...lbl, fontSize: "11px" }}>요금 (비워두면 자동)</label>
                <input style={inp} value={qCustomPrice} onChange={e => setQCustomPrice(e.target.value)} placeholder={"자동: " + fmt(calc.offPP) + "원"} />
              </div>
              <div>
                <label style={{ ...lbl, fontSize: "11px" }}>예약금 (1인)</label>
                <input style={inp} value={qDeposit} onChange={e => setQDeposit(e.target.value)} placeholder="100,000" />
              </div>
            </div>
          </div>

          {/* 티오프 + 계좌/메모 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <div style={{ fontSize: "10px", fontWeight: "700", color: G.textMid, marginBottom: "8px" }}>⏰ 티오프 시간</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(" + Math.min(pkgRounds, 4) + ", 1fr)", gap: "6px" }}>
                {Array.from({ length: pkgRounds }, (_, i) => (
                  <div key={i}>
                    <label style={{ ...lbl, fontSize: "11px" }}>{i+1}일차</label>
                    <input type="text" style={inp} value={qTees[i] || ""} onChange={e => { const a = [...qTees]; a[i] = e.target.value; setQTees(a); }} placeholder="10:55" />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div>
                <label style={{ ...lbl, fontSize: "11px" }}>입금계좌</label>
                <input style={inp} value={qAccount} onChange={e => setQAccount(e.target.value)} />
              </div>
              <div>
                <label style={{ ...lbl, fontSize: "11px" }}>메모</label>
                <input style={inp} value={qMemo} onChange={e => setQMemo(e.target.value)} placeholder="특이사항" />
              </div>
            </div>
          </div>
          {/* 안내 문구 선택 */}
          <div style={{ marginTop: "10px" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: G.textMid, marginBottom: "8px" }}>📋 안내 문구 (선택)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", background: G.lighter, borderRadius: "8px", border: "1px solid " + G.border }}>
                <input type="checkbox" checked={qNotice1On} onChange={e => setQNotice1On(e.target.checked)} style={{ marginTop: "3px", accentColor: G.primary, flexShrink: 0 }} />
                <textarea style={{ ...inp, fontSize: "12px", resize: "vertical", minHeight: "40px", flex: 1 }} value={qNotice1} onChange={e => setQNotice1(e.target.value)} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", background: G.lighter, borderRadius: "8px", border: "1px solid " + G.border }}>
                <input type="checkbox" checked={qNotice2On} onChange={e => setQNotice2On(e.target.checked)} style={{ marginTop: "3px", accentColor: G.primary, flexShrink: 0 }} />
                <textarea style={{ ...inp, fontSize: "12px", resize: "vertical", minHeight: "40px", flex: 1 }} value={qNotice2} onChange={e => setQNotice2(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* ── 견적서 본문 (JPG 저장 영역) ── */}
        <div ref={previewRef} style={{ background: "#f4f6f4", fontFamily: "'Pretendard','Apple SD Gothic Neo','맑은 고딕',sans-serif", width: "100%", boxSizing: "border-box", padding: "0 0 14px 0" }}>

          {/* ① 상단 헤더 */}
          <div style={{ background: G.primary, padding: "10px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "3px", height: "28px", background: "rgba(255,255,255,0.35)", borderRadius: "2px" }} />
              <div>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.45)", letterSpacing: "2px", marginBottom: "2px" }}>ALPENSIA OFFICIAL PARTNER</div>
                <div style={{ fontSize: "15px", fontWeight: "900", color: "#fff", letterSpacing: "-0.3px" }}>㈜초이스골프</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", letterSpacing: "0.5px" }}>알펜시아 골프&amp;리조트 견적서</div>
            </div>
          </div>

          {/* ② 수신/발신/날짜 한줄 */}
          <div style={{ background: "#fff", margin: "8px 12px 0", borderRadius: "10px", overflow: "hidden", display: "grid", gridTemplateColumns: "1fr auto 1fr" }}>
            {/* 수신 */}
            <div style={{ padding: "11px 16px", borderRight: "1px solid #f2f2f2" }}>
              <div style={{ fontSize: "9px", color: "#888", fontWeight: "700", letterSpacing: "1px", marginBottom: "5px" }}>수  신</div>
              <div style={{ fontSize: "14px", fontWeight: "900", color: "#111" }}>{qClient || "—"}</div>
              <div style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>{qPhone || "—"}</div>
            </div>
            {/* 날짜 — 중앙 */}
            <div style={{ padding: "11px 20px", borderRight: "1px solid #f2f2f2", textAlign: "center", background: G.lighter, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: "9px", color: G.textMid, fontWeight: "700", letterSpacing: "1px", marginBottom: "5px" }}>출발일</div>
              <div style={{ fontSize: "14px", fontWeight: "900", color: G.primary, lineHeight: 1 }}>{fmtD(date)}</div>
              <div style={{ fontSize: "10px", color: G.textSub, marginTop: "3px", fontWeight: "600" }}>{pkgKey}</div>
            </div>
            {/* 발신 */}
            <div style={{ padding: "11px 16px", textAlign: "right" }}>
              <div style={{ fontSize: "9px", color: "#888", fontWeight: "700", letterSpacing: "1px", marginBottom: "5px" }}>발  신</div>
              <div style={{ fontSize: "14px", fontWeight: "900", color: "#111" }}>{qManager || "—"}</div>
              <div style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>{qManagerPhone || "—"}</div>
            </div>
          </div>

          {/* ③ 요금 + 계좌 + 안내문구 */}
          <div style={{ background: "#fff", margin: "8px 12px 0", borderRadius: "10px", padding: "14px 16px" }}>
            {/* 요금 한줄 */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px", paddingBottom: "11px", borderBottom: "1px solid #f0f0f0", marginBottom: "11px" }}>
              <div style={{ fontSize: "10px", color: "#888", fontWeight: "700", flexShrink: 0 }}>1인 요금</div>
              <div style={{ fontSize: "26px", fontWeight: "900", color: "#c0392b", letterSpacing: "-1px", lineHeight: 1 }}>₩{fmt(displayPrice)}</div>
            </div>
            {/* 계좌 + 예약금 + 안내문구 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {qAccount && (
                <div style={{ fontSize: "12px", color: "#222", lineHeight: "1.7", paddingLeft: "10px", borderLeft: "2px solid " + G.accent }}>
                  {qAccount}{depositAmt > 0 && <span> · 예약 시 상기 계좌로 1인 <b>₩{fmt(depositAmt)}</b> 입금 부탁드립니다.</span>}
                </div>
              )}
              {qNotice1On && <div style={{ fontSize: "12px", color: "#222", lineHeight: "1.7", paddingLeft: "10px", borderLeft: "2px solid " + G.accent }}>· {qNotice1}</div>}
              {qNotice2On && <div style={{ fontSize: "12px", color: "#222", lineHeight: "1.7", paddingLeft: "10px", borderLeft: "2px solid " + G.accent }}>· {qNotice2}</div>}
            </div>
          </div>

          {/* ④ 일정표 — 흰 카드 */}
          <div style={{ background: "#fff", margin: "8px 12px 0", borderRadius: "10px", padding: "14px 16px" }}>
            <div style={{ fontSize: "9px", fontWeight: "700", color: "#aaa", letterSpacing: "2px", marginBottom: "12px" }}>ITINERARY</div>
            {calc.rounds.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", marginBottom: i < calc.rounds.length - 1 ? "14px" : "0", paddingBottom: i < calc.rounds.length - 1 ? "14px" : "0", borderBottom: i < calc.rounds.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                {/* 날짜 */}
                <div style={{ width: "44px", flexShrink: 0 }}>
                  <div style={{ fontSize: "17px", fontWeight: "900", color: G.primary, lineHeight: 1 }}>{fmtD(r.ds).split("(")[0]}</div>
                  <div style={{ fontSize: "12px", color: "#666", fontWeight: "700", marginTop: "3px" }}>{"(" + fmtD(r.ds).split("(")[1]}</div>
                </div>
                {/* 구분선 */}
                <div style={{ width: "1px", background: "#eee", alignSelf: "stretch", margin: "0 14px", flexShrink: 0 }} />
                {/* 내용 */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "15px", fontWeight: "900", color: "#111" }}>{i+1}일차</span>
                    {qTees[i] && <span style={{ fontSize: "14px", fontWeight: "900", color: "#c0392b" }}>T/O {qTees[i]}</span>}
                    {!qTees[i] && <span style={{ fontSize: "11px", color: "#999" }}>{r.teeIdx === 1 ? "오후 2부" : "오전 1부"}</span>}
                  </div>
                  <div style={{ fontSize: "13px", color: "#444", fontWeight: "600" }}>⛳ {r.cn} 18홀 라운딩</div>
                </div>
              </div>
            ))}
          </div>

          {/* ⑤ 소개 카드들 */}
          {(() => {
            const shownKeys = [];
            const courseCards = calc.rounds.filter(r => {
              if (shownKeys.includes(r.courseKey)) return false;
              shownKeys.push(r.courseKey); return true;
            });
            const totalCards = courseCards.length + 1;

            const CardInfo = ({ title, spec, intro, photo }) => (
              <div style={{ background: "#fff", borderRadius: "10px", overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
                {photo && <img src={photo} alt={title} style={{ width: "100%", height: "140px", objectFit: "cover", display: "block", flexShrink: 0 }} />}
                <div style={{ padding: "10px 12px", flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "13px", fontWeight: "800", color: "#111" }}>{title}</span>
                    {spec && <span style={{ fontSize: "9px", fontWeight: "700", color: G.primary, background: G.lighter, padding: "1px 6px", borderRadius: "3px", border: "1px solid " + G.border }}>{spec}</span>}
                  </div>
                  {intro && <div style={{ fontSize: "11px", color: "#555", lineHeight: "1.7" }}>{intro}</div>}
                </div>
              </div>
            );

            return (
              <div style={{ margin: "8px 12px 0", display: "grid", gridTemplateColumns: totalCards <= 2 ? "1fr 1fr" : "1fr 1fr", gap: "8px", alignItems: "stretch" }}>
                {courseCards.map((r, i) => {
                  const photos = prod.coursePhoto?.[r.courseKey] || [];
                  const photo = photos.filter(Boolean)[0] || null;
                  const introFull = prod.courseIntro?.[r.courseKey] || "";
                  const parts = introFull.split("|");
                  return <CardInfo key={i} title={r.cn} spec={parts[1]?.trim()} intro={parts[0]} photo={photo} />;
                })}
                {(() => {
                  const rPhotos = prod.roomPhoto?.[rmType] || [];
                  const rPhoto = rPhotos.filter(Boolean)[0] || null;
                  const rIntro = prod.roomIntro?.[rmType] || "";
                  const colSpan = totalCards === 3 ? "1 / -1" : "auto";
                  return (
                    <div style={{ gridColumn: colSpan }}>
                      {totalCards === 3 ? (
                        <div style={{ background: "#fff", borderRadius: "10px", overflow: "hidden", display: "grid", gridTemplateColumns: "160px 1fr" }}>
                          {rPhoto && <img src={rPhoto} alt={rmType} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                          <div style={{ padding: "10px 12px" }}>
                            <div style={{ fontSize: "13px", fontWeight: "800", color: "#111", marginBottom: "4px" }}>{rmLabel(rmType)}</div>
                            {rIntro && <div style={{ fontSize: "11px", color: "#555", lineHeight: "1.7" }}>{rIntro}</div>}
                          </div>
                        </div>
                      ) : (
                        <CardInfo title={rmLabel(rmType)} spec={null} intro={rIntro} photo={rPhoto} />
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ⑥ 포함/불포함 */}
          <div style={{ margin: "8px 12px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div style={{ background: "#fff", borderRadius: "10px", padding: "12px 14px" }}>
              <div style={{ fontSize: "10px", fontWeight: "800", color: G.primary, marginBottom: "8px" }}>✅ 포함사항</div>
              {incl.map((it, i) => <div key={i} style={{ fontSize: "12px", color: "#333", lineHeight: "1.9" }}>· {it}</div>)}
            </div>
            <div style={{ background: "#fff", borderRadius: "10px", padding: "12px 14px" }}>
              <div style={{ fontSize: "10px", fontWeight: "800", color: "#c0392b", marginBottom: "8px" }}>✖ 불포함</div>
              {excl.map((it, i) => <div key={i} style={{ fontSize: "12px", color: "#333", lineHeight: "1.9" }}>· {it}</div>)}
            </div>
          </div>



          {/* ⑧ 메모 */}
          {qMemo && <div style={{ margin: "8px 12px 0", background: "#fffbe6", borderRadius: "10px", padding: "10px 14px", fontSize: "11px", color: "#666", borderLeft: "3px solid #f0c040" }}>📝 {qMemo}</div>}


        </div>

        {/* JPG 저장 버튼 */}
        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <button onClick={doDownload} disabled={downloading} style={{ padding: "14px 48px", borderRadius: "10px", border: "none", cursor: downloading ? "wait" : "pointer", background: downloading ? "#999" : "#d32f2f", color: "#fff", fontWeight: "800", fontSize: "15px", boxShadow: "0 4px 14px rgba(211,47,47,0.35)" }}>
            {downloading ? "저장 중..." : "📸 JPG 저장"}
          </button>
        </div>
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
            <div><label style={lbl}>시즌3</label><input style={inp} value={p.seasons.s3 || ""} onChange={e => upProd("seasons", { ...p.seasons, s3: e.target.value })} /></div>
            <div><label style={lbl}>시즌1→2 구분일</label><input type="date" style={inp} value={p.seasonCut} onChange={e => upProd("seasonCut", e.target.value)} /></div>
            <div><label style={lbl}>시즌2→3 구분일</label><input type="date" style={inp} value={p.seasonCut2 || ""} onChange={e => upProd("seasonCut2", e.target.value)} /></div>
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
                <thead><tr style={{ background: "#f0f0f0" }}><th style={{ padding: "6px 8px", textAlign: "left" }}>시즌</th><th style={{ padding: "6px 8px", textAlign: "right" }}>주중</th><th style={{ padding: "6px 8px", textAlign: "right" }}>금요일</th><th style={{ padding: "6px 8px", textAlign: "right" }}>토요일</th></tr></thead>
                <tbody>{["s1", "s2", "s3"].map(sn => (
                  <tr key={sn}>
                    <td style={{ padding: "4px 8px", fontWeight: "600" }}>{sn === "s1" ? "시즌1" : sn === "s2" ? "시즌2" : "시즌3"}</td>
                    <td style={{ padding: "4px 8px" }}><input type="number" style={{ ...inp, textAlign: "right", padding: "6px 8px" }} value={rD[sn]?.[0] || 0} onChange={e => upRoom(rN, sn, 0, e.target.value)} /></td>
                    <td style={{ padding: "4px 8px" }}><input type="number" style={{ ...inp, textAlign: "right", padding: "6px 8px" }} value={rD[sn]?.[1] || 0} onChange={e => upRoom(rN, sn, 1, e.target.value)} /></td>
                    <td style={{ padding: "4px 8px" }}><input type="number" style={{ ...inp, textAlign: "right", padding: "6px 8px" }} value={rD[sn]?.[2] || 0} onChange={e => upRoom(rN, sn, 2, e.target.value)} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ))}
        </div>

        <div style={sc}>
          <div style={{ fontSize: "15px", fontWeight: "800", color: G.primary, marginBottom: "12px" }}>📝 골프장·숙소 소개글</div>
          {Object.keys(p.courseNames || {}).map(ck => (
            <div key={ck} style={{ marginBottom: "12px", padding: "12px", background: G.lighter, borderRadius: "8px", border: "1px solid " + G.border }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: G.primary, marginBottom: "8px" }}>⛳ {p.courseNames[ck]}</div>
              <label style={{ fontSize: "11px", color: "#888", display: "block", marginBottom: "3px" }}>소개글</label>
              <textarea style={{ ...inp, minHeight: "60px", resize: "vertical", marginBottom: "6px" }} value={p.courseIntro?.[ck] || ""} onChange={e => { const ci = { ...(p.courseIntro || {}) }; ci[ck] = e.target.value; upProd("courseIntro", ci); }} />
              <label style={{ fontSize: "11px", color: "#888", display: "block", marginBottom: "6px" }}>사진 업로드 (최대 3장)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                {[0,1,2].map(pi => {
                  const photos = Array.isArray(p.coursePhoto?.[ck]) ? p.coursePhoto[ck] : ["","",""];
                  const src = photos[pi] || "";
                  return (
                    <div key={pi} style={{ position: "relative" }}>
                      {src
                        ? <div style={{ position: "relative" }}>
                            <img src={src} alt={ck} style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "6px", display: "block" }} />
                            <button onClick={() => { const cp = { ...(p.coursePhoto||{}) }; const arr = [...(Array.isArray(cp[ck])?cp[ck]:["","",""])]; arr[pi]=""; cp[ck]=arr; upProd("coursePhoto",cp); }} style={{ position:"absolute", top:"3px", right:"3px", padding:"2px 6px", background:"rgba(0,0,0,0.5)", color:"#fff", border:"none", borderRadius:"4px", fontSize:"10px", cursor:"pointer" }}>✕</button>
                          </div>
                        : <label style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"80px", background:G.lighter, border:"1.5px dashed "+G.border, borderRadius:"6px", cursor:"pointer", fontSize:"11px", color:G.textSub }}>
                            + 사진{pi+1}
                            <input type="file" accept="image/*" style={{ display:"none" }} onChange={e => {
                              const file = e.target.files?.[0]; if(!file) return;
                              const reader = new FileReader();
                              reader.onload = ev => { const cp={...(p.coursePhoto||{})}; const arr=[...(Array.isArray(cp[ck])?cp[ck]:["","",""])]; arr[pi]=ev.target.result; cp[ck]=arr; upProd("coursePhoto",cp); };
                              reader.readAsDataURL(file);
                            }} />
                          </label>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {Object.keys(p.rooms || {}).map(rk => (
            <div key={rk} style={{ marginBottom: "12px", padding: "12px", background: G.lighter, borderRadius: "8px", border: "1px solid " + G.border }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: G.primary, marginBottom: "8px" }}>🏨 {rmLabel(rk)}</div>
              <label style={{ fontSize: "11px", color: "#888", display: "block", marginBottom: "3px" }}>소개글</label>
              <textarea style={{ ...inp, minHeight: "60px", resize: "vertical", marginBottom: "6px" }} value={p.roomIntro?.[rk] || ""} onChange={e => { const ri = { ...(p.roomIntro || {}) }; ri[rk] = e.target.value; upProd("roomIntro", ri); }} />
              <label style={{ fontSize: "11px", color: "#888", display: "block", marginBottom: "6px" }}>사진 업로드 (최대 3장)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                {[0,1,2].map(pi => {
                  const photos = Array.isArray(p.roomPhoto?.[rk]) ? p.roomPhoto[rk] : ["","",""];
                  const src = photos[pi] || "";
                  return (
                    <div key={pi} style={{ position: "relative" }}>
                      {src
                        ? <div style={{ position: "relative" }}>
                            <img src={src} alt={rk} style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "6px", display: "block" }} />
                            <button onClick={() => { const rp={...(p.roomPhoto||{})}; const arr=[...(Array.isArray(rp[rk])?rp[rk]:["","",""])]; arr[pi]=""; rp[rk]=arr; upProd("roomPhoto",rp); }} style={{ position:"absolute", top:"3px", right:"3px", padding:"2px 6px", background:"rgba(0,0,0,0.5)", color:"#fff", border:"none", borderRadius:"4px", fontSize:"10px", cursor:"pointer" }}>✕</button>
                          </div>
                        : <label style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"80px", background:G.lighter, border:"1.5px dashed "+G.border, borderRadius:"6px", cursor:"pointer", fontSize:"11px", color:G.textSub }}>
                            + 사진{pi+1}
                            <input type="file" accept="image/*" style={{ display:"none" }} onChange={e => {
                              const file = e.target.files?.[0]; if(!file) return;
                              const reader = new FileReader();
                              reader.onload = ev => { const rp={...(p.roomPhoto||{})}; const arr=[...(Array.isArray(rp[rk])?rp[rk]:["","",""])]; arr[pi]=ev.target.result; rp[rk]=arr; upProd("roomPhoto",rp); };
                              reader.readAsDataURL(file);
                            }} />
                          </label>
                      }
                    </div>
                  );
                })}
              </div>
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

        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #f0f7f3 0%, #f7f9f8 100%)", fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background: G.primary, padding: isMob ? "0 10px" : "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 2px 16px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", gap: "2px" }}>
          {[["calc", "알펜시아 요금"], ["quote", "고객 견적서"], ["agt", "AGT 예약관리"], ["setting", "⚙️ 설정"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: isMob ? "14px 12px" : "16px 20px", borderRadius: "0", border: "none", borderBottom: tab === k ? "3px solid #fff" : "3px solid transparent", cursor: "pointer", background: "transparent", color: tab === k ? "#fff" : "rgba(255,255,255,0.55)", fontWeight: tab === k ? "800" : "600", fontSize: isMob ? "12px" : "13px", whiteSpace: "nowrap", transition: "all 0.15s", letterSpacing: "0.3px" }}>{l}</button>
          ))}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: "700", letterSpacing: "2px" }}>CHOICE GOLF</div>
      </div>
      <div style={{ padding: isMob ? "12px 10px" : "20px", maxWidth: "800px", margin: "0 auto" }}>
        {tab === "calc" && renderCalc()}
        {tab === "quote" && renderQuote()}
        {tab === "agt" && renderAgt()}
        {tab === "setting" && renderAdmin()}

      </div>
    </div>
  );
}
