const CATEGORIES = ["식품", "생활&주방", "뷰티&패션", "라이프스타일"];
const CATEGORY_ITEMS = {
  "식품": ["간편식/밀키트", "반찬류", "가공육", "소스/조미료", "과자/디저트", "음료", "주류", "건강기능식품", "건강식품", "유제품", "농산물", "수산/건어물", "축산물"],
  "생활&주방": ["생활용품", "주방용품", "생활가전", "주방가전", "유아용품"],
  "뷰티&패션": ["화장품(기초/색조)", "헤어/바디케어", "향수", "이미용가전", "뷰티잡화", "위생용품", "의류", "패션잡화", "언더웨어"],
  "라이프스타일": ["홈데코", "홈패브릭/침구류", "건강", "스포츠/아웃도어", "반려동물용품", "문구/완구류", "기념품", "디지털제품"],
};
const CHANNELS = ["TV/홈쇼핑", "라이브커머스", "온라인 종합몰", "온라인플랫폼/전문몰", "오픈마켓", "대형마트", "백화점/아울렛", "편의점", "드럭스토어/H&B", "전문점(서점, 편집숍 등)", "복지몰/폐쇄몰", "도매/B2B 유통", "수출", "기타"];
const CURRENT_CHANNELS = ["온라인 자사몰", "자사 오프라인 매장", ...CHANNELS.slice(0, -1), "크라우드 펀딩", "기타"];
const STORAGE_BLOCK_MAP = {
  "냉장 보관": "냉장식품",
  "냉동 보관": "냉동식품",
};
const ISSUE_ALIAS_MAP = {
  "수출/해외배송 불가 제품": ["수출/해외배송 불가 제품"],
  "타 폐쇄몰 입점 제품": ["폐쇄몰 입점 제품", "타 폐쇄몰 입점 제품"],
  "벤더사": ["벤더사"],
  "신선식품": ["신선식품"],
  "육류 함유 제품": ["육류 함유 제품", "육류함유제품"],
  "식용색소 첨가 제품": ["식용색소 첨가 제품", "식용색소첨가제품"],
  "면세/규제 대상 제품": ["면세/규제 대상 제품", "면세 규제 대상 제품"],
};
const PAGE_VERSION = "2026-06-29-security-1";
const DRAFT_KEY = "megashowConsultationApplicationDraftV3";
const LEGACY_DRAFT_KEYS = ["megashowConsultationApplicationDraftV2"];
const MAX_FIELD_LENGTH = 1000;
const data = Array.isArray(window.DISTRIBUTORS) ? window.DISTRIBUTORS : [];
const brochureLinks = window.BROCHURE_LINKS || {};
const BROCHURE_COMPANY_ALIASES = {
  "AK PLAZA": "AK플라자",
  "코레일유통 고향뜨락": "코레일유통",
  "코레일유통 중소기업명품마루": "코레일유통",
};
const normalizedBrochureLinks = Object.entries(brochureLinks).reduce((map, [company, entries]) => {
  map.set(normalizeCompanyName(company), entries);
  return map;
}, new Map());
const config = {
  googleAppsScriptUrl: "",
  enableSubmission: false,
  turnstileSiteKey: "",
  ...(window.APPLICATION_CONFIG || {}),
};
const state = {
  category: "",
  subcategory: "",
  matchedGroups: [],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const uniq = (arr) => [...new Set(arr.filter(Boolean))];
const byKo = (a, b) => String(a).localeCompare(String(b), "ko");

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeHref(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  try {
    const parsed = new URL(
      /^(https?:)?\/\//i.test(value) ? value : `https://${value}`
    );

    if (!["https:", "http:"].includes(parsed.protocol)) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

function toBrochureEntries(value) {
  if (!value) return [];
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry, index) => {
    if (!entry) return [];
    if (typeof entry === "string") {
      return [{
        label: entries.length > 1 ? `유통사 제안서 ${index + 1} 보기` : "유통사 제안서 보기",
        url: entry,
      }];
    }
    if (entry.url) {
      const sourceLabel = String(entry.label || "");
      const label = sourceLabel.includes("참고자료")
        ? "참고자료 보기"
        : entries.length > 1 ? `유통사 제안서 ${index + 1} 보기` : "유통사 제안서 보기";
      return [{
        label,
        url: entry.url,
      }];
    }
    return [];
  });
}

function normalizeCompanyName(value) {
  return String(value || "")
    .replace(/[\s()[\]{}_.-]/g, "")
    .toLowerCase();
}

function brochureEntriesFor(company) {
  const alias = BROCHURE_COMPANY_ALIASES[company];
  return brochureLinks[company]
    || normalizedBrochureLinks.get(normalizeCompanyName(company))
    || (alias ? brochureLinks[alias] || normalizedBrochureLinks.get(normalizeCompanyName(alias)) : null);
}

function normalize(value) {
  return String(value || "")
    .replace(/[,\s]/g, "")
    .replace("기초색조", "기초/색조")
    .trim();
}

function values(name) {
  return $$(`[name="${name}"]:checked`).map((input) => input.value);
}

function singleValue(name) {
  return new FormData($("#applicationForm")).get(name) || "";
}

function getSubmissionId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `submission-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clearDrafts() {
  sessionStorage.removeItem(DRAFT_KEY);
  localStorage.removeItem(DRAFT_KEY);
  LEGACY_DRAFT_KEYS.forEach((key) => localStorage.removeItem(key));
}

function rowHasValue(list = [], selected) {
  const target = normalize(selected);
  return list.some((item) => normalize(item) === target);
}

function rowHasIssue(rowIssues = [], selected) {
  const aliases = ISSUE_ALIAS_MAP[selected] || [selected];
  const normalized = rowIssues.map(normalize);
  return aliases.some((alias) => normalized.includes(normalize(alias)));
}

function companyGroups(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!row.company) return;
    if (!map.has(row.company)) {
      map.set(row.company, {
        company: row.company,
        rows: [],
        type: new Set(),
        categories: new Set(),
        channels: new Set(),
        fields: new Set(),
        items: Object.fromEntries(CATEGORIES.map((category) => [category, new Set()])),
        homepage: "",
        brochureEntries: toBrochureEntries(brochureEntriesFor(row.company)),
        score: 0,
      });
    }
    const group = map.get(row.company);
    group.rows.push(row);
    if (row.type) group.type.add(row.type);
    if (!group.homepage && row.homepage) group.homepage = row.homepage;
    (row.categories || []).forEach((item) => group.categories.add(item));
    (row.salesChannels || []).forEach((item) => group.channels.add(item));
    (row.businessFields || []).forEach((item) => group.fields.add(item));
    CATEGORIES.forEach((category) => (row.items?.[category] || []).forEach((item) => group.items[category].add(item)));
  });
  return [...map.values()].map((group) => ({
    ...group,
    type: [...group.type].sort(byKo),
    categories: [...group.categories].sort(byKo),
    channels: [...group.channels].sort(byKo),
    fields: [...group.fields].sort(byKo),
    items: Object.fromEntries(CATEGORIES.map((category) => [category, [...group.items[category]].sort(byKo)])),
  }));
}

function rowMatchesProduct(row) {
  if (!state.category || !state.subcategory) return false;
  const rowHasCategory = (row.categories || []).includes(state.category) || (row.items?.[state.category] || []).length > 0;
  if (!rowHasCategory) return false;
  return rowHasValue(row.items?.[state.category] || [], state.subcategory);
}

function rowMatchesStorage(row) {
  const storage = singleValue("storage");
  if (!storage) return true;
  const blocked = STORAGE_BLOCK_MAP[storage];
  if (!blocked) return true;
  return !rowHasIssue(row.foodUnavailable || [], blocked);
}

function rowMatchesIssues(row) {
  const issues = [...values("foodIssue"), ...values("distributionIssue")].filter((item) => item !== "해당없음");
  const rowIssues = [...(row.commonUnavailable || []), ...(row.foodUnavailable || [])];
  return !issues.some((issue) => rowHasIssue(rowIssues, issue));
}

function rowMatchesInterest(row) {
  const selected = values("interestType");
  if (!selected.length) return true;
  return selected.some((type) => String(row.type || "").includes(type));
}

function scoreGroup(group) {
  let score = 0;
  if (group.categories.includes(state.category)) score += 8;
  if (rowHasValue(group.items[state.category] || [], state.subcategory)) score += 12;
  values("interestType").forEach((type) => {
    if (group.type.some((item) => item.includes(type))) score += 4;
  });
  values("interestChannel").forEach((channel) => {
    if (group.channels.some((item) => normalize(item).includes(normalize(channel)) || normalize(channel).includes(normalize(item)))) score += 2;
  });
  return score;
}

function matchedGroups() {
  const rows = data.filter((row) => rowMatchesProduct(row) && rowMatchesStorage(row) && rowMatchesIssues(row) && rowMatchesInterest(row));
  return companyGroups(rows)
    .map((group) => ({ ...group, score: scoreGroup(group) }))
    .sort((a, b) => b.score - a.score || byKo(a.company, b.company));
}

function renderCategoryCards() {
  $("#categoryCards").innerHTML = CATEGORIES.map((category) => `
    <label class="categoryCard ${state.category === category ? "is-selected" : ""}">
      <input type="radio" name="category" value="${escapeHTML(category)}" ${state.category === category ? "checked" : ""} required />
      <strong>${escapeHTML(category)}</strong>
      <span>${CATEGORY_ITEMS[category].length}개 소분류</span>
    </label>
  `).join("");
}

function renderCheckOptions(container, name, options) {
  $(container).innerHTML = options.map((option) => `
    <label><input type="checkbox" name="${escapeHTML(name)}" value="${escapeHTML(option)}" /> ${escapeHTML(option)}</label>
  `).join("");
}

function renderSubcategories() {
  const select = $("#subcategorySelect");
  if (!state.category) {
    select.disabled = true;
    select.innerHTML = `<option value="">대분류를 먼저 선택하세요</option>`;
    return;
  }
  select.disabled = false;
  const options = CATEGORY_ITEMS[state.category] || [];
  if (!options.includes(state.subcategory)) state.subcategory = "";
  select.innerHTML = `<option value="">소분류 선택</option>${options.map((item) => `<option ${item === state.subcategory ? "selected" : ""}>${escapeHTML(item)}</option>`).join("")}`;
}

function toggleFoodFields() {
  const isFood = state.category === "식품";
  $$(".foodOnly").forEach((el) => el.classList.toggle("hidden", !isFood));
  $("#storageSelect").required = isFood;
  $("#shelfLifeSelect").required = isFood;
  if (!isFood) {
    $("#storageSelect").value = "";
    $("#shelfLifeSelect").value = "";
    $$('[name="foodIssue"]').forEach((input) => { input.checked = false; });
  }
}

function rankingNames() {
  return Array.from({ length: 10 }, (_, index) => `rank${index + 1}`);
}

function selectedRanks(exceptName = "") {
  return rankingNames()
    .filter((name) => name !== exceptName)
    .map((name) => singleValue(name))
    .filter(Boolean);
}

function renderRankings() {
  const groups = state.matchedGroups;
  $("#rankingGrid").innerHTML = rankingNames().map((name, index) => {
    const current = singleValue(name);
    const unavailable = selectedRanks(name);
    const options = groups
      .filter((group) => group.company === current || !unavailable.includes(group.company))
      .map((group) => `<option value="${escapeHTML(group.company)}" ${group.company === current ? "selected" : ""}>${escapeHTML(group.company)}</option>`)
      .join("");
    return `<label>${index + 1}순위
      <select class="control rankSelect" name="${name}" ${groups.length ? "" : "disabled"}>
        <option value="">선택 안 함</option>
        ${options}
      </select>
    </label>`;
  }).join("");
}

function reasonText(group) {
  const reasons = [`${state.subcategory} 상담 가능`];
  const interest = values("interestType").filter((type) => group.type.some((item) => item.includes(type)));
  if (interest.length) reasons.push(`${interest.join(", ")} 상담 방향 일치`);
  if (singleValue("storage")) reasons.push(`${singleValue("storage")} 불가 조건 없음`);
  const channelMatches = values("interestChannel").filter((channel) => group.channels.some((item) => normalize(item).includes(normalize(channel)) || normalize(channel).includes(normalize(item))));
  if (channelMatches.length) reasons.push(`${channelMatches.slice(0, 2).join(", ")} 채널 연관`);
  return reasons;
}

function renderMatchedList() {
  const groups = state.matchedGroups;
  $("#matchedDistributorCount").textContent = groups.length.toLocaleString("ko-KR");
  $("#matchCountText").textContent = `${groups.length.toLocaleString("ko-KR")}곳`;
  if (!state.category || !state.subcategory) {
    $("#matchNotice").className = "notice";
    $("#matchNotice").textContent = "대분류와 소분류를 선택하면 상담 가능한 유통사가 표시됩니다.";
    $("#matchedList").innerHTML = "";
    return;
  }
  if (!groups.length) {
    $("#matchNotice").className = "notice warn";
    $("#matchNotice").textContent = "현재 선택 조건에 맞는 유통사가 없습니다. 소분류 또는 특이사항을 다시 확인하세요.";
    $("#matchedList").innerHTML = "";
    return;
  }
  $("#matchNotice").className = "notice ok";
  $("#matchNotice").textContent = "아래 유통사 안에서만 희망 순위를 선택할 수 있습니다.";
  $("#matchedList").innerHTML = groups.slice(0, 60).map((group) => `
    <article class="matchCard">
      <div>
        <h3>${escapeHTML(group.company)}</h3>
        <p>${escapeHTML(group.channels.slice(0, 5).join(" · ") || "주요판매채널 정보 없음")}</p>
        <div class="chips">
          ${group.type.map((item) => `<span>${escapeHTML(item)}</span>`).join("")}
          ${reasonText(group).map((item) => `<span>${escapeHTML(item)}</span>`).join("")}
        </div>
      </div>
      <div class="matchActions">
        ${renderHomepageButton(group)}
        ${renderBrochureButtons(group)}
      </div>
    </article>
  `).join("");
}

function renderHomepageButton(group) {
  const homepage = normalizeHref(group.homepage);
  if (!homepage) return `<span class="matchButton secondary disabled">홈페이지 없음</span>`;
  return `<a class="matchButton secondary" href="${escapeHTML(homepage)}" target="_blank" rel="noopener noreferrer">홈페이지</a>`;
}

function renderBrochureButtons(group) {
  const entries = toBrochureEntries(group.brochureEntries)
    .map((entry) => ({ ...entry, url: normalizeHref(entry.url) }))
    .filter((entry) => entry.url);
  if (!entries.length) return `<span class="matchButton disabled">제안서 없음</span>`;
  return entries.slice(0, 2).map((entry) => `<a class="matchButton" href="${escapeHTML(entry.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(entry.label)}</a>`).join("");
}

