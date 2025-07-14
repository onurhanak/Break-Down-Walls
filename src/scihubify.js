// scihubify.js

// REGEX CONSTANTS
const amazonRegex = /dp\/\d{10}/;
const doiRegex = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
const isbnRegex = /^(?=(?:\D*\d){10}(?:(?:\D*\d){3})?$)[\d-]+$/i;

const getMirror = async () => {
  try {
    const storage = await browser.storage.sync.get([
      "articleSource",
      "bookSource",
    ]);
    const { articleSource, bookSource } = storage;
    return [articleSource, bookSource];
  } catch (error) {
    console.error("Error getting mirror sources:", error);
    return [null, null];
  }
};

const openNewTab = async (url) => {
  const storage = await browser.storage.sync.get(["openInTheCurrentTab"]);
  let openInTheCurrentTab = storage.openInTheCurrentTab === "true";

  if (openInTheCurrentTab) {
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

const handlePDFUrl = async (data, isDoi) => {
  const [articleSource, _] = await getMirror();
  if (isDoi) {
    return `${articleSource}${data}`;
  } else {
    return `https://openlibrary.org/isbn/${data}.json`;
  }
};

const getISBNFromTab = async (tabId, script) => {
  try {
    const result = await browser.tabs.executeScript(tabId, { code: script });
    const resultArr = result[0];
    const longest = findLongestString(resultArr);
    const isbn = longest ? longest.replace(/\D/g, "") : null;
    return isbn || false;
  } catch (error) {
    console.error("Error executing content script:", error);
    return false;
  }
};

const getDOIFromTab = async (tabId, script) => {
  try {
    const result = await browser.tabs.executeScript(tabId, { code: script });
    return result;
  } catch (error) {
    console.error("Error executing content script:", error);
    return false;
  }
};

const getISBNFromURL = async (url) => {
  if (amazonRegex.test(url)) {
    const isbn = url.match(amazonRegex)[0].replace("dp/", "");
    return isbn || null;
  }
  return null;
};

const getDOIFromURL = async (url) => {
  if (doiRegex.test(url)) {
    const doi = url.match(doiRegex)[0];
    return doi || null;
  }
  return null;
};

async function openLibraryHandler(properURL) {
  try {
    const response = await fetch(properURL);
    if (!response.ok) throw new Error("OpenLibrary response not ok.");

    const data = await response.json();
    let title = data["full_title"];
    let subtitle = data["subtitle"];
    title =
      title || (subtitle ? `${data["title"]} ${subtitle}` : data["title"]);

    if (!title) {
      showNotification("Book not found.");
      return null;
    }

    const [_, bookSource] = await getMirror();
    if (bookSource.includes("annas-archive.org")) {
      return `https://annas-archive.org/search?q=${encodeURIComponent(title)}`;
    } else {
      return `${bookSource}index.php?req=${encodeURIComponent(title)}&columns[]=t&columns[]=a&columns[]=s&columns[]=y&columns[]=p&columns[]=i&objects[]=f&objects[]=e&objects[]=s&objects[]=a&objects[]=p&objects[]=w&topics[]=l&topics[]=c&topics[]=f&topics[]=a&topics[]=m&topics[]=r&topics[]=s&res=100&filesuns=all`;
    }
  } catch (error) {
    console.log(error);
    showNotification("Could not acquire data from Open Library.");
    return null;
  }
}

async function fetchSciHubDOI(url) {
  try {
    const sciHubURL = `https://sci-hub.se/${url}`;
    const response = await fetch(sciHubURL);
    if (response.ok) {
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");
      const doiElement = doc.getElementById("doi");
      if (doiElement) {
        const doiText = doiElement.textContent.trim();
        if (doiText) return doiText;
      }
    }
  } catch (e) {
    console.error("Error fetching DOI from Sci-Hub:", e);
  }
  return null;
}

async function urlHandler(url, tabID) {
  if (url.includes("goodreads.com")) {
    const isbn = await getISBNFromTab(tabID, goodreadsContentScript);
    if (!isbn) {
      showNotification("Could not extract ISBN from page.");
      return null;
    }
    const properURL = await handlePDFUrl(isbn, false);
    return await openLibraryHandler(properURL);
  } else if (url.includes("books.google")) {
    const isbn = await getISBNFromTab(tabID, googleBooksScript);
    const properURL = await handlePDFUrl(isbn, false);
    return await openLibraryHandler(properURL);
  } else if (url.includes("amazon")) {
    const isbn = await getISBNFromURL(url);
    const properURL = await handlePDFUrl(isbn, false);
    return await openLibraryHandler(properURL);
  } else {
    const doi = await getDOIFromURL(url);
    if (doi) {
      return await handlePDFUrl(doi, true);
    } else {
      const scihubDOI = await fetchSciHubDOI(url);
      if (scihubDOI) {
        return await handlePDFUrl(scihubDOI, true);
      } else {
        const pageDOIArray = await getDOIFromTab(tabID, doiExtractorScript);
        const pageDOI =
          Array.isArray(pageDOIArray) && pageDOIArray.length > 0
            ? pageDOIArray[0]
            : null;
        if (pageDOI) {
          return await handlePDFUrl(pageDOI, true);
        } else {
          showNotification("Could not find DOI or ISBN.");
          return null;
        }
      }
    }
  }
}

async function checkScihub(scihubURL) {
  try {
    const response = await fetch(scihubURL);
    if (response.status === 403) {
      showNotification("Complete Sci-hub captcha challenge.");
      return true;
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const saveBtn = doc.querySelector('button[onclick^="location.href=\'"]');

    if (saveBtn) {
      let saveBtnHref = saveBtn.getAttribute("onclick").match(/'([^']+)'/)[1];
      const origin = new URL(scihubURL).origin;
      saveBtnHref = origin + saveBtnHref;

      const saveBtnResponse = await fetch(saveBtnHref);
      if (saveBtnResponse.status === 403 || saveBtnResponse.status === 404) {
        return false;
      } else {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("Error checking Sci-Hub:", error);
    return false;
  }
}

async function run(url, tabID) {
  if (!url || !tabID) {
    showNotification("Invalid tab or URL.");
    return;
  }

  const result = await urlHandler(url, tabID);
  if (!result) return;

  if (result.includes("sci-hub")) {
    const isAvailable = await checkScihub(result);
    if (isAvailable) {
      openNewTab(result);
    } else {
      showNotification("PDF not available on Sci-hub.");
    }
  } else {
    openNewTab(result);
  }
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

    const doiRegex = /10\\.\\d{4,9}\\/[-._;()/:A-Z0-9]+/gi;

    function extractDOI() {
        const links = [...document.querySelectorAll("a[href]")];

        const firstDOILink = links
            .map(link => link.href)
            .find(href => doiRegex.test(href));

        if (firstDOILink) {
            return firstDOILink;
        }

        const textMatch = document.body.innerText.match(doiRegex);

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

browser.browserAction.onClicked.addListener(main);

browser.commands.onCommand.addListener((command) => {
  if (command === "trigger-action") {
    main();
  }
});
