const SPREADSHEET_ID = "17DgdMSgg_8BHj_IUgkantC9_tQa6h3dl0xbatLTrOgQ";
const SHEET_NAME = "신청응답";
const ALLOWED_ORIGINS = [
  "사용할 주소"
];
const ACCEPT_START = new Date("2026-01-01T00:00:00+09:00");
const ACCEPT_END = new Date("2026-12-31T23:59:59+09:00");
const MAX_FIELD_LENGTH = 2000;

const HEADERS = [
  "제출일시", "submissionId", "pageVersion", "회사명", "사업형태", "회사설립일", "직원 수",
  "담당자명", "직함", "사무실 번호", "휴대폰 번호", "이메일", "홈페이지",
  "대분류", "소분류", "보관방식", "유통기한", "제품 특이사항", "세부 상담 품목",
  "관심 분야", "관심 유통채널", "현재 유통 현황", "유통 현황 상세",
  "기타 유통 특이사항", "임의 매칭 희망 여부",
  "1순위", "2순위", "3순위", "4순위", "5순위", "6순위", "7순위", "8순위", "9순위", "10순위"
];

function doPost(e) {
  try {
    assertOrigin_(e);
    assertAccepting_();

    const payload = JSON.parse(e.postData.contents || "{}");
    validatePayload_(payload);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sheet = getSheet_();
      ensureHeaders_(sheet);
      assertNotDuplicate_(sheet, payload.submissionId);
      sheet.appendRow(toSafeRow_(payload));
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function assertOrigin_(e) {
  const origin = (e && e.parameter && e.parameter.origin) || "";
  // Apps Script does not reliably expose request Origin in all deployments.
  // Pass the page origin explicitly from the frontend if strict checking is required.
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    throw new Error("허용되지 않은 Origin입니다.");
  }
}

function assertAccepting_() {
  const now = new Date();
  if (now < ACCEPT_START || now > ACCEPT_END) {
    throw new Error("현재 신청 접수 기간이 아닙니다.");
  }
}

function validatePayload_(p) {
  const required = ["submissionId", "companyName", "managerName", "mobilePhone", "email", "category", "subcategory"];
  required.forEach((key) => {
    if (!String(p[key] || "").trim()) throw new Error(`${key} 값이 필요합니다.`);
  });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.email || ""))) {
    throw new Error("이메일 형식이 올바르지 않습니다.");
  }
  if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(String(p.mobilePhone || ""))) {
    throw new Error("휴대폰 번호 형식이 올바르지 않습니다.");
  }
  if (!p.privacyAgree) {
    throw new Error("개인정보 수집·이용 동의가 필요합니다.");
  }

  Object.keys(p).forEach((key) => {
    const value = p[key];
    if (typeof value === "string" && value.length > MAX_FIELD_LENGTH) {
      throw new Error(`${key} 값이 너무 깁니다.`);
    }
  });
}

function assertNotDuplicate_(sheet, submissionId) {
  const finder = sheet.createTextFinder(String(submissionId)).matchEntireCell(true);
  if (finder.findNext()) {
    throw new Error("이미 접수된 제출입니다.");
  }
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function ensureHeaders_(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (!firstRow.some(Boolean)) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function toSafeRow_(p) {
  const rankings = {};
  (p.rankings || []).forEach((item) => {
    rankings[item.rank] = item.company;
  });

  return [
    p.submittedAt || new Date().toISOString(),
    p.submissionId,
    p.pageVersion || "",
    p.companyName || "",
    join_(p.businessType),
    p.foundedDate || "",
    p.employeeCount || "",
    p.managerName || "",
    p.managerTitle || "",
    p.officePhone || "",
    p.mobilePhone || "",
    p.email || "",
    p.homepage || "",
    p.category || "",
    p.subcategory || "",
    p.storage || "",
    p.shelfLife || "",
    join_(p.foodIssues),
    p.productDetail || "",
    join_(p.interestType),
    join_(p.interestChannels),
    join_(p.currentChannels),
    p.distributionDetail || "",
    join_(p.distributionIssues),
    p.randomMatch || "",
    rankings[1] || "",
    rankings[2] || "",
    rankings[3] || "",
    rankings[4] || "",
    rankings[5] || "",
    rankings[6] || "",
    rankings[7] || "",
    rankings[8] || "",
    rankings[9] || "",
    rankings[10] || ""
  ].map(safeSheetValue);
}

function join_(value) {
  return Array.isArray(value) ? value.join(", ") : value || "";
}

function safeSheetValue(value) {
  const text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) {
    return "'" + text;
  }
  return text;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

