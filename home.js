// home.js
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  'https://vzrqjuzwifsigdpbghvh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnFqdXp3aWZzaWdkcGJnaHZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxODc3NzcsImV4cCI6MjA4MDc2Mzc3N30.sCpcxv_uH6BrF5y6fhL1IO4Xw_mk249hYTVXy-Rby-g'
);

// Backend API URL 
const API_URL = 'https://ite18-final-project-production-bb3c.up.railway.app';

// Helper function to get the current session token
async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}

// Helper function for authenticated fetch
async function authFetch(url, options = {}) {
  const token = await getAuthToken();
  
  if (!token) {
    console.error('No auth token found, redirecting to login');
    window.location.href = 'login.html';
    return;
  }
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  try {
    const response = await fetch(url, { 
      ...options, 
      headers,
      credentials: 'include' // Add this for CORS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

// Fetch profile data
async function loadProfile() {
  try {
    const data = await authFetch(`${API_URL}/profile`); // FIXED: Using API_URL
    document.getElementById('username').textContent = data.username;
    document.getElementById('highscore').textContent = data.highscore;
  } catch (error) {
    console.error('Error fetching profile data:', error);
    document.getElementById('username').textContent = 'Error loading';
    document.getElementById('highscore').textContent = 'Error';
  }
}

// Fetch leaderboard data
async function loadLeaderboard() {
  try {
    const data = await authFetch(`${API_URL}/leaderboard`); // FIXED: Using API_URL
    const leaderboardList = document.getElementById('leaderboard');
    leaderboardList.innerHTML = '';
    
    if (data.length === 0) {
      leaderboardList.innerHTML = '<li>No scores yet!</li>';
      return;
    }
    
    data.forEach((entry, index) => {
      const listItem = document.createElement('li');
      listItem.textContent = `${index + 1}. ${entry.username} — ${entry.score}`;
      leaderboardList.appendChild(listItem);
    });
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    document.getElementById('leaderboard').innerHTML = '<li>Error loading leaderboard</li>';
  }
}

// Check if user is logged in when page loads
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    window.location.href = 'login.html';
    return;
  }
  
  // Load data if authenticated
  loadProfile();
  loadLeaderboard();
}

// Logout functionality
document.getElementById('logoutBtn').onclick = async () => {
  try {
    await supabase.auth.signOut();
    localStorage.removeItem('token');
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Error logging out:', error);
    window.location.href = 'login.html';
  }
};

// Run on page load
checkAuth();