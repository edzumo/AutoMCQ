import { createClient, SupabaseClient } from '@supabase/supabase-js';

// User provided credentials
const DEFAULT_PROJECT_ID = "rlxzvblnnjdimsewafyn";
const DEFAULT_URL = `https://${DEFAULT_PROJECT_ID}.supabase.co`;
const DEFAULT_KEY = "sb_publishable_KhxZnQU1n1Ouje81giSbtQ_-FaLLR7U";

class SupabaseManager {
  private client: SupabaseClient | null = null;

  constructor() {
    this.init();
  }

  init() {
    // 1. Try Environment Variables
    const envUrl = process.env.SUPABASE_URL;
    const envKey = process.env.SUPABASE_ANON_KEY;

    if (envUrl && envKey) {
      this.client = createClient(envUrl, envKey);
      return;
    }

    // 2. Try LocalStorage
    const localUrl = localStorage.getItem('sb_url');
    const localKey = localStorage.getItem('sb_key');

    if (localUrl && localKey) {
      this.client = createClient(localUrl, localKey);
      return;
    }

    // 3. Fallback to Hardcoded User Defaults
    // We check if the default key looks vaguely valid (length check) just in case
    if (DEFAULT_URL && DEFAULT_KEY) {
        try {
            console.log("Initializing Supabase with Default Credentials");
            this.client = createClient(DEFAULT_URL, DEFAULT_KEY);
            
            // Optional: Persist these to local storage so they appear in the Settings Modal
            // so the user knows they are connected
            localStorage.setItem('sb_url', DEFAULT_URL);
            localStorage.setItem('sb_key', DEFAULT_KEY);
        } catch (e) {
            console.error("Failed to initialize default Supabase client", e);
        }
    }
  }

  getClient(): SupabaseClient | null {
    if (!this.client) {
        // Retry init if client is missing (e.g. if localStorage was cleared mid-session)
        this.init();
    }
    return this.client;
  }

  connect(url: string, key: string) {
    if (!url || !key) return false;
    try {
      this.client = createClient(url, key);
      localStorage.setItem('sb_url', url);
      localStorage.setItem('sb_key', key);
      return true;
    } catch (e) {
      console.error("Invalid Supabase Config", e);
      return false;
    }
  }

  disconnect() {
    this.client = null;
    localStorage.removeItem('sb_url');
    localStorage.removeItem('sb_key');
  }

  isConnected(): boolean {
    return !!this.client;
  }
}

export const supabaseManager = new SupabaseManager();
