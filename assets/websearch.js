(function() {
  /*
    A search widget for static web sites.

    Copyright (C) 2017 Johan Zetterberg

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

  */

  "use strict";

  //alert("Hello world 5!");

  //alert(Object.keys);

  // Make sure the script doesn't break for browser's that don't support "console"
  if(!window.console) console = {};
  if(!console.log) console.log = function() {};
  if(!console.warn) console.warn = function() {};
  if(!console.time) console.time = function() {};
  if(!console.timeEnd) console.timeEnd = function() {};

  // Log JavaScript errors (note: some browsers doesn't support window.onerror)
  window.onerror = function(message, source, lineno, colno, error) {
    //alert(message + " line=" + lineno);
    var errimg = new Image(), w = window, d = document, e = d.documentElement, g = d.getElementsByTagName('body')[0], x = w.innerWidth || e.clientWidth || g.clientWidth, y = w.innerHeight|| e.clientHeight|| g.clientHeight;
    errimg.src = "/js-error?message=" + escape(message) + "&source=" + escape(source) + "&lineno=" + escape(lineno) + "&colno=" + escape(colno) + "&error=" + escape(error) + "&referer=" + escape(document.referrer) + "&screenRes=" + escape(x + "x" + y) + "&userAgent=" + escape(navigator.userAgent) + "&appVersion=" + escape(navigator.appVersion) + "&platform=" + escape(navigator.platform);
  };


  window.addEventListener("load", windowLoaded);
  // note: Some (old) browsers doesn't support window.addEventListener!

  var websearch_input = document.getElementById("websearch_input");

  if(websearch_input) websearch_input.disabled = true;

  function windowLoaded() {

    //alert("websearch loading ...");

    var resultDiv = document.getElementById("websearch_results");

    if(!websearch_input) websearch_input = document.getElementById("websearch_input");


    var websearch_searchButton = document.getElementById("websearch_searchButton"); // optional
    var websearch_clearButton = document.getElementById("websearch_clearButton"); // optional

    if(!websearch_input) throw new Error("No input found for websearch widget. Create a input with type=text and id=websearch_input");

    var pages = {}; // url: {textStrippedFromHtml, headerTitle}
    var fethingPages = false;
    var textRead = false;
    var searchTimer;
    var gotPages = false;

    /*
      Look for RSS links, example:
      <link rel="alternate" type="application/rss+xml" href="../rss_en.xml" title="RSS Feed">
    */
    var links = document.getElementsByTagName("link");
    var rssFilesFound = 0;
    for(var i=0, type, href; i<links.length; i++) {
      type = links[i].getAttribute("type");
      href = links[i].getAttribute("href");
      if(type && type.match(/rss/i)) {
        rssFilesFound++;
        addRssFile(href);
      }
    }
    if(rssFilesFound==0) throw new Error("No RSS file(s) found!");
    else console.log(rssFilesFound + " RSS files found");

    websearch_input.disabled = false;

    if(websearch_searchButton) websearch_searchButton.addEventListener("click", function() {
      //alert("Search button clicked");
      doSearch();
    });


    websearch_input.addEventListener("focus", inputFocus);
    websearch_input.addEventListener("change", inputChange);
    websearch_input.addEventListener("keypress", inputKeyPress);

    if(websearch_clearButton) websearch_clearButton.addEventListener("click", cleanUp);

    function inputFocus() {
      console.log("inputFocus");
      if(!fethingPages && gotPages) fetchPages();
    }

    function inputChange() {
      console.log("inputChange");
      if(websearch_input.value == "") cleanup();
    }

    function inputKeyPress(keyPressEvent) {
      console.log("inputKeyPress");
      keyPressEvent = keyPressEvent || window.event;
      var keyCode = keyPressEvent.keyCode || keyPressEvent.which;
      if (keyCode == 13) doSearch()  // Enter pressed
    }

    function cleanup() {
      if(resultDiv) while(resultDiv.firstChild) resultDiv.removeChild(resultDiv.firstChild);
    }

    function doSearch() {
      console.log("Commence search ...");
      var timeoutTime = 300;
      var searchText = websearch_input.value;
      var pagesCount = Object.keys(pages).length;

      if(searchText == "") return console.warn("No text to search!");

      if(resultDiv) while(resultDiv.firstChild) resultDiv.removeChild(resultDiv.firstChild);
      else {
        resultDiv = document.createElement("div");
        resultDiv.setAttribute("id", "websearch_results"); // So it can be found by getElementById
        resultDiv.setAttribute("class", "websearch_results"); // For styling in CSS

        var referenceNode = websearch_searchButton || websearch_input;
        insertAfter(resultDiv, referenceNode);
      }

      var loadingText = document.createElement("p");
      loadingText.setAttribute("class", "websearch_loading");
      resultDiv.appendChild(loadingText);

      if(!gotPages) {
        console.log("Pages not yet retrieved from RSS ...");
        loadingText.innerText = STR("reading_rss");
      }
      else if(gotPages && pagesCount === 0) {
        throw new Error("No pages to search! Make sure RSS link exist!");
      }
      else if(!fethingPages) {
        console.log("Pages not yet fetched, waiting for them to be fetched ...");
        loadingText.innerText = STR("requesting_pages");
        fetchPages();
        clearTimeout(searchTimer);
        searchTimer = setTimeout(doSearch, timeoutTime);
      }
      else if(fethingPages && !textRead) {
        console.log("Waiting for the pages to fetch ...");
        loadingText.innerText = STR("loading_pages");
        clearTimeout(searchTimer);
        searchTimer = setTimeout(doSearch, timeoutTime);
      }
      else if(fethingPages && textRead) {
        loadingText.innerText = STR("searching_pages");
        search(searchText);
      }
      else throw new Error("fethingPages=" + fethingPages + " textRead=" + textRead + " pages=" + JSON.stringify(pages));

    }

    function search(searchText) {
      // Text content is hopefully no that big so we can make a full text search instead of a stream search
      var found = false;
      var results = 0;
      var pagesSearched = 0;
      var regString = escapeRegExp(searchText);
      var reg = new RegExp(regString, "ig");
      var maxSearchResults = 10;

      while(resultDiv.firstChild) resultDiv.removeChild(resultDiv.firstChild);

      for(var url in pages) {
        if(pages[url].text && pages[url].text.search(reg) != -1) {
          found = true;
          results++;
          //console.log("Found searchText=" + searchText + " on page url=" + url);
          showSearchResult(url);
          if(results >= maxSearchResults) break;
        }
        pagesSearched++;
      }

      if(found) {

        scrollIntoViewIfOutOfView(resultDiv);

        // Try to hide the keyboard on mobile devices
        resultDiv.focus(); // This didin't work
        websearch_input.blur(); // This worked!

        var ruler = document.createElement("hr");
        resultDiv.appendChild(ruler);
      }
      else {
        var searchFailed = document.createElement("p");
        var failString = STR("search_fail", undefined, {searchText: searchText, pagesSearched: pagesSearched});
        searchFailed.appendChild(document.createTextNode(failString));
        //alert(failString);
        resultDiv.appendChild(searchFailed);
      }

      function showSearchResult(url) {

        var resultBoxHeading = document.createElement("h4");
        resultBoxHeading.setAttribute("class", "websearch_result_heading");

        var title = pages[url].title || getFilenameFromPath(url);

        resultBoxHeading.appendChild(document.createTextNode(title));

        var resultBoxLink = document.createElement("a");
        resultBoxLink.setAttribute("href", url);
        resultBoxLink.appendChild(resultBoxHeading);

        var resultBoxBody = document.createElement("p");
        resultBoxBody.setAttribute("class", "websearch_result_body");


        var contextStringsFound = 0;
        var maxContextStrings = 3;

        var text = pages[url].text;
        var arrContextStrings = [];

        var arrExec;
        while((arrExec = reg.exec(text)) !== null  && contextStringsFound < maxContextStrings) addContextString(arrExec);

        arrContextStrings = removeRepetition(arrContextStrings);

        for (var i=0; i<arrContextStrings.length; i++) {
          arrContextStrings[i] = dotsToString(arrContextStrings[i]);

          // Highlight the search string
          arrContextStrings[i] = arrContextStrings[i].replace(new RegExp(regString, "igm"), "<b>" + searchText + "</b>") + "<br>";
        }

        resultBoxBody.innerHTML = arrContextStrings.join("");


        // Reset reg
        reg.lastIndex = 0;

        var resultBox = document.createElement("div");
        resultBox.setAttribute("class", "websearch_resultbox");

        resultBox.appendChild(resultBoxLink);
        resultBox.appendChild(resultBoxBody);

        resultDiv.appendChild(resultBox);

        function addContextString(arrExec) {
          contextStringsFound++;

          var contextLength = 100;
          var contextStart = Math.max(0, arrExec.index-Math.round(contextLength/2) - searchText.length);
          var contextEnd = Math.min(text.length, contextStart+contextLength);

          console.log("contextStart=" + contextStart + " contextEnd=" + contextEnd + " url=" + url);

          // End before a line break if possible
          var lineBreakAfter = text.indexOf("\n", arrExec.index);
          if(lineBreakAfter < arrExec.index - contextLength/2) lineBreakAfter = text.indexOf("\n", arrExec.index + contextLength/4);

          if(lineBreakAfter != -1 && lineBreakAfter-arrExec.index < contextLength/1.5) {
            contextEnd = lineBreakAfter;
            console.log("Corrected contextEnd=" + contextEnd + " because of ending line break");
          }
          else {
            // End after a dot (end of sentence) if possible
            var lastDot = text.indexOf(".", arrExec.index);
            if(lastDot != -1 && lastDot-arrExec.index < contextLength/1.5) {
              contextStart = firstDot;
              console.log("Corrected contextStart=" + contextStart + " because of lastDot");
            }
            else {
              // End before a space
              var lastSpace = text.lastIndexOf(" ", contextEnd);
              if(lastSpace != -1 && (contextEnd - lastSpace) < contextLength/4) {
                contextEnd = lastSpace;
                console.log("Corrected contextEnd=" + contextEnd + " because of last space");
              }
            }
          }

          if((contextEnd - contextStart) < contextLength && contextStart > 0) {
            contextStart = Math.max(0, contextEnd - contextLength);
            console.log("Corrected contextStart=" + contextStart + " because not enough length");
          }

          // Start after a line break if possible
          var lineBreak = text.lastIndexOf("\n", arrExec.index);
          if(lineBreak != -1 && (lineBreak - arrExec.index) < contextLength/1.5) {
            contextStart = lineBreak;
            console.log("Corrected contextStart=" + contextStart + " because of starting line break");
          }
          else {
            // Start after a dot (end of sentence) if possible
            var firstDot = text.lastIndexOf(".", arrExec.index);
            if(firstDot != -1 && arrExec.index-firstDot < contextLength/1.5) {
              contextStart = firstDot;
              console.log("Corrected contextStart=" + contextStart + " because of firstDot");
            }
            else {
              // Start after first space
              var firstSpace = text.indexOf(" ", contextStart);
              if(firstSpace != -1 && (contextStart - firstSpace) < contextLength/4) {
                contextStart = firstSpace + 1;
                contextEnd = Math.min(text.length, contextStart+contextLength);
                console.log("Corrected contextStart=" + contextStart + " contextEnd=" + contextEnd + " because of first space");
              }
            }
          }

          // Sanity check
          if(!(arrExec.index >= contextStart && arrExec.index < contextEnd)) {
            throw new Error("Something went wrong, search string is not in range!\n" +
            "contextStart=" + contextStart + " contextEnd=" + contextEnd + " arrExec.index=" + arrExec.index);
          }

          var contextString = text.substring(contextStart, contextEnd);

          // Update reg so that we don't show the same string again
          reg.lastIndex = contextEnd;

          arrContextStrings.push(contextString);

          //console.log("contextString=" + contextString);

        }

        function dotsToString(contextString) {
          var firstChar = contextString.charAt(0);
          contextString = contextString.trim(); // Trim after getting firstChar so that firstChar can be a line break of tab
          var lastChar = contextString.charAt(contextString.length-1);

          //console.log("firstChar=" + firstChar + " lastChar=" + lastChar);

          if(!(lastChar == "." || lastChar == ";" || lastChar == "?" || lastChar == "!")) contextString += " ...";

          if(!(firstChar == "\n" || firstChar == "\t" || firstChar == ".")) contextString = "... " + contextString;

          return contextString;
        }

        function removeRepetition(arr) {
          //console.log("Remove repetition: arr=" + JSON.stringify(arr, null, 2));
          // Recursive, removes strings the repeats
          for(var i=0; i<arr.length; i++) {
            for(var j=0; j<arr.length; j++) {
              if(arr[i].indexOf(arr[j].trim()) != -1 && j != i) {
                //console.log("arr[" + i + "]=" + arr[i] + "\ncontains arr[" + j + "]=" + arr[j]);
                arr.splice(j, 1);
                return removeRepetition(arr);
              }
            }
          }
          return arr;
        }
      }

    }


    // Some (old) browsers doesn't like this function!! Why?
    function fetchPages() {
      //alert("Fetching pages ...");

      if(!gotPages) throw new Error("Have not yet got the pages from RSS file(s)");

      console.time("Fetch pages for searching");
      fethingPages = true;
      var pagesCount = Object.keys(pages).length;
      var pagesFetched = 0;
      var pagesFailed = 0;
      var retries = {};

      if(pagesCount == 0) console.warn("No pages to fetch!");
      else {
        for(var url in pages) {
          retries[url] = 0;
          fetch(url, pageFetched);
        }
      }

      function pageFetched(err, url) {

        if(err) {
          console.warn("Failed to fetch url=" + url + " code=" + err.code + ": " + err.message);
        }
        else {
          console.log("Successfully fetched url=" + url);
        }

        pagesFetched++;

        //alert("Fetched page " + pagesFetched + " of " + pagesCount + " url=" + pageUrl);
        if(pagesFetched == pagesCount) {
          textRead = true;
          console.timeEnd("Fetch pages for searching");
          //alert("All pages fetched!");
        }
      }

      function fetch(pageUrl, whenDoneFetching) {

        if(typeof whenDoneFetching != "function") throw new Error("whenDoneFetching=" + whenDoneFetching);

        httpGet(pageUrl, function pageFetched(err, text) {

          if(err) return whenDoneFetching(err, pageUrl);

          var page = pages[pageUrl];

          page.text = text.replace(/\r\n/g, "\n"); // Use LF as line break character
          page.text = stripHtmlComments(page.text);
          page.text = contentOfHtmlTag(page.text, "body");
          page.text = stripHtml(page.text); // We are not interested in the HTML tags

          var arrTitle = find(text, "<title>(.*?)</title>\\s{0,}", 1);
          if(arrTitle.length > 0) page.title = arrTitle[0];

          return whenDoneFetching(null, pageUrl);

        });
      }
    }

    function addRssFile(href) {
      if(href.indexOf("://") != -1) var url = href;
      else var url = absolutePath(document.location.href, href)

      console.log("RSS url=" + url);

      httpGet(url, function gotRssFile(err, text) {
        if(err) throw err;

        var items = text.match(/<guid>([^<]+)<\/guid>/ig);

        if(!items) console.warn("Unable to find <guid> in RSS url=" + url + "\ntext=" + text);
        else {
          for(var i=0, pageUrl; i<items.length; i++) {
            Pageurl = items[i].replace(/<\/?guid>/ig,'');
            pages[pageUrl] = {};
            //console.log("Found pageUrl=" + pageUrl);
          }
        }

        gotPages = true;
      });
    }

    function fetchRssFile() {

    }

  }

  function absolutePath(base, relative) {
    // https://stackoverflow.com/questions/14780350/convert-relative-path-to-absolute-using-javascript
    var stack = base.split("/"),
    parts = relative.split("/");
    stack.pop(); // remove current file name (or empty string)
    // (omit if "base" is the current folder without trailing slash)
    for (var i=0; i<parts.length; i++) {
      if (parts[i] == ".")
      continue;
      if (parts[i] == "..")
      stack.pop();
      else
      stack.push(parts[i]);
    }
    return stack.join("/");
  }

  function insertAfter(newNode, referenceNode) {
    // https://stackoverflow.com/questions/4793604/how-to-do-insert-after-in-javascript-without-using-a-library
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
  }

  function find(text, reString, group) {

    var re = new RegExp(reString, "img");

    if(group == undefined) group = 1;

    var arr = [];
    var result = [];

    while ((arr = re.exec(text)) !== null) {
      //log("Found: " + JSON.stringify(arr));
      result.push(arr[group]);
    }

    if(result.length == 0) {
      //log("Did not find " + reString + "");
      //result.push("");
    }

    return result;
  }

  function contentOfHtmlTag(text, tag, nr) {

    //log("Finding content of tag: " + tag);

    if(nr == undefined) nr = 1;

    var originalText = text;

    // Ignore the case
    text = text.toLowerCase();
    tag = tag.toLowerCase();



    var xmpStart = -1;
    var xmpEnd = -1;
    var tagStart = -1;
    var condition = true;
    var xmpTags = [];
    var insideXmp = false;
    var count = 0;

    // Find all xmp tags
    do {
      xmpStart = text.indexOf("<xmp", xmpEnd);
      xmpEnd = text.indexOf("</xmp", xmpStart);

      if(xmpStart != -1) xmpTags.push({start: xmpStart, end: xmpEnd});

    } while(xmpStart != -1)

    //log("xmpTags=" + JSON.stringify(xmpTags));

    // Find tagStart, nr, not inside xml tags
    do {

      tagStart = text.indexOf("<" + tag, tagStart+1);

      //log("tagStart=" + tagStart);

      insideXmp = false;

      for(var i=0; i<xmpTags.length; i++) {
        insideXmp = xmpTags[i].start < tagStart && xmpTags[i].end > tagStart;
        if(insideXmp) break;
      }

      if(!insideXmp) count++;

    } while (count < nr && tagStart != -1);

    if(tagStart == -1) {
      //log("Did not find enough occurencies of " + tag + "");
      return "";
    }


    // Move to the end of the tagStart
    tagStart = text.indexOf(">", tagStart) + 1;


    // Find tag end (cant be inside xmp)
    var tagEnd = tagStart;
    //log("Finding end ...");
    do {

      tagEnd = text.indexOf("</" + tag, tagEnd+1);

      //log("tagEnd=" + tagEnd);

      insideXmp = false;

      for(var i=0; i<xmpTags.length; i++) {
        insideXmp = xmpTags[i].start < tagEnd && xmpTags[i].end > tagEnd;
        if(insideXmp) {
          tagEnd = xmpTags[i].end; // Start looking from here
          break;
        }
      }

    } while (insideXmp && tagEnd != -1);

    if(tagEnd == -1) error(new Error("Could not find tag ending </" + tag + ""));

    // Return the content of the html tag
    return originalText.substring(tagStart, tagEnd);

  }

  function getFilenameFromPath(path) {
    if(path.indexOf("/") > -1) {
      return path.substr(path.lastIndexOf('/')+1);
    }
    else {
      // Assume \ is the folder separator
      return path.substr(path.lastIndexOf('\\')+1);
    }
  }

  function stripHtml(text) {
    return text.replace(/<(?:.|\n)*?>/gm, '');
  }

  function stripHtmlComments(text) {
    text = text.replace(/<!--(?!>)[\S\s]*?-->/g, '');

    if(text.indexOf("<!--") != -1) console.warn("Strip comments might have failed! text contains <!--");
    if(text.indexOf("-->") != -1) console.warn("Strip comments might have failed! text contains -->");

    return text;
  }

  function stripHtmlCommentsOld(text) {
    // https://stackoverflow.com/questions/5653207/remove-html-comments-with-regex-in-javascript
    var COMMENT_PSEUDO_COMMENT_OR_LT_BANG = new RegExp(
    '<!--[\\s\\S]*?(?:-->)?'
    + '<!---+>?'  // A comment with no body
    + '|<!(?![dD][oO][cC][tT][yY][pP][eE]|\\[CDATA\\[)[^>]*>?'
    + '|<[?][^>]*>?',  // A pseudo-comment
    'g');

    text = text.replace(COMMENT_PSEUDO_COMMENT_OR_LT_BANG, "");

    if(text.indexOf("<!--") != -1) console.warn("Strip comments might have failed! text contains <!--");
    if(text.indexOf("-->") != -1) console.warn("Strip comments might have failed! text contains -->");

    return text;
  }

  function escapeRegExp(str) {
    return str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  }

  function scrollIntoViewIfOutOfView(el) {
    if(!el.scrollIntoView) return console.warn("scrollIntoView not supported for el=" + el);

    var topOfPage = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
    var heightOfPage = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
    var elY = 0;
    var elH = 0;
    if (document.layers) { // NS4
      elY = el.y;
      elH = el.height;
    }
    else {
      for(var p=el; p&&p.tagName!='BODY'; p=p.offsetParent){
        elY += p.offsetTop;
      }
      elH = el.offsetHeight;
    }
    if ((topOfPage + heightOfPage) < (elY + elH)) {
      el.scrollIntoView(false);
    }
    else if (elY < topOfPage) {
      el.scrollIntoView(true);
    }
  }

  function httpGet(url, callback, range) {
    var xmlHttp = new XMLHttpRequest();
    var timeoutTimer;
    var timeoutTimeMs = 10000;

    //console.log("Get: url=" + url + " range=" + JSON.stringify(range));

    xmlHttp.onreadystatechange = function httpReadyStateChange() {
      if(xmlHttp.readyState == 4) {
        clearTimeout(timeoutTimer);
        //console.log("Get Status: url=" + url + " xmlHttp.status=" + xmlHttp.status + "");
        //console.log("Headers:\n" + xmlHttp.getAllResponseHeaders());
        if(xmlHttp.status == 200 || xmlHttp.status == 206) {

          var err = null;

          if(range && xmlHttp.status != 206) err = new Error("Made a range=" + JSON.stringify(range) + " request but got a HTTP status=" + xmlHttp.status + " (expected 206)");

          // Nginx seems to give size in characters
          //var size = (xmlHttp.status == 206) ? xmlHttp.getResponseHeader("Size") : xmlHttp.responseText.length;
          var size = xmlHttp.responseText.length;

          if(range && range.end) {
            var rangeLength = ( range.end-range.start + 1 );
            if(size != rangeLength) throw new Error("size=" + size + " and rangeLength=" + rangeLength + " does not match! range=" + JSON.stringify(range) + "");
          }

          callback(err, xmlHttp.responseText, size);
        }
        else {
          var err = new Error(xmlHttp.responseText + " xmlHttp.status=" + xmlHttp.status + " xmlHttp.readyState=" + xmlHttp.readyState);
          err.code = xmlHttp.status;
          callback(err);
        }
      }
      //else console.log("xmlHttp.readyState=" + xmlHttp.readyState);
    }

    // setRequestHeader must be after open, or we'll get a: Uncaught DOMException: Failed to execute 'setRequestHeader' on 'XMLHttpRequest': The object's state must be OPENED.
    xmlHttp.open("GET", url, true); // true for asynchronous
    if(range) xmlHttp.setRequestHeader("Range", "bytes=" + range.start + "-" + (range.end ? range.end : ""));
    xmlHttp.send(null);

    timeoutTimer = setTimeout(timeout, timeoutTimeMs);

    function timeout() {
      var err = new Error("HTTP GET request timed out. xmlHttp.readyState=" + xmlHttp.readyState);
      err.code = "TIMEOUT";
      xmlHttp.onreadystatechange = null;
      xmlHttp.abort();
      callback(err);
    }
  }

  function STR(stringId, lang, vars) {

    if(lang == undefined) lang = navigator.language;

    var defaultLang = "en";

    if(!translations.hasOwnProperty(stringId)) {
      throw new Error("No translation available for stringId=" + stringId);
    }
    else {
      if(!translations[stringId].hasOwnProperty(lang)) {
        console.warn("No translation for stringId=" + stringId + " available for lang=" + lang);
        if(lang != defaultLang) return STR(stringId, defaultLang, vars);
        else throw new Error("No translation for stringId=" + stringId + " with lang=" + lang + " and defaultLang=" + defaultLang);
      }
      else {

        var string = translations[stringId][lang];

        if(vars) {
          for(var name in vars) {
            if(string.indexOf("%" + name + "%") != -1) {
              string = string.replace("%" + name + "%", vars[name]);
            }
            else throw new Error("variable name=" + name + " does not exist in stringId=" + stringId);
          }

          // Check if we forgot a variable. PS. string variables can not have spaces!
          var matches = string.match(/%\w+%/);
          if(matches != null) {
            for(var i=0; i<matches.length; i++) {
              throw new Error("Forgot variable for " + matches[i] + " in " + stringId);
            }
          }
        }

        return string;
      }
    }

  }

  var translations = {
    reading_rss: {
      en: "Reading RRS",
      sv: "Läser in RSS"
    },
    requesting_pages: {
      en: "Requesting pages for searching",
      sv: "Hämtar sidor inför sökning"
    },
    loading_pages: {
      en: "Loading pages for searching",
      sv: "Laddar sidor inför sökning"
    },
    searching_pages: {
      en: "Searching the pages",
      sv: "Söker på sidorna"
    },
    search_fail: {
      en: 'Did not find the string "%searchText%" in any of the %pagesSearched% pages!',
      sv: 'Kunde inte hitta "%searchText%" i någon av de %pagesSearched% sidorna!'
    }
  };


})();
