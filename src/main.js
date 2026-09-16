import './style.css';
import {
  validateRows,
  validateProjectionPercentage,
  buildProjection
} from './core.js';
import { readFile, exportProjection } from './files.js';
import { cloud, loadSavedMaster, saveMaster } from './cloud.js';

const $ = id => document.getElementById(id);
const num = n => Number(n).toLocaleString('en-IN');
const esc = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

let user = null;
let master = [];
let masterName = '';
let masterUpdatedAt = '';
let source = '';
let sales = [];
let salesName = '';
let projectionPercentage = 25;
let search = '';
let page = 0;
let busy = false;
let authSubscription = null;

function setApp(html) {
  document.querySelector('#app').innerHTML = html;
}

function loginScreen(message = '') {
  setApp(`
    <div class="login-shell">
      <section class="login-card">
        <div class="login-brand">TEAME<span>Sales Projection</span></div>
        <div class="login-copy">
          <span class="eyebrow">Secure planning module</span>
          <h1>Sign in to continue</h1>
          <p>Your saved item master is loaded automatically after login.</p>
        </div>
        ${!cloud ? `
          <div class="notice error-block">
            Supabase is not configured. Add <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_PUBLISHABLE_KEY</strong> in Vercel Environment Variables, then redeploy.
          </div>
        ` : `
          <form id="loginForm" class="login-form">
            <label>Login ID <span>(email)</span><input id="loginId" type="email" required autocomplete="username" placeholder="name@company.com"></label>
            <label>Password<input id="loginPassword" type="password" required minlength="6" autocomplete="current-password" placeholder="Enter your password"></label>
            <button class="primary full" type="submit">Sign in</button>
          </form>
        `}
        <div id="loginMessage" class="inline-message ${message ? '' : 'hidden'}">${esc(message)}</div>
        <p class="login-note">Accounts are created by the administrator in Supabase Authentication.</p>
      </section>
    </div>
  `);

  if (cloud) {
    $('loginForm').onsubmit = async event => {
      event.preventDefault();
      const button = event.submitter;
      button.disabled = true;
      $('loginMessage').classList.add('hidden');
      const { error } = await cloud.auth.signInWithPassword({
        email: $('loginId').value.trim(),
        password: $('loginPassword').value
      });
      if (error) {
        $('loginMessage').textContent = error.message;
        $('loginMessage').className = 'inline-message error-block';
        button.disabled = false;
      }
    };
  }
}

function moduleShell() {
  setApp(`
    <header>
      <a class="brand" href="#" aria-label="TEAME Sales Projection">TEAME<span>Sales Projection</span></a>
      <div class="account"><span id="accountEmail"></span><button id="signOut" class="ghost">Sign out</button></div>
    </header>
    <main>
      <section class="hero">
        <div>
          <span class="eyebrow">Purchase planning</span>
          <h1>Sales projection</h1>
          <p>Upload a source report, set your uplift percentage, and automatically round the final quantity to the saved case pack.</p>
        </div>
        <button class="primary download-top" id="download" disabled>Download final projection <span aria-hidden="true">↓</span></button>
      </section>

      <section class="master-card" id="masterCard"></section>

      <section class="workflow">
        <article class="panel">
          <div class="panel-head"><span class="step">1</span><div><h2>Select sales source</h2><p>Choose the format you are uploading.</p></div></div>
          <label class="field">Sales source
            <select id="source">
              <option value="">Select source</option>
              <option value="flipkart">Flipkart</option>
              <option value="website">Website</option>
            </select>
          </label>
          <div id="sourceHelp" class="source-help">Select Flipkart or Website to see the required upload format.</div>
        </article>

        <article class="panel">
          <div class="panel-head"><span class="step">2</span><div><h2>Upload previous sales</h2><p id="salesDescription">Select a source first.</p></div></div>
          <label class="drop disabled" id="salesDrop" for="salesFile">
            <strong id="salesName">Choose sales report</strong>
            <span>Excel (.xlsx) or CSV · up to 15 MB</span>
            <input id="salesFile" type="file" accept=".csv,.xlsx" disabled>
          </label>
          <div class="upload-foot"><span id="salesCount">No sales uploaded</span><a id="salesTemplate" href="#" class="disabled-link">Download template</a></div>
          <small id="salesColumns">Required columns will appear here.</small>
        </article>

        <article class="panel">
          <div class="panel-head"><span class="step">3</span><div><h2>Projection percentage</h2><p>Set the uplift to apply to gross units.</p></div></div>
          <label class="field percentage-field">Projection percentage
            <div class="percent-input"><input id="percentage" type="number" min="0" max="1000" step="0.01" value="25"><span>%</span></div>
          </label>
          <div class="formula-mini">Final quantity = gross units + uplift, rounded <strong>up</strong> to a full case pack.</div>
        </article>
      </section>

      <div class="message" id="message" role="status" aria-live="polite" hidden></div>

      <section class="results">
        <div class="result-head">
          <div><h2>Final item-wise projection</h2><p id="summary">Load the master and upload a sales report to calculate the projection.</p></div>
          <label class="search">Find an item<input id="search" type="search" placeholder="Item ID"></label>
        </div>
        <div class="table-tools"><span id="rowCount">0 rows</span><span class="case-note">Case-pack rounding comes from your saved master</span></div>
        <div class="table-wrap" id="table"></div>
        <div class="pagination"><span id="pageInfo"></span><div><button id="prev" disabled>Previous</button><button id="next" disabled>Next</button></div></div>
      </section>

      <footer>
        Flipkart format: Product Id | Item Id | Gross Units<br>
        Website format: Item Id | Gross Units
      </footer>
    </main>
  `);

  $('accountEmail').textContent = user?.email || 'Signed in';
  bindModuleEvents();
  renderMasterCard();
  render();
}

