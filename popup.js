//TODO: More efficient to listen to change, probably
function deleteEntry(event) {
    chrome.storage.sync.remove(event.target.key, function() {
        if (chrome.runtime.lastError) {
            console.log("Failed to delete entry: " + chrome.runtime.lastError.message);
        } else {
            console.log("Successfully deleted entry: " + event.target.key);
            var parentDiv = document.getElementById(event.target.key).parentNode;
            while (parentDiv.hasChildNodes()) {
                parentDiv.removeChild(parentDiv.lastChild);
            }
        }
    })
}

function createDeleteIcon(key) {
    var img = document.createElement("img");
    img.src = "http://findicons.com/files/icons/1580/devine_icons_part_2/128/trash_recyclebin_empty_closed.png";
    img.style.float = "right";
    img.style["width"] = "auto";
    img.style["height"] = "1.25em";
    img.style.position = "relative";
    img.style.top = "1px";
    img.onclick = deleteEntry;
    img.key = key
    return img;
}

function createLinkItem(key, item) {
    var a = document.createElement("a");
    a.id = key;
    a.innerHTML = key;
    a.className += "list_item ";
    a.setAttribute("href", item["pageUrl"]);
    a.onclick = requestTitleUpdate;
    a.style.margin.bottom = "10px";
    a.style["font-size"] = "1.25em";
    return a;
}

function popupScript() {
    chrome.storage.sync.get(null, function(items) {
        if(chrome.runtime.lastError) {
            console.log("Failed to retrieve items in popup: " + chrome.runtime.lastError.message);
        } else {
            console.log("Succesfully retrieved items in popup.");
            var list = document.getElementById("list");
            for (var key in items) {
                if (items.hasOwnProperty(key)) {
                    if (!document.getElementById(key)) {
                        var div = document.createElement("div");
                        var img = createDeleteIcon(key);
                        var a = createLinkItem(key, items[key]);
                        list.appendChild(div);
                        div.appendChild(a);
                        div.appendChild(img);
                    }
                }
            }
            
        }   
    })
}

function requestTitleUpdate(event) {
    var title = event.target.id;
    var link = event.target.href;
    chrome.runtime.sendMessage({ action: "updateTitle", title : title, link : link}, function(response) {
        if(chrome.runtime.lastError) {
            console.log("Failed to send 'updateTitle'. " + chrome.runtime.lastError.message);
        } else {
            console.log("Succefully set title to: " + response.answer);
        }
    })
}

document.onreadystatechange = function() {
    if (document.readyState === "complete") {
        popupScript(); 
    }
}