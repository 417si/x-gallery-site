// ==== 設定 ====
const SHEET_ID = "1JqdW6H_lVMaOHhIAGijVVRXqUar8p43n_x_-fRgOHTo";
const SHEET_NAME = "シート1";
const IMAGE_BASE_URL = "https://34.16.106.234.nip.io";
const PAGE_SIZE = 40;
// ==============

const galleryEl = document.getElementById("gallery");
const loadMoreBtn = document.getElementById("load-more");
const emptyMessageEl = document.getElementById("empty-message");
const hashtagFilterEl = document.getElementById("hashtag-filter");
const lightboxEl = document.getElementById("lightbox");
const lightboxImgEl = document.getElementById("lightbox-img");
const lightboxLinkEl = document.getElementById("lightbox-link");
const lightboxCloseEl = document.getElementById("lightbox-close");

let allItems = [];
let filteredItems = [];
let currentHashtag = "";
let shownCount = 0;

async function fetchSheetRows() {
  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}&headers=1`;

  const res = await fetch(url);
  const text = await res.text();
  const match = text.match(/setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) throw new Error("スプレッドシートの応答を解析できませんでした");

  // gviz は日付セルを Date(y,m,d,...) というJSONとして無効な形式で埋め込むことがあるため、
  // JSON.parse できる形に変換しておく
  const jsonText = match[1].replace(/Date\(([^)]+)\)/g, (_, args) => {
    const p = args.split(",").map(Number);
    const d = new Date(p[0], p[1] || 0, p[2] || 1, p[3] || 0, p[4] || 0, p[5] || 0);
    return JSON.stringify(d.toISOString());
  });

  const data = JSON.parse(jsonText);
  const labels = data.table.cols.map((c) => (c.label || "").trim());

  return data.table.rows.map((row) => {
    const obj = {};
    (row.c || []).forEach((cell, i) => {
      obj[labels[i]] = cell ? cell.v ?? "" : "";
    });
    return obj;
  });
}

function toImageItem(row) {
  let imagePath = String(row["image_path"] || "");
  if (imagePath.startsWith("images/")) {
    imagePath = imagePath.slice("images/".length);
  }
  return {
    tweet_url: row["tweet_url"] || "",
    author_handle: row["author_handle"] || "",
    author_name: row["author_name"] || "",
    posted_at: row["posted_at"] || "",
    hashtags: String(row["hashtags"] || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    image_url: imagePath ? `${IMAGE_BASE_URL}/images/${imagePath}` : "",
  };
}

function populateHashtagFilter(items) {
  const counts = new Map();
  for (const item of items) {
    for (const tag of item.hashtags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sorted) {
    const opt = document.createElement("option");
    opt.value = tag;
    opt.textContent = `#${tag} (${count})`;
    hashtagFilterEl.appendChild(opt);
  }
}

function applyFilter() {
  filteredItems = currentHashtag
    ? allItems.filter((item) => item.hashtags.includes(currentHashtag))
    : allItems;
  filteredItems = [...filteredItems].sort((a, b) =>
    String(b.posted_at).localeCompare(String(a.posted_at))
  );
  shownCount = 0;
  galleryEl.innerHTML = "";
  emptyMessageEl.classList.toggle("hidden", filteredItems.length > 0);
  renderNextPage();
}

function renderNextPage() {
  const nextItems = filteredItems.slice(shownCount, shownCount + PAGE_SIZE);
  for (const item of nextItems) {
    if (!item.image_url) continue;
    const card = document.createElement("div");
    card.className = "card";

    const imgEl = document.createElement("img");
    imgEl.src = item.image_url;
    imgEl.loading = "lazy";
    imgEl.alt = item.author_name || item.author_handle;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `@${item.author_handle}`;

    card.appendChild(imgEl);
    card.appendChild(meta);
    card.addEventListener("click", () => openLightbox(item));

    galleryEl.appendChild(card);
  }
  shownCount += nextItems.length;
  loadMoreBtn.classList.toggle("hidden", shownCount >= filteredItems.length);
}

function openLightbox(item) {
  lightboxImgEl.src = item.image_url;
  lightboxLinkEl.href = item.tweet_url;
  lightboxEl.classList.remove("hidden");
}

function closeLightbox() {
  lightboxEl.classList.add("hidden");
  lightboxImgEl.src = "";
}

hashtagFilterEl.addEventListener("change", () => {
  currentHashtag = hashtagFilterEl.value;
  applyFilter();
});

loadMoreBtn.addEventListener("click", renderNextPage);
lightboxCloseEl.addEventListener("click", closeLightbox);
lightboxEl.addEventListener("click", (e) => {
  if (e.target === lightboxEl) closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

async function init() {
  try {
    const rows = await fetchSheetRows();
    allItems = rows.map(toImageItem);
    populateHashtagFilter(allItems);
    applyFilter();
  } catch (e) {
    console.error(e);
    emptyMessageEl.textContent = "データの読み込みに失敗しました。";
    emptyMessageEl.classList.remove("hidden");
  }
}

init();
