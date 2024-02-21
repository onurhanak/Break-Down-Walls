// UTILITIES

// constants
const amazonRegex = /dp\/\d{10}/;
const doiRegex = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
const isbnRegex = /^(?=(?:\D*\d){10}(?:(?:\D*\d){3})?$)[\d-]+$/;

const getMirror = async () => {
  try {
    const storage = await browser.storage.sync.get(["annasArchive", "scihubMirror", "libgenMirror"]);
    const { scihubMirror, libgenMirror } = storage;

    // convert str to bool
    const useAnnasArchive = storage.annasArchive === "true";

    console.log(`Anna's Archive setting: ${useAnnasArchive}`);
    if (useAnnasArchive) {
      return [scihubMirror || "https://sci-hub.ru", "https://annas-archive.org/"];
    } else {
      return [scihubMirror || 'https://sci-hub.ru/', libgenMirror || 'https://libgen.rs/'];
    }
  } catch (error) {
    console.log(`Error: ${error}`);
    return ['https://sci-hub.se/', 'https://libgen.rs/'];
  }
};



// opens a new browser tab with the given URL
const openNewTab = (url) => {
  browser.tabs.create({ url });
};

// shows a notification with the given message
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

// utility to get ISBN from page source
function findLongestString(arr) {
  let longestString = "";
  for (const element of arr) {
    if (element.length > longestString.length) {
      longestString = element;
    }
  }
  return longestString;
}

// script to return proper URLs 
const handlePDFUrl = async (data, isDoi) => {
  const [scihubMirror, libgenMirror] = await getMirror();
  if (isDoi) {
    const nexusURL = `https://standard--template--construct-org.ipns.dweb.link/#/nexus_science/doi:${data}`;
    const scihubURL = `${scihubMirror}${data}`;
    return [nexusURL, scihubURL];
  } else {
    const openLibraryApiUrl = `https://openlibrary.org/isbn/${data}.json`;
    return [openLibraryApiUrl];
  }
};

// script to get ISBN from Goodreads or Google Books
const getISBNFromTab = async (tabId, script) => {
  try {
    let result = await browser.tabs.executeScript(tabId, { code: script });
    let resultArr = result[0];
    let longest = findLongestString(resultArr);
    isbn = longest.replace(/\D/g, '');
    return isbn || false;
  } catch (error) {
    console.error("Error executing content script:", error);
    return false;
  }
};


const getISBNFromURL = async (url) => {
  if (amazonRegex.test(url)) {
    const isbn = url.match(amazonRegex)[0].replace('dp/', '');
    return isbn || null;
  } else {
    return null;
  }
};

const getDOIFromURL = async (url) => {
  if (doiRegex.test(url)) {
    const doi = url.match(doiRegex)[0];
    return doi || null;
  } else {
    return null;
  }
};

// get book title from open library
async function openLibraryHandler(properURL) {
  try {
    const response = await fetch(properURL[0]);

    if (!response.ok) {
      throw new Error('OpenLibrary response was not ok.');
    }

    const data = await response.json();
    let title = data["full_title"];
    let subtitle = data['subtitle'];

    title = title || (subtitle ? `${data['title']} ${subtitle}` : data['title']);

    if (!title) {
      showNotification('Book not found.');
      return null;
    }

    const [scihubMirror, secondaryMirror] = await getMirror();

    let searchURL;
    if (secondaryMirror.includes("annas-archive.org")) {
      // Format for Anna's Archive
      searchURL = `https://annas-archive.org/search?q=${encodeURIComponent(title)}`;
    } else {
      // Format for Library Genesis
      searchURL = `${secondaryMirror}search.php?req=${encodeURIComponent(title)}&open=0&res=25&view=simple&phrase=1&column=def`;
    }

    return searchURL;
  } catch (error) {
    console.log(error);
    showNotification('Could not acquire data from Open Library.');
    return null;
  }
}


async function fetchSciHubDOI(url) {
  const sciHubURL = `https://sci-hub.se/${url}`;
  const response = await fetch(sciHubURL);
  if (response.ok) {
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const doiElement = doc.getElementById('doi');
    if (doiElement) {
      const doiText = doiElement.textContent.trim();
      if (doiText) {
        return doiText;
      }
    }
  }
  return null;
}

