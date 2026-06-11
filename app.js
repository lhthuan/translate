const API_KEY_STORAGE_KEY = "gemini_translate_api_key_encrypted";
const HISTORY_STORAGE_KEY = "gemini_translate_history";
const HISTORY_LIMIT = 8;
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const apiKeyInput = document.getElementById("apiKey");
const apiPinInput = document.getElementById("apiPin");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const loadKeyBtn = document.getElementById("loadKeyBtn");
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
  if (localStorage.getItem(API_KEY_STORAGE_KEY)) {
    setStatus("Đã có key mã hóa trong bộ nhớ cục bộ. Nhập PIN để mở khóa.");
  }

  renderHistory();

  saveKeyBtn.addEventListener("click", saveApiKey);
  loadKeyBtn.addEventListener("click", loadApiKey);
  translateBtn.addEventListener("click", translate);
  copyBtn.addEventListener("click", copyResult);
}

async function saveApiKey() {
  const key = apiKeyInput.value.trim();
  const pin = apiPinInput.value.trim();

  if (!key) {
    setStatus("Vui lòng nhập API key trước khi lưu.", true);
    return;
  }

  if (!pin) {
    setStatus("Nhập PIN để lưu key an toàn vào localStorage.", true);
    return;
  }

  if (!window.crypto?.subtle) {
    setStatus("Trình duyệt không hỗ trợ mã hóa Web Crypto.", true);
    return;
  }

  try {
    const encryptedPayload = await encryptText(key, pin);
    localStorage.setItem(API_KEY_STORAGE_KEY, JSON.stringify(encryptedPayload));
    setStatus("Đã mã hóa và lưu API key thành công.");
  } catch {
    setStatus("Không thể mã hóa API key.", true);
  }
}

async function loadApiKey() {
  const pin = apiPinInput.value.trim();
  const saved = localStorage.getItem(API_KEY_STORAGE_KEY);

  if (!saved) {
    setStatus("Chưa có API key mã hóa trong localStorage.", true);
    return;
  }

  if (!pin) {
    setStatus("Vui lòng nhập PIN để mở khóa key đã lưu.", true);
    return;
  }

  try {
    const payload = JSON.parse(saved);
    apiKeyInput.value = await decryptText(payload, pin);
    setStatus("Đã mở khóa API key.");
  } catch {
    setStatus("Không thể mở khóa key. Kiểm tra lại PIN.", true);
  }
}

async function translate() {
  const apiKey = apiKeyInput.value.trim();
  const sourceText = sourceTextInput.value.trim();
  const targetLanguage = targetLanguageSelect.value;

  if (!apiKey) {
    setStatus("Chưa có API key. Vui lòng nhập key hoặc mở khóa key đã lưu.", true);
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

async function encryptText(text, pin) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(text)
  );

  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer))
  };
}

async function decryptText(payload, pin) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);
  const key = await deriveKey(pin, salt);

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return decoder.decode(decrypted || encoder.encode(""));
}

async function deriveKey(pin, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveKey"]);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64Text) {
  return Uint8Array.from(atob(base64Text), (char) => char.charCodeAt(0));
}
