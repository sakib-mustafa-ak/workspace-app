// Local lab only. Credentials stay in this page's memory, never localStorage.
let accessToken = '';
let verificationToken = new URLSearchParams(location.search).get('token') || '';
const status = document.querySelector('#status');
const verify = document.querySelector('#verify');
verify.hidden = !verificationToken;
let busy = false;

async function api(path, body) {
  const response = await fetch(`/api/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value = response.status === 204 ? undefined : await response.json();
  if (!response.ok) throw new Error(value?.error?.message || value?.message || 'Request failed');
  return value?.data ?? value;
}

async function action(run) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(button => { button.disabled = true; });
  status.classList.remove('error');
  status.textContent = 'Working...';
  try { await run(); }
  catch (error) { status.textContent = error.message; status.classList.add('error'); }
  finally { busy = false; document.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
}

async function inbox() {
  const result = await api('/dev/mail');
  const container = document.querySelector('#inbox');
  container.replaceChildren();
  if (!result.messages.length) container.textContent = 'No messages yet.';
  result.messages.forEach(message => {
    const article = document.createElement('article'); article.className = 'message';
    const heading = document.createElement('strong'); heading.textContent = `${message.subject} → ${message.to}`;
    const text = document.createElement('pre'); text.textContent = message.text;
    article.append(heading, text);
    const found = message.text.match(/https?:\/\/\S+/)?.[0];
    if (found) {
      const url = new URL(found);
      if (url.origin === location.origin && url.pathname === '/auth/verify-email' && url.searchParams.has('token')) {
        const open = document.createElement('button'); open.className = 'secondary'; open.textContent = 'Select verification link';
        open.addEventListener('click', () => { verificationToken = url.searchParams.get('token'); verify.hidden = false; status.textContent = 'Local email selected. Confirm below to simulate verifying the mailbox.'; verify.focus(); });
        article.append(open);
      }
    }
    container.append(article);
  });
}

document.querySelector('#account').addEventListener('submit', event => {
  event.preventDefault();
  void action(async () => {
    const result = await api('/auth/register', { displayName: document.querySelector('#name').value, email: document.querySelector('#email').value, password: document.querySelector('#password').value });
    accessToken = result.tokens.accessToken;
    await inbox();
    status.textContent = 'Account created, but not verified. Try protected access, then select the captured email link.';
  });
});
document.querySelector('#signin').addEventListener('click', () => void action(async () => {
  const result = await api('/auth/login', { email: document.querySelector('#email').value, password: document.querySelector('#password').value });
  accessToken = result.tokens.accessToken; status.textContent = result.user.emailVerifiedAt ? 'Signed in with a verified address.' : 'Signed in. Email verification is still required.';
}));
document.querySelector('#refresh').addEventListener('click', () => void action(async () => { await inbox(); status.textContent = 'Local inbox refreshed.'; }));
verify.addEventListener('click', () => void action(async () => {
  await api('/auth/verify-email', { token: verificationToken }); verificationToken = ''; verify.hidden = true;
  history.replaceState(null, '', '/'); status.textContent = 'Verified in the disposable database. Check protected access again.';
}));
document.querySelector('#protected').addEventListener('click', () => void action(async () => {
  if (!accessToken) throw new Error('Create an account or sign in first.');
  await api('/prototype/protected'); status.textContent = 'Access allowed: this local account is verified.';
}));
