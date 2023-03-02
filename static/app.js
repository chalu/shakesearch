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
    ShakeSearch.Controller.showSnackBar("Search failed. Pls try again!");
    console.warn(err.message);
  } finally {
    ShakeSearch.Controller.signalSearchEnded();
  }

  if (results) {
    // TODO expand on this check if needed
    ShakeSearch.Controller.displayResults(results, query);
  }
};

// TODO move away from displaying the results with a table
ShakeSearch.Controller.displayResults = (results, qry) => {
  const parser = new DOMParser();
  const entries = results.data.reduce((nodes, { phrase }) => {
    const node = parser.parseFromString(
      ShakeSearch.UI.resultItemTPL(phrase),
      "text/html"
    );
    nodes.push(node.body.childNodes[0]);
    return nodes;
  }, []);

  const root = document.querySelector("#results");
  requestAnimationFrame(() => {
    while (root.firstChild) {
      root.removeChild(root.firstChild);
    }
    requestAnimationFrame(() => {
      root.append(...entries);
    });
  });
};

ShakeSearch.UI.resultItemTPL = (phrase) => {
  return `
  <div class="col">
    <div class="card text-bg-secondary mb-3">
      <div class="card-body">
        <p class="card-text">...${phrase}...</p>
      </div>
    </div>
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
  const tsk = () =>
    ShakeSearch.Controller.showSnackBar("Still busy, pls wait ...");
  const proceedIf = () => ShakeSearch.State.searching === true;

  return ShakeSearch.UI.task(tsk, {
    waitUntil: 2000,
    okayToProceed: proceedIf,
  });
};

ShakeSearch.Controller.showSnackBar = (msg, dismissAfter = 3000) => {
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
  if (form) {
    form.addEventListener("submit", ShakeSearch.Controller.search);
    form.querySelector("input[type=text]").focus();
  }
};

document.addEventListener("DOMContentLoaded", ShakeSearch.Controller.startApp);
