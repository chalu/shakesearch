const ShakeSearch = {
  UI: {},
  State: {
    prevQry: "",
    searching: false,
  },
  Controller: {},
};

// Pattern to validate search term which should be
// a word of >= 3 characters followed by none/more of such words
// separated by space
const validationPtrn = /^[a-zA-Z]{3}[ a-zA-Z]*$/;

/**
 * Submit handler for the search form. Validates search term
 * and calls backed API to see if there are matches to display
 * to the user
 * @param {*} evt The HTML form submit event
 */
ShakeSearch.Controller.search = async (evt) => {
  evt.preventDefault();
  if (ShakeSearch.State.searching) return;

  const form = evt.target;
  const fData = new FormData(form);
  const query = fData.get("query").trim();

  if (!validationPtrn.test(query)) return;
  if (
    ShakeSearch.State.prevQry &&
    ShakeSearch.State.prevQry == query.toLocaleLowerCase()
  ) {
    return;
  }

  let results;
  ShakeSearch.State.prevQry = query.toLocaleLowerCase();
  ShakeSearch.UI.signalSearchStarted();
  try {
    ShakeSearch.UI.prepareToHintResponseDelay();
    const response = await fetch(`/search?q=${query}`);
    results = await response.json();
  } catch (err) {
    ShakeSearch.UI.showSnackBar("Search failed. Pls try again!");
    console.warn(err.message);
  } finally {
    ShakeSearch.UI.signalSearchEnded();
  }

  if (results && results.data) {
    ShakeSearch.Controller.displayResults(results, query);
  }
};

/**
 * Parses, formats and displays the search results from the server
 * @param {object} results metadata response payload for the search
 * @param {string} qry The term the user searched for
 */
ShakeSearch.Controller.displayResults = (results, qry) => {
  const parser = new DOMParser();
  const RE = RegExp;
  // Using reassigned constructor to address
  // Codacy's "Detect non literal regexp" flag
  const qryPtrn = new RE(qry, "gi");

  const entries = results.data.reduce((nodes, { phrase }) => {
    const phraseHighlighted = phrase
      .trim()
      .match(qryPtrn)
      .reduce((marked, q) => {
        return marked.replace(q, `<mark>${q}</mark>`);
      }, phrase);

    const node = parser.parseFromString(
      ShakeSearch.UI.resultItemTPL(phraseHighlighted),
      "text/html"
    );
    nodes.push(node.body.childNodes[0]);
    return nodes;
  }, []);

  const root = document.querySelector("#results");
  const statusInfo = document.querySelector("#status");
  requestAnimationFrame(() => {
    while (root.firstChild) {
      root.removeChild(root.firstChild);
    }
    while (statusInfo.firstChild) {
      statusInfo.removeChild(statusInfo.firstChild);
    }

    requestAnimationFrame(() => {
      root.append(...entries);

      const node = parser.parseFromString(
        ShakeSearch.UI.resultStatsTPL(
          results.total,
          results.data.length,
          results.duration
        ),
        "text/html"
      );
      statusInfo.appendChild(node.body.childNodes[0]);
      statusInfo.classList.remove("visually-hidden");
    });
  });
};

/**
 * Build the HTML markup for each result from the server
 * @param {string} phrase a matching phrase from the server
 * @returns HTML string
 */
ShakeSearch.UI.resultItemTPL = (phrase) => {
  return `
  <div class="col">
    <div class="card border-dark mb-3">
      <div class="card-body">
        <pre class="card-text">
          ${phrase}
        </pre>
      </div>
    </div>
  </div>
  `;
};

/**
 * Build the HTML markup for stats of the search operation
 * @param {integer} totalFound how many matches were found for the query
 * @param {integer} resultSize how many matches were returned with the response
 * @param {integer} duration a sense of how long the server took to carry out the search
 * @returns HTML string
 */
ShakeSearch.UI.resultStatsTPL = (totalFound, resultSize, duration = 500) => {
  let timeCue = "text-bg-dark";
  if (duration >= 2000) {
    timeCue = "text-bg-danger";
  }

  if (duration >= 1500) {
    timeCue = "text-bg-warning";
  }
  const elapsed = parseFloat(duration / 1000).toFixed(2);
  return `
  <div>
    <span class="badge ${timeCue}">${elapsed} seconds</span>
    <br />
    Showing <span class="badge text-bg-success">${resultSize}</span> 
    out of <span class="badge text-bg-success">${totalFound}</span> matches
  </div>
  `;
};

/**
 * Gets the HTML elements for the given CSS selectors
 * @param  {...string} selectors The selectors for the elements we need to get
 * @returns Array of HTML nodes matched by the selectors
 */
ShakeSearch.UI.get = (...selectors) => {
  const nodes = selectors.reduce((gatherer, sel) => {
    gatherer.push(document.querySelector(sel));
    return gatherer;
  }, []);

  if (nodes.length === 1) return nodes[0];
  return nodes;
};

/**
 * A UI activity to carry out, but only if opts.okayToProceed()
 * evaluates to true and after opts.waitUntil has ellapsed
 * @param {Functiont} todo
 * @param {object} opts
 * @returns Promise of the delayed/conditioned activity
 */