function renderMasterCard() {
  if (!$('masterCard')) return;
  const ready = master.length > 0;
  const updated = masterUpdatedAt ? new Date(masterUpdatedAt).toLocaleString('en-IN') : '';
  $('masterCard').innerHTML = ready ? `
    <div class="master-status">
      <span class="master-icon">✓</span>
      <div><span class="eyebrow">Saved master</span><h2>Item master is ready</h2><p><strong>${num(master.length)}</strong> product mappings loaded${masterName ? ` from ${esc(masterName)}` : ''}${updated ? ` · updated ${esc(updated)}` : ''}.</p></div>
    </div>
    <div class="master-actions">
      <label class="secondary file-button" for="masterFile">Replace master<input id="masterFile" type="file" accept=".csv,.xlsx"></label>
      <a href="/templates/item-master-template.csv" download>Download master template</a>
    </div>
  ` : `
    <div class="master-status">
      <span class="master-icon pending">1</span>
      <div><span class="eyebrow">One-time setup</span><h2>Upload your fixed item master</h2><p>It will be saved to your account and loaded automatically every time you sign in.</p></div>
    </div>
    <div class="master-actions">
      <label class="primary file-button" for="masterFile">Upload master<input id="masterFile" type="file" accept=".csv,.xlsx"></label>
      <a href="/templates/item-master-template.csv" download>Download master template</a>
    </div>
    <small class="master-columns">Required: Product Id | Item Id | Case Pack</small>
  `;

  $('masterFile').addEventListener('change', handleMasterUpload);
}

async function handleMasterUpload(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (master.length && !confirm('Replace the saved master with this file? This changes the case-pack rules used for future projections.')) return;

  await action(async () => {
    const rows = validateRows(await readFile(file), 'master');
    await saveMaster(user, rows, file.name);
    master = rows;
    masterName = file.name;
    masterUpdatedAt = new Date().toISOString();
    sales = [];
    salesName = '';
    showMessage(`${file.name} saved as your fixed master. ${num(rows.length)} mappings loaded.`);
    renderMasterCard();
  });
}

function sourceConfig(value) {
  if (value === 'flipkart') return {
    description: 'Upload the Flipkart sales file.',
    columns: 'Required: Product Id | Item Id | Gross Units',
    template: '/templates/flipkart-sales-template.csv',
    help: 'Flipkart rows are validated against Product Id + Item Id in your saved master.'
  };
  if (value === 'website') return {
    description: 'Upload the Website sales file.',
    columns: 'Required: Item Id | Gross Units',
    template: '/templates/website-sales-template.csv',
    help: 'Website rows are matched to Item Id in your saved master.'
  };
  return null;
}

