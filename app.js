import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, doc, query, orderBy, onSnapshot } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- PASTE YOUR API KEYS HERE ---
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

// --- ADMIN CHECK ---
const urlParams = new URLSearchParams(window.location.search);
const isAdmin = urlParams.get('mode') === 'admin';
if (!isAdmin) {
    document.body.classList.add('read-only');
    console.log("View Mode");
} else {
    console.log("Admin Mode");
}

// --- STATE ---
let allLogs = [];
let currentView = 'day'; 
let viewDate = new Date();
let selectedFilterDate = new Date();
let weightChartInstance = null;

// CONSTANTS
const BASE_BMR = 1950; 
const KCAL_PER_STEP = 0.04; 

// DOM ELEMENTS
const foodForm = document.getElementById('foodForm');
const metricForm = document.getElementById('bodyForm'); // The <form> tag
const foodBox = document.getElementById('logForm');     // The container div
const metricBox = document.getElementById('metricForm');// The container div

// --- EVENT LISTENERS ---

// 1. Navigation & Toggles
document.getElementById('toggleFormBtn').addEventListener('click', () => {
    resetForms();
    foodBox.classList.toggle('hidden');
    metricBox.classList.add('hidden'); // Close the other one
});

document.getElementById('toggleMetricBtn').addEventListener('click', () => {
    resetForms();
    metricBox.classList.toggle('hidden');
    foodBox.classList.add('hidden'); // Close the other one
    // Default metric date to today
    document.getElementById('metricDate').valueAsDate = new Date();
});

document.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        foodBox.classList.add('hidden');
        metricBox.classList.add('hidden');
    });
});

// 2. Calendar Nav
document.getElementById('prevMonth').addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    renderCalendar(allLogs);
});
document.getElementById('nextMonth').addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    renderCalendar(allLogs);
});

// 3. Filter Buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentView = e.target.dataset.view;
        if (currentView === 'day') selectedFilterDate = new Date();
        calculateStats(allLogs);
    });
});

// 4. SUBMIT FOOD
foodForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('editId').value;
    const entry = {
        type: 'food',
        name: document.getElementById('foodName').value,
        cals: Number(document.getElementById('cals').value),
        protein: Number(document.getElementById('prot').value),
        carbs: Number(document.getElementById('carb').value),
        fat: Number(document.getElementById('fat').value),
        img: document.getElementById('imgUrl').value || 'https://placehold.co/400x300?text=No+Image',
        date: new Date(document.getElementById('logDate').value)
    };

    try {
        if (editId) await updateDoc(doc(db, "logs", editId), entry);
        else await addDoc(collection(db, "logs"), entry);
        foodBox.classList.add('hidden');
    } catch (err) { console.error(err); }
});

// 5. SUBMIT METRICS (Steps/Weight)
metricForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('metricEditId').value;
    
    const dateInput = document.getElementById('metricDate').value; 
    const dateObj = new Date(dateInput + 'T12:00:00');

    const entry = {
        type: 'metric',
        weight: Number(document.getElementById('bodyWeight').value) || 0,
        steps: Number(document.getElementById('dailySteps').value) || 0,
        date: dateObj
    };

    try {
        if (editId) await updateDoc(doc(db, "logs", editId), entry);
        else await addDoc(collection(db, "logs"), entry);
        metricBox.classList.add('hidden');
    } catch (err) { console.error(err); }
});

// --- DATA LISTENER ---
const q = query(collection(db, "logs"), orderBy("date", "desc"));
onSnapshot(q, (snapshot) => {
    allLogs = snapshot.docs.map(doc => ({ 
        id: doc.id, ...doc.data(), jsDate: doc.data().date.toDate() 
    }));
    
    // Handle legacy data
    allLogs.forEach(log => {
        if (!log.type) log.type = 'food';
    });

    renderFeed(allLogs);
    renderCalendar(allLogs);
    calculateStats(allLogs);
});

// --- CORE FUNCTIONS ---

