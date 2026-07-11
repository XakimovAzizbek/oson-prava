// ============================================================
//  OSON PRAVA — Home JS
//  Firebase Firestore compat SDK (CDN)
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
let allQuestions  = [];   // Firestore'dan olingan barcha savollar
let testQuestions = [];   // Joriy test uchun savollar
let currentIndex  = 0;
let correctCount  = 0;
let wrongCount    = 0;
let answered      = false;
let mistakesList  = [];   // { question, yourAnswer, rightAnswer }
let selectedCategory = null;

const PASS_PERCENT = 70; // O'tish chegarasi (%)

// ============================================================
// DOM
// ============================================================
const $ = id => document.getElementById(id);

const screens = {
  home:     $('home-screen'),
  category: $('category-screen'),
  test:     $('test-screen'),
  result:   $('result-screen'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showLoading(v) { $('loading').classList.toggle('hidden', !v); }

// ============================================================
// FIREBASE — Savollarni yuklash
// ============================================================
async function loadQuestions() {
  showLoading(true);
  try {
    const snap = await db.collection('questions').orderBy('createdAt', 'asc').get();
    allQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    $('total-q-count').textContent = allQuestions.length;
  } catch (e) {
    console.error('Savollar yuklanmadi:', e);
    $('total-q-count').textContent = '!';
  }
  showLoading(false);
}

// ============================================================
// KATEGORIYALAR
// ============================================================
function buildCategoryScreen() {
  const grid = $('category-grid');
  grid.innerHTML = '';

  // Kategoriyalar bo'yicha guruhlash
  const map = {};
  allQuestions.forEach(q => {
    const cat = q.category || 'Umumiy';
    if (!map[cat]) map[cat] = [];
    map[cat].push(q);
  });

  const icons = ['🚦','🛣️','🚧','⚠️','🚗','🏎️','🛑','🔄','🅿️','🌐'];
  let i = 0;
  for (const [cat, qs] of Object.entries(map)) {
    const card = document.createElement('div');
    card.className = 'cat-card';
    card.innerHTML = `
      <div class="cat-icon">${icons[i % icons.length]}</div>
      <div class="cat-name">${cat}</div>
      <div class="cat-count">${qs.length} savol</div>
    `;
    card.addEventListener('click', () => startTest(qs, cat));
    grid.appendChild(card);
    i++;
  }
}

// ============================================================
// TEST BOSHLASH
// ============================================================
function startTest(questions, catName) {
  selectedCategory = catName || 'Barcha savollar';
  testQuestions = shuffle([...questions]);
  currentIndex = 0; correctCount = 0; wrongCount = 0;
  mistakesList = []; answered = false;
  showScreen('test');
  renderQuestion();
}

// ============================================================
// SAVOL RENDER
// ============================================================
function renderQuestion() {
  const q = testQuestions[currentIndex];
  answered = false;
  $('btn-next').classList.add('hidden');

  // Progress
  const pct = (currentIndex / testQuestions.length) * 100;
  $('progress-fill').style.width = pct + '%';
  $('q-counter').textContent = `${currentIndex + 1} / ${testQuestions.length}`;

  // Kategoriya tegi
  $('q-cat-tag').textContent = q.category || 'Umumiy';

  // Savol matni
  $('q-text').textContent = q.question;

  // Rasm (agar bo'lsa)
  if (q.imageUrl) {
    $('q-image-wrap').classList.remove('hidden');
    $('q-image').src = q.imageUrl;
  } else {
    $('q-image-wrap').classList.add('hidden');
  }

  // Javoblar
  const grid = $('answers-grid');
  grid.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const opts = q.options || [];

  opts.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.innerHTML = `<span class="ans-letter">${letters[idx]}</span> ${opt}`;
    btn.addEventListener('click', () => selectAnswer(btn, idx, q));
    grid.appendChild(btn);
  });
}

// ============================================================
// JAVOB TANLASH
// ============================================================
function selectAnswer(clickedBtn, chosenIdx, q) {
  if (answered) return;
  answered = true;

  const allBtns = $('answers-grid').querySelectorAll('.answer-btn');
  allBtns.forEach(b => b.disabled = true);

  const correctIdx = q.correctIndex ?? 0;

  if (chosenIdx === correctIdx) {
    clickedBtn.classList.add('correct');
    correctCount++;
  } else {
    clickedBtn.classList.add('wrong');
    allBtns[correctIdx].classList.add('correct');
    wrongCount++;
    mistakesList.push({
      question:    q.question,
      yourAnswer:  q.options[chosenIdx],
      rightAnswer: q.options[correctIdx],
    });
  }

  $('btn-next').classList.remove('hidden');
}

