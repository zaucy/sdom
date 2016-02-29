"use strict";

// sdom declaration
var sdom = {

  /** Adds hooks to HTMLElement, Document and Window on certain functions to interrupt some
    * events and attributes.
    * @param window - The global dom object 'window' that contains the document and classes
    */
  initHooks(window) {}

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
    return element.getAttribute("data-ssdom-id");
  }

  function createSdomId() {

  }

  function ensureSdomElement(window, element) {
    var id = getSdomId(element);
    if(!id) {
      id = createSdomId();
      element.setAttribute("data-ssdom-id", id);
      window.__sdom.elements[id] = element;
    }
  }

  function addSdomEvent(type, element) {

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

  function initHTMLElementHooks(window, HTMLElement) {
    var addEventListener = HTMLElement.prototype.addEventListener;
    var removeEventListener = HTMLElement.prototype.removeEventListener;


    HTMLElement.prototype.addEventListener = function(type, listener, useCapture) {

      if(isHookedEventType(type)) {
        let id = ensureSdomElement(window, this);
        addSdomEvent(window, type, this);
      }

      return addEventListener.call(this, type, listener, useCapture);
    };

    HTMLElement.prototype.removeEventListener = function(type, listener, useCapture) {

      return removeEventListener.call(this, type, listener, useCapture);
    };
  }

  /** @see sdom.initHooks */
  sdom.initHooks = function(window) {
    window.__sdom = {};
    window.__sdom.elements = {};

    initHTMLElementHooks(window, window.HTMlElement);
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

    switch(context) {
      case "server":
        scriptElement.removeAttribute("context");
        break;
      case "server-only":
        removeElement(scriptElement);
        break;
    }
  };

  /** @see sdom.documentPreSerialize */
  sdom.documentPreSerialize = function(document) {
    var scriptElement = document.createElement("script");

    document.querySelectorAll("*[data-sdom-id]")

    document.appendChild(scriptElement);
  };

}());
