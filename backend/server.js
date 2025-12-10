import express from 'express';
import bodyParser from 'body-parser';
import { supabase } from './supabaseServer.js'; 
import { AuthenticateToken } from './authMiddleWare.js';
import cors from 'cors';

const app = express();
app.use(bodyParser.json());

// Updated CORS configuration to allow requests from Vite dev server
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Save player score
app.post('/score', AuthenticateToken, async (req, res) => {
  const user_id = req.user?.id;
  const { score } = req.body;

  const { data, error } = await supabase
    .from('scores')
    .insert([{ user_id, score }]);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ data });
});

// Get player high score
app.get('/profile', AuthenticateToken, async (req, res) => {
  const user_id = req.user?.id;

  if (!user_id) return res.status(401).json({ error: 'Unauthorized' });

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select(`username`)
    .eq('user_id', user_id)
    .single();

  if (profileError) return res.status(400).json({ error: profileError.message });

  const username = profileData.username || 'Unknown';

  const { data: scoreData, error: scoreError } = await supabase
    .from('scores')
    .select('score')
    .eq('user_id', user_id)
    .order('score', { ascending: false })
    .limit(1);

  if (scoreError) return res.status(400).json({ error: scoreError.message });

  const highscore = scoreData[0]?.score || 0;

  res.json({ username, highscore });
});

// Get top 10 leaderboard
app.get('/leaderboard', AuthenticateToken, async (req, res) => {
  // Get highest score per user
  const { data: scoreData, error: scoreError } = await supabase
    .from('scores')
    .select('user_id, score')
    .order('score', { ascending: false });

  if (scoreError) return res.status(400).json({ error: scoreError.message });

  // Create a map to store each player's highest score
  const highestScores = {};
  scoreData.forEach(s => {
    if (!highestScores[s.user_id] || s.score > highestScores[s.user_id]) {
      highestScores[s.user_id] = s.score;
    }
  });

  const userIds = Object.keys(highestScores);

  // Get usernames for these user_ids
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, username')
    .in('user_id', userIds);

  if (profileError) return res.status(400).json({ error: profileError.message });

  // Combine username and highest score
  const leaderboard = userIds.map((uid) => {
    const profile = profileData.find(p => p.user_id === uid);
    return { 
      username: profile ? profile.username : 'Unknown', 
      score: highestScores[uid] 
    };
  });

  // Sort by score descending and limit to top 10
  leaderboard.sort((a, b) => b.score - a.score);
  res.json(leaderboard.slice(0, 10));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));