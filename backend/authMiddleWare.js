import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function AuthenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "No token provided" });

  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data.user)
    return res.status(401).json({ error: "Invalid or expired token" });

  req.user = data.user;
  next();
}
