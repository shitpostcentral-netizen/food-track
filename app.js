import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, doc, query, orderBy, onSnapshot } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDp4HDIZxNq9_mibAryJdF839LDofOZyzg",
  authDomain: "food-diary-7293d.firebaseapp.com",
  projectId: "food-diary-7293d",
  storageBucket: "food-diary-7293d.firebasestorage.app",
  messagingSenderId: "745034715166",
  appId: "1:745034715166:web:cab03295882e17cc3b1e0f",
  measurementId: "G-G354M9TDBV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// State
let allLogs = [];
let currentView = 'day'; // 'day', 'week', 'month'

// DOM Elements
const form = document.getElementById('foodForm');
const formBox = document.getElementById('logForm');
const toggleBtn = document.getElementById('toggleFormBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// --- EVENT LISTENERS ---

// 1. Toggle Form
toggleBtn.addEventListener('click', () => {
    resetForm();
    formBox.classList.toggle('hidden');
    toggleBtn.textContent = formBox.classList.contains('hidden') ? '+ Log Food' : 'Close';
});

// 2. Filter Buttons (Day/Week/Month)
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Update UI classes
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        // Update Logic
        currentView = e.target.dataset.view;
        calculateStats(allLogs);
    });
});

// 3. Handle Submit (Create OR Update)
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const editId = document.getElementById('editId').value;
    const dateVal = document.getElementById('logDate').value; // Get datetime-local value
    
    const entry = {
        name: document.getElementById('foodName').value,
        cals: Number(document.getElementById('cals').value),
        protein: Number(document.getElementById('prot').value),
        carbs: Number(document.getElementById('carb').value),
        fat: Number(document.getElementById('fat').value),
        img: document.getElementById('imgUrl').value || 'https://placehold.co/400x300?text=No+Image',
        // Convert input string to actual Date object
        date: new Date(dateVal) 
    };

    try {
        if (editId) {
            // UPDATE existing
            const docRef = doc(db, "logs", editId);
            await updateDoc(docRef, entry);
            alert("Updated successfully!");
        } else {
            // CREATE new
            await addDoc(collection(db, "logs"), entry);
            alert("Logged successfully!");
        }
        
        resetForm();
        formBox.classList.add('hidden');
        toggleBtn.textContent = '+ Log Food';
    } catch (err) {
        console.error("Error:", err);
        alert("Error saving data");
    }
});

// 4. Cancel Edit
cancelEditBtn.addEventListener('click', () => {
    resetForm();
    formBox.classList.add('hidden');
});

// --- REAL-TIME LISTENER ---

const q = query(collection(db, "logs"), orderBy("date", "desc"));

onSnapshot(q, (snapshot) => {
    // 1. Convert docs to easy objects
    allLogs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        jsDate: doc.data().date.toDate() // Helper for easy date math
    }));

    renderFeed(allLogs);
    renderCalendar(allLogs);
    calculateStats(allLogs);
});

// --- FUNCTIONS ---

function calculateStats(data) {
    const now = new Date();
    let filtered = [];
    let title = "";

    // Filter Logic
    if (currentView === 'day') {
        title = "Today's Totals";
        filtered = data.filter(item => isSameDay(item.jsDate, now));
    } else if (currentView === 'week') {
        title = "This Week's Totals";
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        filtered = data.filter(item => item.jsDate >= oneWeekAgo);
    } else if (currentView === 'month') {
        title = "This Month's Totals";
        filtered = data.filter(item => 
            item.jsDate.getMonth() === now.getMonth() && 
            item.jsDate.getFullYear() === now.getFullYear()
        );
    }

    // Calculations
    let totalCals = 0;
    let totalProt = 0;
    const uniqueDays = new Set(filtered.map(i => i.jsDate.toDateString())).size || 1;

    filtered.forEach(item => {
        totalCals += item.cals;
        totalProt += item.protein;
    });

    // Update UI
    document.getElementById('statTitle').innerText = title;
    document.getElementById('displayCals').innerText = totalCals.toLocaleString();
    document.getElementById('displayProt').innerText = totalProt.toLocaleString();
    
    // Averages
    document.getElementById('displayAvgCals').innerText = Math.round(totalCals / uniqueDays);
    document.getElementById('displayAvgProt').innerText = Math.round(totalProt / uniqueDays);
}

