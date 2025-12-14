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
  const defaults = {
    articleSource: 'http://sci-hub.ru/',
    bookSource: 'https://annas-archive.org/',
    openInTheCurrentTab: false
  };

  try {
    const stored = await browser.storage.sync.get([
      'articleSource',
      'bookSource',
      'openInTheCurrentTab'
    ]);

    // defaults for any missing values
    const toSave = {};
    if (stored.articleSource === undefined) {
      toSave.articleSource = defaults.articleSource;
    }
    if (stored.bookSource === undefined) {
      toSave.bookSource = defaults.bookSource;
    }
    if (stored.openInTheCurrentTab === undefined) {
      toSave.openInTheCurrentTab = defaults.openInTheCurrentTab;
    }

    if (Object.keys(toSave).length > 0) {
      await browser.storage.sync.set(toSave);
      Object.assign(stored, toSave);
    }

    const articleRadio = document.querySelector(
      `input[name='articleSource'][value='${stored.articleSource}']`
    );
    if (articleRadio) articleRadio.checked = true;

    const bookRadio = document.querySelector(
      `input[name='bookSource'][value='${stored.bookSource}']`
    );
    if (bookRadio) bookRadio.checked = true;

    document.querySelector("input[name='openInTheCurrentTab']").checked =
      !!stored.openInTheCurrentTab;

  } catch (error) {
    console.log('Error restoring options:', error);
  }
};

document.addEventListener("DOMContentLoaded", restoreOptions);