// ============================================================
// NATIJA
// ============================================================
function showResult() {
  showScreen('result');

  const total = testQuestions.length;
  const pct   = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const passed = pct >= PASS_PERCENT;

  // Emoji & sarlavha
  $('result-emoji').textContent = passed ? '🎉' : '😓';
  $('result-title').textContent  = passed ? 'Tabriklaymiz!' : 'Muvaffaqiyatsiz';
  $('result-subtitle').textContent = `${selectedCategory} — test yakunlandi`;

  // Raqamlar
  $('rs-correct').textContent = correctCount;
  $('rs-wrong').textContent   = wrongCount;
  $('rs-total').textContent   = total;
  $('donut-pct').textContent  = pct + '%';

  // O'tdi/o'tmadi banner
  const banner = $('pass-banner');
  if (passed) {
    banner.className = 'pass-banner passed';
    banner.textContent = `✅ Imtihondan o'tdingiz! (${pct}% — o'tish chegarasi ${PASS_PERCENT}%)`;
  } else {
    banner.className = 'pass-banner failed';
    banner.textContent = `❌ Imtihondan o'ta olmadingiz. (${pct}% — o'tish chegarasi ${PASS_PERCENT}%)`;
  }

  // Donut chart (SVG stroke-dashoffset)
  const circumference = 314;
  const correctOffset = circumference - (circumference * correctCount / total);
  const wrongOffset   = circumference - (circumference * wrongCount   / total);

  // Kichik kechikish bilan animate
  setTimeout(() => {
    $('donut-correct-arc').style.strokeDashoffset = correctOffset;
  }, 100);
  setTimeout(() => {
    const arc = $('donut-wrong-arc');
    arc.style.stroke = 'var(--danger)';
    arc.style.strokeDashoffset = wrongOffset;
    // Wrong arc ni correct dan keyin boshlash uchun transform
    const correctAngle = (correctCount / total) * 360;
    arc.style.transform = `rotate(${correctAngle}deg)`;
    arc.style.transformOrigin = '60px 60px';
  }, 200);

  // Xatolar
  const sec = $('mistakes-section');
  const list = $('mistakes-list');
  list.innerHTML = '';
  if (mistakesList.length === 0) {
    sec.style.display = 'none';
  } else {
    sec.style.display = 'block';
    mistakesList.forEach(m => {
      const div = document.createElement('div');
      div.className = 'mistake-item';
      div.innerHTML = `
        <div class="mistake-q">📋 ${m.question}</div>
        <div class="mistake-your">❌ Sizning javobingiz: ${m.yourAnswer}</div>
        <div class="mistake-right">✅ To'g'ri javob: ${m.rightAnswer}</div>
      `;
      list.appendChild(div);
    });
  }
}

// ============================================================
// YORDAMCHI
// ============================================================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ============================================================
// EVENT LISTENERS
// ============================================================
$('btn-start').addEventListener('click', async () => {
  if (allQuestions.length === 0) {
    await loadQuestions();
  }
  if (allQuestions.length === 0) {
    alert('Hali savollar qo\'shilmagan. Admin panel orqali savol qo\'shing.');
    return;
  }
  buildCategoryScreen();
  showScreen('category');
});

$('btn-all-cats').addEventListener('click', () => {
  startTest(allQuestions, 'Barcha savollar');
});

$('btn-next').addEventListener('click', () => {
  currentIndex++;
  if (currentIndex < testQuestions.length) {
    renderQuestion();
  } else {
    showResult();
  }
});

$('btn-quit').addEventListener('click', () => {
  if (confirm('Testdan chiqishni xohlaysizmi? Natijalar saqlanmaydi.')) {
    showScreen('home');
  }
});

$('btn-retry').addEventListener('click', () => {
  startTest(testQuestions.map(q => q), selectedCategory);
});

$('btn-home').addEventListener('click', () => {
  showScreen('home');
});

// ============================================================
// INIT
// ============================================================
(async () => {
  await loadQuestions();
})();
