
function startElementSelection() {
    console.log("Getting element XPATH");

    document.addEventListener('mouseover', highlightElement, false);
    document.addEventListener('click', saveElementXPath, false);
    let selectedElement = null;

    function highlightElement(e) {
        if (selectedElement) {
            selectedElement.style.outline = '';
        }
        selectedElement = e.target;
        selectedElement.style.outline = '2px solid red';
        e.preventDefault();
    }

    function getXPathForElement(element) {
        const xpath = [];
        let currentElem = element;
        while (currentElem && currentElem.nodeType === Node.ELEMENT_NODE) {
            let index = 0;
            let sibling = currentElem.previousSibling;
            while (sibling) {
                if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE) {
                    sibling = sibling.previousSibling;
                    continue;
                }
                if (sibling.nodeName === currentElem.nodeName) {
                    index++;
                }
                sibling = sibling.previousSibling;
            }
            const tagName = currentElem.nodeName.toLowerCase();
            const pathIndex = `[${index + 1}]`;
            xpath.unshift(`${tagName}${pathIndex}`);
            currentElem = currentElem.parentNode;
        }
        return xpath.length ? `/${xpath.join('/')}` : null;
    }

    function saveElementXPath(e) {
        if (!selectedElement) return;
    
        const xpath = getXPathForElement(selectedElement);
        if (xpath) {
            const elementText = selectedElement.textContent.trim();
            const hostname = new URL(window.location.href).hostname;

            // Save the XPath to client storage
            browser.storage.local.set({ [hostname]: xpath });

            // Send the XPath and element text to the background script
            browser.runtime.sendMessage({
                action: "elementData",
                data: { xpath, text: elementText }
            });
    
            selectedElement.style.outline = '';
            selectedElement = null;
            e.preventDefault();
            e.stopPropagation();
            stopElementSelection();
        }
    }

    function stopElementSelection() {
        document.removeEventListener('mouseover', highlightElement, false);
        document.removeEventListener('click', saveElementXPath, false);
        if (selectedElement) {
            selectedElement.style.outline = '';
            selectedElement = null;
        }
    }
}

function getElementByXPath(xpath) {
    return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "startElementSelection") {
        const hostname = new URL(window.location.href).hostname;
        startElementSelection();

        // console.log(hostname)
        // Check local storage for saved XPath
        // browser.storage.local.get(hostname, (data) => {
        //    const savedXPath = data[hostname];
        //    if (savedXPath) {
               // If XPath is found in storage, use it and send back the data
        //        const element = getElementByXPath(savedXPath);
        //        if (element) {
        //            const textContent = element.textContent.trim();
        //            // Send the data back
        //            browser.runtime.sendMessage({
        //                action: "elementData",
        //                data: { xpath: savedXPath, text: textContent }
        //            });
        //        }
        //    } else {
                // If no XPath found in storage find it
                startElementSelection();
        //    }
        }});