function bindModuleEvents() {
  $('signOut').onclick = async () => {
    if (busy) return;
    await cloud.auth.signOut();
  };

  $('source').addEventListener('change', event => {
    source = event.target.value;
    sales = [];
    salesName = '';
    page = 0;
    search = '';
    $('search').value = '';
    const cfg = sourceConfig(source);
    if (cfg) {
      $('salesFile').disabled = !master.length;
      $('salesDrop').classList.toggle('disabled', !master.length);
      $('salesDescription').textContent = cfg.description;
      $('salesColumns').textContent = cfg.columns;
      $('sourceHelp').textContent = cfg.help;
      $('salesTemplate').href = cfg.template;
      $('salesTemplate').classList.remove('disabled-link');
      $('salesTemplate').setAttribute('download', '');
    } else {
      $('salesFile').disabled = true;
      $('salesDrop').classList.add('disabled');
      $('salesDescription').textContent = 'Select a source first.';
      $('salesColumns').textContent = 'Required columns will appear here.';
      $('sourceHelp').textContent = 'Select Flipkart or Website to see the required upload format.';
      $('salesTemplate').href = '#';
      $('salesTemplate').classList.add('disabled-link');
      $('salesTemplate').removeAttribute('download');
    }
    clearMessage();
    render();
  });

  $('salesFile').addEventListener('change', async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    await action(async () => {
      if (!master.length) throw new Error('Upload the item master first.');
      if (!source) throw new Error('Select Flipkart or Website first.');
      const rows = validateRows(await readFile(file), source);
      const test = buildProjection(rows, master, source, projectionPercentage);
      if (test.errors.length) throw new Error(formatErrors(test.errors));
      sales = rows;
      salesName = file.name;
      page = 0;
      showMessage(`${file.name} uploaded. ${num(rows.length)} rows validated.`);
    });
  });

  $('percentage').addEventListener('input', event => {
    const value = Number(event.target.value);
    if (Number.isFinite(value)) projectionPercentage = value;
    page = 0;
    render();
  });

  $('percentage').addEventListener('change', event => {
    try {
      projectionPercentage = validateProjectionPercentage(event.target.value);
      clearMessage();
    } catch (error) {
      showMessage(error.message, true);
    }
    render();
  });

  $('search').addEventListener('input', event => {
    search = event.target.value;
    page = 0;
    render();
  });

  $('prev').onclick = () => { page--; render(); };
  $('next').onclick = () => { page++; render(); };

  $('download').onclick = () => action(async () => {
    if (!sales.length) throw new Error('Upload a sales report first.');
    const percentage = validateProjectionPercentage($('percentage').value);
    const { rows, errors } = buildProjection(sales, master, source, percentage);
    if (errors.length) throw new Error(formatErrors(errors));
    await exportProjection(rows, source, percentage);
    showMessage('Final item-wise projection downloaded as Excel.');
  });
}

function formatErrors(errors) {
  const shown = errors.slice(0, 8).join(' ');
  return errors.length > 8 ? `${shown} Plus ${errors.length - 8} more issue(s).` : shown;
}

function showMessage(text, error = false) {
  if (!$('message')) return;
  $('message').hidden = false;
  $('message').textContent = text;
  $('message').className = `message${error ? ' error' : ''}`;
}

function clearMessage() {
  if (!$('message')) return;
  $('message').hidden = true;
  $('message').textContent = '';
}

async function action(fn) {
  if (busy) return;
  busy = true;
  document.body.classList.add('busy');
  document.querySelectorAll('input, select, button').forEach(el => {
    if (el.id !== 'signOut') el.dataset.wasDisabled = String(el.disabled);
  });
  try {
    await fn();
  } catch (error) {
    showMessage(error.message || 'Something went wrong. Please try again.', true);
  } finally {
    busy = false;
    document.body.classList.remove('busy');
    render();
  }
}

