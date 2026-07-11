// ============================================================
//  OSON PRAVA — Admin JS
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyA2vALrsz7tc5dencTlRFmVH4wlxFPjJ98",
  authDomain: "loyiha-11c74.firebaseapp.com",
  projectId: "loyiha-11c74",
  storageBucket: "loyiha-11c74.firebasestorage.app",
  messagingSenderId: "437733379812",
  appId: "1:437733379812:web:8fe3d3057c927fe2fd66f1",
  measurementId: "G-DH6KLQNP44"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ============================================================
// STATE
// ============================================================
let allQuestions = [];
let deleteTargetId = null;
const LETTERS = ['A','B','C','D','E','F'];

// ============================================================
// DOM SHORTCUTS
// ============================================================
const $ = id => document.getElementById(id);

// ============================================================
// TAB NAVIGATION
// ============================================================
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ============================================================
// LOAD QUESTIONS (real-time)
// ============================================================
function startListener() {
  db.collection('questions').orderBy('createdAt', 'asc').onSnapshot(snap => {
    allQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderList();
    updateSidebarStats();
    updateCategorySelects();
    renderStatsTab();
  }, err => {
    console.error('Listener xatosi:', err);
  });
}

// ============================================================
// SIDEBAR STATS
// ============================================================
function updateSidebarStats() {
  $('ss-total').textContent = allQuestions.length;
  const cats = new Set(allQuestions.map(q => q.category || 'Umumiy'));
  $('ss-cats').textContent = cats.size;
}

// ============================================================
// RENDER QUESTION LIST
// ============================================================
function renderList() {
  const search  = $('search-input').value.toLowerCase();
  const catFilter = $('filter-cat').value;

  const filtered = allQuestions.filter(q => {
    const matchCat  = !catFilter || (q.category || 'Umumiy') === catFilter;
    const matchText = !search || q.question.toLowerCase().includes(search);
    return matchCat && matchText;
  });

  const list = $('q-list');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">Savol topilmadi.</div>';
    return;
  }

  list.innerHTML = filtered.map((q, idx) => {
    const opts = (q.options || []).map((o, i) => {
      const cls = i === q.correctIndex ? 'q-item-correct' : '';
      return `<span class="${cls}">${LETTERS[i]}) ${o}</span>`;
    }).join(' &nbsp;|&nbsp; ');

    return `
      <div class="q-item">
        <div class="q-item-body">
          <span class="q-item-cat">${q.category || 'Umumiy'}</span>
          <div class="q-item-text">${idx + 1}. ${q.question}</div>
          <div class="q-item-opts">${opts}</div>
        </div>
        <div class="q-item-actions">
          <button class="btn-edit" onclick="editQuestion('${q.id}')">✏️ Tahrir</button>
          <button class="btn-del"  onclick="confirmDelete('${q.id}')">🗑 O'chir</button>
        </div>
      </div>
    `;
  }).join('');
}

$('search-input').addEventListener('input', renderList);
$('filter-cat').addEventListener('change', renderList);

// ============================================================
// UPDATE CATEGORY SELECTS
// ============================================================
function updateCategorySelects() {
  const cats = [...new Set(allQuestions.map(q => q.category || 'Umumiy'))].sort();

  // Filter select
  const filterSel = $('filter-cat');
  const filterVal = filterSel.value;
  filterSel.innerHTML = '<option value="">Barcha kategoriyalar</option>';
  cats.forEach(c => {
    filterSel.innerHTML += `<option value="${c}" ${filterVal === c ? 'selected' : ''}>${c}</option>`;
  });

  // Form select
  const formSel = $('category-select');
  const formVal = formSel.value;
  formSel.innerHTML = '<option value="">— Kategoriya tanlang —</option>';
  cats.forEach(c => {
    formSel.innerHTML += `<option value="${c}" ${formVal === c ? 'selected' : ''}>${c}</option>`;
  });
}

// ============================================================
// OPTIONS BUILDER
// ============================================================
let options = ['', ''];  // kamida 2 ta

function renderOptions() {
  const list = $('options-list');
  list.innerHTML = options.map((val, i) => `
    <div class="option-row">
      <div class="opt-letter">${LETTERS[i]}</div>
      <input type="text" class="input-box" placeholder="Variant ${LETTERS[i]}"
        value="${val}" oninput="options[${i}] = this.value; syncCorrectSelect();" />
      ${options.length > 2
        ? `<button class="btn-rem-opt" onclick="removeOption(${i})">✕</button>`
        : '<div style="width:30px"></div>'}
    </div>
  `).join('');
  syncCorrectSelect();
}

function removeOption(idx) {
  if (options.length <= 2) return;
  options.splice(idx, 1);
  const curCorr = parseInt($('correct-select').value);
  renderOptions();
  if (!isNaN(curCorr) && curCorr < options.length) $('correct-select').value = curCorr;
}

function syncCorrectSelect() {
  const sel = $('correct-select');
  const prev = sel.value;
  sel.innerHTML = '<option value="">— To\'g\'ri javobni tanlang —</option>';
  options.forEach((o, i) => {
    if (o.trim()) {
      sel.innerHTML += `<option value="${i}" ${prev == i ? 'selected' : ''}>${LETTERS[i]}) ${o}</option>`;
    }
  });
}