function updateMatches() {
  state.matchedGroups = matchedGroups();
  renderRankings();
  renderMatchedList();
  renderPreview();
}

function payload() {
  const formData = new FormData($("#applicationForm"));
  const obj = Object.fromEntries(formData.entries());
  return {
    submissionId: getSubmissionId(),
    submittedAt: new Date().toISOString(),
    pageVersion: PAGE_VERSION,
    companyName: obj.companyName || "",
    businessType: values("businessType"),
    foundedDate: obj.foundedDate || "",
    employeeCount: obj.employeeCount || "",
    managerName: obj.managerName || "",
    managerTitle: obj.managerTitle || "",
    officePhone: obj.officePhone || "",
    mobilePhone: obj.mobilePhone || "",
    email: obj.email || "",
    homepage: obj.homepage || "",
    category: state.category,
    subcategory: state.subcategory,
    storage: obj.storage || "",
    shelfLife: obj.shelfLife || "",
    foodIssues: values("foodIssue"),
    productDetail: obj.productDetail || "",
    interestType: values("interestType"),
    interestChannels: values("interestChannel"),
    currentChannels: values("currentChannel"),
    distributionDetail: obj.distributionDetail || "",
    distributionIssues: values("distributionIssue"),
    randomMatch: obj.randomMatch || "",
    rankings: rankingNames().map((name, index) => ({ rank: index + 1, company: obj[name] || "" })).filter((item) => item.company),
    privacyAgree: obj.privacyAgree === "on",
    confirmationAgree: obj.confirmationAgree === "on",
  };
}