function calculateStats(data) {
    const now = new Date();
    let filtered = [];
    let title = "";
    let isDayView = false;
    let daysSinceStart = 1;

    // 1. DETERMINE TRACKING DURATION
    if (data.length > 0) {
        const firstDate = data[data.length - 1].jsDate;
        const diff = Math.abs(now - firstDate);
        daysSinceStart = Math.ceil(diff / (1000 * 60 * 60 * 24)) || 1;
    }

    let daysInPeriod = 1;

    // 2. FILTERING LOGIC
    if (currentView === 'day') {
        title = selectedFilterDate.toDateString();
        filtered = data.filter(item => isSameDay(item.jsDate, selectedFilterDate));
        isDayView = true;
        daysInPeriod = 1;
    } else if (currentView === 'week') {
        title = "This Week";
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        filtered = data.filter(item => item.jsDate >= oneWeekAgo);
        daysInPeriod = Math.min(7, daysSinceStart);
    } else if (currentView === 'month') {
        title = "This Month";
        filtered = data.filter(item => 
            item.jsDate.getMonth() === now.getMonth() && 
            item.jsDate.getFullYear() === now.getFullYear()
        );
        daysInPeriod = Math.min(now.getDate(), daysSinceStart);
    } else if (currentView === 'all') {
        title = "All Time";
        filtered = data;
        daysInPeriod = daysSinceStart;
    }

    // 3. SEPARATE LOGS
    const foodLogs = filtered.filter(l => l.type === 'food');
    const metricLogs = filtered.filter(l => l.type === 'metric');

    // 4. CALCULATE FOOD TOTALS
    let totalCals = 0, totalProt = 0;
    foodLogs.forEach(f => { totalCals += f.cals; totalProt += f.protein; });
    
    const uniqueDays = new Set(foodLogs.map(i => i.jsDate.toDateString())).size || 1;

    // 5. CALCULATE METRICS (Weight & Steps)
    let totalStepsForDisplay = 0;
    let latestWeight = null;
    let daysWithStepsCount = 0;
    let totalBurnFromSteps = 0;
    
    // We use a Set to ensure we don't double-count the same day if you edited it
    const daysWithStepLogs = new Set();

    metricLogs.forEach(m => {
        // Handle Weight
        if (m.weight > 0 && !latestWeight) latestWeight = m.weight; 
        
        // Handle Steps
        const dateKey = m.jsDate.toDateString();
        if (m.steps > 0) {
            totalStepsForDisplay += m.steps;
            
            // If this is the first time seeing this day in this loop, calculate its burn
            if (!daysWithStepLogs.has(dateKey)) {
                daysWithStepLogs.add(dateKey);
                // Specific Burn for this day: 1950 + (Steps * 0.04)
                totalBurnFromSteps += (BASE_BMR + (m.steps * KCAL_PER_STEP));
            }
        }
    });

    daysWithStepsCount = daysWithStepLogs.size;

    // 6. HYBRID MAINTENANCE CALCULATION (The Fix)
    // Days WITH steps use the specific calculated burn.
    // Days WITHOUT steps use the default 2460.
    const defaultDaysCount = Math.max(0, daysInPeriod - daysWithStepsCount);
    
    // Total Maintenance = (Burn from Step Days) + (Default 2460 * Empty Days)
    const totalMaintenance = totalBurnFromSteps + (defaultDaysCount * 2460);
    
    // Calculate Deficit
    const deficit = totalMaintenance - totalCals;
    const lbsChange = -(deficit / 3500);

    // 7. DISPLAY CALCULATIONS
    // Calculate "Effective Average TDEE" just for the label
    const effectiveAvgTDEE = totalMaintenance / (daysInPeriod || 1);
    
    const currentWeightDisplay = latestWeight ? latestWeight : "--";
    const avgSteps = Math.round(totalStepsForDisplay / (daysInPeriod || 1));

    // 8. UPDATE UI
    document.getElementById('statTitle').innerText = isDayView ? "Selected Day Cals" : title;
    
    // Show Daily Goal: If day view has steps, show exact burn. If not, show 2460.
    if (isDayView && daysWithStepsCount > 0) {
        document.getElementById('calGoalDisplay').innerText = `Est. Burn: ${Math.round(totalMaintenance)}`;
    } else if (isDayView) {
        document.getElementById('calGoalDisplay').innerText = `Goal: 2460`;
    } else {
        document.getElementById('calGoalDisplay').innerText = `Avg Burn: ${Math.round(effectiveAvgTDEE)}`;
    }

    document.getElementById('displayCals').innerText = totalCals.toLocaleString();
    document.getElementById('displayProt').innerText = totalProt.toLocaleString();
    document.getElementById('displayAvgProt').innerText = Math.round(totalProt / (uniqueDays || 1));
    
    document.getElementById('displaySteps').innerText = isDayView ? totalStepsForDisplay.toLocaleString() : avgSteps.toLocaleString();
    document.getElementById('displayWeight').innerText = currentWeightDisplay;

    const weightEl = document.getElementById('displayWeightChange');
    const sign = lbsChange > 0 ? "+" : "";
    weightEl.innerText = `${sign}${lbsChange.toFixed(2)} lbs`;
    weightEl.style.color = lbsChange > 0 ? "#ef4444" : "#059669";
    
    // Update the small text below weight change
    document.getElementById('tdeeDisplay').innerText = `based on ~${Math.round(effectiveAvgTDEE)} TDEE`;

    renderFeed(filtered);
}

