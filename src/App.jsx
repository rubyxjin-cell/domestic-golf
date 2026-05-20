import { useState, useRef, useEffect } from "react";

// Supabase 클라이언트
const SUPABASE_URL = "https://qmzrpyyadoajwziqachm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtenJweXlhZG9hand6aXFhY2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDI0NDcsImV4cCI6MjA4OTc3ODQ0N30.CI6ZFvNa2TRa0XqwnrXKL9x3ZHXfKg6GaNwJhqYvCmc";
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

// ExcelJS 동적 로드 (CDN)
const loadExcelJS = () => new Promise((res, rej) => {
  if (window.ExcelJS) { res(window.ExcelJS); return; }
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
  s.onload = () => {
    const check = () => {
      if (window.ExcelJS) res(window.ExcelJS);
      else setTimeout(check, 100);
    };
    check();
  };
  s.onerror = () => rej(new Error("ExcelJS 로드 실패"));
  document.head.appendChild(s);
});

// ============================================================
// 팩스 신청서 설정
// ============================================================
const FAX_CONFIG = {
  // 팩스 수신번호 (알펜시아 예약 팩스)
  faxNumber: "02-573-7376",
  // Vercel API 경로 (클라우드 기반 자동 발송)
  apiUrl: "/api/send-fax",
  // 템플릿 파일 위치 (public 폴더)
  templateUrl: "/alpensia_template.xlsx",
  // 여행사 기본 정보
  agency: { name: "초이스골프", manager: "최진우", fax: "02-545-9981" },
};

// 골프장 코드 → 신청서 표기 변환
const courseKeyToLabel = (key) => key === "prv" ? "알펜시아" : "700";
// 객실 코드 → 신청서 표기 변환 (C20), 평형 표기 (D20)
const roomTypeToLabels = (rmType) => {
  const map = {
    IC:    { place: "인터", size: "트윈" },
    HIR:   { place: "호텔", size: "트윈" },
    HIS33: { place: "콘도", size: "33평형" },
  };
  return map[rmType] || { place: rmType, size: "" };
};
// 요일 (일~토 → 한글 1자)
const dayKor = (ds) => "일월화수목금토"[new Date(ds + "T00:00:00").getDay()];

// 2026-04-20 → Excel serial date
const toExcelSerial = (ds) => {
  const d = new Date(ds + "T00:00:00");
  // Excel은 1900-01-01 = 1 (leap year 버그 포함)
  return Math.round((d.getTime() - new Date("1899-12-30T00:00:00").getTime()) / 86400000);
};

const PW = "0090";
const ADMIN_PW = "choice2026";
const RL = { IC: "인터컨티넨탈 호텔", HIR: "홀리데이인 호텔", HIS33: "홀리데이인 스위트 콘도 33평형", NONE: "호텔 없음 (골프만)" };
const rmLabel = k => RL[k] || k;
const DN = ["일", "월", "화", "수", "목", "금", "토"];
const fmt = n => (n || 0).toLocaleString();
const dow = ds => ds ? new Date(ds + "T00:00:00").getDay() : -1;
const dayType = ds => { if (SATURDAY_RATE_DATES.includes(ds)) return "saturday"; if (SUNDAY_RATE_DATES.includes(ds)) return "sunday"; const d = dow(ds); return d >= 1 && d <= 4 ? "weekday" : d === 5 ? "friday" : d === 6 ? "saturday" : "sunday"; };
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
// 그린피 일요일 요금 적용 특별 날짜 (요일 무관)
const SUNDAY_RATE_DATES = ["2026-05-01","2026-05-05","2026-05-25","2026-06-03","2026-08-17"];
// 그린피 토요일 요금 적용 특별 날짜 (요일 무관)
const SATURDAY_RATE_DATES = ["2026-08-16"];
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
  { id: "choice",   name: "초이스골프",         pw: "3791" },
  { id: "elite",    name: "엘리트골프",       pw: "4432" },
  { id: "sangsang", name: "상상로드투어",      pw: "5979" },
  { id: "golf4ppl", name: "골프와사람들",      pw: "8499" },
  { id: "si",       name: "시골프투어",        pw: "2000" },
];