function draftPayload() {
  const value = payload();
  return {
    pageVersion: PAGE_VERSION,
    companyName: value.companyName,
    businessType: value.businessType,
    foundedDate: value.foundedDate,
    employeeCount: value.employeeCount,
    homepage: value.homepage,
    category: value.category,
    subcategory: value.subcategory,
    storage: value.storage,
    shelfLife: value.shelfLife,
    foodIssues: value.foodIssues,
    productDetail: value.productDetail,
    interestType: value.interestType,
    interestChannels: value.interestChannels,
    currentChannels: value.currentChannels,
    distributionDetail: value.distributionDetail,
    distributionIssues: value.distributionIssues,
    randomMatch: value.randomMatch,
    rankings: value.rankings,
    confirmationAgree: value.confirmationAgree,
  };
}

function renderPreview() {
  const value = payload();
  const blocks = [
    ["회사명", value.companyName || "-"],
    ["담당자", [value.managerName, value.managerTitle, value.mobilePhone, value.email].filter(Boolean).join(" / ") || "-"],
    ["상담 품목", [value.category, value.subcategory, value.productDetail].filter(Boolean).join(" / ") || "-"],
    ["식품 조건", [value.storage, value.shelfLife, value.foodIssues.join(", ")].filter(Boolean).join(" / ") || "-"],
    ["관심 분야", value.interestType.join(", ") || "-"],
    ["희망 순위", value.rankings.map((item) => `${item.rank}순위 ${item.company}`).join("\n") || "-"],
  ];
  $("#previewContent").innerHTML = blocks.map(([title, body]) => `
    <div class="previewBlock">
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(body)}</p>
    </div>
  `).join("");
}

