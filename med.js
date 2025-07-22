// ---------- Config ----------
let db;
const DB_NAME = 'MedicineDatabase';
const DB_VERSION = 2; // bumped because we added new fields
const STORE_NAME = 'medicines';

// ---------- Open / Upgrade ----------
const openRequest = indexedDB.open(DB_NAME, DB_VERSION);

openRequest.onerror = (event) => {
  console.error('Database error:', event.target.error);
  alert('Failed to open database. Check console for details.');
};

openRequest.onupgradeneeded = (event) => {
  db = event.target.result;

  let store;
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    store = db.createObjectStore(STORE_NAME, {
      keyPath: 'id',
      autoIncrement: true,
    });
  } else {
    store = event.target.transaction.objectStore(STORE_NAME);
  }

  // create indexes if missing
  if (!store.indexNames.contains('brandName')) {
    store.createIndex('brandName', 'brandName', { unique: false });
  }
  if (!store.indexNames.contains('saltName')) {
    store.createIndex('saltName', 'saltName', { unique: false });
  }
  // optional: index on dosageForm later if needed
  console.log('Database setup / upgrade complete');
};

openRequest.onsuccess = (event) => {
  db = event.target.result;
  console.log('Database opened successfully');
  loadMedicines(); // show all
};

// ---------- DOM refs ----------
const addMedicineFormEl = document.getElementById('addMedicineForm');
const loadingEl = document.getElementById('loading');
const medicineListEl = document.getElementById('medicineList');
const noResultsEl = document.getElementById('noResults');
const searchInputEl = document.getElementById('searchInput');

// form fields
const dosageFormEl = document.getElementById('dosageForm');
const qtyWrapperEl = document.getElementById('qtyWrapper');
const qtyLabelEl = document.getElementById('qtyLabel');
const qtyInputEl = document.getElementById('quantityInput');

// ---------- Helpers ----------
function show(el){ if(el) el.classList.remove('hidden'); }
function hide(el){ if(el) el.classList.add('hidden'); }

// ---------- DosageForm change -> show quantity field ----------
dosageFormEl.addEventListener('change', () => {
  const val = dosageFormEl.value;
  if (!val) {
    hide(qtyWrapperEl);
    qtyInputEl.value = '';
    return;
  }
  // show wrapper
  show(qtyWrapperEl);

  if (val === 'tablet') {
    qtyLabelEl.textContent = 'No. of tablets';
    qtyInputEl.placeholder = 'e.g., 10';
    qtyInputEl.step = 1;
  } else {
    qtyLabelEl.textContent = 'Volume (ml)';
    qtyInputEl.placeholder = 'e.g., 5';
    qtyInputEl.step = 'any';
  }
});

// ---------- Admin Form Toggle ----------
document.getElementById('openFormBtn').addEventListener('click', () => {
  const password = prompt('Enter password to add medicine:');
  if (password === 'shubhanshu') {
    show(addMedicineFormEl);
  } else {
    alert('Incorrect password!');
  }
});

// ---------- Add Medicine Submit ----------
document.getElementById('medicineForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const brandName = document.getElementById('brandName').value.trim();
  const saltName = document.getElementById('saltName').value.trim();
  const companyName = document.getElementById('companyName').value.trim();
  const dosageForm = dosageFormEl.value;
  const qtyStr = qtyInputEl.value.trim();
  const priceStr = document.getElementById('price').value.trim();

  if (!brandName || !saltName || !companyName || !dosageForm || !priceStr) {
    alert('Please fill all required fields.');
    return;
  }

  // quantity required if dosage selected
  if (!qtyStr) {
    alert('Please enter quantity.');
    return;
  }

  const price = parseFloat(priceStr);
  if (isNaN(price)) {
    alert('Price must be a number.');
    return;
  }

  const quantity = dosageForm === 'tablet'
    ? parseInt(qtyStr, 10)
    : parseFloat(qtyStr);

  if (isNaN(quantity)) {
    alert('Quantity must be a valid number.');
    return;
  }

  const unit = dosageForm === 'tablet' ? 'tablets' : 'ml';

  const tx = db.transaction([STORE_NAME], 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const medicine = {
    brandName,
    saltName,
    companyName,
    dosageForm,
    quantity,
    unit,
    price,
    createdAt: new Date().toISOString(),
  };

  const addReq = store.add(medicine);

  addReq.onsuccess = () => {
    console.log('Medicine added');
    e.target.reset();
    hide(qtyWrapperEl); // hide again until new select
    loadMedicines(searchInputEl.value); // reload keeping filter
  };

  addReq.onerror = (event) => {
    console.error('Error adding medicine:', event.target.error);
    alert('Failed to add medicine. Try again.');
  };
});