// Replace the old renderCalendar with this:
function renderCalendar(data) {
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0 = Jan, 1 = Feb...

    // 1. Add Header Row (S M T W T F S)
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    days.forEach(d => {
        const header = document.createElement('div');
        header.style.fontWeight = 'bold';
        header.style.textAlign = 'center';
        header.style.color = '#888';
        header.style.fontSize = '0.8rem';
        header.innerText = d;
        grid.appendChild(header);
    });

    // 2. Calculate padding
    // new Date(year, month, 1).getDay() gives us the weekday of the 1st (0=Sun, 1=Mon...)
    const firstDayIndex = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 3. Totals Map
    const dailyTotals = {};
    data.forEach(item => {
        const dateKey = item.jsDate.toDateString();
        if (!dailyTotals[dateKey]) dailyTotals[dateKey] = 0;
        dailyTotals[dateKey] += item.cals;
    });

    // 4. Create Empty Placeholders (for days before the 1st)
    for (let i = 0; i < firstDayIndex; i++) {
        const empty = document.createElement('div');
        grid.appendChild(empty);
    }

    // 5. Create Actual Days
    for (let i = 1; i <= daysInMonth; i++) {
        const thisDate = new Date(year, month, i);
        const dateKey = thisDate.toDateString();
        const total = dailyTotals[dateKey] || 0;
        const isToday = thisDate.toDateString() === today.toDateString();

        const cell = document.createElement('div');
        // Add specific class if it's today
        cell.className = total > 0 ? 'cal-day has-data' : 'cal-day';
        if (isToday) cell.style.border = "2px solid var(--accent)";

        cell.innerHTML = `
            <span class="cal-date">${i}</span>
            ${total > 0 ? `<div class="cal-total">${total}</div>` : ''}
        `;
        grid.appendChild(cell);
    }
}

function renderFeed(data) {
    const feed = document.getElementById('feed');
    feed.innerHTML = '';

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'food-card';
        card.innerHTML = `
            <img src="${item.img}" class="food-img" alt="food">
            <div class="food-info">
                <strong>${item.name}</strong>
                <div class="macros">
                    <span>${item.cals} kcal</span>
                    <span>P: ${item.protein}g</span>
                </div>
                <div style="font-size: 0.7em; color: #999; margin-top:5px;">
                    ${item.jsDate.toLocaleDateString()} ${item.jsDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                </div>
                <button class="edit-btn" onclick="triggerEdit('${item.id}')">Edit</button>
            </div>
        `;
        feed.appendChild(card);
    });
}

// Global function for Edit button (needs window scope)
// Replace the old window.triggerEdit with this:
window.triggerEdit = (id) => {
    const item = allLogs.find(log => log.id === id);
    if (!item) return;

    // Fill Form
    document.getElementById('editId').value = item.id;
    document.getElementById('foodName').value = item.name;
    document.getElementById('cals').value = item.cals;
    document.getElementById('prot').value = item.protein;
    document.getElementById('carb').value = item.carbs;
    document.getElementById('fat').value = item.fat;
    document.getElementById('imgUrl').value = item.img;
    
    // --- THE FIX ---
    // 1. Get the raw date object
    const date = item.jsDate;
    // 2. Adjust for your local timezone offset (in minutes)
    // This creates a "fake" date that looks right when converted to ISO string
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    // 3. Cut off the seconds/milliseconds
    document.getElementById('logDate').value = localDate.toISOString().slice(0, 16); 

    // UI Changes
    document.getElementById('formTitle').innerText = "Edit Entry";
    document.getElementById('saveBtn').innerText = "Update Entry";
    document.getElementById('cancelEditBtn').classList.remove('hidden');
    formBox.classList.remove('hidden');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function resetForm() {
    form.reset();
    document.getElementById('editId').value = "";
    document.getElementById('formTitle').innerText = "Add Entry";
    document.getElementById('saveBtn').innerText = "Save Entry";
    document.getElementById('cancelEditBtn').classList.add('hidden');
    
    // Default Date to Now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('logDate').value = now.toISOString().slice(0,16);
}

function isSameDay(d1, d2) {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();

}