function setStatus(message, tone = "") {
  const status = $("#statusMessage");
  status.textContent = message;
  status.className = `statusMessage ${tone}`.trim();
}

function isSubmissionEnabled() {
  return Boolean(config.enableSubmission && normalizeHref(config.googleAppsScriptUrl));
}

function applySubmissionState() {
  const button = $("#submitBtn");
  if (!button) return;
  const enabled = isSubmissionEnabled();
  button.disabled = !enabled;
  button.title = enabled ? "" : "현재 신청 접수 준비 중입니다.";
  if (!enabled) {
    setStatus("현재 신청 접수 준비 중입니다.", "warning");
  }
}

function submissionEndpoint() {
  const endpoint = normalizeHref(config.googleAppsScriptUrl);
  if (!endpoint) return "";
  const url = new URL(endpoint);
  url.searchParams.set("origin", window.location.origin);
  return url.href;
}

function isTooLong(value) {
  return String(value || "").length > MAX_FIELD_LENGTH;
}

function validatePayload(value) {
  const errors = [];
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const mobilePattern = /^01[016789]-?\d{3,4}-?\d{4}$/;

  if (!value.companyName.trim()) errors.push("회사명을 입력하세요.");
  if (!value.managerName.trim()) errors.push("담당자명을 입력하세요.");
  if (!emailPattern.test(value.email.trim())) errors.push("이메일 주소 형식을 확인하세요.");
  if (!mobilePattern.test(value.mobilePhone.trim())) errors.push("휴대폰 번호 형식을 확인하세요.");
  if (!value.privacyAgree) errors.push("개인정보 수집·이용에 동의해야 신청할 수 있습니다.");
  if (!value.businessType.length) errors.push("사업형태를 1개 이상 선택하세요.");
  if (!value.interestType.length) errors.push("관심 분야를 1개 이상 선택하세요.");
  if (!value.rankings.length && value.randomMatch !== "예, 희망합니다.") {
    errors.push("상담 희망 유통사를 1곳 이상 선택하거나 임의 매칭을 희망으로 선택하세요.");
  }

  Object.entries(value).forEach(([key, fieldValue]) => {
    if (typeof fieldValue === "string" && isTooLong(fieldValue)) {
      errors.push(`${key} 입력값이 너무 깁니다.`);
    }
  });

  return errors;
}