function renderCalendar(data) {
    const grid = document.getElementById('calendarGrid');
    const monthLabel = document.getElementById('calMonthName');
    grid.innerHTML = '';

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthLabel.innerText = `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
        const h = document.createElement('div');
        h.style.textAlign='center'; h.style.color='#888'; h.innerText=d;
        grid.appendChild(h);
    });

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dailyData = {};
    data.forEach(item => {
        const key = item.jsDate.toDateString();
        if (!dailyData[key]) dailyData[key] = { cals:0, prot:0, steps:0, hasWeight:false };
        
        if (item.type === 'food') {
            dailyData[key].cals += item.cals;
            dailyData[key].prot += item.protein;
        } else if (item.type === 'metric') {
            dailyData[key].steps += (item.steps || 0);
            if (item.weight > 0) dailyData[key].hasWeight = true;
        }
    });

    for (let i=0; i<firstDayIndex; i++) grid.appendChild(document.createElement('div'));

    for (let i=1; i<=daysInMonth; i++) {
        const thisDate = new Date(year, month, i);
        const key = thisDate.toDateString();
        const d = dailyData[key] || { cals:0, prot:0, steps:0 };
        
        const cell = document.createElement('div');
        cell.className = (d.cals > 0 || d.steps > 0) ? 'cal-day has-data' : 'cal-day';
        if (currentView === 'day' && isSameDay(thisDate, selectedFilterDate)) cell.classList.add('selected-day');

        let html = `<span class="cal-date">${i}</span>`;
        if (d.cals > 0) html += `<div class="cal-total">${d.cals}</div><div class="cal-sub">P:${d.prot}g</div>`;
        if (d.steps > 0) html += `<div class="cal-steps">👟${(d.steps/1000).toFixed(1)}k</div>`;
        else if (d.hasWeight) html += `<div class="cal-steps">⚖️ Logged</div>`;
        
        cell.innerHTML = html;
        cell.addEventListener('click', () => {
            selectedFilterDate = thisDate;
            currentView = 'day';
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('dayFilterBtn').classList.add('active');
            calculateStats(allLogs);
            renderCalendar(allLogs);
        });
        grid.appendChild(cell);
    }
}

function renderFeed(data) {
    const feed = document.getElementById('feed');
    feed.innerHTML = '';
    
    data.forEach(item => {
        const card = document.createElement('div');
        
        if (item.type === 'food') {
            card.className = 'food-card';
            card.innerHTML = `
                <img src="${item.img}" class="food-img" alt="food">
                <div class="food-info">
                    <strong>${item.name}</strong>
                    <div class="macros">
                        <span>${item.cals} kcal</span><span>P: ${item.protein}g</span>
                    </div>
                    <div style="font-size:0.7em; color:#999; margin-top:5px;">
                        ${item.jsDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                    </div>
                    <div class="action-row">
                        <button class="edit-btn" onclick="triggerEdit('${item.id}')">Edit</button>
                        <button class="relog-btn" onclick="triggerQuickAdd('${item.id}')">Add Again</button>
                    </div>
                </div>
            `;
        } else {
            card.className = 'food-card metric-card';
            card.innerHTML = `
                <div style="padding:15px; background:#f0fdf4;">
                    <div style="display:flex; justify-content:space-between;">
                        <strong>⚖️ Daily Metrics</strong>
                        <small>${item.jsDate.toLocaleDateString()}</small>
                    </div>
                    <div style="margin-top:10px; display:flex; gap:15px;">
                        <div>
                            <span style="font-size:1.2rem; font-weight:bold; color:#059669;">${item.weight || '--'}</span> <small>lbs</small>
                        </div>
                        <div>
                            <span style="font-size:1.2rem; font-weight:bold; color:#0284c7;">${item.steps || 0}</span> <small>steps</small>
                        </div>
                    </div>
                    <div class="action-row">
                        <button class="edit-btn" onclick="triggerMetricEdit('${item.id}')">Edit</button>
                    </div>
                </div>
            `;
        }
        feed.appendChild(card);
    });
}

// --- GLOBAL HELPERS ---
window.triggerEdit = (id) => {
    const item = allLogs.find(l => l.id === id);
    if (!item) return;
    document.getElementById('editId').value = id;
    document.getElementById('foodName').value = item.name;
    document.getElementById('cals').value = item.cals;
    document.getElementById('prot').value = item.protein;
    document.getElementById('carb').value = item.carbs;
    document.getElementById('fat').value = item.fat;
    document.getElementById('imgUrl').value = item.img;
    const localDate = new Date(item.jsDate.getTime() - (item.jsDate.getTimezoneOffset() * 60000));
    document.getElementById('logDate').value = localDate.toISOString().slice(0, 16);
    
    foodBox.classList.remove('hidden');
    metricBox.classList.add('hidden');
    window.scrollTo({top:0, behavior:'smooth'});
};

window.triggerMetricEdit = (id) => {
    const item = allLogs.find(l => l.id === id);
    if (!item) return;
    document.getElementById('metricEditId').value = id;
    document.getElementById('metricDate').valueAsDate = item.jsDate;
    document.getElementById('bodyWeight').value = item.weight || '';
    document.getElementById('dailySteps').value = item.steps || '';
    
    metricBox.classList.remove('hidden');
    foodBox.classList.add('hidden');
    window.scrollTo({top:0, behavior:'smooth'});
};

window.triggerQuickAdd = (id) => {
    const item = allLogs.find(l => l.id === id);
    if (!item) return;
    document.getElementById('foodName').value = item.name;
    document.getElementById('cals').value = item.cals;
    document.getElementById('prot').value = item.protein;
    document.getElementById('carb').value = item.carbs;
    document.getElementById('fat').value = item.fat;
    document.getElementById('imgUrl').value = item.img;
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('logDate').value = now.toISOString().slice(0, 16);
    document.getElementById('editId').value = ""; 
    
    foodBox.classList.remove('hidden');
    metricBox.classList.add('hidden');
    window.scrollTo({top:0, behavior:'smooth'});
};

function resetForms() {
    foodForm.reset();
    metricForm.reset();
    document.getElementById('editId').value = "";
    document.getElementById('metricEditId').value = "";
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('logDate').value = now.toISOString().slice(0, 16);
}

function isSameDay(d1, d2) {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
}

// --- STATS PAGE ---
const mainDash = document.getElementById('mainDashboard');
const statsDash = document.getElementById('statsDashboard');
document.getElementById('showStatsBtn').addEventListener('click', () => {
    mainDash.classList.add('hidden');
    statsDash.classList.remove('hidden');
    updateCharts(allLogs);
});
document.getElementById('backBtn').addEventListener('click', () => {
    statsDash.classList.add('hidden');
    mainDash.classList.remove('hidden');
});

function updateCharts(data) {
    const metrics = data.filter(i => i.type === 'metric' && i.weight > 0).reverse(); 
    const dates = metrics.map(m => m.jsDate.toLocaleDateString());
    const weights = metrics.map(m => m.weight);

    const ctx = document.getElementById('weightChart').getContext('2d');
    if (weightChartInstance) weightChartInstance.destroy();
    
    weightChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Body Weight (lbs)',
                data: weights,
                borderColor: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const foodLogs = data.filter(i => i.type === 'food');
    let totalCals = 0, totalProt = 0, totalSteps = 0;
    let minWeight = 1000;
    
    data.forEach(i => {
        if(i.cals) totalCals += i.cals;
        if(i.protein) totalProt += i.protein;
        if(i.steps) totalSteps += i.steps;
        if(i.weight > 0 && i.weight < minWeight) minWeight = i.weight;
    });

    document.getElementById('lifeCals').innerText = totalCals.toLocaleString();
    document.getElementById('lifeProt').innerText = totalProt.toLocaleString();
    document.getElementById('lifeLogs').innerText = foodLogs.length;
    document.getElementById('statTotalSteps').innerText = totalSteps.toLocaleString();
    document.getElementById('statMinWeight').innerText = minWeight === 1000 ? '--' : minWeight;
}

