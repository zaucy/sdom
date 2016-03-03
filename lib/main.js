"use strict";

// sdom declaration
var sdom = {

  /** Adds hooks to HTMLElement, Document and Window on certain functions to interrupt some
    * events and attributes.
    * @param window - The global dom object 'window' that contains the document and classes
    */
  initHooks(window) {},

  /** Should be called before a script element is executed. The scriptElement's
    * context will default to 'client-only' if left blank. A waring is printed if the
    * script element's context is not 'server', 'server-only', or 'client-only'.
    * @param scriptElement - HTMlScriptElement object
    * @return true if script should execute false otherwise
    */
  scriptPreExecution(scriptElement) {},

  /** Should be called after a script has executed.
    * Note if scriptPreExecution() returns false this should NOT be called.
    * @param scriptElement - HTMLScriptElement object
    * @param source - Source code of the scriptElement
    */
  scriptPostExecution(scriptElement, source) {},

  /** Should be called before just before the document is being serialized.
    * @param document - document object typically `window.document`
    */
  documentPreSerialize(document) {}

  /** Should be called after the document has been serialized.
    * @param document - document object typically `window.document`
    */
  documentPostSerialize(document) {}

  /** Frees any memory sdom created. This should be called once the sessionData
    * is no longer in use.
    */
  cleanup(window) {}
};

// sdom definition
(function() {

  const hookedEvents = [
    "click"
  ];

  function isHookedEventType(eventType) {
    for(let i=0; hookedEvents.length > i; i++) {
      if(eventType === hookedEvents[i]) {
        return true;
      }
    }

    return false;
  }

  function getSdomId(element) {
    return element.getAttribute("data-sdom-id");
  }

  function setSdomId(element, newId) {
    element.setAttribute("data-sdom-id", newId);
  }

  // Simple algorithm for having consistent (but unique) id's
  // @TODO Make actually unique. Currently possible to overlap.
  function createSdomId(window, element) {
    var numIds = window.__sdom.sdomIds.length;
    var numId = 0;
    var numParents = 0;
    var parent = element;
    while(parent) {
      numParents += 1;
      parent = parent.parentElement;
    }

    numId += numParents;

    for(let n=0; element.tagName.length > n; n++) {
      numId += element.tagName.charCodeAt(n);
    }

    numId *= element.textContent.length+1;
    numId *= element.children.length+1;
    numId *= element.attributes.length+1;

    numId = numId >> numIds;

    window.__sdom.sdomIds.push(numId);

    return numId.toString(24);
  }

  function ensureSdomElement(window, element) {
    var id = getSdomId(element);
    if(!id) {
      id = createSdomId(window, element);
      setSdomId(element, id);
      window.__sdom.elements[id] = element;
    }
  }

  function addSdomEvent(window, type, element) {
    if(!element.__sdomEvents) {
      element.__sdomEvents = [];
    }

    element.__sdomEvents.push(type);
  }

  /** remove element from being serialized. */
  function removeElement(element) {
    if(element.remove) {
      element.remove();
    } else
    if(element.parentElement) {
      element.parentElement.removeChild(element);
    }
  }

  function initHTMLElementHooks(HTMLElement) {
    if(!HTMLElement.__sdom) {
      var addEventListener = HTMLElement.prototype.addEventListener;
      var removeEventListener = HTMLElement.prototype.removeEventListener;


      HTMLElement.prototype.addEventListener = function(type, listener, useCapture) {
        var window = this.ownerDocument.defaultView;
        if(isHookedEventType(type)) {
          let id = ensureSdomElement(window, this);
          addSdomEvent(window, type, this);
        }

        return addEventListener.call(this, type, listener, useCapture);
      };

      HTMLElement.prototype.removeEventListener = function(type, listener, useCapture) {
        var window = this.ownerDocument.defaultView;
        return removeEventListener.call(this, type, listener, useCapture);
      };

      HTMLElement.__sdom = true;
    }
  }

  /** @see sdom.initHooks */
  sdom.initHooks = function(window) {
    window.__sdom = {};
    window.__sdom.elements = {};
    window.__sdom.sdomIds = [];

    initHTMLElementHooks(window.HTMLElement);
  };

  /** @see sdom.scriptPreExecution */
  sdom.scriptPreExecution = function(scriptElement) {
    var context = scriptElement.getAttribute("context") || "client-only";

    switch(context) {
      case "server-only":
      case "server":
        return true;
      default:
        console.warn(`Unknown script context '${context}' defaulting to 'client-only'`);
        scriptElement.setAttribute("context", "client-only");
      case "client-only":
        return false;
    }
  };

  /** @see sdom.scriptPostExecution */
  sdom.scriptPostExecution = function(scriptElement, source) {
    var context = scriptElement.getAttribute("context") || "client-only";


  };

  /** @see sdom.documentPreSerialize */
  sdom.documentPreSerialize = function(document) {

    var scriptElements = document.getElementsByTagName("script");

    for(let i=0; scriptElements.length > i; i++) {
      let scriptElement = scriptElements[i];
      let context = scriptElement.getAttribute("context");

      switch(context) {
        case "server":
          scriptElement.removeAttribute("context");
          break;
        case "server-only":
          removeElement(scriptElement);
          break;
      }
    }

    // Adding server side script XMLHttpRequests client side.
    var scriptElement = document.createElement("script");
    document.body.appendChild(scriptElement);

    scriptElement.textContent =
`(function() {
  function sendSdomEvent(eventType, element, e) {
    var req = new XMLHttpRequest;
    req.open("POST", location.href);

    req.send(JSON.stringify({
      id: element.getAttribute("data-sdom-id"),
      eventType: eventType
    }));
  }
  var sdomElements = [];
`;

    for(var sdomId in document.defaultView.__sdom.elements) {
      let sdomElement = document.defaultView.__sdom.elements[sdomId];
      if(sdomElement.hasAttribute("id")) {
        scriptElement.textContent +=
`sdomElements.push(
  { element: document.getElementById("${sdomElement.getAttribute("id")}")
  , events: ${JSON.stringify(sdomElement.__sdomEvents)} }
);`;
      } else {
        scriptElement.textContent +=
`sdomElements.push(
  { element: document.querySelector("*[data-sdom-id='${getSdomId(sdomElement)}']")
  , events: ${JSON.stringify(sdomElement.__sdomEvents)} }
);`;
      }
    }
    scriptElement.textContent +=
`
  for(var i=0; sdomElements.length > i; i++) {
    var sdomElement = sdomElements[i].element;
    var events = sdomElements[i].events;
    for(var n=0; events.length > n; n++) {
      (function() {
        var event = events[n];
        var element = sdomElement;
        var e = e;
        sdomElement.addEventListener(event, function(e){ return sendSdomEvent(event, element, e); });
      }());
    }
  }
}());`;
    // End of script
  };

  /** @see sdom.documentPostSerialize declaration */
  sdom.documentPostSerialize = function(document) {
    // @TODO (maybe) undo script context removals and server-only script removals.
  };

  /** @see sdom.cleanup declaration */
  sdom.cleanup = function(window) {
    delete window.__sdom;
  };

}());

// Put sdom in the global scope.
if(typeof global != "undefined") {
  global.sdom = sdom;
} else {
  this.sdom = sdom;
}