function saveDraft() {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draftPayload()));
  LEGACY_DRAFT_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(DRAFT_KEY);
  setStatus("개인 연락처를 제외한 신청 내용만 이 브라우저 세션에 임시저장했습니다.", "success");
}

function setCheckedValues(name, valuesToSet = []) {
  $$(`[name="${name}"]`).forEach((input) => {
    input.checked = valuesToSet.includes(input.value);
  });
}

function loadDraft() {
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) {
    setStatus("불러올 임시저장 내용이 없습니다.", "warning");
    return;
  }
  try {
    const value = JSON.parse(raw);
    ["companyName", "foundedDate", "employeeCount", "homepage", "storage", "shelfLife", "productDetail", "distributionDetail"].forEach((name) => {
      const field = $(`[name="${name}"]`);
      if (field) field.value = value[name] || "";
    });
    state.category = value.category || "";
    state.subcategory = value.subcategory || "";
    setCheckedValues("businessType", value.businessType);
    setCheckedValues("foodIssue", value.foodIssues);
    setCheckedValues("interestType", value.interestType);
    setCheckedValues("interestChannel", value.interestChannels);
    setCheckedValues("currentChannel", value.currentChannels);
    setCheckedValues("distributionIssue", value.distributionIssues);
    $$('[name="randomMatch"]').forEach((input) => { input.checked = input.value === value.randomMatch; });
    $$('[name="confirmationAgree"]').forEach((input) => { input.checked = Boolean(value.confirmationAgree); });
    renderCategoryCards();
    renderSubcategories();
    toggleFoodFields();
    updateMatches();
    value.rankings?.forEach((item) => {
      const field = $(`[name="rank${item.rank}"]`);
      if (field) field.value = item.company;
    });
    renderRankings();
    renderPreview();
    setStatus("개인 연락처를 제외한 임시저장 내용을 불러왔습니다.", "success");
  } catch {
    setStatus("임시저장 내용을 읽을 수 없습니다.", "error");
  }
}

