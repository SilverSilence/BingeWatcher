var original_size = {};
var first = true;
var latest_title;
var latestPath;
var nextUrl;
var video;

function getViewport() {

    var viewPortWidth;
    var viewPortHeight;

    // the more standards compliant browsers (mozilla/netscape/opera/IE7) use window.innerWidth and window.innerHeight
    if (typeof window.innerWidth != 'undefined') {
        viewPortWidth = window.innerWidth,
            viewPortHeight = window.innerHeight
    }

    // IE6 in standards compliant mode (i.e. with a valid doctype as the first line in the document)
    else if (typeof document.documentElement != 'undefined' && typeof document.documentElement.clientWidth !=
        'undefined' && document.documentElement.clientWidth != 0) {
        viewPortWidth = document.documentElement.clientWidth,
            viewPortHeight = document.documentElement.clientHeight
    }

    // older versions of IE
    else {
        viewPortWidth = document.getElementsByTagName('body')[0].clientWidth,
            viewPortHeight = document.getElementsByTagName('body')[0].clientHeight
    }
    return [viewPortWidth, viewPortHeight];
}

function getDomPath(el) {
  var stack = [];
  while ( el.parentNode != null ) {
//    console.log(el.nodeName);
    var sibCount = 0;
    var sibIndex = 0;
    for ( var i = 0; i < el.parentNode.childNodes.length; i++ ) {
      var sib = el.parentNode.childNodes[i];
      if ( sib.nodeName == el.nodeName ) {
        if ( sib === el ) {
          sibIndex = sibCount;
        }
        sibCount++;
      }
    }
    if ( el.hasAttribute('id') && el.id != '' ) {
      stack.unshift(el.nodeName.toLowerCase() + '#' + el.id);
    } else if ( sibCount > 1 ) {
      stack.unshift(el.nodeName.toLowerCase() + ':eq(' + sibIndex + ')');
    } else {
      stack.unshift(el.nodeName.toLowerCase());
    }
    el = el.parentNode;
  }
  latestPath = stack.slice(1);
  return latestPath;
}

function querySelectorAllWithEq(selector, document) {
  var remainingSelector = selector;
  var baseElement = document;
  var firstEqIndex = remainingSelector.indexOf(':eq(');

  while (firstEqIndex !== -1) {
    var leftSelector = remainingSelector.substring(0, firstEqIndex);
    var rightBracketIndex = remainingSelector.indexOf(')', firstEqIndex);
    var eqNum = remainingSelector.substring(firstEqIndex + 4, rightBracketIndex);
    eqNum = parseInt(eqNum, 10);

    var selectedElements = baseElement.querySelectorAll(leftSelector);
    if (eqNum >= selectedElements.length) {
      return [];
    }
    baseElement = selectedElements[eqNum];

    remainingSelector = remainingSelector.substring(rightBracketIndex + 1).trim();
    // Note - for now we just ignore direct descendants:
    // 'a:eq(0) > i' gets transformed into 'a:eq(0) i'; we could maybe use :scope
    // to fix this later but support is iffy
    if (remainingSelector.charAt(0) === '>') {
      remainingSelector = remainingSelector.substring(1).trim();
    }

    firstEqIndex = remainingSelector.indexOf(':eq(');
  }

  if (remainingSelector !== '') {
    return Array.from(baseElement.querySelectorAll(remainingSelector));
  }

  return [baseElement];
};


function onScrollHandler(event) {
    if (event.target == video) {
        var newVolume = video.volume - (event.deltaY / 1000); 
        if (event.deltaY > 0) { //scroll down
            video.volume = newVolume < 0 ? 0 : newVolume;
        } else { //scrollUp
            video.volume = newVolume > 1 ? 1 : newVolume;
        }
    }
};

function disableScrolling(){
    var x=window.scrollX;
    var y=window.scrollY;
    window.onscroll=function(evt){
        window.scrollTo(x, y);
    };
};

function enableScrolling(){
    window.onscroll=function(){};
};

function selectQuality() {
    var selectQuality = document.getElementById("selectQuality");
    selectQuality.options.selectedIndex = 0;
}

