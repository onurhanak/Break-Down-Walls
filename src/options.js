const DEFAULT_ANNAS_ARCHIVE_URL = "https://annas-archive.gl/";

const urlInput = document.getElementById("annasArchiveUrl");
const notification = document.querySelector(".notification");
const errorBox = document.querySelector(".error");

const showError = (message) => {
  errorBox.textContent = message;
  errorBox.style.display = "block";
  notification.style.display = "none";
};

const showSaved = () => {
  errorBox.style.display = "none";
  notification.style.display = "block";
  setTimeout(() => {
    notification.style.display = "none";
  }, 2000);
};

const normalizeUrl = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const href = parsed.origin + parsed.pathname;
  return href.endsWith("/") ? href : `${href}/`;
};

document
  .getElementById("settingsForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    const annasArchiveUrl = normalizeUrl(urlInput.value);
    if (!annasArchiveUrl) {
      showError(
        "Enter a valid http(s) URL, for example https://annas-archive.gl/",
      );
      return;
    }

    const openInTheCurrentTab = document.querySelector(
      "input[name='openInTheCurrentTab']",
    ).checked;

    await browser.storage.sync.set({ annasArchiveUrl, openInTheCurrentTab });

    urlInput.value = annasArchiveUrl;
    showSaved();
  });

document.getElementById("resetUrl").addEventListener("click", () => {
  urlInput.value = DEFAULT_ANNAS_ARCHIVE_URL;
  errorBox.style.display = "none";
});

const restoreOptions = async () => {
  try {
    const stored = await browser.storage.sync.get([
      "annasArchiveUrl",
      "openInTheCurrentTab",
    ]);

    const toSave = {};
    if (stored.annasArchiveUrl === undefined) {
      toSave.annasArchiveUrl = DEFAULT_ANNAS_ARCHIVE_URL;
    }
    if (stored.openInTheCurrentTab === undefined) {
      toSave.openInTheCurrentTab = false;
    }

    if (Object.keys(toSave).length > 0) {
      await browser.storage.sync.set(toSave);
      Object.assign(stored, toSave);
    }

    urlInput.value = stored.annasArchiveUrl;
    document.querySelector("input[name='openInTheCurrentTab']").checked =
      !!stored.openInTheCurrentTab;
  } catch (error) {
    console.log("Error restoring options:", error);
  }
};

document.addEventListener("DOMContentLoaded", restoreOptions);
