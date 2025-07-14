document
  .getElementById("settingsForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    const articleSourceValue = document.querySelector(
      "input[name='articleSource']:checked",
    ).value;
    const bookSourceValue = document.querySelector(
      "input[name='bookSource']:checked",
    ).value;
    const openInTheCurrentTab = document.querySelector(
      "input[name='openInTheCurrentTab']",
    ).checked;

    await browser.storage.sync.set({
      articleSource: articleSourceValue,
      bookSource: bookSourceValue,
      openInTheCurrentTab: openInTheCurrentTab,
    });

    const notification = document.querySelector(".notification");
    notification.style.display = "block";

    setTimeout(() => {
      notification.style.display = "none";
    }, 2000);
  });

const restoreOptions = async () => {
  try {
    const { articleSource } = await browser.storage.sync.get("articleSource");
    const articleSelector = articleSource
      ? `input[name='articleSource'][value='${articleSource}']`
      : `input[name='articleSource'][value='http://sci-hub.ru/']`;
    const articleRadio = document.querySelector(articleSelector);
    if (articleRadio) articleRadio.checked = true;
  } catch (error) {
    console.log(`Error restoring article source: ${error}`);
  }

  try {
    const { bookSource } = await browser.storage.sync.get("bookSource");
    const bookSelector = bookSource
      ? `input[name='bookSource'][value='${bookSource}']`
      : `input[name='bookSource'][value='https://annas-archive.org/']`;
    const bookRadio = document.querySelector(bookSelector);
    if (bookRadio) bookRadio.checked = true;
  } catch (error) {
    console.log(`Error restoring book source: ${error}`);
  }

  try {
    const { openInTheCurrentTab } = await browser.storage.sync.get(
      "openInTheCurrentTab",
    );
    document.querySelector("input[name='openInTheCurrentTab']").checked =
      !!openInTheCurrentTab;
  } catch (error) {
    console.log(`Error restoring openInTheCurrentTab: ${error}`);
  }
};

document.addEventListener("DOMContentLoaded", restoreOptions);