$('btn-add-opt').addEventListener('click', () => {
  if (options.length >= 6) return;
  options.push('');
  renderOptions();
});

// ============================================================
// SAVE / ADD QUESTION
// ============================================================
$('btn-save').addEventListener('click', async () => {
  const editId   = $('edit-id').value;
  const catSel   = $('category-select').value.trim();
  const catNew   = $('new-category').value.trim();
  const category = catNew || catSel || 'Umumiy';
  const question = $('q-input').value.trim();
  const imageUrl = $('img-input').value.trim();
  const correctI = parseInt($('correct-select').value);

  // Validation
  const filled = options.filter(o => o.trim());
  if (!question)        return showMsg('Savol matni kiritilmadi!', 'error');
  if (filled.length < 2) return showMsg('Kamida 2 ta variant kiriting!', 'error');
  if (isNaN(correctI))   return showMsg('To\'g\'ri javobni tanlang!', 'error');

  const data = {
    category,
    question,
    options: options.map(o => o.trim()).filter(o => o),
    correctIndex: correctI,
    imageUrl: imageUrl || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  showLoading(true);
  try {
    if (editId) {
      await db.collection('questions').doc(editId).update(data);
      showMsg('✅ Savol yangilandi!', 'success');
      cancelEdit();
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('questions').add(data);
      showMsg('✅ Savol qo\'shildi!', 'success');
      resetForm();
    }
  } catch (e) {
    showMsg('❌ Xato: ' + e.message, 'error');
  }
  showLoading(false);
});

// ============================================================
// EDIT QUESTION
// ============================================================
window.editQuestion = function(id) {
  const q = allQuestions.find(x => x.id === id);
  if (!q) return;

  // Switch to add tab
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="add"]').classList.add('active');
  $('tab-add').classList.add('active');

  $('form-title').textContent = 'Savol Tahrirlash';
  $('edit-id').value = id;
  $('q-input').value = q.question || '';
  $('img-input').value = q.imageUrl || '';
  $('category-select').value = q.category || '';
  $('new-category').value = '';

  options = [...(q.options || ['', ''])];
  renderOptions();
  setTimeout(() => { $('correct-select').value = q.correctIndex ?? ''; }, 100);

  $('btn-cancel-edit').classList.remove('hidden');
  $('form-msg').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ============================================================
// CANCEL EDIT
// ============================================================
function cancelEdit() {
  $('form-title').textContent = 'Yangi Savol Qo\'shish';
  $('btn-cancel-edit').classList.add('hidden');
  resetForm();
}
$('btn-cancel-edit').addEventListener('click', cancelEdit);

function resetForm() {
  $('edit-id').value = '';
  $('q-input').value = '';
  $('img-input').value = '';
  $('category-select').value = '';
  $('new-category').value = '';
  $('correct-select').value = '';
  options = ['', ''];
  renderOptions();
}

// ============================================================
// DELETE
// ============================================================
window.confirmDelete = function(id) {
  deleteTargetId = id;
  $('modal').classList.remove('hidden');
};

$('btn-confirm-del').addEventListener('click', async () => {
  if (!deleteTargetId) return;
  $('modal').classList.add('hidden');
  showLoading(true);
  try {
    await db.collection('questions').doc(deleteTargetId).delete();
  } catch (e) {
    alert('O\'chirishda xato: ' + e.message);
  }
  deleteTargetId = null;
  showLoading(false);
});

$('btn-cancel-del').addEventListener('click', () => {
  $('modal').classList.add('hidden');
  deleteTargetId = null;
});

// ============================================================
// STATS TAB
// ============================================================
function renderStatsTab() {
  const grid = $('stats-grid');
  const cats = {};
  allQuestions.forEach(q => {
    const c = q.category || 'Umumiy';
    cats[c] = (cats[c] || 0) + 1;
  });

  let html = `
    <div class="stat-box">
      <h4>Jami Savollar</h4>
      <div class="big">${allQuestions.length}</div>
      <p>Bazadagi umumiy savol soni</p>
    </div>
    <div class="stat-box">
      <h4>Kategoriyalar</h4>
      <div class="big">${Object.keys(cats).length}</div>
      <p>Mavjud kategoriyalar soni</p>
    </div>
  `;

  for (const [cat, count] of Object.entries(cats)) {
    const pct = allQuestions.length > 0 ? Math.round(count / allQuestions.length * 100) : 0;
    html += `
      <div class="stat-box">
        <h4>${cat}</h4>
        <div class="big">${count}</div>
        <p>Jami savollarning ${pct}% ini tashkil etadi</p>
      </div>
    `;
  }

  grid.innerHTML = html;
}

// ============================================================
// HELPERS
// ============================================================
function showMsg(text, type) {
  const msg = $('form-msg');
  msg.textContent = text;
  msg.className = 'form-message ' + type;
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 4000);
}

function showLoading(v) { $('loading').classList.toggle('hidden', !v); }

// ============================================================
// INIT
// ============================================================
renderOptions();
startListener();
