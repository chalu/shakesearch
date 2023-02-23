const Controller = {};

Controller.search = async (evt) => {
  evt.preventDefault();
  const form = evt.target;
  const { query } = Object.fromEntries(new FormData(form));
  // TODO handle validation
  // TODO update UI that search has begun

  let results;
  try {
    const response = await fetch(`/search?q=${query}`);
    results = await response.json();
  } catch (err) {
    console.warn(err.message);
    // TODO inform user
  } finally {
    // TODO update UI that search has ended
  }

  if (results) {
    // TODO expand on this check if needed
    Controller.displayResults(results);
  }
};

// TODO move away from displaying the results with a table
Controller.displayResults = (results) => {
  const rows = results.reduce((trs, txt) => {
    const tr = document.createElement('tr');
    // TODO If needed, sanitize txt before displaying it
    // Dev tools shows it has some special chars (\r\n e.t.c)
    tr.innerText = txt;
    trs.push(tr);
    return trs;
  }, []);

  requestAnimationFrame(() => {
    const tBody = document.querySelector('#table-body');
    tBody.append(rows);
  });
};

const startApp = () => {
  const form = document.querySelector('#form');
  if (form) {
    form.addEventListener('submit', Controller.search);
  }
};

document.addEventListener('DOMContentLoaded', startApp);
