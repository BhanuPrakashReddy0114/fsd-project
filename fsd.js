const seedItems = [
  {id:1,type:'Lost',title:'Black Sony headphones',category:'Electronics',location:'Central Library',date:'2026-11-17',description:'Black over-ear headphones, last seen near the quiet study area.',symbol:'♫',tone:'photo-headphones',status:'Open'},
  {id:2,type:'Found',title:'Sony over-ear headphones',category:'Electronics',location:'Central Library',date:'2026-11-18',description:'Black headphones found on the second floor by the window seats.',symbol:'♫',tone:'photo-headphones',status:'Open'},
  {id:3,type:'Found',title:'Blue Hydro Flask',category:'Drinkware',location:'Sports Complex',date:'2026-11-18',description:'Blue stainless steel water bottle left by the basketball court.',symbol:'◒',tone:'tone-blue',status:'Open'},
  {id:4,type:'Lost',title:'Student ID card',category:'Accessories',location:'Cafeteria',date:'2026-11-17',description:'Student ID in a clear sleeve. Name has been kept private.',symbol:'▤',tone:'tone-card',status:'Open'},
  {id:5,type:'Found',title:'House keys with green tag',category:'Keys',location:'Main Gate',date:'2026-11-16',description:'A small set of keys with a green fabric tag, near the entrance.',symbol:'⚿',tone:'tone-keys',status:'Open'},
  {id:6,type:'Lost',title:'HP laptop charger',category:'Electronics',location:'Computer Lab 2',date:'2026-11-16',description:'Black HP power adapter, possibly left beside a workstation.',symbol:'⌁',tone:'tone-laptop',status:'Claim Pending'},
  {id:7,type:'Found',title:'Beige knit cardigan',category:'Clothing',location:'Main Building',date:'2026-11-15',description:'Soft beige cardigan found on a chair outside lecture hall 104.',symbol:'▤',tone:'tone-clothing',status:'Open'},
  {id:8,type:'Lost',title:'Silver MacBook Air',category:'Electronics',location:'Central Library',date:'2026-11-14',description:'Silver laptop in a dark sleeve. Finder: please hand to security.',symbol:'▱',tone:'tone-laptop',status:'Open'},
  {id:9,type:'Found',title:'Wireless earbuds case',category:'Electronics',location:'Cafeteria',date:'2026-11-14',description:'White earbuds case found near the north seating area.',symbol:'◉',tone:'tone-earbuds',status:'Resolved'},
  {id:10,type:'Lost',title:'House keys, brass keyring',category:'Keys',location:'Main Building',date:'2026-11-13',description:'Three keys on a plain brass ring. One has a blue cap.',symbol:'⚿',tone:'tone-keys',status:'Open'},
  {id:11,type:'Found',title:'Red and black umbrella',category:'Other',location:'Central Library',date:'2026-11-12',description:'Compact umbrella left at the library front desk.',symbol:'☂',tone:'tone-umbrella',status:'Open'},
  {id:12,type:'Lost',title:'Prescription glasses',category:'Accessories',location:'Sports Complex',date:'2026-11-12',description:'Black rectangular frames, possibly near the changing rooms.',symbol:'⌔',tone:'tone-glasses',status:'Open'}
];

const items = [...seedItems];
const filters = {type:'All',category:'All',location:'All',query:''};
const grid = document.querySelector('#item-grid');
const emptyState = document.querySelector('#empty-state');
const toast = document.querySelector('#toast');
let toastTimer;
let claimedItemId = null;
let selectedMatchFoundId = 2;

const dialogs = {
  report: document.querySelector('#report-dialog'),
  claim: document.querySelector('#claim-dialog'),
  guidelines: document.querySelector('#guidelines-dialog')
};

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', {month:'short',day:'numeric'});
}

function keywords(text) {
  const normalized = text.toLowerCase()
    .replace(/over[\s-]?ear/g, 'headphone')
    .replace(/\b(laptop|macbook|notebook)\b/g, 'computer')
    .replace(/\b(headphones|earbuds)\b/g, 'headphone')
    .replace(/[^a-z0-9 ]/g, ' ');
  const ignored = new Set(['a','an','and','at','by','for','found','in','it','last','near','of','on','the','to','was','with']);
  return new Set(normalized.split(/\s+/).filter(word => word.length > 1 && !ignored.has(word)));
}

