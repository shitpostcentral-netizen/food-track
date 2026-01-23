import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, doc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// --- STATE ---
let allLogs = [];
let currentView = 'day'; // 'day', 'week', 'month'

// Calendar State
let viewDate = new Date(); // The month currently visible on calendar
let selectedFilterDate = new Date(); // The specific day selected for stats

// YOUR STATS
const TDEE = 2460; // Maintenance Calories

// DOM ELEMENTS
const form = document.getElementById('foodForm');
const formBox = document.getElementById('logForm');
const toggleBtn = document.getElementById('toggleFormBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// --- EVENT LISTENERS ---

// 1. Calendar Navigation
document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));

function changeMonth(offset) {
    viewDate.setMonth(viewDate.getMonth() + offset);
    renderCalendar(allLogs);
}

// 2. Filter Buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentView = e.target.dataset.view;
        
        // If they click "Day View" button manually, reset to Today
        if (currentView === 'day') selectedFilterDate = new Date();
        
        calculateStats(allLogs);
    });
});

// 3. Form Handling (Create/Update)
toggleBtn.addEventListener('click', () => {
    resetForm();
    formBox.classList.toggle('hidden');
    toggleBtn.textContent = formBox.classList.contains('hidden') ? '+ Log Food' : 'Close';
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('editId').value;
    const dateVal = document.getElementById('logDate').value; 
    
    const entry = {
        name: document.getElementById('foodName').value,
        cals: Number(document.getElementById('cals').value),
        protein: Number(document.getElementById('prot').value),
        carbs: Number(document.getElementById('carb').value),
        fat: Number(document.getElementById('fat').value),
        img: document.getElementById('imgUrl').value || 'https://placehold.co/400x300?text=No+Image',
        date: new Date(dateVal) 
    };

    try {
        if (editId) {
            await updateDoc(doc(db, "logs", editId), entry);
        } else {
            await addDoc(collection(db, "logs"), entry);
        }
        resetForm();
        formBox.classList.add('hidden');
        toggleBtn.textContent = '+ Log Food';
    } catch (err) {
        console.error("Error:", err);
    }
});

// 4. Cancel Edit
cancelEditBtn.addEventListener('click', () => {
    resetForm();
    formBox.classList.add('hidden');
});

// --- REAL-TIME DATA ---
const q = query(collection(db, "logs"), orderBy("date", "desc"));

onSnapshot(q, (snapshot) => {
    allLogs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        jsDate: doc.data().date.toDate() 
    }));

    renderFeed(allLogs); // Initial render
    renderCalendar(allLogs);
    calculateStats(allLogs);
});

// --- CORE FUNCTIONS ---

function calculateStats(data) {
    const now = new Date();
    let filtered = [];
    let title = "";
    let isDayView = false;

    // 1. FILTERING LOGIC
    if (currentView === 'day') {
        title = selectedFilterDate.toDateString();
        filtered = data.filter(item => isSameDay(item.jsDate, selectedFilterDate));
        isDayView = true;
    } else if (currentView === 'week') {
        title = "This Week";
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        filtered = data.filter(item => item.jsDate >= oneWeekAgo);
    } else if (currentView === 'month') {
        title = "This Month";
        filtered = data.filter(item => 
            item.jsDate.getMonth() === now.getMonth() && 
            item.jsDate.getFullYear() === now.getFullYear()
        );
    } else if (currentView === 'all') {
        title = "All Time";
        filtered = data; // Show everything
    }

    // 2. MACRO CALCULATIONS
    let totalCals = 0;
    let totalProt = 0;
    
    // Count unique days in this filter (to calculate averages & weight correctly)
    const uniqueDaysSet = new Set(filtered.map(i => i.jsDate.toDateString()));
    const uniqueDaysCount = uniqueDaysSet.size || 1; 

    filtered.forEach(item => {
        totalCals += item.cals;
        totalProt += item.protein;
    });

    // 3. UPDATE STAT CARDS
    document.getElementById('statTitle').innerText = isDayView ? "Selected Day Cals" : title;
    document.getElementById('displayCals').innerText = totalCals.toLocaleString();
    document.getElementById('displayProt').innerText = totalProt.toLocaleString();
    document.getElementById('displayAvgProt').innerText = Math.round(totalProt / uniqueDaysCount);

    // 4. WEIGHT ESTIMATION LOGIC (UPDATED)
    const weightEl = document.getElementById('displayWeightChange');
    
    // Calculate Maintenance Cals for the days tracked (TDEE * Days Logged)
    const maintenanceCals = TDEE * uniqueDaysCount;
    
    // The Deficit = Maintenance - What you actually ate
    const deficit = maintenanceCals - totalCals;
    
    // Convert deficit to lbs (1 lb = 3500 kcal)
    // We multiply by -1 because positive weight change means GAIN (bad deficit)
    const lbsChange = -(deficit / 3500); 

    if (filtered.length > 0) {
        const sign = lbsChange > 0 ? "+" : "";
        weightEl.innerText = `${sign}${lbsChange.toFixed(2)} lbs`;
        weightEl.style.color = lbsChange > 0 ? "#ef4444" : "#059669"; // Red=Gain, Green=Loss
    } else {
        weightEl.innerText = "--";
        weightEl.style.color = "#999";
    }

    // 5. RENDER FEED
    renderFeed(filtered);
}

