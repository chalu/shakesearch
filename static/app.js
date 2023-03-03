const ShakeSearch = {
  UI: {},
  State: {
    prevQry: "",
    searching: false,
  },
  Controller: {},
};

const validationPtrn = /^[a-zA-Z]{3}[ a-zA-Z]*$/;

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
  ShakeSearch.Controller.signalSearchStarted();
  try {
    ShakeSearch.UI.prepareToHintResponseDelay();
    const response = await fetch(`/search?q=${query}`);
    results = await response.json();
  } catch (err) {
    ShakeSearch.UI.showSnackBar("Search failed. Pls try again!");
    console.warn(err.message);
  } finally {
    ShakeSearch.Controller.signalSearchEnded();
  }

  if (results && results.data) {
    ShakeSearch.Controller.displayResults(results, query);
  }
};

ShakeSearch.Controller.displayResults = (results, qry) => {
  const parser = new DOMParser();
  const qryPtrn = new RegExp(qry, "gi");

  const entries = results.data.reduce((nodes, { phrase }) => {
    const phraseHighlighted = phrase.match(qryPtrn).reduce((marked, q) => {
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

ShakeSearch.UI.resultItemTPL = (phrase) => {
  return `
  <div class="col">
    <div class="card border-dark mb-3">
      <div class="card-body">
        <p class="card-text">...${phrase}...</p>
      </div>
    </div>
  </div>
  `;
};

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

ShakeSearch.UI.get = (...selectors) => {
  const nodes = selectors.reduce((gatherer, sel) => {
    gatherer.push(document.querySelector(sel));
    return gatherer;
  }, []);

  if (nodes.length === 1) return nodes[0];
  return nodes;
};

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
 * Uses a Promise to show a hint after 2s of issuing
 * a search query, and no response from the server
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

ShakeSearch.Controller.signalSearchStarted = () => {
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

ShakeSearch.Controller.signalSearchEnded = () => {
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