ShakeSearch.UI.task = async (todo, opts = {}) => {
  const { waitUntil = 0, okayToProceed = () => true } = opts;

  if (waitUntil <= 0) {
    return new Promise((resolve, reject) => {
      try {
        const out = okayToProceed() === true ? todo() : undefined;
        resolve(out);
      } catch (err) {
        reject(err.message);
      }
    });
  }

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const out = okayToProceed() === true ? todo() : undefined;
        resolve(out);
      } catch (err) {
        reject(err.message);
      }
    }, waitUntil);
  });
};

/**
 * Uses a Promise to show a hint if no response from the server
 * after 2s of issuing a search query
 * @returns Promise
 */
ShakeSearch.UI.prepareToHintResponseDelay = () => {
  const tsk = () => ShakeSearch.UI.showSnackBar("Still busy, pls wait ...");
  const proceedIf = () => ShakeSearch.State.searching === true;

  return ShakeSearch.UI.task(tsk, {
    waitUntil: 2000,
    okayToProceed: proceedIf,
  });
};

/**
 * Use the HTML placeholder to hint the user how they
 * can use the app to search, citing example search terms
 * @param {HTMLInputElement} searchField The field whose placeholder will be used
 */
ShakeSearch.UI.setupTour = (searchField) => {
  let tourId;
  let tourIndex = 0;
  const plays = ["Hamlet", "Macbeth", "Othelo", "Lear", "Romeo"];
  const tour = [
    "",
    "search all of Shakespeare",
    "make your move ...",
    "type ",
    "so much is possible",
    "",
  ];

  const getNextTourStep = () => {
    // only using parseInt to address Codacy's
    // "Variable Assigned to Object Injection Sink" security flag
    let step = tour[parseInt(tourIndex, 10)];
    if (tourIndex === 3) {
      const randomPlay = plays[Math.floor(Math.random() * plays.length)];
      step = `${step} ${randomPlay}`;
    }
    tourIndex = (tourIndex + 1) % tour.length;
    return step;
  };

  const endTourOnClick = () => {
    if (tourId) {
      tourIndex = 0;
      requestAnimationFrame(() => {
        searchField.setAttribute("placeholder", "");
      });
      clearInterval(tourId);
    }
  };
  searchField.addEventListener("click", endTourOnClick);

  tourId = setInterval(() => {
    requestAnimationFrame(() => {
      const step = getNextTourStep();
      searchField.setAttribute("placeholder", `${step}`);
    });
  }, 2500);
};

/**
 * Shows the user a message for a short period of time
 * @param {string} msg The message to show
 * @param {integer} dismissAfter How long before automatically dismissing the message
 */
ShakeSearch.UI.showSnackBar = (msg, dismissAfter = 3000) => {
  const snkBar = ShakeSearch.UI.get("#snackbar");
  requestAnimationFrame(() => {
    snkBar.innerText = msg;
    snkBar.classList.add("show");
  });

  setTimeout(() => {
    requestAnimationFrame(() => {
      snkBar.classList.remove("show");
    });
  }, dismissAfter);
};

/**
 * Use a visual cue to hint the user that their search has been initiated
 * and the request sent to the backend
 */
ShakeSearch.UI.signalSearchStarted = () => {
  const [spnr, ico, input, btn] = ShakeSearch.UI.get(
    "#form span.spinner-grow",
    "#form svg.bi-search",
    "#form input[type=text]",
    "#form button[type=submit]"
  );

  requestAnimationFrame(() => {
    spnr.classList.remove("visually-hidden");
    ico.classList.add("visually-hidden");
    input.setAttribute("readonly", "readonly");
    btn.setAttribute("disabled", "disabled");
  });

  ShakeSearch.State.searching = true;
};

/**
 * Use a visual cue to hint the user that their search request has completed.
 * Completion could mean there was/wasn't a match or even that the server
 * encountered an error
 */
ShakeSearch.UI.signalSearchEnded = () => {
  const [spnr, ico, input, btn] = ShakeSearch.UI.get(
    "#form span.spinner-grow",
    "#form svg.bi-search",
    "#form input[type=text]",
    "#form button[type=submit]"
  );

  requestAnimationFrame(() => {
    spnr.classList.add("visually-hidden");
    ico.classList.remove("visually-hidden");
    input.removeAttribute("readonly");
    btn.removeAttribute("disabled");
  });

  ShakeSearch.State.searching = false;
};

/**
 * Start the app, setup event handlers and wait for
 * the user to make their move
 */
ShakeSearch.Controller.startApp = () => {
  const form = ShakeSearch.UI.get("#form");
  if (!form) return;

  form.addEventListener("submit", ShakeSearch.Controller.search);
  const searchField = form.querySelector("input[type=text]");
  searchField.focus();

  const urlParams = new URL(document.location).searchParams;
  if (urlParams && (urlParams.get("q") || urlParams.get("query"))) {
    const query = (urlParams.get("q") || urlParams.get("query")).trim();
    searchField.value = query;
    form.querySelector("button").click();
    return;
  }

  ShakeSearch.UI.setupTour(searchField);
};

document.addEventListener("DOMContentLoaded", ShakeSearch.Controller.startApp);
