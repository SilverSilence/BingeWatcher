var latest_title;
var path;
var pageUrl;
var latestUrl;
var currentTabId;
var nextUrl;
var requested = false;
var videoInitiated = false;

function initiateVideoHandler(id) {
    videoInitiated = true;
    chrome.tabs.sendMessage(id, {
        action: "startVideoHandler"
    }, function (response) {
        if (chrome.runtime.lastError) {
            console.log("Error in 'startVideoHandler' send: " + chrome.runtime.lastError.message);
        } else {
            console.log("Succesfully received response: " + response.answer);
        }
    });
}

function setNext(info, tab) {
    if (latest_title === undefined) {
        alert("Please set a title first.");
        return;
    }
    currentTabId = tab.id;
    nextUrl = info.linkUrl;
    pageUrl = info.pageUrl;
    var toSave = {};

    //Request the path
    chrome.tabs.sendMessage(tab.id, {
        action: "getPath",
        link: nextUrl
    }, function (response) {
        if (chrome.runtime.lastError) {
            console.log("Error in 'getPath' send: " + chrome.runtime.lastError.message);
        } else {
            console.log("Succesfully received response: " + response.answer);
            path = response.answer;

            //Save the object
            toSave[latest_title] = {
                pageUrl: pageUrl,
                pathToNext: path
            };
            chrome.storage.sync.set(toSave, function () {
                if (chrome.runtime.lastError) {
                    console.log("Save failed for item: " + latest_title);
                } else {
                    console.log("Save success! Path had value: " + path);
                    initiateVideoHandler(tab.id);
                }
            });
        }
    });
}

function setEntry(info, tab) {
    var title = info.selectionText;
    var pageUrl = info.pageUrl;
    var toSave = {};
    currentTabId = tab.id;
    toSave[title] = {
        pageUrl: pageUrl,
        pathToNext: null
    };
    chrome.storage.sync.set(toSave, function () {
        if (chrome.runtime.lastError) {
            console.log("Save failed for entry: " + chrome.runtime.lastError.message);
        } else {
            console.log("Saved entry with title: " + title);
            latest_title = title;
            latestUrl = pageUrl;
        }
    });
}

function playNextHandler(link) {
    chrome.tabs.update(currentTabId, {
        url: link
    }, function (tab) {
        if (chrome.runtime.lastError) {
            console.log("Failed to play next Url: " + nextUrl + ".\n" + chrome.runtime.lastError.message);
        } else {
            videoInitiated = false;
            nextUrl = link;
            console.log("Succesfully updated tab to 'nextUrl':" + nextUrl);
            pageUrl = nextUrl;
        }
    });
}

function checkLinkForTitle(tabId) {
    console.log("Check if page is known.");
    chrome.storage.sync.get(null, function (items) {
        if (chrome.runtime.lastError) {
            console.log("Error in item retrieval: " + chrome.runtime.lastError.message);
        } else {
            console.log("Successfully retrieved items.");
            for (var key in items) {
                if (items.hasOwnProperty(key)) {
                    if (items[key]["pageUrl"] === latestUrl) {
                        latestUrl = items[key]["pageUrl"];
                        latest_title = key;
                        console.log("Found matching page. Title is: " + latest_title);
                        initiateVideo(tabId);
                        return;
                    }
                }
            }
            console.log("Could not find a matching page.");
        }
    });
}

function loadTitleInTab(link) {
    chrome.tabs.create({
        url: link
    }, function (tab) {
        currentTabId = tab.id;
        pageUrl = link;
        latestUrl = link;
        console.log("Successfully created new tab with url:\n" + tab.url);
    });
}

function initiateVideo(tabId) {
    console.log("In 'initiateVideo'. Been initiated: " + videoInitiated);
    if (videoInitiated) return;
    initiateVideoHandler(tabId);
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (tabId != currentTabId) return;

    console.log("Registered Tab Update: " + changeInfo.status);
    if (changeInfo.status === "complete") {
        initiateVideo(tabId);
    }
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    switch (request.action) {
    case "playNext":
        playNextHandler(request.link);
        sendResponse({
            answer: latest_title
        });
        break;
    case "updateTitle":
        latest_title = request.title;
        sendResponse({
            answer: latest_title
        });
        loadTitleInTab(request.link);
        break;
    case "sendTitle":
        isWatchingKnownShow();
        sendResponse({
            answer: latest_title
        });
        break;
    default:
        console.log("Unknown action by content_script.");
        sendResponse({
            answer: "Ended up in default."
        });
        break;
    }
    return true;
});

chrome.contextMenus.create({
    id: "New Next",
    title: "Set as Next Button",
    contexts: ["link"],
    onclick: setNext
});

chrome.contextMenus.create({
    id: "New Entry",
    title: "Title of new entry",
    contexts: ["selection"],
    onclick: setEntry
});