const DEF = {
  alpensia: {
    name: "알펜시아 골프패키지", sub: "",
    seasons: { s1: "오픈~4/09", s2: "4/10~4/30", s3: "5/01~5/31", s4: "6/01~6/30", s5: "7/01~7/16", s6: "7/17~7/25", s7: "7/26~8/09", s8: "8/10~8/17", s9: "8/18~8/31" }, seasonCut: "2026-04-10", seasonCut2: "2026-05-01", seasonCut3: "2026-06-01", seasonCut4: "2026-07-01", seasonCut5: "2026-07-17", seasonCut6: "2026-07-26", seasonCut7: "2026-08-10", seasonCut8: "2026-08-18",
    courseNames: { pub: "700GC (대중제)", prv: "알펜시아CC (회원제)" },
    courses: {
      pub: {
        s1: { weekday: [50000, 60000], friday: [70000, 80000], saturday: [110000, 130000], sunday: [110000, 100000] },
        s2: { weekday: [60000, 70000], friday: [80000, 90000], saturday: [130000, 150000], sunday: [130000, 120000] },
        s3: { weekday: [80000, 80000], friday: [100000, 130000], saturday: [150000, 170000], sunday: [150000, 130000] },
        s4: { weekday: [80000, 90000], friday: [100000, 130000], saturday: [150000, 170000], sunday: [150000, 130000] },
        s5: { weekday: [100000, 120000], friday: [120000, 160000], saturday: [190000, 190000], sunday: [190000, 170000] },
        s6: { weekday: [120000, 140000], friday: [140000, 180000], saturday: [220000, 220000], sunday: [220000, 190000] },
        s7: { weekday: [120000, 140000], friday: [140000, 180000], saturday: [220000, 220000], sunday: [220000, 190000] },
        s8: { weekday: [120000, 140000], friday: [140000, 180000], saturday: [220000, 220000], sunday: [220000, 190000] },
        s9: { weekday: [100000, 120000], friday: [120000, 160000], saturday: [190000, 190000], sunday: [190000, 170000] },
      },
      prv: {
        s1: { weekday: [70000, 80000], friday: [80000, 90000], saturday: [130000, 140000], sunday: [130000, 120000] },
        s2: { weekday: [80000, 90000], friday: [100000, 110000], saturday: [150000, 160000], sunday: [150000, 130000] },
        s3: { weekday: [90000, 90000], friday: [110000, 140000], saturday: [160000, 180000], sunday: [160000, 140000] },
        s4: { weekday: [90000, 100000], friday: [110000, 140000], saturday: [160000, 180000], sunday: [160000, 140000] },
        s5: { weekday: [110000, 130000], friday: [140000, 180000], saturday: [220000, 220000], sunday: [220000, 190000] },
        s6: { weekday: [140000, 160000], friday: [160000, 200000], saturday: [240000, 240000], sunday: [240000, 220000] },
        s7: { weekday: [140000, 160000], friday: [160000, 200000], saturday: [240000, 240000], sunday: [240000, 220000] },
        s8: { weekday: [140000, 160000], friday: [160000, 200000], saturday: [240000, 240000], sunday: [240000, 220000] },
        s9: { weekday: [110000, 130000], friday: [140000, 180000], saturday: [220000, 220000], sunday: [220000, 190000] },
      },
    },
    rooms: {
      IC:    { s1: [100000, 140000, 140000], s2: [110000, 150000, 150000], s3: [120000, 160000, 190000], s4: [120000, 160000, 200000], s5: [120000, 160000, 190000], s6: [220000, 230000, 240000], s7: [240000, 240000, 240000], s8: [220000, 230000, 240000], s9: [140000, 160000, 190000], holiday: [220000, 230000, 240000], occ: 2 },
      HIR:   { s1: [80000,  100000, 100000], s2: [80000,  100000, 100000], s3: [100000, 120000, 150000], s4: [100000, 120000, 160000], s5: [100000, 120000, 150000], s6: [190000, 210000, 220000], s7: [200000, 200000, 200000], s8: [190000, 210000, 220000], s9: [120000, 120000, 150000], holiday: [200000, 210000, 220000], occ: 2 },
      HIS33: { s1: [80000,  140000, 140000], s2: [100000, 160000, 160000], s3: [140000, 190000, 240000], s4: [140000, 190000, 250000], s5: [140000, 190000, 240000], s6: [240000, 270000, 300000], s7: [300000, 300000, 300000], s8: [240000, 270000, 300000], s9: [160000, 190000, 240000], holiday: [240000, 270000, 300000], occ: 4 },
    },
    breakfast: { s1: 20000, s2: 20000, s3: 15000, s4: 15000, s5: 15000, s6: 15000, s7: 15000, s8: 15000, s9: 15000 }, surcharge: 20000,
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
// combo 표시 이름 변환 (pipe 형식 포함)
const comboLabel = (combo) => {
  if (!combo) return "";
  // pipe 형식: "prv|pub|prv|prv"
  if (combo.includes("|")) {
    return combo.split("|").map(c => c === "prv" ? "회원제" : "대중제").join("+");
  }
  // 구형 키 형식 직접 변환
  const map = {
    prv2:"회원제+회원제", pub2:"대중제+대중제", prv_pub:"회원제+대중제", pub_prv:"대중제+회원제",
    prv_pub_prv:"회원제+대중제+회원제", pub_prv_pub:"대중제+회원제+대중제",
    prv3:"회원제x3", pub3:"대중제x3",
    prv2_pub:"회원제+회원제+대중제", pub2_prv:"대중제+대중제+회원제",
    prv_pub2:"회원제+대중제+대중제", pub_prv2:"대중제+회원제+회원제",
    prv4:"회원제x4", pub4:"대중제x4",
    prv3_pub:"회원제+회원제+회원제+대중제", pub3_prv:"대중제+대중제+대중제+회원제",
  };
  return map[combo] || combo;
};

// combo 키 → 라운드별 코스 배열 (pipe 형식 "prv|pub|prv|prv" 도 지원)
const getCoursesFromCombo = (combo, numRounds) => {
  if (!combo) return Array(numRounds).fill("prv");
  if (combo.includes("|")) return combo.split("|").slice(0, numRounds);
  return (COMBO_COURSES[combo] || Array(numRounds).fill("prv")).slice(0, numRounds);
};

const COMBO_COURSES = {
  prv2:["prv","prv"], pub2:["pub","pub"], prv_pub:["prv","pub"], pub_prv:["pub","prv"],
  prv_pub_prv:["prv","pub","prv"], pub_prv_pub:["pub","prv","pub"],
  prv3:["prv","prv","prv"], pub3:["pub","pub","pub"],
  prv2_pub:["prv","prv","pub"], pub2_prv:["pub","pub","prv"],
  prv_pub2:["prv","pub","pub"], pub_prv2:["pub","prv","prv"],
  prv4:["prv","prv","prv","prv"], pub4:["pub","pub","pub","pub"],
  prv3_pub:["prv","prv","prv","pub"], pub3_prv:["pub","pub","pub","prv"],
  prv_pub_prv_prv:["prv","pub","prv","prv"],
  prv_prv_pub_prv:["prv","prv","pub","prv"],
  prv_prv_prv_pub:["prv","prv","prv","pub"],
  pub_prv_prv_prv:["pub","prv","prv","prv"],
  prv_pub_pub_prv:["prv","pub","pub","prv"],
  prv_pub_prv_pub:["prv","pub","prv","pub"],
  pub_prv_pub_prv:["pub","prv","pub","prv"],
  pub_pub_prv_prv:["pub","pub","prv","prv"],
  prv_prv_pub_pub:["prv","prv","pub","pub"],
  pub_prv_prv_pub:["pub","prv","prv","pub"],
  prv2_pub2:["prv","prv","pub","pub"],
  pub2_prv2:["pub","pub","prv","prv"],
};

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
  const [isAdmin, setIsAdmin] = useState(false);
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
  const [agtResTypeTab, setAgtResTypeTab] = useState("confirmed"); // confirmed | tentative
  const [agtAuthed, setAgtAuthed] = useState(null);
  const [agtPw, setAgtPw] = useState("");
  const [agtPwErr, setAgtPwErr] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [agtResLoaded, setAgtResLoaded] = useState(false);
  const [agtResLoading, setAgtResLoading] = useState(false);
  const [selRes, setSelRes] = useState(null);
  const [showTeeSur, setShowTeeSur] = useState(true);
  const [agtPage, setAgtPage] = useState(1);
  const AGT_PAGE_SIZE = 15;
  const [deletePw, setDeletePw] = useState("");
  const [deletePwErr, setDeletePwErr] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editPw, setEditPw] = useState("");
  const [editPwErr, setEditPwErr] = useState(false);
  const [showEditPw, setShowEditPw] = useState(false);
  const [resForm, setResForm] = useState({ depDate: "", repName: "", phone: "", productId: "alpensia", nights: "1박2일", combo: "prv2", teams: 1, gfPpl: 0, bfPpl: 0, bfIncluded: true, rmType: "HIS33", rmCnt1: 1, rmType2: "NONE", rmCnt2: 0, rmType3: "NONE", rmCnt3: 0, rmType4: "NONE", rmCnt4: 0, rmPpl1: 0, rmPpl2: 0, rmPpl3: 0, rmPpl4: 0, tee1: "", tee2: "", tee3: "", tee4: "", teeSur1: 0, teeSur2: 0, teeSur3: 0, teeSur4: 0, teeType1: 1, teeType2: 0, teeType3: 0, teeType4: 0, roundCourse1: "prv", roundCourse2: "prv", roundCourse3: "prv", roundCourse4: "prv", res_type: "confirmed", memo: "" });
  const [teams, setTeams] = useState(1);
  const [rmGroups, setRmGroups] = useState([{ type: "HIS33", cnt: 1, ppl: 0 }]); // 요금계산탭 객실 그룹 (ppl=0이면 자동계산)
  const [customSell, setCustomSell] = useState("");
  const [qCustomPrice, setQCustomPrice] = useState(""); // 고객 요금 직접입력
  const [qDeposit, setQDeposit] = useState("100,000");   // 예약금
  const [qManager, setQManager] = useState("최진우");   // 담당자
  const [qManagerPhone, setQManagerPhone] = useState("010-5897-1053"); // 담당자 연락처
  const [downloading, setDownloading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [qClient, setQClient] = useState("");
  const [qPhone, setQPhone] = useState("");
  const [qMemo, setQMemo] = useState("");
  const [qGroup1Label, setQGroup1Label] = useState("");  // 그룹1 라벨 (예: "2인")
  const [qGroup1Note, setQGroup1Note] = useState("");    // 그룹1 골드 태그 (예: "숙박 쿠폰 적용")
  const [qGroup2Label, setQGroup2Label] = useState("");  // 그룹2 라벨
  const [qGroup2Note, setQGroup2Note] = useState("");    // 그룹2 골드 태그
  const [qGroup2Price, setQGroup2Price] = useState("");  // 그룹2 1인 금액
  const [qTees, setQTees] = useState(["","","",""]); // 라운드별 티오프시간
  const qTee1 = qTees[0]; const qTee2 = qTees[1]; // 하위호환
  const [qAccount, setQAccount] = useState("신한은행 140-015-261327");
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
  const pkgNights = PACKAGES[pkgKey]?.nights || 1;
  const pkgRounds = PACKAGES[pkgKey]?.rounds || 2;
  // 객실 그룹 헬퍼
  const validRmGroups = (prod && rmGroups) ? rmGroups.filter(g => g.type && g.type !== "NONE" && g.cnt > 0 && prod.rooms[g.type]) : [];
  const noHotel = validRmGroups.length === 0;
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

  const season = ds => {
    if (!ds || ds < (prod?.seasonCut || "")) return "s1";
    if (ds < (prod?.seasonCut2 || "2026-05-01")) return "s2";
    if (ds < (prod?.seasonCut3 || "2026-06-01")) return "s3";
    if (ds < (prod?.seasonCut4 || "2026-07-01")) return "s4";
    if (ds < (prod?.seasonCut5 || "2026-07-17")) return "s5";
    if (ds < (prod?.seasonCut6 || "2026-07-26")) return "s6";
    if (ds < (prod?.seasonCut7 || "2026-08-10")) return "s7";
    if (ds < (prod?.seasonCut8 || "2026-08-18")) return "s8";
    return "s9";
  };
  const dv = date && date <= "2026-08-31";

  // 객실 요금 조회 (연휴/연휴전일 처리 포함)
  const getRmRate = (rmD2, ds) => {
    if (!rmD2) return 0;
    const d = dow(ds);
    const rmIdx = d === 6 ? 2 : d === 5 ? 1 : 0; // 토=2, 금=1, 주중=0
    if (isHoliday(ds) || isHolidayEve(ds)) {
      // 연휴/연휴전일: 성수기 금요일 요금 = holiday[1]
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
            // 저장값 우선 사용, 누락된 시즌(s3/s4 등)은 DEF로 fallback
            const mergeCourses = (defC, savedC) => {
              if (!defC) return savedC;
              if (!savedC) return defC;
              return Object.fromEntries(Object.entries(defC).map(([cK, defCD]) => [
                cK,
                { ...defCD, ...(savedC[cK] || {}) }
              ]));
            };
            const mergeRooms = (defR, savedR) => {
              if (!defR) return savedR;
              if (!savedR) return defR;
              return Object.fromEntries(Object.entries(defR).map(([rN, defRD]) => [
                rN,
                { ...defRD, ...(savedR[rN] || {}) }
              ]));
            };
            const mergeBreakfast = (defB, savedB) => {
              if (typeof savedB === 'object' && savedB !== null) {
                return { ...(typeof defB === 'object' ? defB : {}), ...savedB };
              }
              // 구버전 단일 숫자값(버그였음)은 무시하고 DEF 사용 - 가격 변동 방지
              return defB;
            };
            const fixed = Object.fromEntries(Object.entries(p.products).map(([k, v]) => [k, {
              ...v,
              courses: mergeCourses(DEF[k]?.courses, v.courses),
              rooms: mergeRooms(DEF[k]?.rooms, v.rooms),
              breakfast: mergeBreakfast(DEF[k]?.breakfast, v.breakfast),
              seasonCut: v.seasonCut ?? DEF[k]?.seasonCut,
              seasonCut2: v.seasonCut2 ?? DEF[k]?.seasonCut2,
              seasonCut3: v.seasonCut3 ?? DEF[k]?.seasonCut3,
              seasonCut4: v.seasonCut4 ?? DEF[k]?.seasonCut4,
              seasonCut5: v.seasonCut5 ?? DEF[k]?.seasonCut5,
              seasonCut6: v.seasonCut6 ?? DEF[k]?.seasonCut6,
              seasonCut7: v.seasonCut7 ?? DEF[k]?.seasonCut7,
              seasonCut8: v.seasonCut8 ?? DEF[k]?.seasonCut8,
              seasons: { ...(DEF[k]?.seasons || {}), ...(v.seasons || {}) },
              surcharge: v.surcharge ?? DEF[k]?.surcharge,
              sub: (DEF[k]?.sub !== undefined) ? DEF[k].sub : (v.sub || ""),
              courseIntro: DEF[k]?.courseIntro ?? v.courseIntro,
              roomIntro: DEF[k]?.roomIntro ?? v.roomIntro,
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
          rmCnt1: Number(r.rm_cnt1) || 1,
          rmType2: r.rm_type2 || "NONE",
          rmCnt2: Number(r.rm_cnt2) || 0,
          rmType3: r.rm_type3 || "NONE",
          rmCnt3: Number(r.rm_cnt3) || 0,
          rmType4: r.rm_type4 || "NONE",
          rmCnt4: Number(r.rm_cnt4) || 0,
          rmPpl1: Number(r.rm_ppl1) || 0,
          rmPpl2: Number(r.rm_ppl2) || 0,
          rmPpl3: Number(r.rm_ppl3) || 0,
          rmPpl4: Number(r.rm_ppl4) || 0,
          tee1: r.tee1 || "", tee2: r.tee2 || "", tee3: r.tee3 || "", tee4: r.tee4 || "",
          roundCourse1: (r.combo||"").includes("|") ? r.combo.split("|")[0] : "prv",
          roundCourse2: (r.combo||"").includes("|") ? r.combo.split("|")[1] : "prv",
          roundCourse3: (r.combo||"").includes("|") ? r.combo.split("|")[2] : "prv",
          roundCourse4: (r.combo||"").includes("|") ? r.combo.split("|")[3] : "prv",
          teeSur1: r.tee_sur1 || 0, teeSur2: r.tee_sur2 || 0, teeSur3: r.tee_sur3 || 0, teeSur4: r.tee_sur4 || 0,
          teeType1: r.tee_type1 ?? 1, teeType2: r.tee_type2 ?? 0, teeType3: r.tee_type3 ?? 0, teeType4: r.tee_type4 ?? 0,
          bfIncluded: r.bf_included !== false,
          bfDay1: r.bf_day1 ?? undefined,
          bfDay2: r.bf_day2 ?? undefined,
          bfDay3: r.bf_day3 ?? undefined,
          bfDay4: r.bf_day4 ?? undefined,
          gfPpl: Number(r.gf_ppl) || 0, bfPpl: Number(r.bf_ppl) || 0,
          memo: r.memo, createdAt: r.created_at,
          resType: r.res_type || "confirmed",
        })));
      })
      .catch(() => setReservations([]))
      .finally(() => { setAgtResLoaded(true); setAgtResLoading(false); });
  }, [agtAuthed]);

  // 가예약 확인날짜: 출발일 6주전 주의 월(대중제)/수(회원제)
  const getConfirmDates = (depDate, combo) => {
    if (!depDate) return [];
    const dep = new Date(depDate + "T00:00:00");
    const base = new Date(dep); base.setDate(dep.getDate() - 42);
    const baseDay = base.getDay(); // 0=일
    // 그 주의 월요일
    const monDiff = baseDay === 0 ? -6 : 1 - baseDay;
    const mon = new Date(base); mon.setDate(base.getDate() + monDiff);
    const wed = new Date(mon); wed.setDate(mon.getDate() + 2);
    const fmt = d => (d.getMonth()+1) + "/" + d.getDate() + "(" + ["일","월","화","수","목","금","토"][d.getDay()] + ")";
    const hasPub = (combo||"").includes("pub");
    const hasPrv = (combo||"").includes("prv");
    const results = [];
    if (hasPub) results.push({ label: "대중제 확인", date: fmt(mon), color: "#27ae60" });
    if (hasPrv) results.push({ label: "회원제 확인", date: fmt(wed), color: "#2980b9" });
    return results;
  };

  const calcForRes = (r) => {
    const resProd = products[r.productId || "alpensia"];
    if (!r || !resProd) return null;
    const prod = resProd;
    const date = r.depDate;
    if (!date) return null;
    const pkg = PACKAGES[r.nights] || PACKAGES["1박2일"];
    const numRounds = pkg.rounds;
    const numNights = pkg.nights;
    const ppl2 = r.teams * 4;
    const gfPpl2 = (r.gfPpl && r.gfPpl > 0) ? r.gfPpl : ppl2;
    const bfPpl2 = (r.bfPpl && r.bfPpl > 0) ? r.bfPpl : gfPpl2;

    // 라운드별 그린피 계산
    const teeNums = [r.teeSur1||0, r.teeSur2||0, r.teeSur3||0, r.teeSur4||0];
    const courseArr = getCoursesFromCombo(r.combo, numRounds);
    const gfList = Array.from({ length: numRounds }, (_, i) => {
      const ds = addDays(date, i);
      const ss = season(ds);
      const dt = dayType(ds);
      const courseKey = courseArr[i] ?? "prv";
      const course = prod.courses[courseKey];
      const teeTypeArr = [r.teeType1??1, r.teeType2??0, r.teeType3??0, r.teeType4??0];
      const teeIdx = teeTypeArr[i] ?? 0;
      const tee2Sur = (i > 0 && teeIdx === 1) ? 20000 : 0;
      const basGf = (course?.[ss]?.[dt]?.[teeIdx] || 0) + 2500 + tee2Sur;
      const sur = teeNums[i] || 0;
      return { gf: basGf + (showTeeSur ? sur : 0), sur, cn: prod.courseNames[courseKey], ds, teeIdx };
    });
    const gfTotal = gfList.reduce((s, g) => s + g.gf, 0);

    // 조식
    const ss1 = season(date);
    const bfRate2 = (prod.breakfast?.[ss1] ?? prod.breakfast) || 0;
    let bfNights2 = 0;
    if (r.bfIncluded !== false) {
      for (let i = 0; i < numNights; i++) {
        if ((gfList[i + 1]?.teeIdx ?? 0) === 0) bfNights2++;
      }
    }
    const bfPP2 = bfRate2 * bfNights2;

    // 객실 그룹 계산 - 그룹별 1인 요금 계산
    const rawGroups = [
      { type: r.rmType,  cnt: Number(r.rmCnt1)||1, ppl: Number(r.rmPpl1)||0 },
      { type: r.rmType2, cnt: Number(r.rmCnt2)||0, ppl: Number(r.rmPpl2)||0 },
      { type: r.rmType3, cnt: Number(r.rmCnt3)||0, ppl: Number(r.rmPpl3)||0 },
      { type: r.rmType4, cnt: Number(r.rmCnt4)||0, ppl: Number(r.rmPpl4)||0 },
    ];
    const rmGroupsData = rawGroups
      .filter(g => g.type && g.type !== "NONE" && g.cnt > 0 && prod.rooms[g.type])
      .map(g => {
        const rmDg = prod.rooms[g.type];
        const occ = rmDg.occ || 4;
        const effectivePpl = (g.ppl && g.ppl > 0) ? g.ppl : g.cnt * occ;
        let rmPP = 0;
        const nightlyRates = [];
        for (let i = 0; i < numNights; i++) {
          const ds = addDays(date, i);
          const rate = getRmRate(rmDg, ds); // 1실당 요금
          const nightTotal = rate * g.cnt;  // 그 밤 전체 요금 (실수 × 실당 요금)
          const perPerson = effectivePpl > 0 ? Math.ceil(nightTotal / effectivePpl) : 0;
          nightlyRates.push({ date: ds, rate, nightTotal, perPerson });
          rmPP += (rate * g.cnt) / effectivePpl;
        }
        rmPP = Math.ceil(rmPP);
        return { type: g.type, cnt: g.cnt, occ, ppl: g.ppl||0, groupPpl: effectivePpl, rmPP, label: rmLabel(g.type), sellPP: gfTotal + rmPP + bfPP2, nightlyRates };
      });

    const noHotel2 = rmGroupsData.length === 0;
    const rmPP2 = noHotel2 ? 0 : rmGroupsData[0].rmPP;
    const costPP2 = gfTotal + rmPP2 + bfPP2;
    const totalAgt = rmGroupsData.length > 0
      ? (gfTotal * gfPpl2) + (bfPP2 * bfPpl2) + rmGroupsData.reduce((s, g) => s + g.rmPP * g.groupPpl, 0)
      : (gfTotal * gfPpl2) + (bfPP2 * bfPpl2);

    const gf1 = gfList[0]?.gf || 0;
    const gf2 = gfList[1]?.gf || 0;
    const cn1 = gfList[0]?.cn || "";
    const cn2 = gfList[1]?.cn || "";

    return { gf1, gf2, gfList, gfTotal, rmPP: rmPP2, rmGroupsData, bfPP: bfPP2, bfNights: bfNights2,
             costPP: costPP2, sellPP: costPP2, totalAgt, ppl: ppl2, gfPpl: gfPpl2, bfPpl: bfPpl2,
             cn1, cn2, teeSur1: r.teeSur1||0, teeSur2: r.teeSur2||0, numRounds, numNights, noHotel: noHotel2,
             courseArr: getCoursesFromCombo(r.combo, numRounds) };
  };

  // ================================================================
  // 팩스 신청서 워크북 생성 (템플릿 기반 - 서식 100% 유지)
  // ================================================================
  const buildFaxWorkbook = async (r, inv) => {
    const ExcelJS = await loadExcelJS();
    const resp = await fetch(FAX_CONFIG.templateUrl);
    if (!resp.ok) throw new Error("템플릿 파일 로드 실패: " + FAX_CONFIG.templateUrl);
    const buf = await resp.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet("예약신청서") || wb.worksheets[0];

    const setV = (addr, v) => { ws.getCell(addr).value = v; };

    // 공유수식 셀 초기화 (템플릿의 수식 충돌 방지)
    ["K13","K14","J21","J22"].forEach(a => setV(a, 0));

    // 여행사 + 신청일
    setV("B5", FAX_CONFIG.agency.name);
    setV("B6", FAX_CONFIG.agency.manager);
    setV("G6", FAX_CONFIG.agency.fax);
    const today = new Date();
    setV("H5", today.getMonth() + 1);
    setV("J5", today.getDate());

    // 예약자 정보
    setV("B7", r.repName || "");
    setV("G7", r.phone || "");

    // 골프 예약 (최대 4라운드, 행 11~14)
    // ※ 팩스는 알펜시아에 원가만 전송 - 커미션 2,500원/인/라운드 차감
    const COMMISSION = 2500;
    const ppl = r.teams * 4;
    const roundRows = [11, 12, 13, 14];
    const teeTimes = [r.tee1, r.tee2, r.tee3, r.tee4];
    const bfDays = [r.bfDay1, r.bfDay2, r.bfDay3, r.bfDay4];
    // 1박당 조식 단가 계산
    const bfUnit = (inv.bfNights > 0 && inv.bfPP > 0) ? Math.round(inv.bfPP / inv.bfNights) : 0;
    let golfTotal = 0;
    for (let i = 0; i < inv.gfList.length && i < 4; i++) {
      const g = inv.gfList[i];
      const row = roundRows[i];
      const courseLabel = courseKeyToLabel(inv.courseArr[i] || "prv");
      const teeTime = teeTimes[i] || "";
      // 홀딩시간: 티오프 시간만 표기 (부 표시 제거)
      const holdingLabel = teeTime;
      // 조식 포함 여부: 일차별 설정 우선, 없으면 자동 (1부 AND i>0 AND bfIncluded)
      const autoBf = g.teeIdx === 0 && i > 0 && r.bfIncluded !== false;
      const hasBf = bfDays[i] !== undefined && bfDays[i] !== null ? !!bfDays[i] : autoBf;
      // 팩스용 그린피 (원가) = 계산된 그린피 - 커미션
      const gfOriginal = Math.max(0, g.gf - COMMISSION);
      setV("A" + row, toExcelSerial(g.ds));
      setV("B" + row, dayKor(g.ds));
      setV("C" + row, courseLabel);
      setV("D" + row, r.teams);
      setV("E" + row, ppl);
      setV("F" + row, holdingLabel);
      setV("H" + row, gfOriginal);
      let rowTotal;
      if (hasBf && bfUnit > 0) {
        setV("J" + row, bfUnit);
        rowTotal = ppl * (gfOriginal + bfUnit);
      } else {
        rowTotal = ppl * gfOriginal;
      }
      setV("K" + row, rowTotal);
      golfTotal += rowTotal;
    }

    // 골프 총 금액 (J15) = 모든 라운드 합계 (커미션 제외)
    setV("J15", golfTotal);

    // 객실 예약 (행 20~22) - 그룹 순서 → 그룹 내 밤 순서로 펼치기
    const rmRows = [20, 21, 22];
    const rmGroups = inv.rmGroupsData || [];
    const rmRowsData = [];
    for (const g of rmGroups) {
      const { place, size } = roomTypeToLabels(g.type);
      for (const n of (g.nightlyRates || [])) {
        rmRowsData.push({
          date: n.date,
          place,
          size,
          cnt: g.cnt,
          rate: n.rate,           // 1실당 요금
          nightTotal: n.nightTotal, // 그 밤 총액 (실수 × 실당)
        });
      }
    }
    // 템플릿 행 3개까지 표시
    let displayedRoomTotal = 0;
    for (let i = 0; i < rmRowsData.length && i < 3; i++) {
      const d = rmRowsData[i];
      const row = rmRows[i];
      setV("A" + row, toExcelSerial(d.date));
      setV("B" + row, dayKor(d.date));
      setV("C" + row, d.place);
      setV("D" + row, d.size);
      setV("F" + row, d.cnt);
      setV("G" + row, d.rate);          // 1실당 요금
      setV("J" + row, d.nightTotal);    // 그 밤 총액
      displayedRoomTotal += d.nightTotal;
    }
    // 초과 행 제거 (빈 행)
    for (let i = rmRowsData.length; i < 3; i++) {
      const row = rmRows[i];
      setV("A" + row, "");
      setV("B" + row, "");
      setV("C" + row, "");
      setV("D" + row, "");
      setV("F" + row, "");
      setV("G" + row, "");
      setV("J" + row, 0);
    }
    // 총 객실 요금 = 모든 밤 × 모든 그룹 합계 (3행 초과분 포함)
    const fullRoomTotal = rmRowsData.reduce((s, d) => s + d.nightTotal, 0);
    setV("J23", fullRoomTotal);

    // 총 합계
    setV("J26", golfTotal + fullRoomTotal);

    return wb;
  };

  // 파일명 생성: "YYMMDD 대표자 신청서.xlsx"
  const buildFaxFilename = (r) => {
    const d = new Date(r.depDate + "T00:00:00");
    const yymmdd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    return `${yymmdd} ${r.repName || "고객"} 신청서.xlsx`;
  };

  // 📥 신청서 xlsx 다운로드
  const downloadFaxXlsx = async () => {
    try {
      const r = selRes;
      const inv = calcForRes(r);
      if (!r || !inv) { alert("예약 정보를 불러올 수 없습니다."); return; }
      const wb = await buildFaxWorkbook(r, inv);
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildFaxFilename(r);
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("다운로드 오류: " + e.message);
    }
  };

  // 📠 팩스 자동발송 (Vercel API → CloudConvert → Solapi)
  const sendFaxNow = async () => {
    try {
      const r = selRes;
      const inv = calcForRes(r);
      if (!r || !inv) { alert("예약 정보를 불러올 수 없습니다."); return; }

      if (!window.confirm(`📠 팩스를 발송합니다.\n\n수신: ${FAX_CONFIG.faxNumber}\n예약: ${r.repName} / ${r.depDate}\n\n계속하시겠습니까?`)) return;

      // 로딩 표시
      const loadingMsg = "📠 팩스 발송 중입니다...\n엑셀 생성 → PDF 변환 → 전송 (30~50초 소요)\n\n잠시 기다려주세요!";
      const loading = document.createElement("div");
      loading.id = "fax-loading";
      loading.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;white-space:pre-line;text-align:center;padding:20px;";
      loading.textContent = loadingMsg;
      document.body.appendChild(loading);

      try {
        // 워크북 생성 → base64 (대용량 대응: FileReader 사용)
        const wb = await buildFaxWorkbook(r, inv);
        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf]);
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(new Error("base64 변환 실패"));
          reader.readAsDataURL(blob);
        });
        const filename = buildFaxFilename(r);

        const resp = await fetch(FAX_CONFIG.apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ xlsx_base64: base64, fax_number: FAX_CONFIG.faxNumber, filename }),
        });
        const data = await resp.json();
        if (data.ok) {
          alert(`✅ 팩스 발송 완료\n\n수신: ${data.to}\nFile ID: ${data.fileId}`);
        } else {
          alert(`⚠️ 발송 실패\n\n${data.error || "알 수 없는 오류"}`);
        }
      } finally {
        const el = document.getElementById("fax-loading");
        if (el) el.remove();
      }
    } catch (e) {
      const el = document.getElementById("fax-loading");
      if (el) el.remove();
      alert("팩스 발송 오류: " + e.message);
    }
  };

  const COMBO_LABEL = {
    // 1박2일 (2라운드)
    prv2: "회원제+회원제", pub2: "대중제+대중제",
    prv_pub: "회원제+대중제", pub_prv: "대중제+회원제",
    // 2박3일 (3라운드)
    prv3: "회원제x3", pub3: "대중제x3",
    prv2_pub: "회원제+회원제+대중제", pub2_prv: "대중제+대중제+회원제",
    prv_pub2: "회원제+대중제+대중제", pub_prv2: "대중제+회원제+회원제",
    prv_pub_prv: "회원제+대중제+회원제", pub_prv_pub: "대중제+회원제+대중제",
    // 3박4일 (4라운드)
    prv4: "회원제x4", pub4: "대중제x4",
    prv3_pub: "회원제+회원제+회원제+대중제",
    pub3_prv: "대중제+대중제+대중제+회원제",
    prv_pub_prv_prv: "회원제+대중제+회원제+회원제",
    prv_prv_pub_prv: "회원제+회원제+대중제+회원제",
    prv_prv_prv_pub: "회원제+회원제+회원제+대중제",
    pub_prv_prv_prv: "대중제+회원제+회원제+회원제",
    prv_pub_pub_prv: "회원제+대중제+대중제+회원제",
    prv_pub_prv_pub: "회원제+대중제+회원제+대중제",
    pub_prv_pub_prv: "대중제+회원제+대중제+회원제",
    pub_pub_prv_prv: "대중제+대중제+회원제+회원제",
    prv_prv_pub_pub: "회원제+회원제+대중제+대중제",
    pub_prv_prv_pub: "대중제+회원제+회원제+대중제",
    prv2_pub2: "회원제+회원제+대중제+대중제",
    pub2_prv2: "대중제+대중제+회원제+회원제",
  };

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
    try {
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
      const numNightsForDate = ({"1박2일":1,"2박3일":2,"3박4일":3})[r.nights] || 1;
      const d2date = r.depDate ? addDays(r.depDate, numNightsForDate) : "";
      return (
        <div style={sc}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
            <button onClick={() => { setAgtTab("list"); setSelRes(null); setShowDeleteConfirm(false); setDeletePw(""); setDeletePwErr(false); }} style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: "13px", whiteSpace: "nowrap" }}>← 목록</button>
            <div style={{ fontSize: "16px", fontWeight: "800", color: G.primary, whiteSpace: "nowrap" }}>📄 인보이스</div>
            <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: G.textMid, cursor: "pointer", marginLeft: "4px", whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={showTeeSur} onChange={e => setShowTeeSur(e.target.checked)} style={{ accentColor: G.primary }} />
              시간추가금
            </label>
            <button onClick={doAgtDownload} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: "8px", border: "none", background: "#d32f2f", color: "#fff", fontWeight: "800", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" }}>📸 JPG 저장</button>
            <button onClick={() => {
              // 🆕 실수 방지: 마스터 비밀번호(사장님 전용) 확인 후 다운로드
              const pw = window.prompt("📥 신청서 xlsx 다운로드\n\n비밀번호를 입력하세요:");
              if (pw === null) return; // 취소
              if (pw !== "3791") { alert("❌ 비밀번호가 틀렸습니다."); return; }
              downloadFaxXlsx();
            }} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid " + G.primary, background: "#fff", color: G.primary, fontWeight: "700", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" }}>📥 신청서 xlsx</button>
            <button onClick={() => {
              // 🆕 실수 방지: 마스터 비밀번호(사장님 전용) 확인 후 팩스 발송
              const pw = window.prompt("📠 팩스 발송\n\n실제로 팩스가 발송됩니다.\n비밀번호를 입력하세요:");
              if (pw === null) return; // 취소
              if (pw !== "3791") { alert("❌ 비밀번호가 틀렸습니다."); return; }
              sendFaxNow();
            }} style={{ padding: "8px 14px", borderRadius: "8px", border: "none", background: "#2e7d52", color: "#fff", fontWeight: "800", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" }}>📠 팩스발송</button>
            {(selRes?.resType||"confirmed") === "tentative" && (
              <button onClick={() => {
                if (!window.confirm("확정예약으로 변경하시겠습니까?")) return;
                sbFetch("PATCH", "reservations?id=eq." + selRes.id, { res_type: "confirmed" })
                  .then(() => {
                    const updated = { ...selRes, resType: "confirmed" };
                    setReservations(p => p.map(r => r.id === selRes.id ? updated : r));
                    setSelRes(updated);
                    alert("확정예약으로 변경되었습니다!");
                  }).catch(e => alert("오류: " + e.message));
              }} style={{ padding: "8px 12px", borderRadius: "8px", border: "none", background: G.primary, color: "#fff", fontWeight: "800", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" }}>✅ 확정으로 변경</button>
            )}
            <button onClick={() => { setShowEditPw(true); setEditPw(""); setEditPwErr(false); setEditMode(false); }}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid " + G.primary, background: "#fff", color: G.primary, fontWeight: "700", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" }}>✏️ 수정</button>
            <button onClick={() => { setShowDeleteConfirm(true); setDeletePw(""); setDeletePwErr(false); }}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e74c3c", background: "#fff", color: "#e74c3c", fontWeight: "700", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" }}>🗑 삭제</button>
          </div>

          {/* 수정 비밀번호 확인 */}
          {showEditPw && !editMode && (
            <div style={{ marginBottom: "16px", padding: "16px", background: "#f0f7f3", borderRadius: "10px", border: "1px solid " + G.border }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: G.primary, marginBottom: "10px" }}>✏️ 수정하려면 비밀번호를 입력하세요</div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="password" maxLength={8} value={editPw}
                  onChange={e => { setEditPw(e.target.value); setEditPwErr(false); }}
                  onKeyDown={e => { if (e.key === "Enter") { if (editPw === agtAuthed?.pw) { setEditMode(true); setShowEditPw(false); setResForm({...selRes, depDate: selRes.depDate, productId: selRes.productId||"alpensia", res_type: selRes.resType||"confirmed"}); setAgtTab("edit"); } else setEditPwErr(true); }}}
                  placeholder="비밀번호 입력"
                  style={{ ...inp, width: "160px", letterSpacing: "4px", fontSize: "16px", textAlign: "center" }} />
                <button onClick={() => { if (editPw === agtAuthed?.pw) { setEditMode(true); setShowEditPw(false); setResForm({...selRes, productId: selRes.productId||"alpensia", res_type: selRes.resType||"confirmed"}); setAgtTab("edit"); } else setEditPwErr(true); }}
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
                  ["종료일", d2date ? fmtD(d2date) : "-"],
                  ["골프장", PRODUCT_LIST.find(p => p.id === (r.productId || "alpensia"))?.name || "-"],
                  ["대표자", r.repName || "-"],
                  ["연락처", r.phone || "-"],
                  ["상품", comboLabel(r.combo)],
                  ["박수", r.nights],
                  ["팀수", r.teams + "팀 (" + (inv?.ppl || 0) + "인)"],
                  ["객실", (() => { const gs = [{t:r.rmType,c:r.rmCnt1||1},{t:r.rmType2,c:r.rmCnt2},{t:r.rmType3,c:r.rmCnt3},{t:r.rmType4,c:r.rmCnt4}].filter(g=>g.t&&g.t!=="NONE"&&g.c>0); return gs.length===0?"호텔 없음":gs.map(g=>rmLabel(g.t)+" "+g.c+"실").join(" + "); })()],
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
                    {(inv.rmGroupsData||[]).length > 0
                      ? (inv.rmGroupsData||[]).flatMap((g, gi) =>
                          (g.nightlyRates || []).map((n, ni) => (
                            <tr key={`${gi}-${ni}`} style={{ borderBottom: "1px solid #f0f0f0" }}>
                              <td style={{ padding: "6px 4px", color: "#555", fontSize: "13px" }}>🏨 {fmtD(n.date)} {g.label} {g.cnt}실 ({g.groupPpl}명) - ₩{fmt(n.nightTotal)}</td>
                              <td style={{ padding: "6px 4px", textAlign: "right" }}>₩{fmt2(n.perPerson)}</td>
                            </tr>
                          ))
                        )
                      : inv.rmPP > 0 && (
                          <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                            <td style={{ padding: "6px 4px", color: "#555", fontSize: "13px" }}>🏨 객실 ÷ {inv.ppl}인</td>
                            <td style={{ padding: "6px 4px", textAlign: "right" }}>₩{fmt2(inv.rmPP)}</td>
                          </tr>
                        )
                    }
                    {inv.bfPP > 0 && (
                      <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "6px 4px", color: "#555", fontSize: "13px" }}>🥐 조식({inv.bfNights ?? inv.numNights}박) × {inv.bfPpl}인</td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>₩{fmt2(inv.bfPP)}</td>
                      </tr>
                    )}
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
            { label: "팀 수", node: <select style={inp} value={resForm.teams} onChange={e => setResForm(p => ({...p, teams: parseInt(e.target.value)}))}>{[1,2,3,4,5].map(v => <option key={v} value={v}>{v}팀 ({v*4}인)</option>)}</select> },
            { label: "객실 구성", node: (<div>
                {[
                  {tk:"rmType",ck:"rmCnt1"},{tk:"rmType2",ck:"rmCnt2"},
                  {tk:"rmType3",ck:"rmCnt3"},{tk:"rmType4",ck:"rmCnt4"},
                ].map(({tk,ck},ri) => (
                  <div key={ri} style={{ display:"flex", gap:"6px", alignItems:"center", marginBottom:"6px" }}>
                    <span style={{ fontSize:"11px", color:"#888", minWidth:"20px", fontWeight:"700" }}>{ri+1}</span>
                    <select style={{ ...inp, flex:2, fontSize:"12px", padding:"8px 6px" }} value={resForm[tk]||"NONE"} onChange={e => {
                        const newType = e.target.value;
                        const occ2 = prod?.rooms[newType]?.occ||4;
                        const defCnt = newType !== "NONE" ? resForm.teams*(occ2===4?1:2) : 0;
                        setResForm(p => ({...p, [tk]: newType, [ck]: defCnt}));
                      }}>
                      <option value="NONE">{ri===0?"선택":"없음"}</option>
                      {[["HIS33","콘도 33평(4인1실)"],["HIR","홀리데이인 호텔(2인1실)"],["IC","인터컨티넨탈(2인1실)"]].map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {(resForm[tk] && resForm[tk] !== "NONE") && (() => {
                      const pk2 = ["rmPpl1","rmPpl2","rmPpl3","rmPpl4"][ri];
                      const occ2 = prod?.rooms[resForm[tk]]?.occ||4;
                      const defCnt = resForm.teams*(occ2===4?1:2);
                      const effPpl = (resForm[pk2]&&resForm[pk2]>0)?resForm[pk2]:(resForm[ck]||defCnt)*occ2;
                      return (<>
                        <input type="number" min={1} style={{ ...inp, width:"48px", textAlign:"center", padding:"8px 4px" }} value={resForm[ck]||defCnt} onChange={e => setResForm(p => ({...p, [ck]: parseInt(e.target.value)||1}))} />
                        <span style={{ fontSize:"11px", color:"#888" }}>실</span>
                        <input type="number" min={1} style={{ ...inp, width:"56px", textAlign:"center", padding:"8px 4px" }} value={resForm[pk2]||""} placeholder={String(effPpl)+"명"} onChange={e => setResForm(p => ({...p, [pk2]: parseInt(e.target.value)||0}))} />
                        <span style={{ fontSize:"11px", color:"#888" }}>명</span>
                      </>);
                    })()}
                  </div>
                ))}
              </div>) },
            { fullWidth: true, label: "라운드별 구성 (일차 / 시간 / 부 / 코스 / 조식 / 추가금)", node: (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {Array.from({length: PACKAGES[resForm.nights]?.rounds||2}, (_, i) => {
                  const tk = "tee"+(i+1);
                  const rcKey = "roundCourse"+(i+1);
                  const ttKey = "teeType"+(i+1);
                  const surKey = "teeSur"+(i+1);
                  const bfKey = "bfDay"+(i+1);
                  const rc = resForm[rcKey] || "prv";
                  const tt = resForm[ttKey] ?? (i===0?1:0);
                  // 조식 기본값: 첫날 X, 이후 1부면 O (수동 override 가능)
                  const autoBf = i > 0 && tt === 0 && resForm.bfIncluded !== false;
                  const bfChecked = resForm[bfKey] !== undefined ? !!resForm[bfKey] : autoBf;
                  const updateCombo = (newRc) => {
                    const arr = Array.from({length: PACKAGES[resForm.nights]?.rounds||2}, (_, j) => j===i ? newRc : (resForm["roundCourse"+(j+1)] || "prv"));
                    return { [rcKey]: newRc, combo: arr.join("|") };
                  };
                  return (
                    <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center", padding: "10px", background: G.lighter, border: "1px solid "+G.border, borderRadius: "8px", flexWrap: "wrap" }}>
                      <div style={{ minWidth: "48px", fontSize: "13px", fontWeight: "800", color: G.primary }}>{i+1}일차</div>
                      <input style={{ ...inp, width: "85px", padding: "8px 6px", textAlign: "center" }} type="text" value={resForm[tk]||""} onChange={e => setResForm(p => ({...p, [tk]: e.target.value}))} placeholder={i===0?"14:00":"07:00"} />
                      <select style={{ ...inp, width: "64px", padding: "8px 4px" }} value={tt} onChange={e => setResForm(p => ({...p, [ttKey]: parseInt(e.target.value)}))}>
                        <option value={0}>1부</option>
                        <option value={1}>2부</option>
                      </select>
                      <button type="button" onClick={() => setResForm(p => ({...p, ...updateCombo("prv")}))} style={{ padding: "7px 10px", borderRadius: "6px", border: "2px solid "+(rc==="prv"?"#2980b9":"#ddd"), background: rc==="prv"?"#ebf5fb":"#fff", color: rc==="prv"?"#2980b9":"#aaa", fontWeight: "800", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}>회원</button>
                      <button type="button" onClick={() => setResForm(p => ({...p, ...updateCombo("pub")}))} style={{ padding: "7px 10px", borderRadius: "6px", border: "2px solid "+(rc==="pub"?"#27ae60":"#ddd"), background: rc==="pub"?"#eafaf1":"#fff", color: rc==="pub"?"#27ae60":"#aaa", fontWeight: "800", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}>대중</button>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", padding: "6px 8px", borderRadius: "6px", background: bfChecked ? "#eafaf1" : "#fafafa", border: "1px solid " + (bfChecked ? "#27ae60" : "#eee") }}>
                        <input type="checkbox" checked={bfChecked} onChange={e => setResForm(p => ({...p, [bfKey]: e.target.checked}))} style={{ width: "14px", height: "14px", accentColor: G.primary, cursor: "pointer" }} />
                        <span style={{ fontSize: "12px", fontWeight: "700", color: bfChecked?"#27ae60":"#888" }}>조식</span>
                      </label>
                      <input style={{ ...inp, width: "100px", padding: "8px 6px", textAlign: "right" }} type="number" value={resForm[surKey]||""} onChange={e => setResForm(p => ({...p, [surKey]: parseInt(e.target.value)||0}))} placeholder="추가금" />
                    </div>
                  );
                })}
              </div>
            )},
            { label: "그린피 인원 (비워두면 팀수x4)", node: <input style={inp} type="number" value={resForm.gfPpl||""} onChange={e => setResForm(p => ({...p, gfPpl: Number(e.target.value)||0}))} placeholder={String(resForm.teams*4)+"명 (자동)"} /> },
            { label: "예약 유형", node: (
              <div style={{ display: "flex", gap: "8px" }}>
                {[["confirmed","✅ 확정예약"],["tentative","📋 가예약"]].map(([k,l]) => (
                  <button key={k} type="button" onClick={() => setResForm(p => ({...p, res_type: k}))} style={{ flex:1, padding:"10px", borderRadius:"8px", border:"none", fontWeight:"700", fontSize:"12px", cursor:"pointer", background: resForm.res_type===k ? G.primary : "#f0f0f0", color: resForm.res_type===k ? "#fff" : "#888" }}>{l}</button>
                ))}
              </div>
            ) },
            { label: "메모", node: <input style={inp} value={resForm.memo||""} onChange={e => setResForm(p => ({...p, memo: e.target.value}))} placeholder="특이사항" /> },
          ].map(({ label, node, fullWidth }, idx) => (
            <div key={idx} style={fullWidth ? { gridColumn: "1 / -1" } : {}}><label style={{ fontSize: "12px", fontWeight: "700", color: "#555", display: "block", marginBottom: "4px" }}>{label}</label>{node}</div>
          ))}
        </div>
        <button onClick={() => {
          if (!resForm.depDate || !resForm.repName) return alert("출발일과 대표자명은 필수입니다.");
          sbFetch("PATCH", "reservations?id=eq." + selRes.id, {
            dep_date: resForm.depDate, rep_name: resForm.repName, phone: resForm.phone,
            product_id: resForm.productId||"alpensia", nights: resForm.nights, combo: resForm.combo,
            teams: resForm.teams, rm_type: resForm.rmType, rm_cnt1: resForm.rmCnt1||1, rm_type2: resForm.rmType2||"NONE", rm_cnt2: resForm.rmCnt2||0, rm_type3: resForm.rmType3||"NONE", rm_cnt3: resForm.rmCnt3||0, rm_type4: resForm.rmType4||"NONE", rm_cnt4: resForm.rmCnt4||0, rm_ppl1: resForm.rmPpl1||0, rm_ppl2: resForm.rmPpl2||0, rm_ppl3: resForm.rmPpl3||0, rm_ppl4: resForm.rmPpl4||0,
            tee1: resForm.tee1||"", tee2: resForm.tee2||"", tee3: resForm.tee3||"", tee4: resForm.tee4||"",
            tee_sur1: resForm.teeSur1||0, tee_sur2: resForm.teeSur2||0, tee_sur3: resForm.teeSur3||0, tee_sur4: resForm.teeSur4||0,
            tee_type1: resForm.teeType1??1, tee_type2: resForm.teeType2??0, tee_type3: resForm.teeType3??0, tee_type4: resForm.teeType4??0,
            gf_ppl: Number(resForm.gfPpl)||0, bf_ppl: Number(resForm.bfPpl)||0, bf_included: resForm.bfIncluded !== false,
            bf_day1: resForm.bfDay1 ?? null, bf_day2: resForm.bfDay2 ?? null, bf_day3: resForm.bfDay3 ?? null, bf_day4: resForm.bfDay4 ?? null,
            memo: resForm.memo||"", res_type: resForm.res_type||"confirmed"
          }).then(() => {
            const updated = { ...selRes, ...resForm,
              depDate: resForm.depDate, repName: resForm.repName, phone: resForm.phone,
              productId: resForm.productId||"alpensia", nights: resForm.nights, combo: resForm.combo,
              teams: resForm.teams, rmType: resForm.rmType, rmCnt1: resForm.rmCnt1||1, rmType2: resForm.rmType2||"NONE", rmCnt2: resForm.rmCnt2||0, rmType3: resForm.rmType3||"NONE", rmCnt3: resForm.rmCnt3||0, rmType4: resForm.rmType4||"NONE", rmCnt4: resForm.rmCnt4||0,
              tee1: resForm.tee1||"", tee2: resForm.tee2||"", tee3: resForm.tee3||"", tee4: resForm.tee4||"",
              teeSur1: resForm.teeSur1||0, teeSur2: resForm.teeSur2||0, teeSur3: resForm.teeSur3||0, teeSur4: resForm.teeSur4||0,
              teeType1: resForm.teeType1??1, teeType2: resForm.teeType2??0, teeType3: resForm.teeType3??0, teeType4: resForm.teeType4??0,
              bfIncluded: resForm.bfIncluded !== false,
              gfPpl: Number(resForm.gfPpl)||0, bfPpl: Number(resForm.bfPpl)||0, memo: resForm.memo||"", resType: resForm.res_type||"confirmed" };
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
            { label: "팀 수", node: <select style={inp} value={resForm.teams} onChange={e => setResForm(p => ({...p, teams: parseInt(e.target.value)}))}>{[1,2,3,4,5].map(v => <option key={v} value={v}>{v}팀 ({v*4}인)</option>)}</select> },
            { label: "객실 구성", node: (<div>
                {[
                  {tk:"rmType",ck:"rmCnt1"},{tk:"rmType2",ck:"rmCnt2"},
                  {tk:"rmType3",ck:"rmCnt3"},{tk:"rmType4",ck:"rmCnt4"},
                ].map(({tk,ck},ri) => (
                  <div key={ri} style={{ display:"flex", gap:"6px", alignItems:"center", marginBottom:"6px" }}>
                    <span style={{ fontSize:"11px", color:"#888", minWidth:"20px", fontWeight:"700" }}>{ri+1}</span>
                    <select style={{ ...inp, flex:2, fontSize:"12px", padding:"8px 6px" }} value={resForm[tk]||"NONE"} onChange={e => {
                        const newType = e.target.value;
                        const occ2 = prod?.rooms[newType]?.occ||4;
                        const defCnt = newType !== "NONE" ? resForm.teams*(occ2===4?1:2) : 0;
                        setResForm(p => ({...p, [tk]: newType, [ck]: defCnt}));
                      }}>
                      <option value="NONE">{ri===0?"선택":"없음"}</option>
                      {[["HIS33","콘도 33평(4인1실)"],["HIR","홀리데이인 호텔(2인1실)"],["IC","인터컨티넨탈(2인1실)"]].map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {(resForm[tk] && resForm[tk] !== "NONE") && (() => {
                      const pk2 = ["rmPpl1","rmPpl2","rmPpl3","rmPpl4"][ri];
                      const occ2 = prod?.rooms[resForm[tk]]?.occ||4;
                      const defCnt = resForm.teams*(occ2===4?1:2);
                      const effPpl = (resForm[pk2]&&resForm[pk2]>0)?resForm[pk2]:(resForm[ck]||defCnt)*occ2;
                      return (<>
                        <input type="number" min={1} style={{ ...inp, width:"48px", textAlign:"center", padding:"8px 4px" }} value={resForm[ck]||defCnt} onChange={e => setResForm(p => ({...p, [ck]: parseInt(e.target.value)||1}))} />
                        <span style={{ fontSize:"11px", color:"#888" }}>실</span>
                        <input type="number" min={1} style={{ ...inp, width:"56px", textAlign:"center", padding:"8px 4px" }} value={resForm[pk2]||""} placeholder={String(effPpl)+"명"} onChange={e => setResForm(p => ({...p, [pk2]: parseInt(e.target.value)||0}))} />
                        <span style={{ fontSize:"11px", color:"#888" }}>명</span>
                      </>);
                    })()}
                  </div>
                ))}
              </div>) },
            { fullWidth: true, label: "라운드별 구성 (일차 / 시간 / 부 / 코스 / 조식 / 추가금)", node: (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {Array.from({length: PACKAGES[resForm.nights]?.rounds||2}, (_, i) => {
                  const tk = "tee"+(i+1);
                  const rcKey = "roundCourse"+(i+1);
                  const ttKey = "teeType"+(i+1);
                  const surKey = "teeSur"+(i+1);
                  const bfKey = "bfDay"+(i+1);
                  const rc = resForm[rcKey] || "prv";
                  const tt = resForm[ttKey] ?? (i===0?1:0);
                  const autoBf = i > 0 && tt === 0 && resForm.bfIncluded !== false;
                  const bfChecked = resForm[bfKey] !== undefined ? !!resForm[bfKey] : autoBf;
                  const updateCombo = (newRc) => {
                    const arr = Array.from({length: PACKAGES[resForm.nights]?.rounds||2}, (_, j) => j===i ? newRc : (resForm["roundCourse"+(j+1)] || "prv"));
                    return { [rcKey]: newRc, combo: arr.join("|") };
                  };
                  return (
                    <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center", padding: "10px", background: G.lighter, border: "1px solid "+G.border, borderRadius: "8px", flexWrap: "wrap" }}>
                      <div style={{ minWidth: "48px", fontSize: "13px", fontWeight: "800", color: G.primary }}>{i+1}일차</div>
                      <input style={{ ...inp, width: "85px", padding: "8px 6px", textAlign: "center" }} type="text" value={resForm[tk]||""} onChange={e => setResForm(p => ({...p, [tk]: e.target.value}))} placeholder={i===0?"14:00":"07:00"} />
                      <select style={{ ...inp, width: "64px", padding: "8px 4px" }} value={tt} onChange={e => setResForm(p => ({...p, [ttKey]: parseInt(e.target.value)}))}>
                        <option value={0}>1부</option>
                        <option value={1}>2부</option>
                      </select>
                      <button type="button" onClick={() => setResForm(p => ({...p, ...updateCombo("prv")}))} style={{ padding: "7px 10px", borderRadius: "6px", border: "2px solid "+(rc==="prv"?"#2980b9":"#ddd"), background: rc==="prv"?"#ebf5fb":"#fff", color: rc==="prv"?"#2980b9":"#aaa", fontWeight: "800", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}>회원</button>
                      <button type="button" onClick={() => setResForm(p => ({...p, ...updateCombo("pub")}))} style={{ padding: "7px 10px", borderRadius: "6px", border: "2px solid "+(rc==="pub"?"#27ae60":"#ddd"), background: rc==="pub"?"#eafaf1":"#fff", color: rc==="pub"?"#27ae60":"#aaa", fontWeight: "800", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}>대중</button>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", padding: "6px 8px", borderRadius: "6px", background: bfChecked ? "#eafaf1" : "#fafafa", border: "1px solid " + (bfChecked ? "#27ae60" : "#eee") }}>
                        <input type="checkbox" checked={bfChecked} onChange={e => setResForm(p => ({...p, [bfKey]: e.target.checked}))} style={{ width: "14px", height: "14px", accentColor: G.primary, cursor: "pointer" }} />
                        <span style={{ fontSize: "12px", fontWeight: "700", color: bfChecked?"#27ae60":"#888" }}>조식</span>
                      </label>
                      <input style={{ ...inp, width: "100px", padding: "8px 6px", textAlign: "right" }} type="number" value={resForm[surKey]||""} onChange={e => setResForm(p => ({...p, [surKey]: parseInt(e.target.value)||0}))} placeholder="추가금" />
                    </div>
                  );
                })}
              </div>
            )},
            { label: "그린피 인원 (비워두면 팀수x4)", node: <input style={inp} type="number" value={resForm.gfPpl||""} onChange={e => setResForm(p => ({...p, gfPpl: Number(e.target.value)||0}))} placeholder={String(resForm.teams*4) + "명 (자동)"} /> },
            { label: "기본 조식 설정 (각 일차 조식 체크박스 기본값)", node: <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 0", cursor: "pointer" }}>
                <input type="checkbox" checked={resForm.bfIncluded !== false} onChange={e => setResForm(p => ({...p, bfIncluded: e.target.checked}))} style={{ width: "18px", height: "18px", accentColor: G.primary, cursor: "pointer" }} />
                <span style={{ fontSize: "14px", color: G.text, fontWeight: "600" }}>조식 포함 {resForm.bfIncluded !== false ? "(해장국+커피)" : "(미포함)"}</span>
              </label>
            },
            { label: "예약 유형", node: (
              <div style={{ display: "flex", gap: "8px" }}>
                {[["confirmed","✅ 확정예약"],["tentative","📋 가예약"]].map(([k,l]) => (
                  <button key={k} type="button" onClick={() => setResForm(p => ({...p, res_type: k}))} style={{ flex:1, padding:"10px", borderRadius:"8px", border:"none", fontWeight:"700", fontSize:"12px", cursor:"pointer", background: resForm.res_type===k ? G.primary : "#f0f0f0", color: resForm.res_type===k ? "#fff" : "#888" }}>{l}</button>
                ))}
              </div>
            ) },
            { label: "메모", node: <input style={inp} placeholder="특이사항" value={resForm.memo} onChange={e => setResForm(p => ({...p, memo: e.target.value}))} /> },
          ].map(({ label, node, fullWidth }, idx) => (
            <div key={idx} style={fullWidth ? { gridColumn: "1 / -1" } : {}}>
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
              rm_cnt1: resForm.rmCnt1||1,
              rm_type2: resForm.rmType2||"NONE",
              rm_cnt2: resForm.rmCnt2||0,
              rm_type3: resForm.rmType3||"NONE",
              rm_cnt3: resForm.rmCnt3||0,
              rm_type4: resForm.rmType4||"NONE",
              rm_cnt4: resForm.rmCnt4||0,
              rm_ppl1: resForm.rmPpl1||0,
              rm_ppl2: resForm.rmPpl2||0,
              rm_ppl3: resForm.rmPpl3||0,
              rm_ppl4: resForm.rmPpl4||0,
              tee1: resForm.tee1 || "",
              tee2: resForm.tee2 || "",
              tee3: resForm.tee3 || "",
              tee4: resForm.tee4 || "",
              tee_sur1: resForm.teeSur1 || 0,
              tee_sur2: resForm.teeSur2 || 0,
              tee_sur3: resForm.teeSur3 || 0,
              tee_sur4: resForm.teeSur4 || 0,
              tee_type1: resForm.teeType1 ?? 1,
              tee_type2: resForm.teeType2 ?? 0,
              tee_type3: resForm.teeType3 ?? 0,
              tee_type4: resForm.teeType4 ?? 0,
              gf_ppl: Number(resForm.gfPpl) || 0,
              bf_ppl: Number(resForm.bfPpl) || 0,
              bf_included: resForm.bfIncluded !== false,
              bf_day1: resForm.bfDay1 ?? null,
              bf_day2: resForm.bfDay2 ?? null,
              bf_day3: resForm.bfDay3 ?? null,
              bf_day4: resForm.bfDay4 ?? null,
              memo: resForm.memo || "",
              res_type: resForm.res_type || "confirmed",
            }).then(data => {
              const r = data[0];
              setReservations(p => [...p, {
                id: r.id, agtId: r.agt_id, depDate: r.dep_date, repName: r.rep_name,
                phone: r.phone, productId: r.product_id, nights: r.nights,
                combo: r.combo, teams: r.teams, rmType: r.rm_type,
                rmCnt1: Number(r.rm_cnt1)||1,
                rmType2: r.rm_type2||"NONE", rmCnt2: Number(r.rm_cnt2)||0,
                rmType3: r.rm_type3||"NONE", rmCnt3: Number(r.rm_cnt3)||0,
                rmType4: r.rm_type4||"NONE", rmCnt4: Number(r.rm_cnt4)||0,
                rmPpl1: Number(r.rm_ppl1)||0, rmPpl2: Number(r.rm_ppl2)||0,
                rmPpl3: Number(r.rm_ppl3)||0, rmPpl4: Number(r.rm_ppl4)||0,
                tee1: r.tee1, tee2: r.tee2, tee3: r.tee3, tee4: r.tee4,
                teeSur1: r.tee_sur1||0, teeSur2: r.tee_sur2||0, teeSur3: r.tee_sur3||0, teeSur4: r.tee_sur4||0,
                teeType1: r.tee_type1??1, teeType2: r.tee_type2??0, teeType3: r.tee_type3??0, teeType4: r.tee_type4??0,
                bfIncluded: r.bf_included !== false,
          bfDay1: r.bf_day1 ?? undefined,
          bfDay2: r.bf_day2 ?? undefined,
          bfDay3: r.bf_day3 ?? undefined,
          bfDay4: r.bf_day4 ?? undefined,
                gfPpl: Number(r.gf_ppl)||0, bfPpl: Number(r.bf_ppl)||0,
                memo: r.memo, createdAt: r.created_at, resType: r.res_type||"confirmed",
              }]);
              setResForm({ depDate: "", repName: "", phone: "", productId: "alpensia", nights: "1박2일", combo: "prv2", teams: 1, rmType: "HIS33", rmCnt1: 1, rmType2: "NONE", rmCnt2: 0, rmType3: "NONE", rmCnt3: 0, rmType4: "NONE", rmCnt4: 0, rmPpl1: 0, rmPpl2: 0, rmPpl3: 0, rmPpl4: 0, tee1: "", tee2: "", tee3: "", tee4: "", teeSur1: 0, teeSur2: 0, teeSur3: 0, teeSur4: 0, res_type: "confirmed", memo: "" });
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
              <button onClick={() => {
                // 예약 등록 폼 초기화 (이전 입력값 제거)
                setResForm({
                  depDate: "", repName: "", phone: "",
                  productId: "alpensia", nights: "1박2일", combo: "prv2",
                  teams: 1, gfPpl: 0, bfPpl: 0, bfIncluded: true,
                  rmType: "HIS33", rmCnt1: 1,
                  rmType2: "NONE", rmCnt2: 0,
                  rmType3: "NONE", rmCnt3: 0,
                  rmType4: "NONE", rmCnt4: 0,
                  rmPpl1: 0, rmPpl2: 0, rmPpl3: 0, rmPpl4: 0,
                  tee1: "", tee2: "", tee3: "", tee4: "",
                  teeSur1: 0, teeSur2: 0, teeSur3: 0, teeSur4: 0,
                  teeType1: 1, teeType2: 0, teeType3: 0, teeType4: 0,
                  roundCourse1: "prv", roundCourse2: "prv", roundCourse3: "prv", roundCourse4: "prv",
                  bfDay1: undefined, bfDay2: undefined, bfDay3: undefined, bfDay4: undefined,
                  res_type: "confirmed", memo: ""
                });
                setAgtTab("form");
              }} style={{ padding: "8px 16px", background: G.primary, color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>+ 예약 등록</button>
              <button onClick={() => { setAgtAuthed(null); setAgtTab("login"); setReservations([]); setAgtResLoaded(false); }} style={{ padding: "8px 12px", background: "#f0f0f0", color: "#666", border: "none", borderRadius: "8px", fontSize: "12px", cursor: "pointer" }}>로그아웃</button>
            </div>
          </div>
          {/* 확정/가예약 탭 */}
          <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
            {[["confirmed","✅ 확정예약"],["tentative","📋 가예약"]].map(([k,l]) => (
              <button key={k} onClick={() => { setAgtResTypeTab(k); setAgtPage(1); }} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", fontWeight: "800", fontSize: "13px", cursor: "pointer", background: agtResTypeTab===k ? G.primary : "#f0f0f0", color: agtResTypeTab===k ? "#fff" : "#888" }}>{l} {reservations.filter(r=>(r.resType||"confirmed")===k).length}건</button>
            ))}
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
            {(() => {
              const today = new Date().toISOString().slice(0,10);
              const sorted = [...reservations]
                .filter(r => (r.resType||"confirmed") === agtResTypeTab)
                .sort((a, b) => (a.depDate || "") > (b.depDate || "") ? 1 : -1);
              const upcoming = sorted.filter(r => (r.depDate || "") >= today);
              const done = sorted.filter(r => (r.depDate || "") < today);
              const totalPages = Math.ceil(upcoming.length / AGT_PAGE_SIZE);
              const paged = upcoming.slice((agtPage-1)*AGT_PAGE_SIZE, agtPage*AGT_PAGE_SIZE);
              const renderRow = (r) => {
                const productName = PRODUCT_LIST.find(p => p.id === (r.productId||"alpensia"))?.name || "-";
                const confirmDates = agtResTypeTab === "tentative" ? getConfirmDates(r.depDate, r.combo) : [];
                // 🆕 신규 예약 표시 (등록 후 24시간 이내)
                const isNew = r.createdAt && (Date.now() - new Date(r.createdAt).getTime()) < 86400000;
                return (
                  <div key={r.id} onClick={() => { setSelRes(r); setAgtTab("invoice"); setEditMode(false); setShowEditPw(false); setEditPw(""); setShowDeleteConfirm(false); }}
                    style={{ padding: "10px 12px", borderRadius: "8px", cursor: "pointer", borderBottom: "1px solid " + G.border, transition: "background 0.15s", background: isNew ? "#FFF8E1" : "transparent", borderLeft: isNew ? "3px solid #f39c12" : "3px solid transparent" }}
                    onMouseEnter={e => e.currentTarget.style.background = isNew ? "#FFF3CD" : G.lighter}
                    onMouseLeave={e => e.currentTarget.style.background = isNew ? "#FFF8E1" : ""}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "80px 48px 90px 100px 70px 80px 1fr 44px", gap: "6px", fontSize: "13px", alignItems: "center" }}>
                      <span style={{ fontWeight: "800", color: G.primary, whiteSpace: "nowrap" }}>
                        {r.depDate ? fmtD(r.depDate) : "-"}
                        {isNew && <span style={{ display: "inline-block", marginLeft: "4px", fontSize: "9px", fontWeight: "800", background: "#f39c12", color: "#fff", padding: "1px 5px", borderRadius: "3px", verticalAlign: "middle", letterSpacing: "0.3px" }}>NEW</span>}
                      </span>
                      <span style={{ color: G.textMid, fontSize: "12px", whiteSpace: "nowrap" }}>{r.nights}</span>
                      <span style={{ fontWeight: "700", color: G.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.repName}</span>
                      <span style={{ color: G.textMid, fontSize: "12px", whiteSpace: "nowrap" }}>{r.phone}</span>
                      <span style={{ fontSize: "11px", color: "#e67e22", fontWeight: "700", whiteSpace: "nowrap" }}>{r.tee1 || "-"}</span>
                      <span style={{ fontSize: "11px", color: G.accent, fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{productName}</span>
                      <span style={{ fontSize: "12px", color: G.text, whiteSpace: "nowrap" }}>{comboLabel(r.combo)}</span>
                      <span style={{ textAlign: "right", fontWeight: "800", color: G.primary, whiteSpace: "nowrap" }}>{r.teams}팀</span>
                    </div>
                    {confirmDates.length > 0 && (
                      <div style={{ display: "flex", gap: "8px", marginTop: "5px", flexWrap: "wrap" }}>
                        {confirmDates.map((cd, i) => (
                          <span key={i} style={{ fontSize: "11px", fontWeight: "700", color: cd.color, background: cd.color+"18", padding: "2px 8px", borderRadius: "4px" }}>
                            🔔 {cd.label}: {cd.date}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              };
              return (<>
                {paged.map(renderRow)}
                {totalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginTop: "12px", flexWrap: "wrap" }}>
                    {Array.from({length: totalPages}, (_, i) => i+1).map(p => (
                      <button key={p} onClick={() => setAgtPage(p)} style={{ width: "34px", height: "34px", borderRadius: "8px", border: agtPage===p ? "none" : "1px solid "+G.border, background: agtPage===p ? G.primary : "#fff", color: agtPage===p ? "#fff" : G.textMid, fontWeight: agtPage===p ? "800" : "600", fontSize: "13px", cursor: "pointer" }}>{p}</button>
                    ))}
                  </div>
                )}
                {done.length > 0 && (
                  <details style={{ marginTop: "12px" }}>
                    <summary style={{ cursor: "pointer", padding: "10px 12px", background: "#f0f0f0", borderRadius: "8px", fontSize: "12px", fontWeight: "700", color: "#888", listStyle: "none", display: "flex", alignItems: "center", gap: "6px" }}>
                      ✅ 행사완료 {done.length}건 (클릭하여 펼치기)
                    </summary>
                    <div style={{ marginTop: "6px", opacity: 0.6 }}>
                      {done.sort((a,b) => (a.depDate||"") > (b.depDate||"") ? -1 : 1).map(renderRow)}
                    </div>
                  </details>
                )}
              </>);
            })()}
          </div>
        )}
      </div>
    );
    } catch(e) { console.error('renderAgt error:', e); return <div style={{padding:'20px', color:'#e74c3c', background:'#fff', borderRadius:'12px'}}>⚠️ 오류: {e.message}</div>; }
  };

  const calc = (() => {
    if (!date || !prod || !dv) return null;
    const pkg = PACKAGES[pkgKey];
    if (!pkg) return null;
    const rounds = Array.from({ length: pkg.rounds }, (_, i) => {
      const ds = addDays(date, i);
      const teeIdx = roundTees[i] ?? DEFAULT_TEE[i] ?? 0;
      const courseKey = roundCourses[i] ?? "prv";
      const course = prod.courses[courseKey];
      const ss = season(ds);
      const dt = getGfDayType(ds);
      const isD1 = i === 0;
      const teeSur = getTeeSur(qTees[i] || "", isD1);
      const tee2Sur = (!isD1 && teeIdx === 1) ? 20000 : 0;
      const rawGf = (course?.[ss]?.[dt]?.[teeIdx] || 0) + teeSur + tee2Sur;
      const gf = rawGf + 2500;
      return { ds, teeIdx, courseKey, cn: prod.courseNames[courseKey], gf, rawGf, teeSur, ss };
    });
    const rawGfTotal = rounds.reduce((s, r) => s + r.rawGf, 0);
    const gfTotal = rounds.reduce((s, r) => s + r.gf, 0);
    const ss1 = season(date);
    const bfRate = (prod.breakfast?.[ss1] ?? prod.breakfast) || 0;
    let bfNights = 0;
    for (let i = 0; i < pkg.nights; i++) {
      if ((rounds[i + 1]?.teeIdx ?? 0) === 0) bfNights++;
    }
    const bfPP = bfRate * bfNights;
    // 객실 그룹별 1인 요금 (ppl=0이면 occ로 자동계산)
    const rmGroupsData = validRmGroups.map(g => {
      const rmDg = prod.rooms[g.type];
      const occ = rmDg.occ || 4;
      const effectivePpl = (g.ppl && g.ppl > 0) ? g.ppl : g.cnt * occ;
      let rmPP = 0;
      for (let i = 0; i < pkg.nights; i++) {
        const ds = addDays(date, i);
        const rate = getRmRate(rmDg, ds);
        rmPP += (rate * g.cnt) / effectivePpl;
      }
      rmPP = Math.ceil(rmPP);
      const sellPPg = gfTotal + rmPP + bfPP;
      const offPPg = rawGfTotal + rmPP + bfPP + (10000 * pkg.rounds) + (validRmGroups.length === 0 ? 0 : 5000 * pkg.nights);
      return { type: g.type, cnt: g.cnt, occ, ppl: g.ppl||0, groupPpl: effectivePpl, rmPP, label: rmLabel(g.type), sellPP: sellPPg, offPP: offPPg };
    });
    const rmPP = noHotel ? 0 : (rmGroupsData[0]?.rmPP || 0);
    const rawCostPP = rawGfTotal + rmPP + bfPP;
    const costPP = gfTotal + rmPP + bfPP;
    const offPP = rawCostPP + (10000 * pkg.rounds) + (noHotel ? 0 : 5000 * pkg.nights);
    const sellPP = rawCostPP + (2500 * pkg.rounds);
    const agtMgn = (7500 * pkg.rounds) + (noHotel ? 0 : 5000 * pkg.nights);
    const choiceMgn = 2500 * pkg.rounds;
    return { rounds, rawGfTotal, gfTotal, rmPP, rmGroupsData, bfPP, bfNights, rawCostPP, costPP, offPP, sellPP, agtMgn, choiceMgn };
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
        <input type="password" placeholder="비밀번호" value={pw} onChange={e => { setPw(e.target.value); setPwErr(false); }} onKeyDown={e => { if (e.key === "Enter") { if (pw === ADMIN_PW) { setAuthed(true); setIsAdmin(true); setPwErr(false); } else if (pw === PW) { setAuthed(true); setIsAdmin(false); setPwErr(false); } else { setPwErr(true); } } }}
          style={{ ...inp, textAlign: "center", marginBottom: "14px", border: pwErr ? "2px solid #e74c3c" : "1px solid #ddd", fontSize: "16px" }} />
        {pwErr && <div style={{ color: "#e74c3c", fontSize: "13px", marginBottom: "10px" }}>비밀번호가 틀립니다</div>}
        <button onClick={() => { if (pw === ADMIN_PW) { setAuthed(true); setIsAdmin(true); setPwErr(false); } else if (pw === PW) { setAuthed(true); setIsAdmin(false); setPwErr(false); } else { setPwErr(true); } }} style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "none", background: G.primary, color: "#fff", fontWeight: "800", fontSize: "16px", cursor: "pointer" }}>로그인</button>
        <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #eee", fontSize: "11px", color: "#888", lineHeight: "1.6" }}>
          <div style={{ fontWeight: "700", color: "#666", marginBottom: "3px" }}>여행사전용 네이트온 문의</div>
          <div style={{ color: G.primary, fontWeight: "700", fontSize: "13px", letterSpacing: "0.3px" }}>golfchoice@nate.com</div>
        </div>
      </div>
    </div>
  );

  const cLabel = t => t === "pub" ? "대중제" : "회원제";
  const cColor = t => t === "pub" ? "#27ae60" : "#2980b9";
  const cBg = t => t === "pub" ? "#eafaf1" : "#ebf5fb";

  // incl/excl — renderCalc, renderQuote 공용
  const incl = prod ? ["골프 그린피 " + (pkgRounds * 18) + "홀 (18홀 x " + pkgRounds + "라운드)"] : [];
  if (prod && validRmGroups.length > 0) validRmGroups.forEach(g => { const occ = prod.rooms[g.type]?.occ||4; incl.push("숙박 " + pkgNights + "박 — " + rmLabel(g.type) + " " + g.cnt + "실 (" + (g.cnt*occ) + "명)"); });
  if (prod && bfOn && (calc?.bfPP ?? 0) > 0) incl.push("클럽조식 (해장국+커피)");
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
              {[1, 2, 3, 4, 5, 6, 7, 8].filter(m => {
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
          {date && !dv && <div style={{ marginTop: "10px", padding: "10px", background: "#fdecea", borderRadius: "8px", fontSize: "13px", color: "#c0392b", fontWeight: "700" }}>⚠️ 요금표는 8/31까지 적용됩니다.</div>}
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
              <div style={{ fontSize: "13px", fontWeight: "800", color: G.text, marginBottom: "10px" }}>🏨 숙소 구성</div>
              {rmGroups.map((g, idx) => {
                const occ = prod.rooms[g.type]?.occ || 4;
                const defaultCnt = g.type !== "NONE" ? teams * (occ === 4 ? 1 : 2) : 0;
                const effectivePpl = (g.ppl && g.ppl > 0) ? g.ppl : (g.cnt || defaultCnt) * occ;
                return (
                  <div key={idx} style={{ marginBottom: "8px", padding: "10px 12px", background: g.type !== "NONE" ? G.lighter : "#fff5f5", borderRadius: "10px", border: "1px solid " + (g.type !== "NONE" ? G.border : "#fcc") }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: g.type !== "NONE" ? "8px" : "0" }}>
                      <select value={g.type} onChange={e => {
                        const newType = e.target.value;
                        const newOcc = prod.rooms[newType]?.occ || 4;
                        const newCnt = newType !== "NONE" ? teams * (newOcc === 4 ? 1 : 2) : 0;
                        const ng = [...rmGroups]; ng[idx] = {...ng[idx], type: newType, cnt: newCnt, ppl: 0}; setRmGroups(ng);
                      }} style={{ ...inp, flex: 2, fontSize: "12px", padding: "8px 6px" }}>
                        <option value="NONE">🚫 호텔 없음</option>
                        {Object.keys(prod.rooms).map(r => <option key={r} value={r}>{rmLabel(r)} ({prod.rooms[r].occ===4?"4인1실":"2인1실"})</option>)}
                      </select>
                      {rmGroups.length > 1 && <button onClick={() => setRmGroups(rmGroups.filter((_,i)=>i!==idx))} style={{ padding: "6px 10px", border: "none", background: "#eee", borderRadius: "6px", cursor: "pointer", fontSize: "12px", color: "#888" }}>✕</button>}
                    </div>
                    {g.type !== "NONE" && (
                      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ fontSize: "11px", color: "#666" }}>객실</span>
                          <input type="number" min={1} value={g.cnt || defaultCnt} onChange={e => { const ng=[...rmGroups]; ng[idx]={...ng[idx],cnt:parseInt(e.target.value)||1}; setRmGroups(ng); }} style={{ ...inp, width: "52px", textAlign: "center", padding: "6px 4px", fontSize: "13px", fontWeight: "700" }} />
                          <span style={{ fontSize: "11px", color: "#666" }}>실</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ fontSize: "11px", color: "#666" }}>실제인원</span>
                          <input type="number" min={1} value={g.ppl || ""} placeholder={String(effectivePpl)} onChange={e => { const ng=[...rmGroups]; ng[idx]={...ng[idx],ppl:parseInt(e.target.value)||0}; setRmGroups(ng); }} style={{ ...inp, width: "60px", textAlign: "center", padding: "6px 4px", fontSize: "13px", fontWeight: "700" }} />
                          <span style={{ fontSize: "11px", color: "#666" }}>명</span>
                        </div>
                        
                      </div>
                    )}
                  </div>
                );
              })}
              {rmGroups.length < 4 && (
                <button onClick={() => {
                  const defOcc = prod.rooms["HIS33"]?.occ || 4;
                  const defCnt = teams * (defOcc === 4 ? 1 : 2);
                  setRmGroups([...rmGroups, {type: "HIS33", cnt: defCnt, ppl: 0}]);
                }} style={{ width: "100%", padding: "8px", border: "2px dashed " + G.border, borderRadius: "10px", background: "transparent", color: G.primary, fontWeight: "700", fontSize: "12px", cursor: "pointer" }}>+ 객실 추가</button>
              )}
            </div>
          </div>
        </div>

        {/* ══ 결과 - 객실 그룹별 요금 ══ */}
        {calc && (
          <div style={{ borderRadius: "16px", overflow: "hidden", marginBottom: "12px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
            {/* 그룹별 요금 카드 */}
            {calc.rmGroupsData.length > 0 ? calc.rmGroupsData.map((g, gi) => (
              <div key={gi}>
                <div style={{ padding: "16px 24px", background: "linear-gradient(135deg, #fdf6e3 0%, #fffef7 100%)", borderBottom: "1px solid #e8d5a3" }}>
                  <div style={{ fontSize: "11px", color: G.textSub, fontWeight: "700", marginBottom: "4px" }}>🏨 {g.label} 이용자 ({g.groupPpl}명) — 공식판매가 (1인)</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "30px", fontWeight: "900", color: "#5a4510" }}>₩{fmt(g.offPP)}</div>
                    <div style={{ fontSize: "12px", color: G.gold, fontWeight: "700" }}>커미션 {fmt(g.offPP - g.sellPP)}원/인</div>
                  </div>
                </div>
                <div style={{ padding: "12px 24px", background: G.primary, borderBottom: gi < calc.rmGroupsData.length-1 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", marginBottom: "2px" }}>AGT 입금가 (1인)</div>
                      <div style={{ fontSize: "24px", fontWeight: "900", color: "#fff" }}>₩{fmt(g.sellPP)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>{g.groupPpl}명 합계</div>
                      <div style={{ fontSize: "18px", fontWeight: "800", color: "#fff" }}>₩{fmt(g.sellPP * g.groupPpl)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div>
                <div style={{ padding: "16px 24px", background: "linear-gradient(135deg, #fdf6e3 0%, #fffef7 100%)", borderBottom: "1px solid #e8d5a3" }}>
                  <div style={{ fontSize: "12px", color: G.gold, fontWeight: "700", marginBottom: "4px" }}>공식판매가 (1인) — 호텔 미포함</div>
                  <div style={{ fontSize: "30px", fontWeight: "900", color: "#5a4510" }}>₩{fmt(calc.offPP)}</div>
                </div>
                <div style={{ padding: "12px 24px", background: G.primary }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", marginBottom: "2px" }}>AGT 입금가 (1인)</div>
                    <div style={{ fontSize: "24px", fontWeight: "900", color: "#fff" }}>₩{fmt(calc.sellPP)}</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>총액 ({ppl}명)</div>
                    <div style={{ fontSize: "18px", fontWeight: "800", color: "#fff" }}>₩{fmt(calc.sellPP * ppl)}</div></div>
                  </div>
                </div>
              </div>
            )}
            <div style={{ padding: "14px 24px", background: "#f9fbfa" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#aaa", marginBottom: "8px" }}>포함사항</div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                <span style={{ padding: "5px 12px", borderRadius: "20px", background: "#fff", border: "1px solid #ddd", fontSize: "12px", fontWeight: "700", color: "#444" }}>⛳ 골프 그린피 {pkgRounds * 18}홀</span>
                {bfOn && (calc?.bfPP ?? 0) > 0 && <span style={{ padding: "5px 12px", borderRadius: "20px", background: "#fff", border: "1px solid #ddd", fontSize: "12px", fontWeight: "700", color: "#444" }}>🥐 클럽조식</span>}
                {calc.rmGroupsData.map((g, i) => <span key={i} style={{ padding: "5px 12px", borderRadius: "20px", background: "#fff", border: "1px solid #ddd", fontSize: "12px", fontWeight: "700", color: "#444" }}>🏨 {g.label} {g.cnt}실</span>)}
              </div>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#aaa", marginBottom: "8px" }}>불포함사항</div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ padding: "5px 12px", borderRadius: "20px", background: "#fff", border: "1px solid #fdd", fontSize: "12px", fontWeight: "700", color: "#c0392b" }}>🚫 캐디피 ₩150,000</span>
                {hasPrv && hasPub ? <span style={{ padding: "5px 12px", borderRadius: "20px", background: "#fff", border: "1px solid #fdd", fontSize: "12px", fontWeight: "700", color: "#c0392b" }}>🚫 카트비 ₩120,000(회원제)/₩100,000(대중제)</span>
                  : hasPrv ? <span style={{ padding: "5px 12px", borderRadius: "20px", background: "#fff", border: "1px solid #fdd", fontSize: "12px", fontWeight: "700", color: "#c0392b" }}>🚫 카트비 ₩120,000</span>
                  : <span style={{ padding: "5px 12px", borderRadius: "20px", background: "#fff", border: "1px solid #fdd", fontSize: "12px", fontWeight: "700", color: "#c0392b" }}>🚫 카트비 ₩100,000</span>}
              </div>
            </div>
          </div>
        )}

        {/* 세부 요금표 */}
        {calc && (
          <div style={sc}>
            <button onClick={() => setShowDetail(!showDetail)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: "#f0f0f0", cursor: "pointer", fontSize: "13px", fontWeight: "700", color: "#777" }}>
              {showDetail ? "▲ 세부 요금표 닫기" : "▼ 세부 요금표"}
            </button>
            {showDetail && (
              <div style={{ marginTop: "14px" }}>
                {calc.rmGroupsData.length > 0 ? calc.rmGroupsData.map((g, gi) => (
                  <div key={gi} style={{ marginBottom: "14px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "800", color: G.primary, marginBottom: "6px" }}>🏨 {g.label} 이용자 ({g.groupPpl}명)</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <tbody>
                        {calc.rounds.map((r, i) => (<tr key={i}><td style={qTd}>⛳ {i+1}일차 {r.cn} {r.teeIdx===1?"2부":"1부"}</td><td style={qTdR}>₩{fmt(r.gf)}</td></tr>))}
                        <tr><td style={qTd}>🏨 {g.label} {pkgNights}박</td><td style={qTdR}>₩{fmt(g.rmPP)}</td></tr>
                        {calc.bfPP > 0 && <tr><td style={qTd}>🥐 조식</td><td style={qTdR}>₩{fmt(calc.bfPP)}</td></tr>}
                        <tr style={{ background: G.light }}><td style={{ ...qTd, fontWeight: "800", color: G.primary }}>AGT 입금가</td><td style={{ ...qTdR, color: G.primary, fontSize: "15px" }}>₩{fmt(g.sellPP)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                )) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <tbody>
                      {calc.rounds.map((r, i) => (<tr key={i}><td style={qTd}>⛳ {i+1}일차 {r.cn} {r.teeIdx===1?"2부":"1부"}</td><td style={qTdR}>₩{fmt(r.gf)}</td></tr>))}
                      {calc.bfPP > 0 && <tr><td style={qTd}>🥐 조식</td><td style={qTdR}>₩{fmt(calc.bfPP)}</td></tr>}
                      <tr style={{ background: G.light }}><td style={{ ...qTd, fontWeight: "800", color: G.primary }}>AGT 입금가</td><td style={{ ...qTdR, color: G.primary, fontSize: "15px" }}>₩{fmt(calc.sellPP)}</td></tr>
                    </tbody>
                  </table>
                )}
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

          {/* 이용자별 요금 표기 (4인 단체에서 2인은 얼마, 2인은 얼마 다르게 표기할 때) */}
          <div style={{ marginTop: "10px", padding: "12px 14px", background: "#fff8e1", borderRadius: "8px", border: "1px solid #f0c040" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "#8b6914", marginBottom: "10px" }}>👥 이용자별 요금 표기 (선택) — 비워두면 기본 1인 요금만 표시</div>
            <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr", gap: "12px" }}>
              {/* 그룹 1 */}
              <div style={{ padding: "10px", background: "#fff", borderRadius: "6px", border: "1px solid #f0c040" }}>
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#8b6914", marginBottom: "6px" }}>📦 그룹 1</div>
                <label style={{ ...lbl, fontSize: "11px" }}>라벨</label>
                <input style={inp} value={qGroup1Label} onChange={e => setQGroup1Label(e.target.value)} placeholder="예: 2인" />
                <label style={{ ...lbl, fontSize: "11px", marginTop: "4px" }}>🎫 골드 태그 (선택)</label>
                <input style={inp} value={qGroup1Note} onChange={e => setQGroup1Note(e.target.value)} placeholder="예: 숙박 쿠폰 적용" />
                <div style={{ fontSize: "10px", color: "#888", marginTop: "4px" }}>💰 금액은 위 "1인 요금" 자동 사용</div>
              </div>
              {/* 그룹 2 */}
              <div style={{ padding: "10px", background: "#fff", borderRadius: "6px", border: "1px solid #f0c040" }}>
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#8b6914", marginBottom: "6px" }}>📦 그룹 2</div>
                <label style={{ ...lbl, fontSize: "11px" }}>라벨</label>
                <input style={inp} value={qGroup2Label} onChange={e => setQGroup2Label(e.target.value)} placeholder="예: 2인" />
                <label style={{ ...lbl, fontSize: "11px", marginTop: "4px" }}>🎫 골드 태그 (선택)</label>
                <input style={inp} value={qGroup2Note} onChange={e => setQGroup2Note(e.target.value)} placeholder="예: 일반" />
                <label style={{ ...lbl, fontSize: "11px", marginTop: "4px" }}>💰 1인 금액</label>
                <input style={inp} value={qGroup2Price} onChange={e => setQGroup2Price(e.target.value)} placeholder="350000" />
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
        <div ref={previewRef} style={{ background: "#f4f6f4", fontFamily: "'Pretendard','Apple SD Gothic Neo','맑은 고딕',sans-serif", width: "100%", boxSizing: "border-box", padding: "8px 0 14px 0" }}>

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
            {/* 요금 표시: 그룹별 카드 디자인 */}
            {(() => {
              const hasG2 = qGroup2Label && qGroup2Price;
              const g2Price = parseInt(String(qGroup2Price).replace(/,/g,"")) || 0;

              const PriceCard = ({ main, note, price }) => (
                <div style={{
                  flex: 1,
                  padding: "14px 16px",
                  background: note ? "linear-gradient(135deg, #fffdf5 0%, #fef8e0 100%)" : "#fafaf7",
                  borderRadius: "10px",
                  border: note ? "1.5px solid #e8c96e" : "1px solid #e8e6e0",
                  boxShadow: note ? "0 2px 8px rgba(232,201,110,0.15)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "#222" }}>{main}</div>
                    {note && (
                      <div style={{
                        fontSize: "10px",
                        fontWeight: "800",
                        color: "#fff",
                        background: "linear-gradient(135deg, #c9a942 0%, #b8941f 100%)",
                        padding: "3px 9px",
                        borderRadius: "12px",
                        letterSpacing: "0.3px",
                        boxShadow: "0 1px 3px rgba(184,148,31,0.3)",
                      }}>🎫 {note}</div>
                    )}
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: "900", color: "#c0392b", letterSpacing: "-0.5px", lineHeight: 1 }}>
                    ₩{fmt(price)}
                  </div>
                </div>
              );

              return (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: hasG2 ? "1fr 1fr" : "1fr",
                  gap: "10px",
                  paddingBottom: "11px",
                  borderBottom: "1px solid #f0f0f0",
                  marginBottom: "11px"
                }}>
                  <PriceCard main={qGroup1Label || "1인 요금"} note={qGroup1Note} price={displayPrice} />
                  {hasG2 && <PriceCard main={qGroup2Label} note={qGroup2Note} price={g2Price} />}
                </div>
              );
            })()}
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
                  const firstRmType = rmGroups.find(g => g.type && g.type !== "NONE")?.type || "HIS33";
                  const rPhotos = prod.roomPhoto?.[firstRmType] || [];
                  const rPhoto = rPhotos.filter(Boolean)[0] || null;
                  const rIntro = prod.roomIntro?.[firstRmType] || "";
                  const colSpan = totalCards === 3 ? "1 / -1" : "auto";
                  return (
                    <div style={{ gridColumn: colSpan }}>
                      {totalCards === 3 ? (
                        <div style={{ background: "#fff", borderRadius: "10px", overflow: "hidden", display: "grid", gridTemplateColumns: "160px 1fr" }}>
                          {rPhoto && <img src={rPhoto} alt={firstRmType} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                          <div style={{ padding: "10px 12px" }}>
                            <div style={{ fontSize: "13px", fontWeight: "800", color: "#111", marginBottom: "4px" }}>{rmLabel(firstRmType)}</div>
                            {rIntro && <div style={{ fontSize: "11px", color: "#555", lineHeight: "1.7" }}>{rIntro}</div>}
                          </div>
                        </div>
                      ) : (
                        <CardInfo title={rmLabel(firstRmType)} spec={null} intro={rIntro} photo={rPhoto} />
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
            <div><label style={lbl}>시즌4</label><input style={inp} value={p.seasons.s4 || ""} onChange={e => upProd("seasons", { ...p.seasons, s4: e.target.value })} /></div>
            <div><label style={lbl}>시즌1→2 구분일</label><input type="date" style={inp} value={p.seasonCut} onChange={e => upProd("seasonCut", e.target.value)} /></div>
            <div><label style={lbl}>시즌2→3 구분일</label><input type="date" style={inp} value={p.seasonCut2 || ""} onChange={e => upProd("seasonCut2", e.target.value)} /></div>
            <div><label style={lbl}>시즌3→4 구분일</label><input type="date" style={inp} value={p.seasonCut3 || ""} onChange={e => upProd("seasonCut3", e.target.value)} /></div>
            <div><label style={lbl}>시즌4→5 구분일</label><input type="date" style={inp} value={p.seasonCut4 || ""} onChange={e => upProd("seasonCut4", e.target.value)} /></div>
            <div><label style={lbl}>시즌5→6 구분일</label><input type="date" style={inp} value={p.seasonCut5 || ""} onChange={e => upProd("seasonCut5", e.target.value)} /></div>
            <div><label style={lbl}>시즌6→7 구분일</label><input type="date" style={inp} value={p.seasonCut6 || ""} onChange={e => upProd("seasonCut6", e.target.value)} /></div>
            <div><label style={lbl}>시즌7→8 구분일</label><input type="date" style={inp} value={p.seasonCut7 || ""} onChange={e => upProd("seasonCut7", e.target.value)} /></div>
            <div><label style={lbl}>시즌8→9 구분일</label><input type="date" style={inp} value={p.seasonCut8 || ""} onChange={e => upProd("seasonCut8", e.target.value)} /></div>
            <div><label style={lbl}>2부+2부 추가금</label><input type="number" style={inp} value={p.surcharge} onChange={e => upProd("surcharge", parseInt(e.target.value) || 0)} /></div>
          </div>
          <div style={{ marginTop: "16px", padding: "14px", background: "#fafafa", borderRadius: "10px" }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#555", marginBottom: "10px" }}>🥐 조식 요금 (1인 기준, 시즌별)</div>
            <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr 1fr" : "1fr 1fr 1fr", gap: "10px" }}>
              {["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"].map(sn => {
                const defBf = { s1: 20000, s2: 20000, s3: 15000, s4: 15000, s5: 15000, s6: 15000, s7: 15000, s8: 15000, s9: 15000 };
                const bfObj = (typeof p.breakfast === 'object' && p.breakfast) ? p.breakfast : defBf;
                return (
                  <div key={sn}>
                    <label style={{ ...lbl, fontSize: "11px" }}>시즌{sn.slice(1)} ({p.seasons[sn]})</label>
                    <input type="number" style={inp} value={bfObj[sn] || 0} onChange={e => upProd("breakfast", { ...bfObj, [sn]: parseInt(e.target.value) || 0 })} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {Object.entries(p.courses).map(([cK, cD]) => (
          <div key={cK} style={sc}>
            <div style={{ fontSize: "15px", fontWeight: "800", color: G.primary, marginBottom: "12px" }}>⛳ {p.courseNames[cK]}</div>
            {["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"].map(sn => (
              <div key={sn} style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#555", marginBottom: "8px", background: "#f5f5f5", padding: "8px 12px", borderRadius: "8px" }}>시즌{sn.slice(1)} ({p.seasons[sn]})</div>
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
                <tbody>{["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"].map(sn => (
                  <tr key={sn}>
                    <td style={{ padding: "4px 8px", fontWeight: "600" }}>시즌{sn.slice(1)}</td>
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
      <div style={{ background: G.primary, padding: isMob ? "0 4px" : "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 2px 16px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", gap: "0px", flex: 1 }}>
          {[["calc", "알펜시아 요금", "요금"], ["quote", "고객 견적서", "견적서"], ["agt", "AGT 예약관리", "예약관리"], ...(isAdmin ? [["setting", "⚙️ 설정", "⚙️"]] : [])].map(([k, l, lm]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex: isMob ? 1 : "none", padding: isMob ? "14px 4px" : "16px 20px", borderRadius: "0", border: "none", borderBottom: tab === k ? "3px solid #fff" : "3px solid transparent", cursor: "pointer", background: "transparent", color: tab === k ? "#fff" : "rgba(255,255,255,0.55)", fontWeight: tab === k ? "800" : "600", fontSize: isMob ? "11px" : "13px", whiteSpace: "nowrap", transition: "all 0.15s", letterSpacing: "0px" }}>{isMob ? lm : l}</button>
          ))}
        </div>
        {!isMob && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: "700", letterSpacing: "2px" }}>CHOICE GOLF</div>}
      </div>
      <div style={{ padding: isMob ? "12px 10px" : "20px", maxWidth: "800px", margin: "0 auto" }}>
        {tab === "calc" && renderCalc()}
        {tab === "quote" && renderQuote()}
        {tab === "agt" && renderAgt()}
        {tab === "setting" && isAdmin && renderAdmin()}

      </div>
    </div>
  );
}