function videoHandler(){
    if (document.readyState === "complete") {
        console.log("Document ready in videohandler.");
        var videos = document.getElementsByTagName("video");
        video = videos[0];
        if (!video) {
            console.log("No HTML5 Player found!");
            return;
        }
        video.volume = 0.5;
        selectQuality();
        disableScrolling();
        storeOriginalSize(video);
        if (first) {
            first = false;
            console.log("Adding listeners in videohandler.");
            video.addEventListener("wheel", onScrollHandler);
            video.addEventListener("canplay", function() { 
                setNewSize(video)
                requestFullScreen(video); 
                video.play(); 
            });
            video.addEventListener("ended", function() {
                videoEndHandler(video)
            });
            video.addEventListener("pause", function() {
                video.removeEventListener("wheel", onScrollHandler);
                enableScrolling();
                restoreSize(video);
            });
            video.addEventListener("play", function() {
                video.addEventListener("wheel", onScrollHandler);
                disableScrolling();
                setNewSize(video);
            })
        } else {
            console.log("Listeners should already be there.");
        }
        if(!video.paused) {
            setNewSize(video);
            requestFullScreen(video);
        } else {
            video.load();
            video.play();
        }
    } else {
        console.log("Videohandler was called, but document wasn't ready.");
    }
}

function sendPlayNextRequest() {
    console.log("Requesting 'playNext' with URL: " + nextUrl);
    chrome.runtime.sendMessage({ action : "playNext", link: nextUrl}, function(response) {
        if (chrome.runtime.lastError) {
            console.log("Error in 'playNext' send: " + chrome.runtime.lastError);
        } else {
            console.log("Succesfully received 'playNext' answer: " + response.answer);
            latest_title = response.answer;
            first = true;
        }
    });
}

function checkLinkForTitle() {
    console.log("Check if page is known.");
    chrome.storage.sync.get(null, function(items) {
        if(chrome.runtime.lastError) {
            console.log("Error in item retrieval: " + chrome.runtime.lastError.message);
        } else {
            console.log("Successfully retrieved items to look for pageUrl match.");
            for(var key in items) {
                if (items.hasOwnProperty(key)){
                    if (items[key]["pageUrl"] === window.location.href) {
                        latest_title = key;
                        console.log("Found matching page. Title is: " + latest_title);
                        storeAndSendRequest(latestPath);
                        return;
                    }
                }
            }
            console.log("Could not find a matching page.");
            console.log("Video of unknown show has ended.")
        }
    });
}

function videoEndHandler(video) {
    console.log("Detected Video-End Event.");
    restoreSize(video);
    if (latest_title) {
        storeAndSendRequest(latestPath);
    } else {
        checkLinkForTitle();
    }
}

function requestFullScreen(elem) {
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    }
}

function restoreSize(video) {
    video.style.width = original_size.width;
    video.style.height = original_size.height; 
    video.style.position = original_size.position;
    video.style.zIndex = original_size.zIndex;
}

function storeOriginalSize(video) {
    original_size.width         = video.style.width;
    original_size.height        = video.style.height;
    original_size.position      = video.style.position;
    original_size.zIndex        = video.style.zIndex;
}

function setNewSize(video) {
    video.style.position ="fixed";
    video.style.zIndex = "1000";
    video.style.width = "100%";
    video.style.height = "100%";
}

function workaround(video) {
    storeOriginalSize(video);
    setNewSize(video);
}

function getPathHandler(link) {
    var links = document.getElementsByTagName("a");
        for(var i = 0; i < links.length; i++) {
            if (links[i]["href"] === link) {
                link = links[i];
                break;
            }
        }
        return getDomPath(link);
}

function storeAndSendRequest(path){
    var title = latest_title;
    
    chrome.storage.sync.get(title, function(item) {
        if(chrome.runtime.latestError) {
            console.log("Error in getting item to set 'nextUrl':" + chrome.runtime.lastError.message);
        } else {
            console.log("Succesfully retrieved item to store 'nextUrl'.");
            var toSave = item;
            var linkElem = querySelectorAllWithEq(item[title]["pathToNext"].toString().replace(/,/g, " "), document)[0];
            toSave[title]["pageUrl"] = linkElem["href"];
            nextUrl = linkElem["href"];
            chrome.storage.sync.set(toSave, function() {
                if(chrome.runtime.lastError) {
                    console.log("Update failed for 'nextUrl': " + chrome.runtime.lastError.message);
                } else {
                    console.log("Successfully updated 'nextUrl' to: " + linkElem["href"]);
                    sendPlayNextRequest();
                }
            })
        }
    })
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("Received request for action: " + request.action);
    switch(request.action) {
        case "getPath":
            var path = getPathHandler(request.link);
            sendResponse({ answer : path});
            break;
        case "setTitle":
            latest_title = request.title;
            sendResponse({ answer : "Succesfully updated content title to:" + request.title});
        case "startVideoHandler":
            videoHandler();
            sendResponse({ answer: "VideoHandler executed"});
            break;
        default:
            console.log("Unknown action received.");
            break;
    }
    return true;
});

//document.addEventListener("DOMContentLoaded", videoHandler);