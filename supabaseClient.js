import { createClient } from "https://esm.sh/@supabase/supabase-js";

export const supabase = createClient(
  "https://vzrqjuzwifsigdpbghvh.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnFqdXp3aWZzaWdkcGJnaHZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxODc3NzcsImV4cCI6MjA4MDc2Mzc3N30.sCpcxv_uH6BrF5y6fhL1IO4Xw_mk249hYTVXy-Rby-g"
);