async function urlHandler(url, tabID) {
  if (url.includes("goodreads.com")) {
    const isbn = await getISBNFromTab(tabID, goodreadsContentScript);
    if (!isbn) {
      showNotification('Could not extract ISBN from page.');
      return null;
    }
    const properURL = await handlePDFUrl(isbn, false);
    const finalURL = await openLibraryHandler(properURL);
    return finalURL || null;
  } else if (url.includes("books.google")) {
    const isbn = await getISBNFromTab(tabID, googleBooksScript);
    const properURL = await handlePDFUrl(isbn, false);
    const finalURL = await openLibraryHandler(properURL);
    return finalURL || null;
  } else if (url.includes("amazon")) {
    const isbn = await getISBNFromURL(url);
    const properURL = await handlePDFUrl(isbn, false);
    const finalURL = await openLibraryHandler(properURL);
    return finalURL || null;
  } else {
    const doi = await getDOIFromURL(url);
    if (doi) {
      const [nexusURL, scihubURL] = await handlePDFUrl(doi, true);
      return [nexusURL, scihubURL] || [null, null];
    } else {
      const scihubDOI = await fetchSciHubDOI(url);
      if (scihubDOI) {
        const [nexusURL, scihubURL] = await handlePDFUrl(scihubDOI, true);
        return [nexusURL, scihubURL] || [null, null];
      } else {
        showNotification('Could not find DOI or ISBN.');
        browser.tabs.sendMessage(tabID, { action: "startElementSelection" });
        return null;
      }
    }
  }
}

async function checkScihub(scihubURL) {
  try {
    const response = await fetch(scihubURL);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const saveBtn = doc.querySelector('button[onclick^="location.href=\'"]');
    const captchaBtn = doc.querySelector('input#answer');
    if (captchaBtn) {
      // scihub asks for captcha
      return true;
    } else if (saveBtn) {
      var saveBtnHref = saveBtn.getAttribute("onclick").match(/'([^']+)'/)[1];
      saveBtnHref = 'https://sci-hub.ru' + saveBtnHref
      const saveBtnResponse = await fetch(saveBtnHref);
      if (saveBtnResponse.status === 404) {
        // Sci-Hub returned a 404 Not Found page, try Nexus instead
        return false;
      } else {
        return true
      }
    }
    return false;
  } catch (error) {
    console.error("Error checking Sci-Hub:", error);
    return false;
  }
}


async function run(url, tabID) {
  const result = await urlHandler(url, tabID);
  if (Array.isArray(result)) {
    // It returned an array, which means it's a DOI URL and has two values
    const [nexusURL, scihubURL] = result;

    const isAvailableFromScihub = await checkScihub(scihubURL);
    if (isAvailableFromScihub) {
      openNewTab(scihubURL);
    } else {
      showNotification('PDF not available on Sci-hub, trying Nexus.');
      openNewTab(nexusURL);
    }
  } else {
    // it returned a single value, which means it's a goodreads, Google Books, or Amazon URL
    const bookURL = result;
    if (bookURL) {
      openNewTab(bookURL);
    }
  }
}

async function main() {
  const [urlTemp, tabID] = await getActiveTabUrl();
  if (urlTemp) {
    const url = urlTemp.replace('/full', '').replace('/text', ''); // edge cases
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

// LISTENERS AND CONTEXT MENU

// Menu
// Firefox Desktop
if (browser.menus) {
  browser.menus.create({
    id: "download",
    title: "Download PDF",
    contexts: ["link"],
  });

  // listener for the menu item click
  browser.menus.onClicked.addListener(async (info) => {
    if (info.menuItemId === "download") {
      const link = info.linkUrl;
      if (link.includes('goodreads.com') || link.includes('books.google')) {
        showNotification("Download Not Available: Open the page and use the menubar icon.");
      } else {
        run(link, null)
      }
    }
  });
} else {
  // pass
}


browser.runtime.onMessage.addListener( async (message, sender, sendResponse) => {
  // Check if the message is the expected type
  if (message.action === "elementData") {
    // Process the received data
    const xpath = message.data.xpath;
    const text = message.data.text;

    let cleanedText = text.replace(/(ISBN:|DOI:)/gi, '').trim();
    console.log(cleanedText)

    const doiMatch = cleanedText.match(doiRegex);
    if (doiMatch) {
      const [nexusURL, scihubURL] = await handlePDFUrl( doiMatch[0], true);
      const isAvailableFromScihub = await checkScihub(scihubURL);
      if (isAvailableFromScihub) {
        openNewTab(scihubURL);
      } else {
        showNotification('PDF not available on Sci-hub, trying Nexus.');
        openNewTab(nexusURL);
      }
    }
  

  // Test for ISBN
  const isbnMatch = cleanedText.match(isbnRegex);
  if (isbnMatch) {
    const properURL = await handlePDFUrl(isbnMatch[0], false);
    const finalURL = await openLibraryHandler(properURL);
    if (finalURL) {
        openNewTab(finalURL);
      }
    }
  }})

// listener for when the browser-action is clicked
browser.browserAction.onClicked.addListener(main);
 




// check updates
function checkForUpdates() {
  // version URL
  const versionUrl = 'https://raw.githubusercontent.com/onurhanak/Break-Down-Walls/main/VERSION';

  // fetch 
  fetch(versionUrl)
    .then(response => response.text())
    .then(latestVersion => {
      const currentVersion = browser.runtime.getManifest().version;

      if (currentVersion !== latestVersion) {
        showNotification('A new version of the extension is available. Please update to the latest version.');
      }
    })
    .catch(error => console.error('Error checking for extension updates:', error));
}

checkForUpdates();

setInterval(checkForUpdates, 86400000); // check for new version everyday
