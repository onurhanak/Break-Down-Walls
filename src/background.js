// background.js

const AMAZON_ASIN_REGEX = /dp\/\d{10}/;
const DOI_REGEX = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;

const DEFAULT_ANNAS_ARCHIVE_URL = "https://annas-archive.gl/";

const normalizeBaseUrl = (url) => (url.endsWith("/") ? url : `${url}/`);

const getAnnasArchiveUrl = async () => {
  try {
    const { annasArchiveUrl } =
      await browser.storage.sync.get("annasArchiveUrl");
    return normalizeBaseUrl(annasArchiveUrl || DEFAULT_ANNAS_ARCHIVE_URL);
  } catch (error) {
    console.error("Error reading Anna's Archive URL:", error);
    return DEFAULT_ANNAS_ARCHIVE_URL;
  }
};

const buildScidbUrl = async (doi) => `${await getAnnasArchiveUrl()}scidb/${doi}`;

const buildSearchUrl = async (title) =>
  `${await getAnnasArchiveUrl()}search?q=${encodeURIComponent(title)}`;

const buildOpenLibraryUrl = (isbn) =>
  `https://openlibrary.org/isbn/${isbn}.json`;

const openNewTab = async (url) => {
  const { openInTheCurrentTab } = await browser.storage.sync.get(
    "openInTheCurrentTab",
  );

  if (openInTheCurrentTab === true || openInTheCurrentTab === "true") {
    browser.tabs.update({ url });
  } else {
    browser.tabs.create({ url });
  }
};

const showNotification = (message) => {
  browser.notifications.create({
    type: "basic",
    iconUrl: browser.runtime.getURL("graduate-hat.png"),
    title: "Notification",
    message: message,
  });
};

function getActiveTabUrl() {
  return new Promise((resolve) => {
    browser.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs[0];
      const url = tab.url;
      resolve([url, tab.id]);
    });
  });
}

function findLongestString(arr) {
  let longestString = "";
  for (const element of arr) {
    if (element.length > longestString.length) {
      longestString = element;
    }
  }
  return longestString;
}

const getISBNFromTab = async (tabId, script) => {
  try {
    const result = await browser.tabs.executeScript(tabId, { code: script });
    const resultArr = result[0];
    if (!Array.isArray(resultArr)) return null;
    const longest = findLongestString(resultArr);
    const isbn = longest ? longest.replace(/\D/g, "") : null;
    return isbn || null;
  } catch (error) {
    console.error("Error executing content script:", error);
    return null;
  }
};

const getDOIFromTab = async (tabId, script) => {
  try {
    const result = await browser.tabs.executeScript(tabId, { code: script });
    return Array.isArray(result) && result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("Error executing content script:", error);
    return null;
  }
};

const getISBNFromURL = (url) => {
  const match = url.match(AMAZON_ASIN_REGEX);
  return match ? match[0].replace("dp/", "") : null;
};

const getDOIFromURL = (url) => {
  const match = url.match(DOI_REGEX);
  return match ? match[0] : null;
};

async function resolveBookByISBN(isbn) {
  if (!isbn) {
    showNotification("Could not extract ISBN from page.");
    return null;
  }

  try {
    const response = await fetch(buildOpenLibraryUrl(isbn));
    if (!response.ok) throw new Error("OpenLibrary response not ok.");

    const data = await response.json();
    const subtitle = data["subtitle"];
    const title =
      data["full_title"] ||
      (subtitle ? `${data["title"]} ${subtitle}` : data["title"]);

    if (!title) {
      showNotification("Book not found.");
      return null;
    }

    return await buildSearchUrl(title);
  } catch (error) {
    showNotification("Could not acquire data from Open Library.");
    return null;
  }
}

async function urlHandler(url, tabID) {
  if (url.includes("goodreads.com")) {
    return await resolveBookByISBN(
      await getISBNFromTab(tabID, goodreadsContentScript),
    );
  }

  if (url.includes("books.google")) {
    return await resolveBookByISBN(
      await getISBNFromTab(tabID, googleBooksScript),
    );
  }

  if (url.includes("amazon")) {
    return await resolveBookByISBN(getISBNFromURL(url));
  }

  const pageDOI = await getDOIFromTab(tabID, doiExtractorScript);
  const doi = getDOIFromURL(url) || (pageDOI ? getDOIFromURL(pageDOI) : null);
  if (!doi) {
    showNotification("Could not find DOI or ISBN.");
    return null;
  }

  return await buildScidbUrl(doi);
}

async function run(url, tabID) {
  if (!url || !tabID) {
    showNotification("Invalid tab or URL.");
    return;
  }

  const result = await urlHandler(url, tabID);
  if (result) openNewTab(result);
}

async function main() {
  const [urlTemp, tabID] = await getActiveTabUrl();
  if (urlTemp) {
    const url = urlTemp.replace("/full", "").replace("/text", "");
    run(url, tabID);
  }
}

// CONTENT SCRIPTS

// content script to get ISBN from Goodreads
const goodreadsContentScript = `
  buttons = Array.from(document.querySelectorAll('span'));
  buttonToClick = buttons.find(button => button.innerText === 'Book details & editions');

  if (buttonToClick) {
    buttonToClick.click();
  }
  elements = document.querySelectorAll('.DescListItem');
  isbn = null;

  elements.forEach(element => {
    if (element.firstElementChild && element.firstElementChild.innerText === "ISBN") {
      const secondChild = element.firstElementChild.nextElementSibling;
      if (secondChild) {
        isbn = secondChild.innerText.split(" ");
      }
    }
  });

  isbn;
`;

const doiExtractorScript = `

    var doiRegex = /10\\.\\d{4,9}\\/[-._;()/:A-Z0-9]+/gi;

    function extractDOI() {
        var links = [...document.querySelectorAll("a[href]")];

        var firstDOILink = links
            .map(link => link.href)
            .find(href => href.match(doiRegex));

        if (firstDOILink) {
            return firstDOILink;
        }

        var textMatch = document.body.innerText.match(doiRegex);

        if (textMatch && textMatch.length > 0) {
            return textMatch[0];
        }

        return null;
    }

    extractDOI();
`;

// content script to get ISBN from Google Books
const googleBooksScript = `
  table = document.getElementById('metadata_content_table');
  dataObject = {};

  rows = table.getElementsByTagName('tr');

  for (let i = 1; i < rows.length; i++) {
    row = rows[i];
    cells = row.getElementsByTagName('td');

    if (cells.length >= 2) {
      key = cells[0].textContent.trim(); // Get the text content of the first cell (key)
      value = cells[1].textContent.trim(); // Get the text content of the second cell (value)
      dataObject[key] = value;
    }
  }

  ISBN = dataObject['ISBN']?.split(', ');
  ISBN;
`;

browser.runtime.onInstalled.addListener(async () => {
  const { annasArchiveUrl } = await browser.storage.sync.get("annasArchiveUrl");
  if (annasArchiveUrl === undefined) {
    await browser.storage.sync.set({
      annasArchiveUrl: DEFAULT_ANNAS_ARCHIVE_URL,
    });
  }
  await browser.storage.sync.remove(["articleSource", "bookSource"]);
});

browser.browserAction.onClicked.addListener(main);

browser.commands.onCommand.addListener((command) => {
  if (command === "trigger-action") {
    main();
  }
});
