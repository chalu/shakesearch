const Controller = {};

Controller.search = (ev) => {
  ev.preventDefault();
  const form = document.getElementById('form');
  const data = Object.fromEntries(new FormData(form));
  const response = fetch(`/search?q=${data.query}`).then((response) => {
    response.json().then((results) => {
      Controller.updateTable(results);
    });
  });
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
