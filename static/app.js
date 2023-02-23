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
    Controller.updateTable(results);
  }
};

Controller.updateTable = (results) => {
  const table = document.getElementById('table-body');
  const rows = [];
  for (let result of results) {
    rows.push(`<tr>${result}<tr/>`);
  }
  table.innerHTML = rows;
};

const startApp = () => {
  const form = document.querySelector('#form');
  if (form) {
    form.addEventListener('submit', Controller.search);
  }
};

document.addEventListener('DOMContentLoaded', startApp);
