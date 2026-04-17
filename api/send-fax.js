// ============================================================
// Vercel API Route: /api/send-fax
// xlsx → PDF (CloudConvert) → Solapi 팩스 발송
// ============================================================
import crypto from "crypto";

export const maxDuration = 60; // Vercel Hobby: 최대 60초

const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY;
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET;
const SOLAPI_SENDER = process.env.SOLAPI_SENDER;
const CLOUDCONVERT_API_KEY = process.env.CLOUDCONVERT_API_KEY;

// ======================================================
// HMAC-SHA256 서명 생성 (Solapi 인증)
// ======================================================
function solapiAuthHeader() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const data = date + salt;
  const signature = crypto
    .createHmac("sha256", SOLAPI_API_SECRET)
    .update(data)
    .digest("hex");
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

// ======================================================
// CloudConvert: xlsx → PDF 변환
// ======================================================
async function convertXlsxToPdf(xlsxBase64, filename) {
  // 1. Job 생성
  const jobRes = await fetch("https://api.cloudconvert.com/v2/jobs", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + CLOUDCONVERT_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tasks: {
        "import-1": {
          operation: "import/base64",
          file: xlsxBase64,
          filename: filename,
        },
        "convert-1": {
          operation: "convert",
          input: "import-1",
          output_format: "pdf",
          engine: "libreoffice",
          page_orientation: "portrait",
          pdf_a: false,
        },
        "export-1": {
          operation: "export/url",
          input: "convert-1",
          inline: false,
        },
      },
    }),
  });
  if (!jobRes.ok) throw new Error("CloudConvert job 생성 실패: " + await jobRes.text());
  const job = await jobRes.json();
  const jobId = job.data.id;

  // 2. Job 완료 대기 (최대 50초)
  const start = Date.now();
  let jobData;
  while (Date.now() - start < 50000) {
    await new Promise(r => setTimeout(r, 2000));
    const stat = await fetch("https://api.cloudconvert.com/v2/jobs/" + jobId, {
      headers: { Authorization: "Bearer " + CLOUDCONVERT_API_KEY },
    });
    if (!stat.ok) throw new Error("CloudConvert 상태 조회 실패");
    jobData = (await stat.json()).data;
    if (jobData.status === "finished") break;
    if (jobData.status === "error") throw new Error("CloudConvert 변환 에러: " + JSON.stringify(jobData.tasks?.map(t => t.message)));
  }
  if (!jobData || jobData.status !== "finished") throw new Error("CloudConvert 타임아웃");

  // 3. PDF 다운로드
  const exportTask = jobData.tasks.find(t => t.operation === "export/url");
  const fileUrl = exportTask?.result?.files?.[0]?.url;
  if (!fileUrl) throw new Error("PDF URL 없음");
  const pdfRes = await fetch(fileUrl);
  if (!pdfRes.ok) throw new Error("PDF 다운로드 실패");
  return Buffer.from(await pdfRes.arrayBuffer());
}

// ======================================================
// Solapi: 파일 업로드 (JSON + base64)
// ======================================================
async function uploadToSolapi(fileBuffer, filename) {
  const base64 = fileBuffer.toString("base64");
  const res = await fetch("https://api.solapi.com/storage/v1/files", {
    method: "POST",
    headers: {
      Authorization: solapiAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file: base64,
      type: "FAX",
      name: filename,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error("Solapi 업로드 실패: " + text);
  const data = JSON.parse(text);
  return data.fileId;
}

// ======================================================
// Solapi: 팩스 발송
// ======================================================
async function sendSolapiFax(fileId, toNumber) {
  const res = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      Authorization: solapiAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        to: toNumber,
        from: SOLAPI_SENDER,
        type: "FAX",
        imageId: fileId,
        text: "알펜시아 예약신청서 (초이스골프)",
        subject: "알펜시아 예약신청서",
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error("Solapi 발송 실패: " + text);
  return JSON.parse(text);
}

// ======================================================
// Vercel Handler
// ======================================================
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  // 환경변수 체크
  const missing = [];
  if (!SOLAPI_API_KEY) missing.push("SOLAPI_API_KEY");
  if (!SOLAPI_API_SECRET) missing.push("SOLAPI_API_SECRET");
  if (!SOLAPI_SENDER) missing.push("SOLAPI_SENDER");
  if (!CLOUDCONVERT_API_KEY) missing.push("CLOUDCONVERT_API_KEY");
  if (missing.length) {
    return res.status(500).json({ ok: false, error: "환경변수 누락: " + missing.join(", ") });
  }

  try {
    const { xlsx_base64, fax_number, filename } = req.body || {};
    if (!xlsx_base64 || !fax_number) {
      return res.status(400).json({ ok: false, error: "xlsx_base64, fax_number 필수" });
    }

    const cleanFax = String(fax_number).replace(/\D/g, "");
    const safeName = (filename || "fax").replace(/[\\/:*?"<>|]/g, "_");

    console.log("[fax] start:", safeName, "→", cleanFax);

    // 1) CloudConvert: xlsx → PDF
    const pdfBuffer = await convertXlsxToPdf(xlsx_base64, safeName);
    console.log("[fax] pdf size:", pdfBuffer.length);

    // 2) Solapi: PDF 업로드
    const fileId = await uploadToSolapi(pdfBuffer, safeName.replace(/\.xlsx$/i, ".pdf"));
    console.log("[fax] solapi fileId:", fileId);

    // 3) Solapi: 팩스 발송
    const result = await sendSolapiFax(fileId, cleanFax);
    console.log("[fax] sent:", result);

    return res.status(200).json({
      ok: true,
      fileId,
      to: cleanFax,
      result,
    });
  } catch (e) {
    console.error("[fax] error:", e);
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}