function renderCalendar(data) {
    const grid = document.getElementById('calendarGrid');
    const monthLabel = document.getElementById('calMonthName');
    grid.innerHTML = '';

    // 1. Update Header Month Name
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthLabel.innerText = `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

    // 2. Day Headers
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
        const header = document.createElement('div');
        header.style.textAlign = 'center';
        header.style.color = '#888';
        header.innerText = d;
        grid.appendChild(header);
    });

    // 3. Grid Logic
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 4. Totals Map
    const dailyTotals = {};
    data.forEach(item => {
        const dateKey = item.jsDate.toDateString();
        if (!dailyTotals[dateKey]) dailyTotals[dateKey] = { cals: 0, prot: 0 };
        dailyTotals[dateKey].cals += item.cals;
        dailyTotals[dateKey].prot += item.protein;
    });

    // 5. Placeholders
    for (let i = 0; i < firstDayIndex; i++) {
        grid.appendChild(document.createElement('div'));
    }

    // 6. Render Days
    for (let i = 1; i <= daysInMonth; i++) {
        const thisDate = new Date(year, month, i);
        const dateKey = thisDate.toDateString();
        const dayData = dailyTotals[dateKey] || { cals: 0, prot: 0 };
        
        const cell = document.createElement('div');
        cell.className = dayData.cals > 0 ? 'cal-day has-data' : 'cal-day';
        
        // Add "Selected" styling if this is the active day
        if (currentView === 'day' && isSameDay(thisDate, selectedFilterDate)) {
            cell.classList.add('selected-day');
        }

        cell.innerHTML = `
            <span class="cal-date">${i}</span>
            ${dayData.cals > 0 ? `
                <div class="cal-total">${dayData.cals}</div>
                <div class="cal-sub">P: ${dayData.prot}g</div>
            ` : ''}
        `;
        
        // CLICK EVENT: Filter to this day
        cell.addEventListener('click', () => {
            selectedFilterDate = thisDate;
            currentView = 'day';
            
            // Update buttons UI
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('dayFilterBtn').classList.add('active');

            calculateStats(allLogs);
            renderCalendar(allLogs); // Re-render to show selection border
        });

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

// Stats & Edit Helpers (Unchanged Logic, just ensuring global scope)
window.triggerEdit = (id) => {
    const item = allLogs.find(log => log.id === id);
    if (!item) return;
    document.getElementById('editId').value = item.id;
    document.getElementById('foodName').value = item.name;
    document.getElementById('cals').value = item.cals;
    document.getElementById('prot').value = item.protein;
    document.getElementById('carb').value = item.carbs;
    document.getElementById('fat').value = item.fat;
    document.getElementById('imgUrl').value = item.img;
    const date = item.jsDate;
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    document.getElementById('logDate').value = localDate.toISOString().slice(0, 16); 
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
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('logDate').value = now.toISOString().slice(0,16);
}

function isSameDay(d1, d2) {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
}

// Cool Stats Page Logic (Kept mostly same, added null checks)
const mainDash = document.getElementById('mainDashboard');
const statsDash = document.getElementById('statsDashboard');
const showStatsBtn = document.getElementById('showStatsBtn');
const backBtn = document.getElementById('backBtn');

showStatsBtn.addEventListener('click', () => {
    mainDash.classList.add('hidden');
    statsDash.classList.remove('hidden');
    calculateCoolStats(allLogs);
});

backBtn.addEventListener('click', () => {
    statsDash.classList.add('hidden');
    mainDash.classList.remove('hidden');
});

function calculateCoolStats(data) {
    if (data.length === 0) return;
    let totalCals = 0, totalProt = 0;
    const foodCounts = {};
    const dailySums = {};

    data.forEach(item => {
        totalCals += item.cals;
        totalProt += item.protein;
        const name = item.name.trim().toLowerCase();
        foodCounts[name] = (foodCounts[name] || 0) + 1;
        const dateKey = item.jsDate.toDateString();
        if (!dailySums[dateKey]) dailySums[dateKey] = { cals: 0, prot: 0, date: dateKey };
        dailySums[dateKey].cals += item.cals;
        dailySums[dateKey].prot += item.protein;
    });

    document.getElementById('lifeCals').innerText = totalCals.toLocaleString();
    document.getElementById('lifeProt').innerText = totalProt.toLocaleString();
    document.getElementById('lifeLogs').innerText = data.length;

    const days = Object.values(dailySums);
    days.sort((a, b) => b.cals - a.cals);
    if (days.length > 0) {
        document.getElementById('statMaxCals').innerText = days[0].cals;
        document.getElementById('statMaxCalsDate').innerText = days[0].date;
    }
    days.sort((a, b) => b.prot - a.prot);
    if (days.length > 0) document.getElementById('statMaxProt').innerText = days[0].prot;

    const sortedFoods = Object.entries(foodCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const list = document.getElementById('topFoodsList');
    list.innerHTML = '';
    sortedFoods.forEach(([name, count]) => {
        const li = document.createElement('li');
        li.style.padding = "8px 0";
        li.style.borderBottom = "1px solid #eee";
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        const displayName = name.charAt(0).toUpperCase() + name.slice(1);
        li.innerHTML = `<span>${displayName}</span> <span style="font-weight:bold; color:var(--accent);">${count}x</span>`;
        list.appendChild(li);
    });
}



