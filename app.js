// Import Firebase functions from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, limit } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- PASTE YOUR FIREBASE CONFIG HERE ---
const firebaseConfig = {
  apiKey: "AIzaSyDp4HDIZxNq9_mibAryJdF839LDofOZyzg",
  authDomain: "food-diary-7293d.firebaseapp.com",
  projectId: "food-diary-7293d",
  storageBucket: "food-diary-7293d.firebasestorage.app",
  messagingSenderId: "745034715166",
  appId: "1:745034715166:web:cab03295882e17cc3b1e0f",
  measurementId: "G-G354M9TDBV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global Chart Instances
let lineChartInstance = null;
let doughnutChartInstance = null;

// Toggle Form Visibility
const toggleBtn = document.getElementById('toggleFormBtn');
const formBox = document.getElementById('logForm');
toggleBtn.addEventListener('click', () => {
    formBox.classList.toggle('hidden');
    toggleBtn.textContent = formBox.classList.contains('hidden') ? '+ Log Food' : 'Close';
});

// Handle Form Submission
document.getElementById('foodForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const entry = {
        name: document.getElementById('foodName').value,
        cals: Number(document.getElementById('cals').value),
        protein: Number(document.getElementById('prot').value),
        carbs: Number(document.getElementById('carb').value),
        fat: Number(document.getElementById('fat').value),
        img: document.getElementById('imgUrl').value || 'https://placehold.co/400x300?text=No+Image', // Default placeholder
        date: new Date()
    };

    try {
        await addDoc(collection(db, "logs"), entry);
        alert('Food logged!');
        document.getElementById('foodForm').reset();
        formBox.classList.add('hidden');
    } catch (err) {
        console.error("Error adding document: ", err);
    }
});

// Real-time Data Listener
const q = query(collection(db, "logs"), orderBy("date", "desc"), limit(50));

onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateDashboard(data);
    renderFeed(data);
});

// --- CORE FUNCTIONS ---

function updateDashboard(data) {
    // 1. Calculate Today's Totals
    const today = new Date().toDateString();
    let todayCals = 0;
    let todayProt = 0;
    let totalProt = 0, totalCarb = 0, totalFat = 0;

    data.forEach(item => {
        // Convert Firestore timestamp to JS Date
        const itemDate = item.date.toDate().toDateString();
        
        // Sum macros for charts
        totalProt += item.protein;
        totalCarb += item.carbs;
        totalFat += item.fat;

        // Sum for Today's display
        if (itemDate === today) {
            todayCals += item.cals;
            todayProt += item.protein;
        }
    });

    document.getElementById('displayCals').innerText = todayCals;
    document.getElementById('displayProt').innerText = todayProt;

    // 2. Render Charts
    renderLineChart(data);
    renderDoughnut(totalProt, totalCarb, totalFat);
    renderHeatmap(data);
}

function renderFeed(data) {
    const feed = document.getElementById('feed');
    feed.innerHTML = ''; // Clear current feed

    data.forEach(item => {
        const dateObj = item.date.toDate();
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
                    ${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
            </div>
        `;
        feed.appendChild(card);
    });
}

// --- CHART LOGIC ---

function renderLineChart(data) {
    const ctx = document.getElementById('lineChart').getContext('2d');
    
    // Reverse data to show oldest to newest left-to-right
    const chartData = [...data].reverse(); 
    
    const labels = chartData.map(d => d.date.toDate().toLocaleDateString());
    const cals = chartData.map(d => d.cals);

    if (lineChartInstance) lineChartInstance.destroy();

    lineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Calories',
                data: cals,
                borderColor: '#4f46e5',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(79, 70, 229, 0.1)'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderDoughnut(p, c, f) {
    const ctx = document.getElementById('doughnutChart').getContext('2d');
    
    if (doughnutChartInstance) doughnutChartInstance.destroy();

    doughnutChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Protein', 'Carbs', 'Fat'],
            datasets: [{
                data: [p, c, f],
                backgroundColor: ['#36A2EB', '#FF6384', '#FFCE56']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderHeatmap(data) {
    const container = document.getElementById('heatmap');
    container.innerHTML = '';
    
    // Create 30 boxes
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toDateString();
        
        const box = document.createElement('div');
        box.className = 'heat-day';
        
        // Check if we logged food on this date
        const hasLog = data.some(item => item.date.toDate().toDateString() === dateStr);
        if (hasLog) box.classList.add('heat-active');
        
        box.title = dateStr; // Hover tooltip
        container.appendChild(box);
    }
}