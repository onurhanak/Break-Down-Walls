const saveOptions = (e) => {
  e.preventDefault();

  const scihubMirrorValue = document.querySelector(
    "input[name='scihub-mirror']:checked",
  ).value;
  browser.storage.sync.set({ scihubMirror: scihubMirrorValue });

  const libgenMirrorValue = document.querySelector(
    "input[name='libgen-mirror']:checked",
  ).value;
  browser.storage.sync.set({ libgenMirror: libgenMirrorValue });

  const annasArchiveCheckbox = document.querySelector(
    "input[name='annas-archive']",
  );
  const useAnnasArchiveValue = annasArchiveCheckbox.checked ? "true" : "false";
  browser.storage.sync.set({ annasArchive: useAnnasArchiveValue });

  const openInTheCurrentTabCheckBox = document.querySelector(
    "input[name='openInTheCurrentTab']",
  );
  const openInTheCurrentTabValue = openInTheCurrentTabCheckBox.checked
    ? "true"
    : "false";
  browser.storage.sync.set({ openInTheCurrentTab: openInTheCurrentTabValue });
};

const restoreOptions = async () => {
  try {
    const { scihubMirror } = await browser.storage.sync.get("scihubMirror");
    if (scihubMirror) {
      document.querySelector(
        `input[name='scihub-mirror'][value='${scihubMirror}']`,
      ).checked = true;
    }
  } catch (error) {
    console.log(`Error restoring Sci-Hub mirror: ${error}`);
  }

  try {
    const { libgenMirror } = await browser.storage.sync.get("libgenMirror");
    if (libgenMirror) {
      document.querySelector(
        `input[name='libgen-mirror'][value='${libgenMirror}']`,
      ).checked = true;
    }
  } catch (error) {
    console.log(`Error restoring LibGen mirror: ${error}`);
  }

  try {
    const { annasArchive } = await browser.storage.sync.get("annasArchive");
    if (annasArchive !== undefined) {
      document.querySelector("input[name='annas-archive']").checked =
        annasArchive === "true";
    }
  } catch (error) {
    console.log(`Error restoring Anna's Archive setting: ${error}`);
  }

  try {
    const { openInTheCurrentTab } = await browser.storage.sync.get(
      "openInTheCurrentTab",
    );
    if (openInTheCurrentTab !== undefined) {
      document.querySelector("input[name='openInTheCurrentTab']").checked =
        openInTheCurrentTab === "true";
    }
  } catch (error) {
    console.log(`Error restoring 'Open in Current Tab' setting: ${error}`);
  }
};

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);

document
  .getElementById("settingsForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();

    var notification = document.querySelector(".notification");
    notification.style.display = "block";

    setTimeout(function () {
      notification.style.display = "none";
    }, 2000);
  });
