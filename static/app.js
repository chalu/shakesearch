const Controller = {};
const validationPtrn = /^[a-zA-Z]{3,}[ a-zA-Z]+$/;

State = {
  searching: false,
};

Controller.showSnackBar = (msg) => {
  const snkBar = document.querySelector("#snackbar");
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

Controller.signalSearchStarted = () => {
  const spnr = document.querySelector("#form span.spinner-grow");
  const ico = document.querySelector("#form svg.bi-search");
  const input = document.querySelector("#form input[type=text]");
  const btn = document.querySelector("#form button[type=submit]");

  requestAnimationFrame(() => {
    spnr.classList.remove("visually-hidden");
    ico.classList.add("visually-hidden");
    input.setAttribute("readonly", "readonly");
    btn.setAttribute("disabled", "disabled");
  });
  State.searching = true;
};

Controller.signalSearchEnded = () => {
  const spnr = document.querySelector("#form span.spinner-grow");
  const ico = document.querySelector("#form svg.bi-search");
  const input = document.querySelector("#form input[type=text]");
  const btn = document.querySelector("#form button[type=submit]");

  requestAnimationFrame(() => {
    spnr.classList.add("visually-hidden");
    ico.classList.remove("visually-hidden");
    input.removeAttribute("readonly");
    btn.removeAttribute("disabled");
  });
  State.searching = false;
};

Controller.search = async (evt) => {
  evt.preventDefault();
  if (State.searching) return;

  const form = evt.target;
  const fData = new FormData(form);
  const query = fData.get("query").trim();

  if (!validationPtrn.test(query)) return;

  let results;
  Controller.signalSearchStarted();
  try {
    const response = await fetch(`/search?q=${query}`);
    results = await response.json();
  } catch (err) {
    Controller.showSnackBar("Search failed. Pls try again!");
    console.warn(err.message);
  } finally {
    Controller.signalSearchEnded();
  }

  if (results) {
    // TODO expand on this check if needed
    Controller.displayResults(results);
  }
};

// TODO move away from displaying the results with a table
Controller.displayResults = (results) => {
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

const startApp = () => {
  const form = document.querySelector("#form");
  if (form) {
    form.addEventListener("submit", Controller.search);
    form.querySelector("input[type=text]").focus();
  }
};

document.addEventListener("DOMContentLoaded", startApp);
