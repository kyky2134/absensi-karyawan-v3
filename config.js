const SUPABASE_URL = "ISI_PROJECT_URL";
const SUPABASE_KEY = "ISI_PUBLISHABLE_KEY";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