// ---------- Load Medicines (with optional search) ----------
function loadMedicines(searchTerm = '') {
  if (loadingEl) show(loadingEl);
  medicineListEl.innerHTML = '';
  hide(noResultsEl);

  const term = searchTerm.trim().toLowerCase();

  const tx = db.transaction([STORE_NAME], 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const req = store.openCursor();

  let hasResults = false;

  req.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      const med = cursor.value;
      const id = cursor.key;

      const matches =
        term === '' ||
        med.brandName.toLowerCase().includes(term) ||
        med.saltName.toLowerCase().includes(term) ||
        (med.dosageForm && med.dosageForm.toLowerCase().includes(term));

      if (matches) {
        hasResults = true;
        medicineListEl.appendChild(renderMedicineCard({ ...med, id }));
      }
      cursor.continue();
    } else {
      if (loadingEl) hide(loadingEl);
      if (!hasResults) show(noResultsEl);
    }
  };

  req.onerror = (event) => {
    console.error('Error loading medicines:', event.target.error);
    if (loadingEl) hide(loadingEl);
    show(noResultsEl);
  };
}

// ---------- Render Card ----------
function renderMedicineCard(med) {
  const card = document.createElement('div');
  card.className =
    'medicine-card bg-white border border-gray-200 rounded-lg p-4 relative';

  const created = med.createdAt
    ? new Date(med.createdAt).toLocaleDateString()
    : '';

  const qtyText =
    med.dosageForm === 'tablet'
      ? `${med.quantity} ${med.unit}`
      : `${med.quantity}${med.unit ? ' ' + med.unit : ''}`;

  card.innerHTML = `
    <div class="absolute top-2 right-2 text-xs text-gray-600">Added: ${created}</div>
    <h3 class="text-lg font-semibold text-gray-800 mb-1">${med.brandName}</h3>
    <p class="text-sm text-gray-600 mb-1"><strong>Salt:</strong> ${med.saltName}</p>
    <p class="text-sm text-gray-600 mb-1"><strong>Company:</strong> ${med.companyName || 'N/A'}</p>
    <p class="text-sm text-gray-600 mb-1"><strong>Form:</strong> ${med.dosageForm}</p>
    <p class="text-sm text-gray-600 mb-1"><strong>Qty:</strong> ${qtyText}</p>
    <p class="text-sm font-medium text-gray-800"><strong>Price:</strong> ₹${med.price}</p>
    <div class="flex justify-end mt-2">
      <button
        data-id="${med.id}"
        class="text-red-500 hover:text-red-700 text-sm delete-btn">
        Delete
      </button>
    </div>
  `;

  card.querySelector('.delete-btn').addEventListener('click', () => {
    deleteMedicine(med.id);
  });

  return card;
}

// ---------- Delete ----------
function deleteMedicine(id) {
  if (!confirm('Are you sure you want to delete this medicine?')) return;

  const tx = db.transaction([STORE_NAME], 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const delReq = store.delete(id);

  delReq.onsuccess = () => {
    console.log('Medicine deleted');
    loadMedicines(searchInputEl.value);
  };

  delReq.onerror = (event) => {
    console.error('Error deleting medicine:', event.target.error);
    alert('Failed to delete medicine. Try again.');
  };
}
window.deleteMedicine = deleteMedicine; // optional global

// ---------- Search ----------
searchInputEl.addEventListener('input', (e) => {
  loadMedicines(e.target.value);
});
document.getElementById('clearBtn').addEventListener('click', () => {
  searchInputEl.value = '';
  loadMedicines();
});

