document.getElementById("settingsForm").addEventListener("submit", async function (event) {
  event.preventDefault();

  let articleSourceValue = document.querySelector("input[name='articleSource']:checked").value;
  let bookSourceValue = document.querySelector("input[name='bookSource']:checked").value;
  const openInTheCurrentTab = document.querySelector("input[name='openInTheCurrentTab']").checked;

  if (articleSourceValue === "custom-scihub") {
    let customValue = document.getElementById("articleSourceCustomScihubInput").value.trim();
    if (customValue) {
      if (!customValue.endsWith("/")) {
        customValue += "/";
      }
      articleSourceValue = customValue;
    } else {
      alert("Please enter a custom Sci-Hub URL");
      return;
    }
  }

  if (articleSourceValue === "custom-annas") {
    let customValue = document.getElementById("articleSourceCustomAnnasInput").value.trim();
    if (customValue) {
      if (!customValue.endsWith("/")) {
        customValue += "/";
      }
      articleSourceValue = customValue;
    } else {
      alert("Please enter a custom Anna's Archive URL");
      return;
    }
  }

  if (bookSourceValue === "custom-libgen") {
    let customValue = document.getElementById("bookSourceCustomLibgenInput").value.trim();
    if (customValue) {
      if (!customValue.endsWith("/")) {
        customValue += "/";
      }
      bookSourceValue = customValue;
    } else {
      alert("Please enter a custom LibGen URL");
      return;
    }
  }

  if (bookSourceValue === "custom-annas") {
    let customValue = document.getElementById("bookSourceCustomAnnasInput").value.trim();
    if (customValue) {
      if (!customValue.endsWith("/")) {
        customValue += "/";
      }
      bookSourceValue = customValue;
    } else {
      alert("Please enter a custom Anna's Archive URL");
      return;
    }
  }

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
    articleSource: "http://sci-hub.ru/",
    bookSource: "https://annas-archive.org/",
    openInTheCurrentTab: false,
  };

  try {
    const stored = await browser.storage.sync.get(["articleSource", "bookSource", "openInTheCurrentTab"]);

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

    // handle article source
    const articleRadio = document.querySelector(`input[name='articleSource'][value='${stored.articleSource}']`);
    if (articleRadio) {
      articleRadio.checked = true;
    } else {
      const isScihub = stored.articleSource.includes("sci-hub");
      if (isScihub) {
        document.getElementById("articleSourceCustomScihubRadio").checked = true;
        document.getElementById("articleSourceCustomScihubInput").value = stored.articleSource;
      } else {
        document.getElementById("articleSourceCustomAnnasRadio").checked = true;
        document.getElementById("articleSourceCustomAnnasInput").value = stored.articleSource;
      }
    }

    // handle book source
    const bookRadio = document.querySelector(`input[name='bookSource'][value='${stored.bookSource}']`);
    if (bookRadio) {
      bookRadio.checked = true;
    } else {
      const isLibgen = stored.bookSource.includes("libgen");
      if (isLibgen) {
        document.getElementById("bookSourceCustomLibgenRadio").checked = true;
        document.getElementById("bookSourceCustomLibgenInput").value = stored.bookSource;
      } else {
        document.getElementById("bookSourceCustomAnnasRadio").checked = true;
        document.getElementById("bookSourceCustomAnnasInput").value = stored.bookSource;
      }
    }

    document.querySelector("input[name='openInTheCurrentTab']").checked = !!stored.openInTheCurrentTab;
  } catch (error) {
    console.log("Error restoring options:", error);
  }
};

document.addEventListener("DOMContentLoaded", restoreOptions);
