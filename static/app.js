const ShakeSearch = {
  UI: {},
  State: {
    prevQry: "",
    searching: false,
  },
  Controller: {},
};

const validationPtrn = /^[a-zA-Z]{3}[ a-zA-Z]*$/;

ShakeSearch.UI.get = (...selectors) => {
  const nodes = selectors.reduce((gatherer, sel) => {
    gatherer.push(document.querySelector(sel));
    return gatherer;
  }, []);

  if (nodes.length === 1) return nodes[0];
  return nodes;
};

ShakeSearch.Controller.showSnackBar = (msg) => {
  const snkBar = ShakeSearch.UI.get("#snackbar");
  requestAnimationFrame(() => {
    snkBar.innerText = msg;
    snkBar.classList.add("show");
  });

  // Hide snackbar after 3 secs
  setTimeout(() => {
    requestAnimationFrame(() => {
      snkBar.classList.remove("show");
    });
  }, 3000);
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

ShakeSearch.Controller.search = async (evt) => {
  evt.preventDefault();
  if (ShakeSearch.State.searching) return;

  const form = evt.target;
  const fData = new FormData(form);
  const query = fData.get("query").trim();

  if (!validationPtrn.test(query)) return;
  if (ShakeSearch.State.prevQry && ShakeSearch.State.prevQry == query) return;

  let results;
  ShakeSearch.State.prevQry = query;
  ShakeSearch.Controller.signalSearchStarted();
  try {
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
    ShakeSearch.Controller.displayResults(results);
  }
};

// TODO move away from displaying the results with a table
ShakeSearch.Controller.displayResults = (results) => {
  const rows = results.reduce((trs, txt) => {
    const tr = document.createElement("tr");
    // TODO If needed, sanitize txt before displaying it
    // Dev tools shows it has some special chars (\r\n e.t.c)
    tr.innerText = txt;
    trs.push(tr);
    return trs;
  }, []);

  const tBody = document.querySelector("#table-body");
  requestAnimationFrame(() => {
    while (tBody.firstChild) {
      tBody.removeChild(tBody.firstChild);
    }
    requestAnimationFrame(() => {
      tBody.append(...rows);
    });
  });
};

ShakeSearch.Controller.startApp = () => {
  const form = ShakeSearch.UI.get("#form");
  if (form) {
    form.addEventListener("submit", ShakeSearch.Controller.search);
    form.querySelector("input[type=text]").focus();
  }
};

document.addEventListener("DOMContentLoaded", ShakeSearch.Controller.startApp);
