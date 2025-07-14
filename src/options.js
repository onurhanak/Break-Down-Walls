const saveOptions = (e) => {
  e.preventDefault();

  const articleSourceValue = document.querySelector(
    "input[name='articleSource']:checked",
  ).value;
  browser.storage.sync.set({ articleSource: articleSourceValue });

  const bookSourceValue = document.querySelector(
    "input[name='bookSource']:checked",
  ).value;
  browser.storage.sync.set({ bookSource: bookSourceValue });

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
    const { articleSource } = await browser.storage.sync.get("articleSource");
    if (articleSource) {
      document.querySelector(
        `input[name='articleSource'][value='${articleSource}']`,
      ).checked = true;
    }
  } catch (error) {
    console.log(`Error restoring article source: ${error}`);
  }

  try {
    const { bookSource } = await browser.storage.sync.get("bookSource");
    if (bookSource) {
      document.querySelector(
        `input[name='bookSource'][value='${bookSource}']`,
      ).checked = true;
    }
  } catch (error) {
    console.log(`Error restoring book source: ${error}`);
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