function render() {
  if (!$('table')) return;

  const cfg = sourceConfig(source);
  if (cfg) {
    $('salesFile').disabled = !master.length;
    $('salesDrop').classList.toggle('disabled', !master.length);
  }

  $('salesName').textContent = salesName || 'Choose sales report';
  $('salesCount').textContent = sales.length ? `${num(sales.length)} sales rows` : 'No sales uploaded';

  let percentageValid = true;
  let percentage = projectionPercentage;
  try {
    percentage = validateProjectionPercentage($('percentage').value);
    projectionPercentage = percentage;
  } catch {
    percentageValid = false;
  }

  const result = source && sales.length && master.length && percentageValid
    ? buildProjection(sales, master, source, percentage)
    : { rows: [], errors: [] };

  const rows = result.rows;
  const errors = result.errors;

  $('download').disabled = busy || !rows.length || !!errors.length || !percentageValid;

  if (errors.length) {
    showMessage(formatErrors(errors), true);
  }

  if (rows.length && !errors.length) {
    const gross = rows.reduce((sum, row) => sum + row['Gross Units(total)'], 0);
    const projected = rows.reduce((sum, row) => sum + row['Projected Unit'], 0);
    $('summary').textContent = `${num(gross)} gross units · ${num(projected)} projected units · ${percentage}% uplift · ${num(rows.length)} item codes`;
  } else if (!master.length) {
    $('summary').textContent = 'Complete the one-time master setup to begin.';
  } else if (!source) {
    $('summary').textContent = 'Select Flipkart or Website, then upload the sales report.';
  } else if (!sales.length) {
    $('summary').textContent = 'Upload the selected source sales report to calculate the projection.';
  } else if (!percentageValid) {
    $('summary').textContent = 'Enter a valid projection percentage between 0 and 1000.';
  }

  const filtered = rows.filter(row =>
    String(row['Item Id']).toLowerCase().includes(search.toLowerCase())
  );

  page = Math.min(page, Math.max(0, Math.ceil(filtered.length / 50) - 1));
  $('rowCount').textContent = `${num(filtered.length)} rows`;

  const heads = ['Item Id', 'Gross Units(total)', 'Projection Percentage', 'Projected Unit'];
  const visible = filtered.slice(page * 50, page * 50 + 50);

  $('table').innerHTML = visible.length ? `
    <table>
      <thead><tr>${heads.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${visible.map(row => `
        <tr>${heads.map(h => {
          const value = row[h];
          const display = h === 'Projection Percentage' ? `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%` : (typeof value === 'number' ? num(value) : esc(value));
          return `<td class="${typeof value === 'number' ? 'numeric' : ''}${h === 'Projected Unit' ? ' projected' : ''}">${display}</td>`;
        }).join('')}</tr>
      `).join('')}</tbody>
    </table>
  ` : `
    <div class="empty">
      <div class="empty-icon">↗</div>
      <h3>${search ? 'No matching item code' : 'Your projection will appear here'}</h3>
      <p>${search ? 'Try another Item ID.' : 'Select a source and upload the previous sales file.'}</p>
    </div>
  `;

  $('pageInfo').textContent = filtered.length
    ? `Showing ${page * 50 + 1}–${Math.min(filtered.length, page * 50 + 50)} of ${num(filtered.length)}`
    : '';
  $('prev').disabled = page === 0;
  $('next').disabled = (page + 1) * 50 >= filtered.length;
}

async function enterModule(sessionUser) {
  user = sessionUser;
  master = [];
  masterName = '';
  masterUpdatedAt = '';
  source = '';
  sales = [];
  salesName = '';
  projectionPercentage = 25;
  search = '';
  page = 0;

  moduleShell();
  showMessage('Loading your saved master...');
  try {
    const saved = await loadSavedMaster(user);
    if (saved?.rows?.length) {
      master = validateRows([
        ['Product Id', 'Item Id', 'Case Pack'],
        ...saved.rows.map(row => [row['Product Id'], row['Item Id'], row['Case Pack']])
      ], 'master');
      masterName = saved.filename;
      masterUpdatedAt = saved.updatedAt;
      clearMessage();
    } else {
      showMessage('No saved master found. Complete the one-time master upload below.');
    }
  } catch (error) {
    showMessage(`Could not load the saved master: ${error.message}`, true);
  }
  renderMasterCard();
  render();
}

async function boot() {
  if (!cloud) {
    loginScreen();
    return;
  }

  loginScreen('Checking session...');
  const { data, error } = await cloud.auth.getSession();
  if (error) {
    loginScreen(error.message);
    return;
  }

  if (data.session?.user) await enterModule(data.session.user);
  else loginScreen();

  const { data: listener } = cloud.auth.onAuthStateChange(async (_event, session) => {
    const nextUser = session?.user || null;
    if (nextUser && nextUser.id !== user?.id) {
      await enterModule(nextUser);
    } else if (!nextUser && user) {
      user = null;
      loginScreen();
    }
  });
  authSubscription = listener.subscription;
}

window.addEventListener('beforeunload', () => authSubscription?.unsubscribe());
boot();