function overlapScore(leftText, rightText) {
  const left = keywords(leftText);
  const right = keywords(rightText);
  const union = new Set([...left,...right]);
  if (!union.size) return 0;
  let common = 0;
  left.forEach(word => { if (right.has(word)) common++; });
  return common / union.size;
}

function matchScore(lost, found) {
  if (lost.category !== found.category) return 0;
  const daysApart = Math.abs(new Date(`${lost.date}T12:00:00`) - new Date(`${found.date}T12:00:00`)) / 86400000;
  if (daysApart > 14) return 0;
  const score = 25
    + (lost.location === found.location ? 20 : 0)
    + (daysApart <= 1 ? 15 : daysApart <= 3 ? 10 : 5)
    + overlapScore(lost.title, found.title) * 40
    + overlapScore(lost.description, found.description) * 6;
  return Math.min(99, Math.round(score));
}

function updateMatchPanel() {
  const pairs = [];
  items.filter(item => item.type === 'Lost' && item.status !== 'Resolved').forEach(lost => {
    items.filter(item => item.type === 'Found' && item.status !== 'Resolved').forEach(found => {
      const score = matchScore(lost, found);
      if (score >= 40) pairs.push({lost,found,score});
    });
  });
  pairs.sort((a,b) => b.score-a.score);
  document.querySelector('#matches-stat-count').textContent = String(pairs.length).padStart(2,'0');
  document.querySelector('#matches-nav-count').textContent = pairs.length;
  const best = pairs[0];
  if (!best) {
    document.querySelector('#match-panel').hidden = true;
    return;
  }
  document.querySelector('#match-panel').hidden = false;
  document.querySelector('#match-confidence').textContent = `${best.score}%`;
  document.querySelector('#match-lost-title').textContent = best.lost.title;
  document.querySelector('#match-lost-meta').textContent = `${best.lost.location} · ${formatDate(best.lost.date)}`;
  document.querySelector('#match-found-title').textContent = best.found.title;
  document.querySelector('#match-found-meta').textContent = `${best.found.location} · ${formatDate(best.found.date)}`;
  selectedMatchFoundId = best.found.id;
  document.querySelector('#match-claim').disabled = best.found.status === 'Claim Pending';
  document.querySelector('#match-claim').textContent = best.found.status === 'Claim Pending' ? 'Claim pending' : 'Take a closer look →';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[character]));
}

function renderCard(item) {
  const statusClass = item.status === 'Claim Pending' ? 'status-pending' : item.status === 'Resolved' ? 'status-resolved' : '';
  const image = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy" onerror="this.remove()">`
    : '';
  const action = item.type === 'Found' && item.status !== 'Resolved'
    ? `<button class="card-action" type="button" data-claim="${item.id}">${item.status === 'Claim Pending' ? 'Claim pending' : 'This might be mine →'}</button>`
    : '';
  return `<article class="item-card">
    <div class="card-image ${escapeHtml(item.tone || 'tone-default')}">${image}<span class="image-placeholder" aria-hidden="true">${escapeHtml(item.symbol || '◌')}</span>
      <span class="card-type type-${item.type.toLowerCase()}">${item.type.toUpperCase()}</span>
      <span class="status-pill ${statusClass}">${escapeHtml(item.status)}</span>
    </div>
    <div class="card-content">
      <div class="card-title-row"><h3 class="card-title">${escapeHtml(item.title)}</h3><span class="card-category">${escapeHtml(item.category)}</span></div>
      <p class="card-description">${escapeHtml(item.description)}</p>
      <div class="card-meta"><span class="card-location"><span>⌖</span>${escapeHtml(item.location)}</span><span class="card-date">${formatDate(item.date)}</span></div>
      ${action}
    </div>
  </article>`;
}