async function submitForm(event) {
  event.preventDefault();
  if (!$("#applicationForm").reportValidity()) return;
  const value = payload();

  const validationErrors = validatePayload(value);
  if (validationErrors.length) {
    setStatus(validationErrors[0], "error");
    return;
  }

  if (!isSubmissionEnabled()) {
    setStatus("현재 신청 접수 준비 중입니다.", "warning");
    return;
  }

  try {
    setStatus("신청서를 제출하는 중입니다.");
    const response = await fetch(submissionEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(value),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    setStatus("신청서가 제출되었습니다.", "success");
    clearDrafts();
    $("#applicationForm").reset();
    state.category = "";
    state.subcategory = "";
    renderCategoryCards();
    renderSubcategories();
    toggleFoodFields();
    updateMatches();
  } catch (error) {
    setStatus(`제출에 실패했습니다. ${error.message}`, "error");
  }
}

function bindEvents() {
  $("#categoryCards").addEventListener("change", (event) => {
    if (event.target.name !== "category") return;
    state.category = event.target.value;
    state.subcategory = "";
    renderCategoryCards();
    renderSubcategories();
    toggleFoodFields();
    updateMatches();
  });
  $("#subcategorySelect").addEventListener("change", (event) => {
    state.subcategory = event.target.value;
    updateMatches();
  });
  $("#applicationForm").addEventListener("change", (event) => {
    if (event.target.classList.contains("rankSelect")) {
      renderRankings();
      renderPreview();
      return;
    }
    updateMatches();
  });
  $("#applicationForm").addEventListener("input", renderPreview);
  $("#applicationForm").addEventListener("submit", submitForm);
  $("#saveDraftBtn").addEventListener("click", saveDraft);
  $("#loadDraftBtn").addEventListener("click", loadDraft);
}

function init() {
  LEGACY_DRAFT_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(DRAFT_KEY);
  $("#totalDistributorCount").textContent = uniq(data.map((row) => row.company)).length.toLocaleString("ko-KR");
  renderCheckOptions("#interestChannels", "interestChannel", CHANNELS);
  renderCheckOptions("#currentChannels", "currentChannel", CURRENT_CHANNELS);
  renderCategoryCards();
  renderSubcategories();
  renderRankings();
  renderMatchedList();
  renderPreview();
  bindEvents();
  applySubmissionState();
}

document.addEventListener("DOMContentLoaded", init);
