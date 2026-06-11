const API_KEY_STORAGE_KEY = "gemini_translate_api_key";
const HISTORY_STORAGE_KEY = "gemini_translate_history";
const HISTORY_LIMIT = 8;
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const apiKeyInput = document.getElementById("apiKey");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const sourceTextInput = document.getElementById("sourceText");
const targetLanguageSelect = document.getElementById("targetLanguage");
const translateBtn = document.getElementById("translateBtn");
const translatedTextOutput = document.getElementById("translatedText");
const sourceLanguageText = document.getElementById("sourceLanguage");
const statusText = document.getElementById("status");
const copyBtn = document.getElementById("copyBtn");
const historyList = document.getElementById("historyList");

init();

function init() {
  apiKeyInput.value = localStorage.getItem(API_KEY_STORAGE_KEY) || "";
  renderHistory();

  saveKeyBtn.addEventListener("click", saveApiKey);
  translateBtn.addEventListener("click", translate);
  copyBtn.addEventListener("click", copyResult);
}

function saveApiKey() {
  const key = apiKeyInput.value.trim();
  if (!key) {
    setStatus("Vui lòng nhập API key trước khi lưu.", true);
    return;
  }

  localStorage.setItem(API_KEY_STORAGE_KEY, key);
  setStatus("Đã lưu API key.");
}

async function translate() {
  const apiKey = apiKeyInput.value.trim() || localStorage.getItem(API_KEY_STORAGE_KEY);
  const sourceText = sourceTextInput.value.trim();
  const targetLanguage = targetLanguageSelect.value;

  if (!apiKey) {
    setStatus("Chưa có API key. Vui lòng nhập và lưu API key.", true);
    return;
  }

  if (!sourceText) {
    setStatus("Vui lòng nhập nội dung cần dịch.", true);
    return;
  }

  setLoading(true);
  setStatus("Đang dịch...");
  sourceLanguageText.textContent = "";

  try {
    const prompt = [
      "Bạn là trợ lý dịch thuật chính xác.",
      `Hãy dịch văn bản sang ngôn ngữ đích: ${targetLanguage}.`,
      "Phát hiện ngôn ngữ nguồn.",
      'Chỉ trả về JSON hợp lệ theo schema: {"detectedSourceLanguage":"...","translation":"..."}.',
      `Văn bản: """${sourceText}"""`
    ].join("\n");

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Lỗi mạng/API: ${response.status}`);
    }

    const data = await response.json();
    const candidateText =
      data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") || "";

    const parsed = parseGeminiResponse(candidateText);

    translatedTextOutput.value = parsed.translation || "";
    sourceLanguageText.textContent = parsed.detectedSourceLanguage
      ? `Ngôn ngữ nguồn phát hiện: ${parsed.detectedSourceLanguage}`
      : "Không xác định được ngôn ngữ nguồn.";

    setStatus("Dịch thành công.");
    saveHistory({
      sourceText,
      targetLanguage,
      detectedSourceLanguage: parsed.detectedSourceLanguage || "Không rõ",
      translation: parsed.translation || ""
    });
  } catch (error) {
    setStatus(error.message || "Đã xảy ra lỗi khi dịch.", true);
  } finally {
    setLoading(false);
  }
}

function parseGeminiResponse(text) {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("Gemini không trả về nội dung.");
  }

  const blockMatch = trimmed.match(/\{[\s\S]*\}/);
  const jsonText = blockMatch ? blockMatch[0] : trimmed;

  try {
    const parsed = JSON.parse(jsonText);
    if (typeof parsed.translation !== "string") {
      throw new Error("Thiếu trường translation trong phản hồi.");
    }

    return {
      detectedSourceLanguage:
        typeof parsed.detectedSourceLanguage === "string" ? parsed.detectedSourceLanguage : "",
      translation: parsed.translation
    };
  } catch {
    return {
      detectedSourceLanguage: "",
      translation: trimmed
    };
  }
}

async function copyResult() {
  const result = translatedTextOutput.value;
  if (!result) {
    setStatus("Chưa có nội dung để sao chép.", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(result);
    setStatus("Đã sao chép kết quả dịch.");
  } catch {
    translatedTextOutput.select();
    document.execCommand("copy");
    setStatus("Đã sao chép kết quả dịch.");
  }
}

function setLoading(isLoading) {
  translateBtn.disabled = isLoading;
  translateBtn.textContent = isLoading ? "Đang dịch..." : "Dịch";
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle("error", isError);
}

function saveHistory(entry) {
  const existing = getHistory();
  existing.unshift({ ...entry, at: new Date().toISOString() });
  const next = existing.slice(0, HISTORY_LIMIT);
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
  renderHistory();
}

function getHistory() {
  const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderHistory() {
  const history = getHistory();
  historyList.innerHTML = "";

  if (!history.length) {
    historyList.innerHTML = "<li>Chưa có lịch sử dịch.</li>";
    return;
  }

  history.forEach((item) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.className = "history-button";
    button.type = "button";
    button.textContent = `${item.detectedSourceLanguage} → ${item.targetLanguage}: ${item.translation.slice(
      0,
      80
    )}${item.translation.length > 80 ? "..." : ""}`;

    button.addEventListener("click", () => {
      sourceTextInput.value = item.sourceText || "";
      translatedTextOutput.value = item.translation || "";
      sourceLanguageText.textContent = `Ngôn ngữ nguồn phát hiện: ${item.detectedSourceLanguage || "Không rõ"}`;
      targetLanguageSelect.value = item.targetLanguage || targetLanguageSelect.value;
    });

    li.appendChild(button);
    historyList.appendChild(li);
  });
}