function render() {
  const query = filters.query.trim().toLowerCase();
  const visible = items.filter(item => {
    const matchesText = !query || [item.title,item.description,item.category,item.location].some(value => value.toLowerCase().includes(query));
    return (filters.type === 'All' || item.type === filters.type)
      && (filters.category === 'All' || item.category === filters.category)
      && (filters.location === 'All' || item.location === filters.location)
      && matchesText;
  }).sort((a,b) => b.date.localeCompare(a.date) || b.id-a.id);
  grid.innerHTML = visible.map(renderCard).join('');
  emptyState.hidden = visible.length !== 0;
  grid.hidden = visible.length === 0;
  const lostCount = items.filter(item => item.type === 'Lost').length;
  const foundCount = items.filter(item => item.type === 'Found').length;
  document.querySelector('#report-total').textContent = items.length;
  document.querySelector('#open-count').textContent = items.filter(item => item.status !== 'Resolved').length;
  document.querySelector('#all-tab-count').textContent = items.length;
  document.querySelector('#lost-tab-count').textContent = lostCount;
  document.querySelector('#found-tab-count').textContent = foundCount;
  updateMatchPanel();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function openDialog(dialog) {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open','');
}

function closeDialog(dialog) {
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function startClaim(item) {
  if (!item || item.type !== 'Found') return;
  if (item.status === 'Claim Pending') {
    showToast('A claim has already been started for this item.');
    return;
  }
  claimedItemId = item.id;
  document.querySelector('#claim-item-title').textContent = item.title;
  document.querySelector('#claim-item-location').textContent = item.location;
  openDialog(dialogs.claim);
}

document.querySelector('#report-open').addEventListener('click', () => {
  const date = document.querySelector('#report-form [name="date"]');
  date.value = new Date().toISOString().slice(0,10);
  openDialog(dialogs.report);
});
document.querySelector('#guidelines-link').addEventListener('click', () => openDialog(dialogs.guidelines));
document.querySelector('#match-claim').addEventListener('click', () => startClaim(items.find(item => item.id === selectedMatchFoundId)));
document.querySelector('#matches-nav').addEventListener('click', () => {
  document.querySelector('#match-panel').scrollIntoView({behavior:'smooth',block:'center'});
});

document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => {
  Object.values(dialogs).forEach(closeDialog);
}));
Object.values(dialogs).forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target === dialog) closeDialog(dialog);
}));
document.querySelectorAll('.filter-tab').forEach(button => button.addEventListener('click', () => {
  filters.type = button.dataset.type;
  document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.toggle('active', tab === button));
  render();
}));
document.querySelectorAll('[data-nav-filter]').forEach(link => link.addEventListener('click', () => {
  filters.type = link.dataset.navFilter;
  document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.type === filters.type));
  render();
}));
document.querySelectorAll('[data-zone]').forEach(button => button.addEventListener('click', () => {
  filters.location = button.dataset.zone;
  document.querySelector('#location-filter').value = filters.location;
  render();
  document.querySelector('#reports').scrollIntoView({behavior:'smooth'});
}));
document.querySelector('#search-input').addEventListener('input', event => {
  filters.query = event.target.value;
  render();
});
document.querySelector('#category-filter').addEventListener('change', event => {
  filters.category = event.target.value;
  render();
});
document.querySelector('#location-filter').addEventListener('change', event => {
  filters.location = event.target.value;
  render();
});
document.querySelector('#view-all').addEventListener('click', () => {
  filters.type = 'All'; filters.category = 'All'; filters.location = 'All'; filters.query = '';
  document.querySelector('#search-input').value = '';
  document.querySelector('#category-filter').value = 'All';
  document.querySelector('#location-filter').value = 'All';
  document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.type === 'All'));
  render();
});
document.querySelector('#clear-filters').addEventListener('click', () => document.querySelector('#view-all').click());
grid.addEventListener('click', event => {
  const button = event.target.closest('[data-claim]');
  if (button) startClaim(items.find(item => item.id === Number(button.dataset.claim)));
});
document.querySelector('#report-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const item = {
    id:Date.now(),
    type:data.get('type'),
    title:String(data.get('title')).trim(),
    category:String(data.get('category')),
    location:String(data.get('location')),
    date:String(data.get('date')),
    image:String(data.get('image')).trim(),
    description:String(data.get('description')).trim(),
    symbol:'◌',
    tone:'tone-default',
    status:'Open'
  };
  items.unshift(item);
  closeDialog(dialogs.report);
  form.reset();
  filters.type = 'All';
  filters.category = 'All';
  filters.location = 'All';
  filters.query = '';
  document.querySelector('#search-input').value = '';
  document.querySelector('#category-filter').value = 'All';
  document.querySelector('#location-filter').value = 'All';
  document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.type === 'All'));
  render();
  showToast(`${item.type} report posted. Thanks for helping out!`);
});
document.querySelector('#claim-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const item = items.find(candidate => candidate.id === claimedItemId);
  if (!item) {
    closeDialog(dialogs.claim);
    showToast('That item is no longer available. Refresh the reports and try again.');
    return;
  }
  item.status = 'Claim Pending';
  closeDialog(dialogs.claim);
  form.reset();
  render();
  showToast('Claim sent! Meet campus security in person to verify ownership.');
});
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.querySelector('#search-input').focus();
  }
});

render();